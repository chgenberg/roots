import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "@roots/db";
import {
  campaigns,
  teams,
  customerOrders,
  payouts,
  organizations,
  users,
} from "@roots/db/schema";
import { getSession, isDemoSession } from "../lib/session";
import { getInvoiceProvider } from "../lib/invoicing";
import type { SessionData } from "../lib/session";
import { getSessionId } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { redis } from "../lib/redis";

const log = childLogger("settlement");

export const settlement = new Hono();

async function requireAdmin(c: Context): Promise<SessionData | null> {
  const sessionId = getSessionId(c);
  if (!sessionId) return null;
  try {
    const session = await getSession(sessionId);
    if (
      !session ||
      (session.role !== "ASSOCIATION_ADMIN" && session.role !== "INTERNAL_ADMIN")
    ) {
      return null;
    }
    // MASTERPLAN_01 KC2.1: settlement writes real payouts (and triggers
    // Fortnox). Demo-sessions live in memory with `orgId: null` so they
    // would either crash or — worse — settle an arbitrary org. Reject.
    if (isDemoSession(session)) return null;
    return session;
  } catch {
    return null;
  }
}

settlement.post("/generate/:campaignId", async (c) => {
  const session = await requireAdmin(c);
  if (!session) return c.json({ error: "Behörighet saknas" }, 403);

  const campaignId = c.req.param("campaignId");

  // P3.48 (audit 2026-05-26): två parallella POST /generate/:campaignId
  // kunde tidigare båda passera campaign.status === 'ENDED'-checken,
  // båda upsert:a payouts och båda flippa campaign till SETTLED i
  // separata transaktioner — vilket race:ar belopp och spammar
  // audit-loggar. Distribuerat Redis-lås per kampanj med kort TTL.
  const lockKey = `settlement:generate:${campaignId}`;
  // `null` = låset är redan taget (parallell körning pågår) → 409.
  // Ett Redis-fel (nere/disabled) får INTE tolkas som "låst" — då
  // skulle avräkning blockeras helt vid infra-strul. Vi fail-open:ar
  // och litar på status-guarden (ENDED→SETTLED) + upsert:en nedan.
  let acquired: "OK" | null | "error";
  try {
    acquired = (await redis.set(lockKey, "1", "EX", 120, "NX")) as "OK" | null;
  } catch (err) {
    log.warn(
      { err, campaignId },
      "settlement lock unavailable (redis) — proceeding best-effort"
    );
    acquired = "error";
  }
  if (acquired === null) {
    return c.json(
      {
        error:
          "Avräkning körs redan för denna kampanj. Vänta ett par minuter och försök igen.",
      },
      409
    );
  }

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return c.json({ error: "Kampanj hittades inte" }, 404);
    }

    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas för denna kampanj" }, 403);
    }

    if (campaign.status !== "ENDED") {
      return c.json({ error: "Kampanjen måste vara avslutad innan avräkning kan genereras" }, 400);
    }

    const teamList = await db
      .select()
      .from(teams)
      .where(eq(teams.campaignId, campaignId));

    const results = await db.transaction(async (tx) => {
      const txResults: Array<Record<string, unknown>> = [];

      for (const team of teamList) {
        const salesResult = await tx
          .select({
            total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
          })
          .from(customerOrders)
          .where(
            and(
              eq(customerOrders.teamId, team.id),
              eq(customerOrders.campaignId, campaignId),
              eq(customerOrders.status, "PAID")
            )
          );

        const totalSalesOre = Number(salesResult[0]?.total || 0);

        // MASTERPLAN_01 KC1.8: don't manufacture payout-rows for teams
        // that didn't sell anything. They clutter Fortnox, confuse the
        // assoc-admin payout view, and skew settlement audit-meta. If
        // an existing row is present (re-run on a corrected sale list)
        // keep it so we never lose history.
        const [existing] = await tx
          .select()
          .from(payouts)
          .where(
            and(
              eq(payouts.campaignId, campaignId),
              eq(payouts.teamId, team.id)
            )
          )
          .limit(1);

        if (totalSalesOre === 0 && !existing) {
          txResults.push({
            teamId: team.id,
            teamName: team.name,
            totalSalesOre: 0,
            teamShareOre: 0,
            rootsShareOre: 0,
            skipped: true,
          });
          continue;
        }

        const marginPercent = campaign.marginPercent;
        const teamShareOre = Math.round(totalSalesOre * (marginPercent / 100));
        const rootsShareOre = totalSalesOre - teamShareOre;

        if (existing) {
          // P1.1 (audit 2026-05-26): skydda redan fakturerade/utbetalda
          // payouts mot belopps-drift vid re-run. När en payout har
          // status INVOICED finns det redan en Fortnox-faktura kopplad
          // till `existing.rootsShareOre`; PAID-rader är dessutom
          // pengar som faktiskt transfererats. Vi får ALDRIG silently
          // skriva över dem med en omräknad summa — ops måste först
          // makulera fakturan / reversera betalningen manuellt.
          if (existing.status === "INVOICED" || existing.status === "PAID") {
            const amountDrift =
              existing.totalSalesOre !== totalSalesOre ||
              existing.teamShareOre !== teamShareOre ||
              existing.rootsShareOre !== rootsShareOre;
            txResults.push({
              teamId: team.id,
              teamName: team.name,
              totalSalesOre: existing.totalSalesOre,
              teamShareOre: existing.teamShareOre,
              rootsShareOre: existing.rootsShareOre,
              payoutId: existing.id,
              status: existing.status,
              skipped: true,
              reason: existing.status === "INVOICED" ? "already_invoiced" : "already_paid",
              recalculatedTotalSalesOre: amountDrift ? totalSalesOre : undefined,
              recalculatedTeamShareOre: amountDrift ? teamShareOre : undefined,
              recalculatedRootsShareOre: amountDrift ? rootsShareOre : undefined,
            });
            if (amountDrift) {
              log.warn(
                {
                  payoutId: existing.id,
                  status: existing.status,
                  storedTotalSalesOre: existing.totalSalesOre,
                  recomputedTotalSalesOre: totalSalesOre,
                },
                "settlement re-run found amount drift on locked payout — keeping stored values"
              );
            }
            continue;
          }

          await tx
            .update(payouts)
            .set({
              totalSalesOre,
              rootsShareOre,
              teamShareOre,
              updatedAt: new Date(),
            })
            .where(eq(payouts.id, existing.id));

          txResults.push({
            teamId: team.id,
            teamName: team.name,
            totalSalesOre,
            teamShareOre,
            rootsShareOre,
            payoutId: existing.id,
            updated: true,
          });
        } else {
          const [payout] = await tx
            .insert(payouts)
            .values({
              campaignId,
              orgId: campaign.orgId,
              teamId: team.id,
              totalSalesOre,
              rootsShareOre,
              teamShareOre,
              status: "PENDING",
            })
            .returning();

          txResults.push({
            teamId: team.id,
            teamName: team.name,
            totalSalesOre,
            teamShareOre,
            rootsShareOre,
            payoutId: payout.id,
          });
        }
      }

      await tx
        .update(campaigns)
        .set({ status: "SETTLED", updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

      return txResults;
    });

    // MASTERPLAN_01 KC1.3: invariant check + audit-meta enrichment. We
    // want a single line in `audit_logs` that lets ops verify that
    // team_share + roots_share == total_sales for every payout row in
    // this run, and recover the exact payout-IDs if Fortnox needs a
    // sanity-cross-check later.
    const settledRows = results.filter((r) => !r.skipped);
    const totalSales = settledRows.reduce(
      (s, r) => s + Number(r.totalSalesOre ?? 0),
      0
    );
    const totalTeamShare = settledRows.reduce(
      (s, r) => s + Number(r.teamShareOre ?? 0),
      0
    );
    const totalRootsShare = settledRows.reduce(
      (s, r) => s + Number(r.rootsShareOre ?? 0),
      0
    );
    const checksumOk = totalTeamShare + totalRootsShare === totalSales;
    if (!checksumOk) {
      log.error(
        { campaignId, totalSales, totalTeamShare, totalRootsShare },
        "settlement checksum mismatch"
      );
    }
    const payoutIds = settledRows
      .map((r) => r.payoutId)
      .filter((id): id is string => typeof id === "string");

    void auditLog({
      userId: session.userId,
      action: "campaign.status.changed",
      entityType: "campaign",
      entityId: campaignId,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        from: campaign.status,
        to: "SETTLED",
        settlementCount: settledRows.length,
        skippedCount: results.length - settledRows.length,
        totalSalesOre: totalSales,
        totalTeamShareOre: totalTeamShare,
        totalRootsShareOre: totalRootsShare,
        checksumOk,
        payoutIds,
      },
    });

    return c.json({ ok: true, settlements: results });
  } catch (err) {
    log.error({ err }, "Settlement generation failed");
    return c.json({ error: "Avräkning misslyckades" }, 500);
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
});

