# Sprint E9 — P0/P1 gap closures

**Datum:** 2026-05-18
**Status:** ✅ Genomförd, deployed (Railway DB migrerad)

## Mål

Stänga de tre högst prioriterade gaps från `ROLE_GAP_AUDIT.md` så att
ASSOCIATION_ADMIN och SALES_REP kan göra sina jobb från grunden utan att
en utvecklare måste handinsata data i databasen.

## Vad bygger E9?

| # | Gap | Roll | Pri | Lösning |
| - | --- | ---- | --- | ------- |
| 1 | Kan inte skapa lag från UI | ASSOCIATION_ADMIN | P0 | "Skapa nytt lag"-knapp på `/forening/lag` → modal → inbjudningslänk för lagansvarig |
| 2 | Kan inte starta nya kampanjer från UI | ASSOCIATION_ADMIN | P0 | "Starta ny kampanj"-knapp i header på `/forening` → modal med mål/datum/marginal |
| 3 | Kan inte skapa nya leads | SALES_REP | P1 | "Nytt lead"-knapp i header på `/portal/pipeline` → modal → ny org med crmStatus=LEAD |

## Implementationskartläggning

### Backend (apps/api)

* `apps/api/src/routes/association.ts` (ny)
  * `POST /v1/association/team-invites` — ASSOCIATION_ADMIN skapar
    `team_invites`-row med 14-dagars token. Validerar att kampanjen
    tillhör admin:ens egen org.
  * `GET /v1/association/team-invites/:token` — public preview för
    claim-sidan. Returnerar 404/410 om token okänd/använd/utgången.
  * `POST /v1/association/team-invites/claim` — public claim. Atomisk
    transaction skapar `users` (role=TEAM_LEADER) + `teams` (med ny
    seller-invite-token) + markerar `team_invites.used_at`. Sätter
    session-cookie så lagansvarig är inloggad direkt på `/lag`.
  * `POST /v1/association/campaigns` — skapar kampanj med
    `status=ACTIVE`. Genererar unik slug, validerar datum + marginal.

* `apps/api/src/routes/sales.ts` (ny)
  * `POST /v1/sales/leads` — SALES_REP / SALES_ADMIN / INTERNAL_ADMIN
    skapar ny `organizations`-row med `crm_status=LEAD`,
    `lead_source`, `potential_score`, `assigned_asm_user_id=user`.
    Validerar org.nr-format och returnerar 409 om numret redan finns.

### Database

* `packages/db/src/schema/team-invites.ts` (ny)
* `packages/db/drizzle/0005_team_invites.sql` (ny migration)
  * Tabellen `team_invites` skapad lokalt + på Railway-produktion.
  * `teams.leader_id` förblir NOT NULL — `team_invites` håller
    "team-to-be"-metadata tills coachen registrerat sig.

### Frontend (apps/web)

* `apps/web/src/app/(fundraising)/forening/lag/page.tsx`
  * Header får "Skapa nytt lag"-knapp.
  * Modal: lagnamn + kampanj-dropdown + e-post (valfritt).
  * Efter skapande visas en kopierbar inbjudningslänk till
    lagansvarig. Befintliga säljarinbjudningar fungerar oförändrat.

* `apps/web/src/app/(fundraising)/forening/page.tsx`
  * Header får "Ny kampanj"-knapp (rubrik dynamisk: "Starta kampanj"
    om ingen aktiv finns).
  * Modal: namn, mål (kr), marginal (%), start- och slutdatum.

* `apps/web/src/app/(auth)/registrera/lagansvarig/[token]/page.tsx` (ny)
  * Hämtar preview från `GET /team-invites/:token`, visar förenings-
    och lagnamn för bekräftelse.
  * Formulär: namn, e-post (förifylld om invite hade en), telefon,
    lösenord. Felmeddelanden för 404/410/409.

* `apps/web/src/app/(portal)/portal/pipeline/page.tsx`
  * Header får "Nytt lead"-knapp.
  * Modal: klubbnamn, källa (dropdown med 6 lead-källor), potential
    0–100, kommun, org.nr och webbplats. Validerar org.nr-format
    klient-side innan POST.

## Valideringar utförda

* `pnpm --filter @roots/db typecheck` → grönt
* `pnpm --filter @roots/web typecheck` → grönt
* `pnpm --filter @roots/api test --run` → 102/102 gröna
* `pnpm --filter @roots/web build` → grönt, alla nya rutter
  rapporterade i route-tabellen
* `drizzle-kit migrate` mot lokal + Railway-produktions-DB → båda OK

## Kvarstående efter E9 (för E10/E11)

Se `docs/ROLE_GAP_AUDIT.md` — fortsätt med P1-poster:

* TEAM_LEADER: lägga till `goalValue` per lag (just nu bara läs).
* SALES_REP: edit av lead (idag krävs ny invite om uppgifter ändras).
* INTERNAL_ADMIN: kampanj/org/säljar-edit-UI.
* SELLER: lägga upp förmedlare av personlig profilbild.

## Login till nya flöden

Identiska demo-konton som tidigare (se `docs/DEMO_CREDENTIALS.md`):

| Roll | E-post | Lösenord |
| --- | --- | --- |
| ASSOCIATION_ADMIN | `felicia.assoc@demo-if.se` | `Demo1234!` |
| TEAM_LEADER | `tobias.lag@demo-if.se` | `Demo1234!` |
| SALES_REP | `simon.sales@roots.se` | `Demo1234!` |

Felicia skapar lag → får invite-länk → öppna `/registrera/lagansvarig/<token>`
i inkognitofönster för att testa hela claim-flowet.
