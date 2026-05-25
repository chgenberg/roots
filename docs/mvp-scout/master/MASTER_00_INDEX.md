# MVP Scout — Master Index

**Datum:** 2026-05-25
**Källa:** 35 parallella Composer 2.5-scouts (`docs/mvp-scout/01–35*.txt`)
**Syfte:** Konsolidera alla fynd i risk-kategorier, gruppera tematiskt, ge en MVP-actionplan.

---

## 1. Totalt resultat

| Risk-nivå | Antal fynd | Andel | Master-fil |
|-----------|-----------:|------:|------------|
| **P1 — Kritiskt (blockerar MVP)** | **164** | 22 % | `MASTER_01_CRITICAL.md` |
| **P2 — Nödvändigt (måste fixas före launch)** | **292** | 40 % | `MASTER_02_NECESSARY.md` |
| **P3 — Förbättring (quality / soft launch)** | 194 | 26 % | `MASTER_03_IMPROVEMENT.md` |
| **P4 — Polish (v1.1 backlog)** | 87 | 12 % | `MASTER_03_IMPROVEMENT.md` |
| **TOTALT** | **737** | 100 % | |

*(P3 + P4 ligger tillsammans i den tredje master-filen för att hålla antalet filer på 4.)*

---

## 2. MVP-readiness per scout (svagast först)

Sjutton scouts ligger under 60/100. Tre värst exponerade affärsflöden är **fakturering, klubbinbjudan och avräkning**.

| # | Scout | MVP | Status |
|---|---|----:|---|
| 27 | Fortnox + invoicing | **18 / 100** | Klubborder skapar aldrig faktura, OAuth saknas, webhook no-op |
| 09 | Register team-leader | **35 / 100** | Org-search 401 pre-login; team skapas inte utan aktiv kampanj |
| 11 | Auth secondary (reset/MFA/logout-all) | **38 / 100** | Glömt-lösenord saknas helt; MFA är README-lögn |
| 18 | Club B2B portal | **42 / 100** | Inbjuden klubbmedlem kan inte logga in; cart tappas |
| 26 | Settlement + payouts | **42 / 100** | Ingen UI för att avsluta kampanj; ingen payout-PAID-flagga |
| 24 | Order confirmation | **48 / 100** | E-post bara på webhook; stepper är kosmetisk |
| 25 | Payments (Klarna) | **48 / 100** | Webhook blockas av CSRF i prod; ingen amount-reconciliation |
| 10 | Register seller | **52 / 100** | Tyst session-takeover; ingen guardian-consent |
| 22 | Shop cart | **52 / 100** | Kassan ignorerar sessionStorage; cart rensas aldrig |
| 32 | Forms | **54 / 100** | Inga `aria-invalid`; inputs zoomar i iOS Safari |
| 33 | Mobile | **54 / 100** | 14 px inputs (iOS zoom) + tap targets <44 px |
| 15 | Association admin | **54 / 100** | Ingen leveranser-vy; kan inte avsluta kampanj |
| 16 | Team leader portal | **54 / 100** | Inaktiv säljare blockas inte vid checkout |
| 17 | Seller portal | **56 / 100** | Fas 6-fält oanvända i UI; KPI/feed-konflikt |
| 12 | Portal RBAC | **58 / 100** | `/portal/*` saknar middleware-skydd |
| 19 | Portal AI | **58 / 100** | Pekar på `/v1/ai/public-chat` — role-prompts oanvända |
| 28 | Emails | **58 / 100** | Welcome-länk → `/logga-in` (404); milstolp-mail osända |
| 01 | Public landing | **58 / 100** | Tyst newsletter-opt-in; 5 MB LCP-bilder |
| 13 | Admin portal | **61 / 100** | False-green system-card; hårkods-MRR |
| 31 | API contracts | **61 / 100** | Ingen `error.code`; dubbla envelopes |
| 34 | Accessibility | **61 / 100** | Skip-link bryts utanför marketing; dolda paneler tabbbara |
| 14 | Sales pipeline | **62 / 100** | Quotes saknar status-lifecycle och e-postleverans |
| 08 | Register association | **62 / 100** | Servern ignorerar Zod-schema; ingen rate-limit |
| 20 | Portal statistik | **62 / 100** | `customer_orders` ignoreras i admin-stats |
| 29 | AI guardrails | **62 / 100** | Rate-limits fail open vid Redis-fel |
| 05 | Hair analysis | **68 / 100** | `ageConfirmed=true` hårdkodat utan UI |
| 06 | Public chat | **68 / 100** | Dialog tabbbar när stängd; stoppas inte vid close |
| 07 | Login | **68 / 100** | `?next=` ignoreras; ingen "logga ut alla" |
| 23 | Checkout | **68 / 100** | UI-total saknar frakt API lägger på |
| 30 | DB schema | **68 / 100** | `audit_logs` har 0 index; Fas 6-kolumner dead |
| 02 | Marketing pages | **72 / 100** | Kontaktform inte HTML-escapad |
| 04 | Legal + SEO | **78 / 100** | Telefon placeholder; AI-disclosure saknas i integritet |
| 21 | Shop page | NOT READY | Static bundle-card icke-köpbart; campaign_products ignoreras |
| 03 | Product pages | NOT READY | Catalog hårdkodat client-side; fel SKU i JSON-LD |
| 35 | End-to-end roles | 44 / 100 | Hela money-loop bryts; admin blind för fundraising |

