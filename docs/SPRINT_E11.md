# Sprint E11 — Operational maturity (audit-log, inbox, hjälp)

Stänger de tre P1/P2-gapen i `ROLE_GAP_AUDIT.md` för operativ
mognad. Inget av detta är blockerande för en demo, men allt
tre lyfter plattformen från "fungerar" till "går att driva".

| # | Roll               | Yta                                   | Status |
|---|--------------------|---------------------------------------|--------|
| 1 | INTERNAL_ADMIN     | `/portal/audit-log` händelsehistorik  | ✅ E11 |
| 2 | Alla inloggade     | Notifikations-klocka i header         | ✅ E11 |
| 3 | Alla (även public) | `/hjalp` FAQ + kontaktformulär        | ✅ E11 |

## 1. Audit-log för INTERNAL_ADMIN

### Backend
- `GET /v1/admin/audit-log` — paginerad lista med filter på
  `action` (prefix), `entityType`, `userId`, `from`, `to`.
  Returnerar `{ items, total, limit, offset, hasMore }`. Joinar
  in `users.email` så UI:t slipper en N+1.
- `GET /v1/admin/audit-log/actions` — distinkt åtgärds-lista
  sorterad efter senast sedda, för dropdown-filtret.
- Båda kräver `role === "INTERNAL_ADMIN"` (401/403 annars).
- Använder Drizzles `like`, `eq`, `gte`, `lt`, `and` med
  parametriserade clauses — ingen sträng-konkatenering mot SQL.

### Frontend
- `apps/web/src/app/(portal)/portal/audit-log/page.tsx`:
  filterpanel (åtgärd, entitet, user-UUID, datumintervall),
  expanderbara rader som visar full `meta` JSON, paginering
  med `limit=50`. Action-badge tonas beroende på `.fail`/`.ok`
  så det går snabbt att skanna efter incidenter.
- Sidan är registrerad i `ADMIN_NAV` med `ShieldCheck`-ikonen.

### Designval
- Read-only. Audit-tampering motverkar hela ISAE/SOC-poängen,
  så vi exponerar ingen delete-action.
- `like(action, '${prefix}%')` — vi vill kunna filtrera på t.ex.
  `auth.` för att se alla auth-event utan att lista varje
  enskild action separat.

## 2. Notifikations-klocka för alla roller

### Backend
- `GET /v1/notifications` — projicerar befintliga rader till en
  rolltänkande feed av 20 senaste händelser (30 dagars fönster).
- Per roll:
  - `SELLER`: egna `customer_orders`.
  - `TEAM_LEADER`: team-orders.
  - `ASSOCIATION_ADMIN`: org-orders + claim:ade `team_invites`.
  - `CLUB_ADMIN`/`CLUB_MEMBER`: org-orders med `invoiceStatus`
    in `(ISSUED, PAID)`.
  - `SALES_REP`/`SALES_ADMIN`: organisations skapade som leads.
  - `INTERNAL_ADMIN`: high-signal audit-rader (login-fail,
    password-byte, lead-create, campaign-create, claim).

### Frontend
- `apps/web/src/components/notification-bell.tsx`:
  klock-ikon med olästa-badge, dropdown med 20 senaste, klickbara
  rader leder till respektive yta (orders, fakturor, audit-log,
  pipeline).
- Polling var 60 sek (ingen SSE/WS — håller infran enkel).
- "Olästa" = client-side `localStorage["roots.notifications.lastReadAt"]`,
  stampas när dropdown öppnas. Inget per-user-DB-state i E11;
  shape:n från API:t är dock redan formad som en notifikation
  så vi kan byta lagring senare utan FE-ändring.
- Bell:n syns i båda layoutsens header:
  - `(fundraising)/layout.tsx` — sticky sidebar + mobile header
  - `(portal)/portal/layout.tsx` — sidebar + mobile header

### Designval
- **Projektion istället för ny tabell.** Ingen migration
  krävdes för att leverera inboxen. När vi senare vill ha
  mark-as-read per rad är response-shape:n redan rätt.
- Vi visar inte audit-event för andra än `INTERNAL_ADMIN` —
  vanliga roller får inte se varandras password-byten.

## 3. Hjälp & FAQ-portal

### Frontend
- `apps/web/src/app/(marketing)/hjalp/page.tsx`:
  - Sektionerad FAQ (Säljare, Lagansvarig, Förening,
    Klubb, Sälj-team, Drift, Allmänt) med expanderbara items.
  - Hämtar `/v1/auth/me` och **lyfter användarens egen
    sektion till toppen**, märkt "Din roll". Övriga sektioner
    är synliga för alla — vi vill inte underhålla N FAQ-portaler.
  - Kontaktformulär POSTar till befintliga `POST /v1/contact`
    (samma som marketing-kontaktsidan), pre-ifyllt med namn
    och email om inloggad.
- `HelpCircle`-ikon ovanför `NotificationBell` i båda layouts.

### Designval
- Live under `(marketing)`, inte `(portal)/(fundraising)`,
  eftersom: (a) den ska funka för utloggade besökare, (b)
  vi vill inte göra två kopior, (c) marketing-layouten har
  redan header + footer.
- Ingen ny backend-endpoint — `POST /v1/contact` täcker
  redan use-caset.

## Filer rörda

```
apps/api/src/app.ts                                       (+4)
apps/api/src/routes/admin.ts                              (ny)
apps/api/src/routes/notifications.ts                      (ny)
apps/web/src/components/notification-bell.tsx             (ny)
apps/web/src/app/(portal)/portal/audit-log/page.tsx       (ny)
apps/web/src/app/(portal)/portal/layout.tsx               (bell + help + audit-log nav)
apps/web/src/app/(fundraising)/layout.tsx                 (bell + help)
apps/web/src/app/(marketing)/hjalp/page.tsx               (ny)
docs/SPRINT_E11.md                                        (ny)
```

## Verifiering

- `pnpm --filter @roots/api typecheck` → endast pre-existing
  `bankid`-fel (ej E11).
- `pnpm --filter @roots/web typecheck` → 0 fel.
- `pnpm --filter @roots/api test --run` → 102/102 passerar.
- `pnpm --filter @roots/web build` → bygger alla nya rutter:
  - `/portal/audit-log` (5.45 kB)
  - `/hjalp` (7.99 kB)

## Vad återstår efter E11

Sprint E11 stänger samtliga P1/P2-items från `ROLE_GAP_AUDIT.md`.
Återstående arbete från audit är optionellt och listas där som
nice-to-have, inte produktions-blockerare:

- Per-user mark-as-read på notifikationer (i dag client-side).
- Sökmotor över audit-log (i dag prefix-filter).
- Inbäddad video / produkt-tour i `/hjalp`.
