# Sprint E10 — Närliggande affärsvärde

**Datum:** 2026-05-18
**Status:** ✅ Genomförd

## Mål

Bygga tre nya UI-ytor som ger direkt affärsvärde för SELLER,
CLUB_ADMIN och TEAM_LEADER och som E9-audit pekade ut som P1.

## Vad bygger E10?

| # | Gap | Roll | Lösning |
| - | --- | ---- | ------- |
| 1 | "Senaste 5 ordrar"-kortet är ofta otillräckligt — säljaren vill se hela historiken med filter och CSV-export | SELLER | Ny route `/min-shop/bestallningar` med status- och datumfilter, KPI:er och CSV-export |
| 2 | Klubben ser inte sina fakturor — måste ringa support för status | CLUB_ADMIN / CLUB_MEMBER | Ny route `/portal/fakturor` som listar B2B-ordrar med `invoiceStatus` + `fortnoxInvoiceId` |
| 3 | Lagansvarig kunde inte sätta individuella mål per säljare | TEAM_LEADER (+ ASSOCIATION_ADMIN/INTERNAL_ADMIN) | Inline goal-edit i `/lag/saljare` mot ny `PATCH /v1/dashboard/sellers/:sellerId` |

Alla tre punkter återanvänder befintliga endpoints där det är möjligt —
inga nya backend-endpoints behövdes för #1 och #2.

## Implementationskartläggning

### Backend (apps/api)

* `apps/api/src/routes/dashboard.ts`
  * Ny `PATCH /v1/dashboard/sellers/:sellerId` (Sprint E10):
    * Validerar UUID och `individualGoal` (heltal 0 – 10 000 000 kr).
    * RBAC: INTERNAL_ADMIN ✓, ASSOCIATION_ADMIN om `session.orgId ==
      team.orgId` ✓, TEAM_LEADER om `team.leaderId == session.userId` ✓.
    * Skriver enbart `individualGoal` + `updatedAt` (whitelist mot
      `users.role`/`shopSlug`-drift).
    * Returnerar `{ id, individualGoal }` så FE kan applicera optimistisk
      uppdatering utan refetch.

Inga schemaändringar krävdes — `sellers.individualGoal` finns redan.

### Frontend (apps/web)

* `apps/web/src/app/(fundraising)/min-shop/bestallningar/page.tsx` (ny)
  * Konsumerar `GET /v1/dashboard/seller` (returnerar redan alla ordrar
    för säljaren — ingen ny endpoint behövdes).
  * Filter: status (Betald / Avvaktar / Avbruten / Alla), från-datum,
    till-datum. Filter rensas med en knapp.
  * KPI-rad: antal visade beställningar + total betald i urvalet.
  * Export: klient-side CSV med `datum;kund;status;belopp_kr`-kolumner.
  * Tom-stater för "inga ordrar alls" vs. "inga ordrar matchar filter".

* `apps/web/src/app/(fundraising)/min-shop/page.tsx`
  * "Senaste beställningar"-kortet har fått en `Visa alla →`-länk till
    nya `/min-shop/bestallningar`-arkivet.

* `apps/web/src/app/(fundraising)/layout.tsx`
  * SELLER-navmenyn fick nytt item `Beställningar` (`ClipboardList`).

* `apps/web/src/app/(fundraising)/lag/saljare/page.tsx`
  * Inline edit för `individualGoal` per säljare med Spara/Avbryt
    (`PATCH /v1/dashboard/sellers/:sellerId`).
  * Två varianter rendras beroende på state:
    * Om mål satt → progress-bar + "Ändra"-länk.
    * Annars → "Sätt mål"-knapp som öppnar inline input.
  * Optimistisk lokal state-uppdatering så raden uppdateras direkt
    utan refetch.

* `apps/web/src/app/(portal)/portal/fakturor/page.tsx` (ny)
  * Konsumerar `GET /v1/portal/orders` (returnerar redan ordrar med
    `invoiceStatus` + `fortnoxInvoiceId`).
  * Statusbadges: NONE / PENDING / ISSUED / PAID / CANCELLED med
    distinkta färger så ögat hittar utestående direkt.
  * KPI-rad: totalt betalt + totalt skickat (utestående) + antal rader.
  * Samma filter-mall (status + datum-range) som order-historiken så
    klubben hittar sina mönster.
  * CSV-export för revisor-överlämning.

* `apps/web/src/app/(portal)/portal/layout.tsx`
  * CLUB_NAV fick `{ href: "/portal/fakturor", icon: FileText }`.

## Designval

### Varför ingen ny "list invoices"-endpoint i API:t?

`/v1/portal/orders` (sedan tidigare) returnerar redan klubbens egna
ordrar med `fortnoxInvoiceId` + `invoiceStatus` — Fortnox-webhook
synkar dessa till `orders`-tabellen så data är färsk utan att vi gör
ett extra anrop mot Fortnox per sidladdning. En klubb har sällan fler
än några hundra rader så client-side-filter räcker för MVP. Om
behovet växer (multi-år, tusentals rader) lägger vi till
paginering + server-side filter i en framtida sprint.

### Varför PATCH och inte PUT på säljar-målet?

Vi vill bara tillåta uppdatering av `individualGoal`. En PUT skulle
implicit kräva att kallaren skickar hela seller-objektet och öppnar
för att en bugg råkar nollställa t.ex. `shopSlug`. PATCH gör att vi
kan vitelista exakt vad som får ändras (`individualGoal` + auto-bumpa
`updatedAt`).

## Verifieringar

* `pnpm --filter @roots/web typecheck` → grönt
* `pnpm --filter @roots/api test --run` → 102/102 gröna
* `pnpm --filter @roots/web build` → grönt
  * Nya rutter i route-tabellen:
    * `/min-shop/bestallningar` 2.63 kB
    * `/portal/fakturor` 3.37 kB
  * `/lag/saljare` växte med inline-edit-koden men inga regressions.

## Kvarstående efter E10 (för E11)

Enligt `ROLE_GAP_AUDIT.md` återstår E11-skopet:

1. **INTERNAL_ADMIN: `/portal/audit-log`** händelsehistorik.
2. **Notifikationer/inkorg i header** för alla roller.
3. **Hjälp/FAQ-portal** under `/hjalp`.

Och ej demo-blockerande P2/P3-poster som finns dokumenterade i samma
audit-rapport per roll.