---

## 3. Topp 20 P1-actions att fixa först

Sorterad efter blast radius × användarpåverkan. Allt detta finns med full kontext i `MASTER_01_CRITICAL.md`.

| # | Område | Fix | Effort |
|---|--------|-----|-------|
| 1 | **Klarna webhook blockas av CSRF i prod** — alla riktiga betalningar fastnar i PENDING (`S25 F-1.1` / `S35 F-1.3`). | Lägg `/v1/checkout/webhook` i `CSRF_EXEMPT_PATHS`. | **S** |
| 2 | **Glömt-lösenord saknas helt** — ingen UI, ingen API, ingen mall (`S07 F-1.2` / `S11 F-1.1`). | `password_reset_tokens`-tabell + `POST /v1/auth/forgot-password` + mall + UI. | **M** |
| 3 | **Inbjuden klubbmedlem kan aldrig logga in** — `passwordHash: invite-pending-{uuid}` (`S11 F-1.2` / `S18 F-1.6`). | Skicka invite-mail; accept-sida sätter lösenord och session. | **M** |
| 4 | **Welcome-mail länkar till `/logga-in` (404)** — drabbar association/team-leader/seller (`S07 F-1.1` / `S28 F-1.1` / `S35 F-2.4`). | Byt href → `/login` eller redirect. | **S** |
| 5 | **Server validerar inte registrera-payloads** — `RegisterAssociationSchema`/`RegisterSellerSchema` finns men anropas aldrig (`S08 F-1.1` / `S09 F-1.3` / `S10 F-2.2`). | `safeParse()` i topp av varje POST. | **S** |
| 6 | **Klarna fake-PAID utan riktig betalning** — stub-läget triggas tyst utan KLARNA_USERNAME/PASSWORD (`S25 F-1.2`). | Reject `POST /create` i prod när !isKlarnaConfigured. | **S** |
| 7 | **Klarna belopp valideras inte mot order** — vilken `checkout_complete` som helst flippar till PAID (`S25 F-1.3`). | Jämför `order_amount` mot `customer_orders.total_ore` före UPDATE. | **M** |
| 8 | **B2B-order skapar aldrig Fortnox-faktura** — `invoiceStatus` stuck på `NONE` (`S27 F-1.1`). | Efter order insert → `createInvoiceFromOrder` när `org.fortnoxCustomerId` finns. | **L** |
| 9 | **Avsluta kampanj saknas i UI** — blockerar hela settlement-pipen (`S15 F-1.4` / `S26 F-1.2` / `S35 F-1.2`). | `PATCH /v1/association/campaigns/:id/status` + UI "Avsluta kampanj". | **M** |
| 10 | **Shop ignorerar `campaign_products`** — visar hela globala katalogen (`S21 F-1.2`). | Filtrera shop-API på `campaign_products` när rader finns. | **S** |
| 11 | **`/portal/*` saknar middleware-skydd** — vilken authenticerad användare som helst kan ladda admin-shell (`S12 F-1.1` / `S13 F-2.7`). | Lägg `/portal` i `PROTECTED_ROUTES` med tillåtna roller. | **M** |
| 12 | **GDPR newsletter-opt-in tyst `true`** — i hero-CTA + hair-analysis utan checkbox (`S01 F-1.1` / `S05 F-1.1`). | Separat ocheckad checkbox `newsletterConsent`; default false. | **S** |
| 13 | **`ageConfirmed: true` skickas utan UI** — DB lagrar bekräftelse som aldrig fanns (`S05 F-1.2`). | Lägg åldersbekräftelse på gate-step eller ta bort fältet. | **S** |
| 14 | **Tyst session-takeover vid säljarregistrering** — förälder + barn på samma enhet (`S10 F-1.1` / `S11 F-3.2`). | Detektera aktiv session; returnera 409 `SESSION_CONFLICT`. | **M** |
| 15 | **Inget guardian-consent-flöde för minderåriga säljare** — Fas 6-schema dead (`S10 F-1.2` / `S30 F-1.1`). | Birth-year + guardian email/consent token vid signup. | **L** |
| 16 | **Inaktiv säljare blockas inte i shop/kassa** — paused-leader byter ingenting (`S16 F-1.2` / `S21 F-2.7` / `S23 F-2.8`). | 404/410 från shop + 400 från checkout när status=INACTIVE. | **S** |
| 17 | **Cart tappas på kassa-reload** — sessionStorage läses bara i shop-page (`S22 F-1.1` / `S23 F-2.4` / `S35 F-1.7`). | Importera `useCart(slug)` i kassa, fallback från storage. | **M** |
| 18 | **Cart rensas aldrig efter klar order** — risk för dubbel-order (`S22 F-1.2`). | Anropa `clear()` på bekräftelse-sidan + ta bort sessionStorage. | **S** |
| 19 | **Order-bekräftelse-mail bara på webhook** — `/confirm` flippar PAID utan att skicka (`S24 F-1.1` / `S25 F-1.5` / `S35 F-1.4`). | Extrahera `finalizePaidOrder()` helper; anropa från båda paths. | **S–M** |
| 20 | **Public order endpoints är okrypterade capability URLs (IDOR)** — UUID läcker maskad köparinfo (`S24 F-1.4` / `S25 F-2.7`). | HMAC `order_token` i Klarna-confirmation URL + krav i status-API. | **M** |