settlement.get("/by-campaign/:campaignId", async (c) => {
  const session = await requireAdmin(c);
  if (!session) return c.json({ error: "Behörighet saknas" }, 403);

  const campaignId = c.req.param("campaignId");

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return c.json({ error: "Kampanj hittades inte" }, 404);

    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const payoutList = await db
      .select()
      .from(payouts)
      .where(eq(payouts.campaignId, campaignId));

    const teamList = await db
      .select()
      .from(teams)
      .where(eq(teams.campaignId, campaignId));

    const teamMap = new Map(teamList.map((t) => [t.id, t.name]));

    return c.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        marginPercent: campaign.marginPercent,
      },
      payouts: payoutList.map((p) => ({
        id: p.id,
        teamId: p.teamId,
        teamName: teamMap.get(p.teamId) || "Okänt lag",
        totalSalesOre: p.totalSalesOre,
        rootsShareOre: p.rootsShareOre,
        teamShareOre: p.teamShareOre,
        status: p.status,
        fortnoxInvoiceId: p.fortnoxInvoiceId,
      })),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch settlement by campaign");
    return c.json({ error: "Kunde inte hämta avräkning" }, 500);
  }
});

settlement.post("/create-invoice/:payoutId", async (c) => {
  const session = await requireAdmin(c);
  if (!session) return c.json({ error: "Behörighet saknas" }, 403);

  // Scout fix 2026-05-26 (Integration CRIT-settlement-null): med
  // FORTNOX_ENABLED=false används NullProvider som skapar
  // "NULL-INV-*"-id:n i process-minne. Om någon kör create-invoice i
  // prod utan riktig Fortnox sparas detta i DB som om fakturan
  // existerade — bokföringsmässig blackhole vid restart. Vi vägrar
  // helt i prod tills Fortnox är aktiv.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.FORTNOX_ENABLED?.trim().toLowerCase() !== "true"
  ) {
    return c.json(
      {
        error:
          "Fortnox är inte aktiverat. Sätt FORTNOX_ENABLED=true och giltig FORTNOX_ACCESS_TOKEN innan utbetalningsfaktura skapas.",
      },
      503
    );
  }

  const payoutId = c.req.param("payoutId");

  try {
    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, payoutId))
      .limit(1);

    if (!payout) {
      return c.json({ error: "Utbetalning hittades inte" }, 404);
    }

    if (
      session.role !== "INTERNAL_ADMIN" &&
      payout.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    // P1.2 (audit 2026-05-26): idempotency på create-invoice.
    // Tidigare kunde en dubbel-klick / retry efter Fortnox-timeout
    // skapa en andra extern faktura medan bara den senaste ID:n
    // sparades i DB. Vi gate:ar på faktiskt status + befintligt
    // fortnoxInvoiceId och returnerar det existerande id:t som ett
    // 200 OK så att UI:t inte tror att något misslyckades.
    if (payout.status === "INVOICED" || payout.status === "PAID") {
      if (payout.fortnoxInvoiceId) {
        return c.json({
          ok: true,
          invoiceId: payout.fortnoxInvoiceId,
          alreadyInvoiced: true,
          status: payout.status,
        });
      }
      // Status säger INVOICED men fakturan saknar id — det är en
      // tidigare halv-genomförd skapelse vi inte automatiskt kan
      // återhämta. Kräv manuell granskning innan vi får trigga
      // Fortnox igen.
      return c.json(
        {
          error:
            "Utbetalningen är markerad som fakturerad men saknar Fortnox-ID. Kontakta support innan ny faktura skapas.",
        },
        409
      );
    }
    if (payout.status !== "PENDING") {
      return c.json(
        { error: `Utbetalningen kan inte faktureras i status ${payout.status}.` },
        409
      );
    }

    // MASTERPLAN_01 KC1.4: ladda faktisk klubb-data istället för
    // hårdkodat "Roots AB". Tidigare blev customer-namnet tomt i
    // Fortnox vilket gjorde att bok-export inte gick att tilldela
    // någon kund. Använd masterdata-fälten (displayName, postalCode)
    // när de finns, annars legacy `name`. Address-fält som street/city
    // saknas i organizations-schemat — schema-utvidgning är egen story
    // (se docs/runbooks/onboard-fortnox.md). Fortnox accepterar
    // kunden utan postadress; vi fyller den senare via /forening UI.
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        displayName: organizations.displayName,
        orgNumber: organizations.orgNumber,
        postalCode: organizations.postalCode,
        municipality: organizations.municipality,
      })
      .from(organizations)
      .where(eq(organizations.id, payout.orgId))
      .limit(1);

    if (!org) {
      return c.json({ error: "Föreningen hittades inte" }, 404);
    }
    if (!org.orgNumber) {
      return c.json(
        {
          error:
            "Föreningen saknar organisationsnummer — fyll i det i inställningar innan fakturering.",
        },
        422
      );
    }

    // Billing-mail: vi har inget dedicerat org-fält idag, använd
    // primär assoc-admins e-post. När /forening/installningar exposeas
    // en billingEmail-input räcker det att lägga till en organizations.billing_email-
    // kolumn + byta SELECT-listan ovan.
    let billingEmail = "";
    const [admin] = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.orgId, payout.orgId), eq(users.role, "ASSOCIATION_ADMIN")))
      .limit(1);
    billingEmail = admin?.email ?? "";

    // P2.24 (audit 2026-05-26): tidigare var Fortnox-anropet + DB
    // UPDATE inte atomiska. Två concurrent requests (admin
    // dubbel-klick eller automation-retry) kunde båda passera
    // PENDING-checken och båda skapa en faktura hos Fortnox medan
    // bara den ena externa ID:n landade i DB → orphan invoice +
    // dubbel-fakturering av föreningen.
    //
    // Vi tar ett distribuerat Redis-lås per payoutId över hela
    // operationen. Lås-TTL är 5 min så ett crashat API-instance
    // inte permanent blockar nya försök. Om låset inte kan tas →
    // 409 (en parallell operation pågår, klienten kan poll:a status).
    const lockKey = `settlement:invoice:${payoutId}`;
    // `null` = låset redan taget → 409. Redis-fel får inte blockera
    // fakturering; vi fail-open:ar och skyddas av re-läsningen av
    // payout-status (PENDING-guard) inuti låset nedan.
    let lockAcquired: "OK" | null | "error";
    try {
      lockAcquired = (await redis.set(lockKey, "1", "EX", 300, "NX")) as
        | "OK"
        | null;
    } catch (err) {
      log.warn(
        { err, payoutId },
        "invoice lock unavailable (redis) — proceeding best-effort"
      );
      lockAcquired = "error";
    }
    if (lockAcquired === null) {
      return c.json(
        { error: "Faktura skapas redan — vänta några sekunder och försök igen." },
        409
      );
    }

    try {
      // Inom låset: re-läs payout-status så vi inte race:ade förbi
      // idempotency-gaten ovan från en parallell körning.
      const [latest] = await db
        .select({ status: payouts.status, fortnoxInvoiceId: payouts.fortnoxInvoiceId })
        .from(payouts)
        .where(eq(payouts.id, payoutId))
        .limit(1);
      if (!latest || latest.status !== "PENDING") {
        return c.json(
          {
            ok: true,
            alreadyInvoiced: true,
            invoiceId: latest?.fortnoxInvoiceId ?? null,
            status: latest?.status ?? "UNKNOWN",
          },
          200
        );
      }

      const invoiceProvider = getInvoiceProvider();
      const result = await invoiceProvider.createInvoiceFromOrder({
        orderId: payout.id,
        customer: {
          orgId: payout.orgId,
          name: org.displayName ?? org.name ?? "Okänd förening",
          orgNumber: org.orgNumber,
          email: billingEmail,
          address: {
            postalCode: org.postalCode ?? undefined,
            city: org.municipality ?? undefined,
            countryCode: "SE",
          },
        },
        lines: [
          {
            sku: "SETTLEMENT",
            description: `Roots-andel kampanj ${payout.id.slice(0, 8)} (avtalad fee)`,
            qty: 1,
            unitPriceOre: payout.rootsShareOre,
            vatPercent: 25,
            accountNumber: 3001,
          },
        ],
        totalOre: payout.rootsShareOre,
      });

      if (result.status === "error" || !result.externalId) {
        return c.json(
          { error: result.message || "Faktura kunde inte skapas hos leverantören" },
          502
        );
      }

      // P2.24: conditional UPDATE — vi sätter bara INVOICED + extern
      // ID om raden fortfarande är PENDING och saknar invoice-id.
      // Om vi får 0 rader tillbaka betyder det att vi har en orphan
      // faktura hos Fortnox vi inte fick fäst i DB:n; det loggas
      // CRITICAL så ops kan rensa manuellt med externalId.
      const updated = await db
        .update(payouts)
        .set({
          status: "INVOICED",
          fortnoxInvoiceId: result.externalId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payouts.id, payoutId),
            eq(payouts.status, "PENDING"),
            isNull(payouts.fortnoxInvoiceId)
          )
        )
        .returning({ id: payouts.id });

      if (updated.length === 0) {
        log.error(
          {
            payoutId,
            orphanInvoiceId: result.externalId,
          },
          "CRITICAL: Fortnox invoice created but DB update failed — manual reconciliation required"
        );
        return c.json(
          {
            error: "Faktura skapades hos leverantören men kunde inte sparas. Kontakta ops.",
            invoiceId: result.externalId,
          },
          500
        );
      }

      void auditLog({
        userId: session.userId,
        action: "payout.invoiced",
        entityType: "payout",
        entityId: payoutId,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          orgId: payout.orgId,
          campaignId: payout.campaignId,
          invoiceExternalId: result.externalId,
          rootsShareOre: payout.rootsShareOre,
        },
      });

      return c.json({ ok: true, invoiceId: result.externalId });
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  } catch (err) {
    log.error({ err }, "Invoice creation failed");
    return c.json({ error: "Faktura kunde inte skapas" }, 500);
  }
});
