import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@roots/db";
import { users } from "@roots/db/schema";
import { childLogger } from "./logger";
import { auditLog } from "./audit";
import { destroyUserSessions } from "./session";

const log = childLogger("deletion-purge");

/**
 * MASTERPLAN_01 KC2.7 — anonymisera användare vars cooldown är slut.
 *
 * Strategi (matchar GDPR art. 17 + bokföringslagen 7 år):
 *   - PII-fält nollas eller anonymiseras (email → `deleted-${id}@roots.invalid`)
 *   - role behålls (för historisk audit / payout-ägarskap)
 *   - orgId behålls (en order måste fortfarande kunna kopplas till
 *     vilken förening sälj-aren tillhörde)
 *   - passwordHash byts mot en sentinel som inte är ett giltigt
 *     argon2-hash — INGEN kan logga in på en raderad användare
 *   - deletedAt sätts → unik index/where-filter kan exkludera dem
 *     från listings utan att ändra app-logik
 *
 * Returnerar antal raderade rader (för audit + monitoring).
 *
 * Body funktionen tar `cutoff` så att tester kan tvinga "låtsas-nu"
 * utan att vänta 14 dagar i en sleep.
 */
export async function purgeDueDeletions(cutoff: Date = new Date()): Promise<{
  purged: number;
  errors: number;
}> {
  let purged = 0;
  let errors = 0;

  // Hämta upp till 100 i taget — håller en eventuell backlog under
  // kontroll utan att blocka tx-snurror för länge. Cron-jobbet kallar
  // funktionen var 6:e timme; 100 per körning = 400/dygn = mer än
  // tillräckligt för en SMB-plattform i flera år framåt.
  const due = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      orgId: users.orgId,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.scheduledDeletionAt),
        lte(users.scheduledDeletionAt, cutoff),
        isNull(users.deletedAt)
      )
    )
    .limit(100);

  if (due.length === 0) {
    return { purged: 0, errors: 0 };
  }

  log.info({ count: due.length }, "purging users past scheduled deletion");

  for (const user of due) {
    try {
      // Anonymisera. Vi behåller role + orgId men nuke:ar allt som
      // är PII. Det går inte att gå tillbaka — `deleted_at` är vår
      // tombstone-markör som UI:t filtrerar bort på.
      const tombstoneEmail = `deleted-${user.id}@roots.invalid`;
      const updated = await db
        .update(users)
        .set({
          email: tombstoneEmail,
          // Sentinel som inte är ett giltigt argon2-hash → ingen kan
          // logga in. Samma mönster som invite-pending-sentinel:en.
          passwordHash: "deleted-account-cannot-login",
          contactName: null,
          phone: null,
          personalNumber: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          postalCode: null,
          mfaSecret: null,
          birthYear: null,
          guardianUserId: null,
          guardianConsentAt: null,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
        .returning({ id: users.id });

      if (updated.length === 0) {
        // Någon annan körning (schemaläggaren och cron-endpointen kan överlappa)
        // hann före. `deleted_at IS NULL` matchade inte längre, så vi har inte
        // anonymiserat något — räkna det inte, och skriv ingen dubbel audit-rad.
        continue;
      }

      // Skulle teoretiskt redan vara tomt (vi sessions-revokar vid
      // request:en), men gör det idempotent för säkerhetsskull.
      try {
        await destroyUserSessions(user.id);
      } catch {
        // OK — sessions är förmodligen redan utgångna.
      }

      // Väntas in, till skillnad från request-vägarnas audit-skrivningar: raden
      // är beviset för att raderingen skedde, och anonymiseringen är redan
      // committad och oåterkallelig. En SIGTERM i fönstret mellan de två hade
      // annars lämnat en raderad användare helt utan spår. `auditLog` kastar
      // aldrig, så väntan kan inte fälla körningen.
      await auditLog({
        userId: user.id,
        action: "auth.delete_account.purged",
        meta: {
          role: user.role,
          orgId: user.orgId,
          tombstoneEmail,
        },
      });
      purged += 1;
    } catch (err) {
      errors += 1;
      log.error(
        { err, userId: user.id },
        "purge of a single user failed — will retry next run"
      );
    }
  }

  log.info({ purged, errors }, "purge run complete");
  return { purged, errors };
}