---

## 4. Tematiska kluster (cross-cutting)

Dessa hittades av flera scouts samtidigt — fixa roten en gång så stryker du många rader.

### A. Pengaflödet bryts mellan UI och bokföring
*S15, S18, S20, S24, S25, S26, S27, S28, S35*
- Klarna-webhook blockad av CSRF.
- Inget belopps-reconciliation före PAID.
- B2B-order → ingen Fortnox-faktura.
- Settlement går inte att starta från UI (kampanj kan inte avslutas).
- Payout-status fastnar på `INVOICED` (PAID-enum dead).
- Cart rensas aldrig + ingen idempotency på `POST /checkout/create` → duplikatorder.

### B. Auth, session och GDPR
*S07, S08, S09, S10, S11, S12, S30, S35*
- Glömt-lösenord saknas helt.
- Inbjuden klubbmedlem kan inte logga in.
- Session-takeover på delade enheter.
- Server validerar aldrig register-payloads (Zod-schema oanvända).
- Fas 6-schema (`birth_year`, `guardian_user_id`, `public_alias`, `hide_from_leaderboard`, `personal_message`) är dead code.
- `/portal/*` saknar middleware-skydd; rate-limits fail-open vid Redis-fel.
- `auth.login.failed` loggas men `auth.login.success` saknas för demos.
- MFA + BankID är README-claims utan implementation.

### C. Roll-handoffs som bryts
*S01, S02, S08, S09, S10, S15, S16, S17, S19, S35*
- `/registrera` finns inte i nav; CTA pekar till `/foreningsliv` (2 hopp).
- Org-search returnerar 401 för anonyma → team-leader-flödet kraschar tyst.
- ASSOCIATION_ADMIN på `/portal` → AdminDashboard + ADMIN_NAV (fel surface).
- TEAM_LEADER / SELLER på `/portal/saljare` → ser CRM-säljare istället för ungdomar.
- Welcome-mail länkar `/logga-in` (404) för alla roller.
- ASSOCIATION_ADMIN saknar leveranser-vy helt (TL ser `/lag/bestallningar`).
- Portal AI på `/v1/ai/public-chat` med role-prompts som aldrig laddas.

### D. Commerce / shop / cart
*S21, S22, S23, S24, S25, S33*
- Static "399 kr"-bundle är inte köpbar; shop ignorerar `campaign_products`.
- Cart-state delas inte mellan shop och kassa.
- Frakttotal på UI ≠ vad Klarna debiterar (campaign shipping fee saknas i summary).
- `publicAlias` / `personalMessage` finns i schema men inte i shop-API/UI.
- Bekräftelse-sida saknar line items, frakt, moms.
- Tracking-steps är kosmetiska (SHIPPED/DELIVERED triggas aldrig).

