# Sprint E12 — Topp 8 dashboard-luckor

Stänger de åtta sista konkreta luckorna i `ROLE_GAP_AUDIT.md` som
syntes som "—" eller "går inte att göra" på respektive roll-dashboard.
Inga schema-tillägg krävs — alla ändringar bygger på data som redan
finns i DB:n men inte exponerades eller redigerades i UI.

| # | Roll                             | Yta                                                              | Status |
|---|----------------------------------|------------------------------------------------------------------|--------|
| 1 | SALES_REP / SALES_ADMIN          | `/portal/pipeline` visar nu LEAD-orgar utan quote                | ✅ E12 |
| 2 | SALES_REP / INTERNAL_ADMIN       | `/portal/klubbar` visar riktiga members / revenue / lastOrder    | ✅ E12 |
| 3 | INTERNAL_ADMIN / SALES_ADMIN     | `/portal/saljare` med pipeline / closed / conversion-KPI:er      | ✅ E12 |
| 4 | ASSOCIATION_ADMIN                | `/forening/mal` redigerbar målfördelning per lag                 | ✅ E12 |
| 5 | TEAM_LEADER / ASSOCIATION_ADMIN  | Pausa/aktivera säljare – dolda från topplistan                   | ✅ E12 |
| 6 | TEAM_LEADER                      | `/lag/bestallningar` datumfilter, textsök, CSV-export            | ✅ E12 |
| 7 | CLUB_ADMIN                       | `/portal/bestallningar` samma verktygslåda                       | ✅ E12 |
| 8 | SELLER                           | Färdiga delningsmallar (SMS / WhatsApp / Insta / FB / mejl)      | ✅ E12 |

---

## 1. Pipeline LEAD-stage

**Innan:** `POST /v1/sales/leads` skapade en `organizations`-rad med
`crm_status='LEAD'` — men `/portal/pipeline` läste bara `quotes`, så
leadet "försvann" tills någon hann skriva en offert.

**Backend:** `GET /v1/portal/pipeline` (`apps/api/src/routes/portal.ts`)
har fått en femte stage `"LEAD"` som unionerar in `organizations`-rader
där `crm_status='LEAD'`. SALES_REP-tenancyn filtrerar på
`assigned_asm_user_id`. Svaret innehåller nu både quote-deals och
lead-orgar i `deals[]` med `status: "LEAD"` och `totalOre: 0`.

**FE:** `STAGE_LABELS["LEAD"] = "Lead"` + `STAGE_SCAFFOLD["LEAD"]`.
`EMPTY_COLUMNS` mappas från stage-koder istället för positions-index.
Modal-callbacken anropar `loadPipeline()` så nya leads dyker upp
direkt utan reload.

**Snapshot/test:** `portal.snapshot.test.ts` mockar nu fyra queries
(stage-rollup, lead-count, recent-deals, recent-leads). Snapshot
uppdaterad i `__snapshots__/portal.snapshot.test.ts.snap`.

**Kontrakt:** `pipelineStageSchema.stage` är `z.string()` så ingen
contracts-bump behövs.

## 2. Klubbar — riktiga aggregat

**Innan:** `/portal/klubbar`-tabellen visade `—` för medlemmar,
senaste order och intäkt.

**Backend:** `GET /v1/portal/clubs` returnerar nu per rad:
`membersCount` (COUNT `users` per `org_id`), `lastOrderAt`
(MAX `created_at` över `customer_orders` PAID + alla `orders`),
`revenueOre` (SUM `total_ore` med samma filter) och `crmStatus`.
Tre grupperade subqueries scoped till sidans 50 orgs — billigare
än 50 N+1 round-trips.

**FE:** `portal/klubbar/page.tsx` formaterar datum + öre och visar
`crmStatus` (LEAD/CUSTOMER/PROSPECT/INACTIVE) som status-badge istället
för det förvirrande `type === "club"`. KPI-card lägger till "Total
intäkt".

**Kontrakt:** `portalClubSchema` har fått `membersCount`,
`lastOrderAt`, `revenueOre`, `crmStatus` — alla optional/nullable.

## 3. Säljar-KPI:er

**Innan:** `/portal/saljare`-kort visade `—` för pipeline, closed
och conversion; tabellrader hade samma luckor.

**Backend:** `GET /v1/portal/sellers` aggregerar nu per säljare:
`pipelineOre` (SUM quotes där status IN DRAFT/SENT), `closedOre`
(SUM där ACCEPTED), `conversion` (won / (won+lost)) och `clubs`
(antal organisationer med `assigned_asm_user_id`). Lägger även
top-level `totals` för KPI-korten.

**Konversionsformeln:** vi exkluderar öppna quotes från nämnaren —
annars straffas nya reps vars pipeline fortfarande värms upp.

**FE:** `portal/saljare/page.tsx` läser de nya fälten, sorterar
DESC på `closedOre` (så pall-emojier hamnar rätt) och färgkodar
konvertering (≥50% grön, ≥25% neutral, annars varning).

## 4. /forening/mal — redigerbar målfördelning

**Innan:** målen visades men gick inte att ändra. `teams`-tabellen
har ingen `goalValue`-kolumn; den faktiska datan ligger i
`team_goals` (unique på `team_id+campaign_id`).

**Backend:** ny `PATCH /v1/dashboard/association/team-goals`
(`apps/api/src/routes/dashboard.ts`) som upsertar `team_goals` på
unique-constraintet. ASSOCIATION_ADMIN får bara röra egna teams /
egen kampanj; INTERNAL_ADMIN kan röra allt.

**FE:** `/forening/mal/page.tsx` har inline edit per lag (penna
→ input → spara/cancel) med toast. Header-card visar dessutom
"Fördelat" och "Kvar att fördela / Över mål" så ASM:n direkt ser
om summan stämmer mot kampanjmålet.

## 5. Pausa säljare

**Innan:** ingen väg att tysta en säljare som slutat eller är på
föräldraledig — de fortsatte räknas i ranking och måluppfyllelse.

**Backend:** `PATCH /v1/dashboard/sellers/:sellerId` accepterar
nu valfritt `status: "ACTIVE" | "INACTIVE"` jämte
`individualGoal`. RBAC oförändrad (TEAM_LEADER för eget lag,
ASSOCIATION_ADMIN för egen org, INTERNAL_ADMIN). `GET
/v1/dashboard/team/:teamId` exponerar nu också `status` på varje
seller-rad.

**FE:** `lag/saljare/page.tsx` filtrerar bort `INACTIVE` från
ranking + pallen och listar pausade i en egen sektion med
dashed-border och "Aktivera"-knapp. Pausa-knappen ligger på alla
aktiva rader.

**Typer:** `Seller.status` lagt till i `apps/web/src/types/fundraising.ts`
(optional).

## 6 + 7. Filter / sök / CSV på beställningssidorna

`/lag/bestallningar` och `/portal/bestallningar` har fått samma
verktygslåda:

- Datumfilter (`from` / `to`, inkluderande hela slutdagen)
- Textsök (kund/säljare resp. order-ID/produkt)
- CSV-export (UTF-8 BOM + `;`-separator för Excel-svenska)
- Behåller redan existerande status-filter och detalj-popup

Helper: `apps/web/src/lib/orders-csv.ts` med två funktioner —
`downloadCustomerOrdersCsv` (B2C) och `downloadPortalOrdersCsv`
(B2B). En filename-prefix in, ett `.csv` ut.

## 8. Säljarens delningsmallar

**Innan:** säljare hade en `Share2`-knapp men måste skriva själva
texten — den vanligaste anledningen unga säljare inte delar är att
de inte vet vad de ska skriva.

**FE:** ny komponent `apps/web/src/components/share-templates.tsx`
med sex färdiga mallar:

1. **SMS · Kort & snabb** (< 160 tecken)
2. **WhatsApp · Familj** (varm, längre)
3. **Instagram · Story/caption** (hashtags inkluderade)
4. **Facebook · Inlägg** (CTA "dela inlägget")
5. **E-post · Mor- & farföräldrar** (med subject-rad)
6. **SMS · Kollegor & vänner** (vuxen ton)

Alla mallar är funktioner av `{ displayName, shopUrl, campaignName,
teamName }` så de fylls i automatiskt. "Kopiera"-knapp + "Öppna
SMS/WhatsApp/E-post"-knapp där deeplinks är trovärdiga (SMS, wa.me,
mailto). Instagram/Facebook visar copy-bara mallar utan deeplink
eftersom plattformarna inte har stabila share-URL:er från webben.

Renderas under befintliga "Dela din shop"-kortet på `/min-shop`.

---

## Verifiering

```
pnpm -r build      # apps/web + apps/api + packages OK
pnpm -r typecheck  # OK (förutom pre-existing `bankid`-typing från E11)
pnpm -r test       # 102/102 API + 20/20 DB
```

Snapshot för `/v1/portal/pipeline` uppdaterad medvetet — diff syns
i `apps/api/src/routes/__snapshots__/portal.snapshot.test.ts.snap`
och i `portal.snapshot.test.ts` (mock-fixturen) så framtida PR:er
kan inte tysta diffen.