### E. AI guardrails
*S05, S06, S19, S29*
- Portal AI använder PUBLIC-prompt → kan inte svara om pipeline/KPI/admin (men chips lovar det).
- User-namn injiceras osaniterat i system-prompt.
- Inga audit-loggar för rate-limit-hits, fallbacks eller upprepade fel.
- Rate-limit fail-open vid Redis-outage drabbar all AI samtidigt.
- Conversational state lost on refresh; dialog förblir tabbbar när stängd; stream avbryts inte vid close.

### F. Data-architecture: B2B `orders` vs B2C `customer_orders`
*S13, S18, S20, S27, S35*
- `/portal/dashboard` och `/portal/statistik` läser bara `orders` → fundraising är osynlig för admin.
- "Aktiva klubbar" KPI räknar alla org-typer.
- "MRR" är livstidstotal, inte rullande månadsvärde.
- `/portal/clubs` (UI) säger "klubbar" men API returnerar alla typer.

### G. Mobil & A11y (verifierat av flera scouts)
*S01, S05, S06, S08, S16, S17, S22, S23, S32, S33, S34*
- 14 px inputs överallt → iOS zoom-on-focus.
- Tap targets < 44 px på hamburger (32), portal-nav (40), shop +/- (32), fundraising-nav (36).
- Skip-länk fungerar bara på marketing (saknar `id="main-content"` annars).
- Dolda dialoger (chat, mobil-nav, portal-sidebar) tabbbara via tangentbord.
- Hero LCP-bilder ~5 MB (PNG sparade som .jpg).
- Sticky bottom-CTA + chat-FAB kolliderar på 360 px.
- Autocomplete saknas på namn/email/tel/adress i kassa.
- Inga `aria-invalid` / `aria-describedby` mellan inputs och felmeddelanden.

### H. API-contracts & schema-drift
*S30, S31, S32*
- `@roots/contracts` Zod-schema finns men anropas aldrig i REST-routes.
- Drizzle-schema lovar index (`orders_created_at_idx`, `quotes_status_idx`) som inte finns i SQL.
- `audit_logs` har noll index (Fas 5 ger snabb degradering).
- `customer_orders` fields, `orders` fields, `quote_id` saknar FK.
- `apiFetch` slukar non-JSON-fel; `portalFetch` validerar bara `/v1/portal/*`.
- Tre olika success-envelope (`{ok, data}`, `{ok}`, bare object).
- Inga `Retry-After` / `X-RateLimit-*` headers.

### I. Communications & notiser
*S15, S16, S24, S26, S28*
- Welcome-mail trasig (`/logga-in` 404) för alla roller.
- Milstolp-mail definierade men aldrig triggade.
- Kampanj-start-mail finns men anropas aldrig vid create/activate.
- Säljar/team-leader får ingen notis när ny order kommer in.
- Settlement complete → ingen mail till assoc admin.
- Production kan boota utan `RESEND_API_KEY` → tysta mail-drop.
- Inbjudningar utan automatisk e-post (klubbmedlem, team-leader, säljare).

### J. Trust, legal & SEO
*S01, S02, S04, S05, S28*
- Telefon `+46 8 000 000 00` exponeras i JSON-LD.
- Hårvård vs hudvård narrativsplit (metadata, hero, om-oss, foreningsliv, header).
- Ingen AI/automated-decision-disclosure i integritetspolicy.
- Per-page Open Graph saknas på de flesta marketing-routes.
- Mail-footer saknar fullständig LegalIdentity (org.nr, momsregistr.).
- `Brand` story split + identifierbara grundare saknas.
- "500+ analyser"-räknare osourcad.

---

## 5. Föreslagen sprint-ordning

Baserat på riskvolym, beroenden och blast radius:

### Sprint 1 — Pengar & säkerhet (1 vecka)
1. Klarna CSRF-exempt + amount-reconciliation + stub-guard (P1 #1, #6, #7).
2. Order-bekräftelse-mail från `/confirm` + cart-clear post order (P1 #18, #19).
3. Glömt-lösenord-flow + welcome-link fix + invited-member accept (P1 #2, #3, #4).
4. Server Zod-validation på alla register-routes (P1 #5).
5. `/portal/*` middleware-skydd (P1 #11).
6. AI rate-limit fail-closed (Tema E).
7. `audit_logs` index + audit calls på ordrar (Tema H, I).

### Sprint 2 — MVP-flow för fundraising (1–2 veckor)
8. `PATCH campaigns/:id/status` + UI "Avsluta kampanj" (P1 #9).
9. Settlement-UI på `/forening/avrakning` (Tema A).
10. Shop ignorerar `campaign_products` → fix + bundle-CTA (P1 #10).
11. Cart-persistence kassa hydration (P1 #17).
12. INAKTIV säljare blockas i shop+checkout (P1 #16).
13. Roll-redirect i `/portal` för fundraising-roller (Tema C).

### Sprint 3 — GDPR & ungdomar (1 vecka)
14. Guardian-consent-flöde + birth-year (P1 #15).
15. Hair-analysis newsletter-checkbox + ageConfirmed-UI (P1 #12, #13).
16. Session-takeover-skydd (P1 #14).
17. `publicAlias` / `hideFromLeaderboard` aktiveras i shop + leaderboard (Tema D, B).
18. Public order endpoints HMAC-skyddade (P1 #20).

### Sprint 4 — Mobil & A11y (1 vecka)
19. Globala `Input` text-base; tap targets ≥44 px (Tema G).
20. Autocomplete på kassa + register; `aria-invalid` + `role="alert"`.
21. Dolda paneler `inert`; skip-länk fixad i alla layouts.
22. Sticky CTA + chat-FAB conflict; safe-area.

### Sprint 5 — Polish & long tail (löpande)
23. Resterande P2 enligt `MASTER_02_NECESSARY.md`.
24. P3/P4 enligt prioritering i `MASTER_03_IMPROVEMENT.md`.
25. Fortnox OAuth + invoice-flow för B2B (P1 #8, P2 invoicing).
26. Brand narrative-fix (hårvård vs hudvård) + per-page OG/canonical.

---

## 6. Navigation till master-filerna

| Fil | Innehåll |
|-----|----------|
| `MASTER_00_INDEX.md` | Denna fil — översikt, sprint-ordning, top-20. |
| `MASTER_01_CRITICAL.md` | Alla **164 P1-fynd**, grupperade i 10 teman, med fil-ref + fix + effort. |
| `MASTER_02_NECESSARY.md` | Alla **292 P2-fynd**, grupperade i 10 teman, kompakt format. |
| `MASTER_03_IMPROVEMENT.md` | Alla **194 P3- + 87 P4-fynd**, grupperade per tema, single-line format. |

Sub-extracts per grupp (för referens):
- Group 1 (scouts 1–11, Public + Onboarding): 220 fynd
- Group 2 (scouts 12–20, Portals): 195 fynd
- Group 3 (scouts 21–28, Commerce): 168 fynd
- Group 4 (scouts 29–35, Infrastructure + Cross-cutting): 154 fynd

---

## 7. Hur master-filerna är strukturerade

Inom varje master-fil grupperas fynd under tematiska rubriker (samma 10 teman A–J som i avsnitt 4). Inom varje tema sorteras fynden efter scout-id för spårbarhet.

Varje fynd har formatet:
```
[Scout-id F-X.Y] Titel  —  Effort: S/M/L
File(s): exakt fil/rad
Symptom: 1–2 meningar
Fix: 1–2 meningar
```

Cross-references mellan scouts (`Ref audit: ...`) är bevarade när relevant.

---

## 8. Vad som faktiskt fungerar (positivt)

Det är inte allt som är trasigt. Scouterna verifierade aktivt följande som **godkänt sedan april-auditen**:

- `LegalIdentityBlock` syns nu i footer/kontakt/villkor/integritet (S01).
- Organization JSON-LD har legalName + vatID + sameAs (S01).
- Footer är harmoniserad; integritetspolicy-länk fixad (`/integritet`) (S01).
- Hårdkodade "500+/23 föreningar"-räknare borttagna från hero (S01).
- Sessions-cookie: httpOnly, secure i prod, SameSite=none för cross-origin (S12).
- Logout förstör session + CSRF på POST (S12).
- `/portal/system`, `/sellers`, `/pipeline` har korrekta role-guards på API-nivå (S13).
- Audit-log nav syns bara för INTERNAL_ADMIN; non-admin får 403 (S12).
- Klarna `merchantUrls.confirmation` → bekräftelse?order_id= fungerar (S24).
- Tack-länken "Se orderstatus" matchar mailets URL (S24).
- Health-probes (`/readyz` 503 vid down) är korrekt utformade för load-balancers (S31).
- Global `onError` läcker inte stacktraces i prod (S31).
- Monetära fält är konsekvent `*Ore`-suffixade; camelCase i hela JSON (S31).

Behåll dessa — fixa runt dem.

---

*Master-filerna är genererade från 35 scout-rapporter på ~17 500 rader. Vid avvikelse mellan master och källfil är källfilen sanning.*
