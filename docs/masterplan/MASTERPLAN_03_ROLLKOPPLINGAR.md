# MASTERPLAN 03 — ROLLKOPPLINGAR

**Källa:** 35 MVP-scout-rapporter + 10 flow-audit-rapporter + Modell_register.docx.
**Syfte:** Ingen funktion existerar i isolation. Varje handoff mellan roller är där MVP står eller faller.

> Disciplin: En "fungerande feature" som dör i handoffen mellan roller är **inte fungerande**. Den här planen är hela graf-skissen över hur identiteter, data, och förtroende flödar genom plattformen.

---

## Sammanfattning

Plattformen har **8 roller** och **24 distinkta handoffs** mellan dem. Av dessa är **9 trasiga eller halv-fungerande idag** — de blockerar end-to-end-flödet, oavsett hur polerade individuella sidor är.

### Roll-grafen

```
                  PUBLIC_VISITOR
                       │
                       ├── (hair-analysis) ──→ LEAD (waitlist)
                       │
                       └── (registrera) ──→ ASSOCIATION_ADMIN
                                                │
                                                ├── (skapar kampanj)
                                                │
                                                ├── (bjuder in TL) ──→ TEAM_LEADER
                                                │                            │
                                                │                            ├── (bjuder in seller) ──→ SELLER
                                                │                            │                            │
                                                │                            │                            └── (delar shop) ──→ SUPPORTER
                                                │                            │                                                       │
                                                │                            │                                                       └── (köper) ──→ ORDER
                                                │                            │
                                                │                            └── (följer upp seller) ──→ NUDGE
                                                │
                                                └── (settlement → payout) ──→ INTERNAL_ADMIN (oversight)
                                                                                    │
                                                                                    └── (Fortnox invoice) ──→ ASSOCIATION_ADMIN

CLUB_ADMIN ──→ CLUB_MEMBER ──→ ORDER (B2B)
     │
     └── (assigned to) ──→ SALES_REP ──→ SALES_ADMIN (oversight) ──→ INTERNAL_ADMIN
```

### Status-matris (24 handoffs)

| # | Handoff | Status | Owner-roller | Master-ref |
|--:|---------|--------|--------------|------------|
| 1 | PUBLIC → LEAD (hair-analysis) | 🟡 Halv | Public · Marketing | KC4, H10 |
| 2 | PUBLIC → ASSOCIATION_ADMIN (signup) | 🔴 Trasig | Public · Onboarding | KC3 |
| 3 | ASSOCIATION_ADMIN → CAMPAIGN (creation) | 🔴 Trasig | Assoc · Backend | KC3 |
| 4 | ASSOCIATION_ADMIN → TEAM_LEADER (invite) | 🔴 Trasig | Assoc · Email · Auth | KC3 |
| 5 | TEAM_LEADER → SELLER (invite) | 🔴 Trasig | TL · Email · Auth | KC3, H4 |
| 6 | SELLER → PUBLIC_SHOP (shop creation) | 🟡 Halv | Seller · Slug-gen · SEO | KC7 |
| 7 | SELLER → SUPPORTER (share) | 🟡 Halv | Seller · Sharing | H1, H2 |
| 8 | SUPPORTER → ORDER (checkout) | 🔴 Trasig | Shop · Checkout · Klarna | KC1, KC4 |
| 9 | ORDER → SELLER (notification) | 🟢 OK | Email · Seller-dashboard | — |
| 10 | ORDER → TEAM_LEADER (rollup) | 🟡 Halv | TL-dashboard · Realtime | H4 |
| 11 | ORDER → ASSOCIATION_ADMIN (rollup) | 🟡 Halv | Assoc-dashboard | H3, H9 |
| 12 | CAMPAIGN_END → SETTLEMENT (calc) | 🔴 Trasig | Settlement · Backend | KC1 |
| 13 | SETTLEMENT → PAYOUT (invoice via Fortnox) | 🔴 Trasig | Fortnox · Backend | KC1 |
| 14 | PAYOUT → ASSOCIATION_ADMIN (notify) | 🔴 Trasig | Email · Settlement | KC1 |
| 15 | INTERNAL_ADMIN → ALL_ORGS (oversight) | 🟡 Halv | Admin-portal · RBAC | KC2 |
| 16 | CLUB_ADMIN → CLUB_MEMBER (invite) | 🟢 OK | Portal · Email | — |
| 17 | CLUB_MEMBER → ORDER (B2B checkout) | 🟡 Halv | Portal · Checkout | H5 |
| 18 | CLUB_ADMIN → SALES_REP (assigned to) | 🔴 Trasig | CRM · Territory | KC2, H6 |
| 19 | SALES_REP → QUOTE (lifecycle) | 🟡 Halv | Pipeline · Quote | H6 |
| 20 | QUOTE → ORDER (acceptance) | 🟡 Halv | Quote · Checkout | H6 |
| 21 | SALES_REP → SALES_ADMIN (oversight) | 🟢 OK | Portal · RBAC | — |
| 22 | AI → ALL_ROLES (concierge) | 🟡 Halv | AI · Prompts | H7 |
| 23 | AUDIT_LOG → INTERNAL_ADMIN (forensics) | 🟡 Halv | Audit · System | KC8 |
| 24 | NOTIFICATION → USER (transactional) | 🟡 Halv | Email · Channels | KC8 |

**Legend:** 🔴 Trasig (blocker) · 🟡 Halv (works but lossy) · 🟢 OK.

---

# DEL 1 — KRITISKA HANDOFFS (9 trasiga)

> Dessa måste fungera för att MVP ska räknas som "fungerande". Var och en är en kedja som dör vid första svaga länk.

---

## HANDOFF 2: PUBLIC → ASSOCIATION_ADMIN (signup)

### Vad ska flöda

En public-besökare som klickat "Anslut din förening" → måste bli ASSOCIATION_ADMIN med en aktiv kampanj inom **10 minuter**, utan support.

### Nuvarande tillstånd (trasigt)

1. Discovery: "Anslut förening" finns inte i header-nav → måste hitta `/registrera` via foreningsliv-page.
2. Wizard: 3-step form, men inget orgs-search → admin skriver namn manuellt → duplicate-risk.
3. Post-signup redirect: `/forening` (tom portal) — ingen setup-wizard, ingen "skapa kampanj"-modal auto-öppnad.
4. Validering: org-nr inte validerat. Implicit consent på integritetspolicy.
5. Welcome-email länkar `/logga-in` → 404.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `email`, `password` | Form | `users` | ✓ |
| `orgName`, `orgNumber`, `address` | Form | `organizations` | 🟡 (no validation, no dedup) |
| `contactName`, `contactPhone` | Form | `users` | 🟡 (no phone format) |
| `consentAt` | Form checkbox | `users.consentAt` | 🔴 (implicit, not stored) |
| `onboarding_state` | Wizard completion | `users.onboarding_state` | 🔴 (not stored) |

### Fix-sequence

1. **Discovery:** Lägg "Anslut förening"-CTA i public-header. (S — `header.tsx`)
2. **Org-search pre-auth:** Open `GET /v1/orgs/search?q=` public (rate-limited). (S — `auth.ts`)
3. **Org-nr-validering:** Klient-mask `\d{6}-?\d{4}` + Luhn. Server-side reject. (S)
4. **Explicit consent-checkbox:** Required checkbox med länk till villkor + integritet. Spara `consentAt`. (S — `registrera/page.tsx`)
5. **Post-signup wizard:** Redirect till `/forening?onboarding=1`, auto-öppna campaign-modal med templates. (M)
6. **Welcome-email fix:** `/logga-in` → `/login`. (S — `templates.ts`)
7. **Email-validation av deliverability:** Använd `clean.email` eller bara dokumentera "tested patterns". (S)

### Success criteria

- [ ] Public-besökare når aktiv kampanj inom 10 min.
- [ ] Org-nr-format validerat (regex + Luhn).
- [ ] `consentAt` stored på user-row.
- [ ] Welcome-email-länkar går till 200 OK.
- [ ] Duplicate-orgs varnas, blockas vid 95%-name-match.

### Referenser

`MASTERPLAN_01 KC3 punkt 1, 2, 6`, `MASTERPLAN_02 H3`.

---

## HANDOFF 3: ASSOCIATION_ADMIN → CAMPAIGN (creation)

### Vad ska flöda

Admin → kampanj med start-/slutdatum, produkter, vinstmål, leverans-typ, payout-modell.

### Nuvarande tillstånd (trasigt)

1. Campaign skapas direkt med status `ACTIVE` — ingen DRAFT-lifecycle.
2. Inga campaign-templates → admin börjar från scratch.
3. Inga pre-launch-checklist före activate ("har du TL?", "har du sellers?").
4. Multi-campaign: ingen warning innan en andra ACTIVE-kampanj öppnas.
5. Settlement-rates: hårdkodade istället för campaign-konfigurerbara.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `name`, `description` | Form | `campaigns` | ✓ |
| `startDate`, `endDate` | Form | `campaigns` | ✓ |
| `goalAmountOre` | Form | `campaigns` | ✓ |
| `deliveryType` | Form | `campaigns` | 🟡 (not enforced in checkout) |
| `productIds[]` | Form | `campaign_products` | ✓ |
| `teamShareOre`, `rootsShareOre` per produkt | Templates | `products` | 🔴 (hardcoded) |
| `status` lifecycle | Lifecycle | `campaigns.status` | 🔴 (skips DRAFT) |

### Fix-sequence

1. **DRAFT → ACTIVE lifecycle:** Default create-status `DRAFT`. Separate `POST /campaigns/:id/activate`. (M — `association.ts`)
2. **Campaign-templates:** ~6 templates (klassresa, läger, höstkampanj). Spara `campaign_templates`-tabell. (M)
3. **Pre-launch checklist:** Modal innan `activate` — varnar men tillåter. (S)
4. **Multi-campaign warning:** Vid `activate` om andra ACTIVE finns: confirmation. (S)
5. **Campaign-level support-tier rates:** Schema `campaigns.support_tier` (basic | standard | premium). Mappa till `teamShareOre`-bonus. (M)
6. **Delivery-type enforcement:** `kassa/page.tsx` använder `campaign.deliveryType` istället för båda options. (S)

### Success criteria

- [ ] Kampanj kan vara DRAFT, redigeras, aktiveras med audit-log.
- [ ] Template-baserad kampanj-skapning < 2 min för standard-mix.
- [ ] Settlement-rates per kampanj (inte hårdkodade).
- [ ] Checkout endast visar deliveries enligt kampanj-config.

### Referenser

`MASTERPLAN_01 KC1 punkt 3`, `MASTERPLAN_02 H3`.

---

## HANDOFF 4: ASSOCIATION_ADMIN → TEAM_LEADER (invite)

### Vad ska flöda

Admin → invite-länk → TL får email → klick → signup → matchas till team & org.

### Nuvarande tillstånd (trasigt)

1. Admin skapar TL via `POST /v1/association/leaders` → genererar token men **skickar inget email**.
2. Admin måste manuellt kopiera URL och skicka.
3. TL claimar: success men welcome-email länkar `/logga-in` → 404.
4. Audit-log saknar `team_leader.invited` event.
5. Ingen "Bjud in flera"-bulk-flow.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `email`, `name`, `phone` | Form | `users` (via invite-claim) | 🟡 |
| `inviteToken` | Server-gen | `team_leader_invites` | ✓ |
| `inviteEmail` | Form | Email-send | 🔴 (manual copy) |
| `orgId` | Session | Invite-claim | ✓ |
| `claimedAt`, `expiresAt` | Token-lifecycle | `team_leader_invites` | 🟡 (no expiry) |

### Fix-sequence

1. **Skicka invite-email server-side:** Vid `POST /association/leaders`, sicka email via `getEmailSender()`. (M)
2. **Email-template:** "Du har blivit inbjuden av {assocAdminName} att leda ett lag för {orgName}". Förklara vad TL gör. (S)
3. **Welcome-email-länkar:** `/logga-in` → `/login`. (S)
4. **Token-lifecycle:** `expiresAt = now() + 14 days`, `usedAt = null`. (S)
5. **Audit-log:** `team_leader.invited`, `team_leader.claimed`. (S)
6. **Bulk-invite UI:** `/forening/lag` → "Bjud in flera" med email-list. (M)
7. **Notify assoc-admin när TL claimar:** Email "Erik har accepterat — han är nu lagledare för {teamName}". (S)

### Success criteria

- [ ] Email skickas inom 60 s efter invite.
- [ ] TL claimar → assoc-admin notified inom 60 s.
- [ ] Invite-token expirerar efter 14 dagar.
- [ ] Bulk-invite: 50 sellers via CSV på en gång.
- [ ] Audit-log har båda events.

### Referenser

`MASTERPLAN_01 KC3 punkt 2, 3, 4`, `MASTERPLAN_02 H4`.

---

## HANDOFF 5: TEAM_LEADER → SELLER (invite)

### Vad ska flöda

TL skapar invite-länk → seller får länk (eller QR) → claimar → assignas till team & campaign.

### Nuvarande tillstånd (trasigt)

1. Invite-token är **permanent multi-use, no expiry**.
2. Svenska namn ger trasiga shop-slugs (`Åsa Söderström` → `""`).
3. Welcome-email länkar `/logga-in` → 404.
4. Seller-success-screen utan klickbar shop-länk.
5. Email-invite-templates exposed i UI men UI använder dem inte.
6. Audit-log saknar `seller.invited` event.
7. Ingen privacy-fields (publicAlias, hideFromLeaderboard, personalMessage) collectade vid signup.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `email`, `name`, `phone` | Form | `users`, `sellers` | ✓ |
| `birthYear`, `guardianUserId` | Form (minor consent) | `users.birthYear`, `guardianUserId` | 🟡 (schema added, no UI) |
| `publicAlias`, `hideFromLeaderboard`, `personalMessage` | Form | `sellers.*` | 🟡 (schema added, no UI) |
| `slug` | Generated from name | `sellers.slug` | 🔴 (broken on åäö) |
| `teamId`, `campaignId` | Invite-token | `sellers.*` | ✓ |

### Fix-sequence

1. **Token-rotation:** `team_invites.expires_at`, `max_uses`. UI "Skapa ny länk". (M — connects MASTERPLAN_02 H4-E)
2. **Slug-fix:** `slugify` med svensk-locale. Transliterera. Asserta i tests. (S — `auth.ts:756`)
3. **Welcome-email:** `/login` instead of `/logga-in`. Extra CTA "Öppna min shop" → `/min-shop`. (S)
4. **Success-screen:** Omedelbar "Visa min shop"-knapp + secondary "Gå till dashboard". (S)
5. **Optional onboarding-step:** Privacy-fields + personal-message vid signup ELLER vid första `/min-shop`-besök. (M)
6. **Minor consent (om birthYear < 18):** Kräv `guardianUserId` invite-flow. (M)
7. **Templates exposed:** "Kopiera SMS / E-post"-knappar på `/lag/saljare`. (S)
8. **Audit-log:** `seller.invited`, `seller.claimed`. (S)

### Success criteria

- [ ] Token expirerar och kan roteras.
- [ ] `Åsa Söderström` får valid slug (`asa-soderstrom`).
- [ ] Welcome-email-länkar funkar.
- [ ] Seller på sin shop inom 30 s efter signup.
- [ ] Minor (under 18) kräver guardian-consent innan shop aktiveras.
- [ ] Audit-log för båda events.

### Referenser

`MASTERPLAN_01 KC3 punkt 2-8`, `MASTERPLAN_02 H1, H4`.

---

## HANDOFF 8: SUPPORTER → ORDER (checkout)

### Vad ska flöda

Supporter på shop → add-to-cart → kassa → Klarna → bekräftelse → email.

### Nuvarande tillstånd (trasigt)

1. Cart-state: dual stores (sessionStorage + URL) som desynkar.
2. Inactive seller inte blockad i checkout — orphan-orders skapas.
3. Köpvillkor-checkbox saknas → implicit consent.
4. Klarna webhook blockas av CSRF → orders fastnar PENDING.
5. Cart inte rensad efter PAID.
6. Order-bekräftelse-email bara via webhook → no fallback.
7. Per-field-validation saknas → error-mapping är "Något gick fel".
8. Payment-cancel återgår till nakna `/kassa` utan recovery-banner.
9. Säljar-attribution strippad på checkout-header.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `cart_items[]` | Storage/URL | `POST /checkout` | 🟡 (dual source) |
| `customer_email`, `name`, `address`, `phone`, `postalCode`, `city` | Form | `customer_orders` | ✓ |
| `delivery_type` | Form (constrained by campaign) | `customer_orders` | 🔴 (not constrained) |
| `consent_accepted_at` | Checkbox | `customer_orders` | 🔴 (missing) |
| `seller_id`, `campaign_id` | URL / shop | `customer_orders` | ✓ |
| `klarna_order_id` | Klarna-create | `customer_orders` | ✓ |
| `status` lifecycle: PENDING → PAID → CONFIRMED | Webhook | `customer_orders.status` | 🔴 (CONFIRMED dead) |
| `audit_log` rows | Lifecycle events | `audit_logs` | 🔴 (missing) |

### Fix-sequence

1. **Klarna webhook CSRF-exempt:** Add `/v1/checkout/webhook` to `CSRF_EXEMPT_PATHS`. (S — `app.ts`)
2. **Cart single source of truth:** Storage-first med URL-sync. Cross-tab listener. (M — `use-cart.ts`)
3. **Block inactive seller:** `checkout.ts:82-90` — 400 om `seller.status !== "ACTIVE"`. (S)
4. **Consent-checkbox:** Required, gate submit, store `consent_accepted_at`. (S)
5. **Per-field validation:** API returnerar `{ fieldErrors }`, UI mappar till inline. (M)
6. **Payment-cancel recovery:** Klarna `cancel_url` appendar cart-query. Recovery-banner. (M)
7. **Cart-clear efter PAID:** `bekraftelse/page.tsx` triggar `clearCart(slug)`. (S)
8. **Order-confirmation fallback:** Extrahera `sendOrderConfirmation()`, anropa från båda paths med dedupe. (M)
9. **Audit-log lifecycle:** `order.created`, `order.paid`, `order.confirmed`. (S)
10. **Säljar-attribution-header:** Utöka kassa-fetch + rendera "Du stöder {sellerName}". (S)
11. **Delivery-type-constraint:** Visa endast `campaign.deliveryType`-options. (S)

### Success criteria

- [ ] 100 testorders end-to-end utan manuell intervention.
- [ ] Cart synkar mellan tabs inom 1 s.
- [ ] Inactive seller blockas innan order skapas.
- [ ] Klarna webhook 200 OK → PAID-transition < 5 s.
- [ ] Cart rensad efter bekräftelse.
- [ ] Confirmation-email skickas både via webhook och fallback (dedupliceras).
- [ ] Audit-log har alla transitions.

### Referenser

`MASTERPLAN_01 KC1, KC4`, `MASTERPLAN_02 H2`.

---

## HANDOFF 12: CAMPAIGN_END → SETTLEMENT (calc)

### Vad ska flöda

Kampanj slut → batch beräknar per-team-sales → genererar payout-rows → kampanj status ENDED → SETTLED.

### Nuvarande tillstånd (trasigt)

1. Settlement använder fel rates (campaign vs product, hårdkodade).
2. Skapar payout-rader för zero-sales teams.
3. Order-status-filter fragile för framtida fulfillment-workflows.
4. Re-settlement efter correction blockerat utan safe amendment-path.
5. Status-check är utanför transaction → race-condition vid concurrent generate.
6. Settlement-audit saknar payout-IDs och amount-checksum.
7. Inga notify-emails när payout genereras.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `campaign_id` | Trigger | `payouts.campaign_id` | ✓ |
| `team_id` | Per team | `payouts.team_id` | ✓ |
| `total_sales_ore` | Σ orders PAID per team | `payouts.total_sales_ore` | 🟡 (filter fragile) |
| `team_share_ore` | Rate * total_sales_ore | `payouts.team_share_ore` | 🔴 (wrong rate source) |
| `roots_share_ore` | Same | `payouts.roots_share_ore` | 🔴 |
| `status` lifecycle: PENDING → INVOICED → PAID | Lifecycle | `payouts.status` | 🔴 (PAID never reached) |
| Audit-log | Settlement-run | `audit_logs` | 🟡 (lacks payout-IDs) |

### Fix-sequence

1. **Read rates from campaign/product-level:** `settlement.ts` — pulla från `campaigns.support_tier` eller `products.team_share_ore`. (S)
2. **Skip zero-sales-teams:** Insert-guard `if totalSalesOre > 0`. (S)
3. **Centralize eligible-statuses:** `lib/settlement/eligible-orders.ts` — single source of order-status-filter. (S)
4. **Move status-check inside tx:** `settlement.ts:67-69` — race condition. Move inside transaction. (S)
5. **Re-settlement amendment-path:** ADR: allow `SETTLED → ENDED` med audit + block if any payout INVOICED. Eller delta-adjustment-job. (M)
6. **Audit-meta enrichment:** Add `payoutIds[]`, `totalTeamShareOre`, `totalRootsShareOre`, `checksum`. (S)
7. **Notify-email per payout:** TL + assoc-admin får "Avräkning klar för {teamName}". (S — `templates.ts`)
8. **Settlement-preview during campaign:** Read-only `/forening/avrakning?preview=1` — live calculation utan att persist. (M, also part of H3)

### Success criteria

- [ ] Re-settlement på samma kampanj är idempotent (samma input = samma output).
- [ ] Audit-log har payout-IDs + checksum för varje run.
- [ ] Zero-sales-team → ingen payout-rad.
- [ ] Notify-email per payout går ut inom 60 s.
- [ ] Concurrent settlement-attempts → en lyckas, andra returnerar conflict.

### Referenser

`MASTERPLAN_01 KC1 punkt 3-7`, `MASTERPLAN_02 H3`.

---

## HANDOFF 13: SETTLEMENT → PAYOUT (invoice via Fortnox)

### Vad ska flöda

Payout PENDING → Fortnox invoice created → payout status INVOICED → eventually PAID.

### Nuvarande tillstånd (trasigt)

1. Fortnox provider `createOrUpdateCustomer` always POSTar (no lookup/update).
2. Fortnox `invoiceCustomer.name` läses från fel kolumn (tomt).
3. InvoiceLine saknar `VATPercent`, `AccountNumber`.
4. ArticleNumber = SKU, men artiklar finns kanske inte i Fortnox.
5. PAID-status never reached (no webhook-handler för betalning).
6. `orders.invoiceStatus` uppdaterad ingenstans i API.
7. No retry på transient Fortnox-failures.
8. Webhook-dedup är in-memory only.
9. `FORTNOX_ENABLED=true` utan token degraderar tyst till NullProvider.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `org_id`, `org_number`, `name`, `address` | `organizations` | Fortnox-customer | 🔴 (wrong join) |
| `fortnox_customer_id` | Fortnox-response | `organizations.fortnox_customer_id` | 🟡 (no update) |
| `InvoiceLine[]` | Payout/order | Fortnox-invoice | 🔴 (incomplete) |
| `fortnox_invoice_id` | Fortnox-response | `payouts.fortnox_invoice_id` | ✓ |
| `payout.status` lifecycle | Webhook/manual | `payouts.status` | 🔴 |

### Fix-sequence

1. **Customer-lookup before POST:** Search Fortnox by org-number. PUT update if exists. (M)
2. **Fix invoiceCustomer.name JOIN:** `fortnox-provider.ts:65-78` — pulla `organizations.name`, `orgNumber`, `address`. (S)
3. **InvoiceLine VAT + AccountNumber:** Schema-extend products med vatPercent (25/12/6/0), accountNumber. (M)
4. **Product-sync-job to Fortnox:** Pre-create articles vid product-create. (M)
5. **Payout PAID-transition:** Either Fortnox payment-webhook OR `PATCH /v1/settlement/payouts/:id/status` (INTERNAL_ADMIN). (M)
6. **Update `orders.invoiceStatus`:** Centralisera transitions i webhook/sync/post-create-hook. (S)
7. **Retry on transient failures:** Idempotent GETs retry. Invoice-create queue med dedupe-key. (M)
8. **Persistent webhook-dedup:** Redis/Postgres med 24h TTL istället för in-memory Set. (S)
9. **Boot-fail on misconfig:** `FORTNOX_ENABLED=true` utan token = boot-fail i prod. (S)

### Success criteria

- [ ] 10 testfakturor i Fortnox staging med rätt kund, 25% moms, korrekt artikelnummer.
- [ ] Payout kan nå PAID med audit-log.
- [ ] Webhook-dedup överlever restart.
- [ ] Boot failar om `FORTNOX_ENABLED=true` utan token.
- [ ] Transient Fortnox-failure → retry inom 1 min med exponential backoff.

### Referenser

`MASTERPLAN_01 KC1 punkt 4-5, KC8 punkt 1, 3`, `MASTER_02 P2 Fortnox-block`.

---

## HANDOFF 14: PAYOUT → ASSOCIATION_ADMIN (notify)

### Vad ska flöda

Payout INVOICED/PAID → email till assoc-admin + TL + dashboard-notification.

### Nuvarande tillstånd (trasigt)

1. Ingen notify-email på payout-create.
2. Ingen notify-email på payout-INVOICED.
3. Ingen in-app notification-inbox.
4. Dashboard-widget för senaste payouts saknas.
5. Settlement-PDF för revisor saknas.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `payout_id`, `amount_ore`, `team_id`, `campaign_id` | `payouts` | Email | 🔴 |
| `invoice_url` | Fortnox | Email | 🔴 |
| `expected_payment_date` | Calc | Email | 🔴 |

### Fix-sequence

1. **Email på `payout.invoiced`:** "Avräkning klar för {teamName}, {amount} SEK kommer in på ert konto inom 14 dagar." (S)
2. **Email på `payout.paid`:** "Pengarna är på ert konto idag." (S)
3. **In-app notification-inbox:** `notifications`-tabell + bell-icon i portal-header. (M — part of MASTERPLAN_02 cross-cut)
4. **Dashboard-widget "Senaste utbetalningar":** På `/forening` + `/portal`. (S)
5. **Settlement-PDF:** HTML→PDF per kampanj för revisor. (M)
6. **CSV/Excel-export av settlement:** `GET /v1/settlement/:campaignId/export?format=csv`. (S)

### Success criteria

- [ ] Email per payout-state-change inom 60 s.
- [ ] Notification-inbox visar senaste 10 events.
- [ ] Settlement-PDF har signatur-fält för revisor.
- [ ] CSV-export öppnar i Excel utan formatting-issues.

### Referenser

`MASTERPLAN_01 KC1 punkt 5, KC8 punkt 2`, `MASTER_02 P3 Comms-block`.

---

## HANDOFF 18: CLUB_ADMIN → SALES_REP (assigned to)

### Vad ska flöda

CLUB_ADMIN är assigned till en SALES_REP (territory-baserat). SALES_REP ser sina kunder. CLUB_ADMIN ser sin sales-contact.

### Nuvarande tillstånd (trasigt)

1. `klubbar` endpoint returnerar global catalog för SALES_REP — ingen territory-filter.
2. Ingen `assigned_asm_user_id`-FK i `organizations`-tabell (eller används inte).
3. CLUB_ADMIN ser inte vem som är deras sales-contact.
4. SALES_REP `/portal/klubbar` har inget "mina kunder"-filter.
5. SALES_ADMIN kan inte assigna leads till specific SALES_REP.

### Data som måste passas

| Field | Källa | Mål | Status |
|-------|-------|-----|--------|
| `organization.assigned_sales_rep_id` | SALES_ADMIN-assign | `organizations` | 🔴 (no UI) |
| `territory_rules` | Postal-code prefix | `territory_assignments` | 🔴 (no table) |
| `assigned_to_me` filter | Session | `GET /v1/portal/klubbar?assignedTo=me` | 🔴 (no filter) |

### Fix-sequence

1. **Schema: `organizations.assigned_sales_rep_id`:** Add FK to `users`. Nullable. (S)
2. **Territory-rules-table:** `territory_assignments (postal_prefix, sales_rep_id, priority)`. (M)
3. **Auto-assign on org-create:** Lookup territory_assignments → assign. (M)
4. **`/portal/klubbar?assignedTo=me`:** SALES_REP filter. Default-view. (S)
5. **CLUB_ADMIN sees sales-contact:** `/portal` dashboard widget "Din kontaktperson: {salesRepName, photo, email, phone}". (S)
6. **SALES_ADMIN assignment UI:** `/portal/klubbar/[id]` → "Tilldela säljare"-dropdown. (S)
7. **Audit-log:** `organization.assigned`, `organization.unassigned`. (S)

### Success criteria

- [ ] SALES_REP ser bara sina kunder i default-view.
- [ ] CLUB_ADMIN ser tydlig kontakt-info.
- [ ] SALES_ADMIN kan flytta org mellan reps med audit-log.
- [ ] Auto-assignment vid signup baserat på postal-code.

### Referenser

`MASTERPLAN_02 H6`, `MASTER_02 S14`.

---

# DEL 2 — HALV-FUNGERANDE HANDOFFS (10 yellow)

> Fungerar idag men "läcker" — data eller förtroende förloras i overgången. Mindre brådskande men måste fixas innan dem blir blockers.

| # | Handoff | Vad läcker | Fix-essens |
|--:|---------|------------|------------|
| 1 | PUBLIC → LEAD (hair-analysis) | Lead-save failure tyst; analysis kör ändå | If insert fails (non-dup), return 503 OR queue retry. Lead → `crm`-pipeline auto. |
| 6 | SELLER → PUBLIC_SHOP | Slug-bugg + ingen OG-metadata + inte indexerbar | Connect till KC3-5 + KC7-1-2; OG via `(shop)/shop/[slug]/layout.tsx` (delvis fixat). |
| 7 | SELLER → SUPPORTER (share) | Share-template-API finns men UI använder inte | UI: knappar "Kopiera SMS / inlägg / email" på `/min-shop`. QR-card. |
| 10 | ORDER → TEAM_LEADER (rollup) | Ingen realtime; TL ser bara via refresh | 60s-polling eller SSE på `/lag`-dashboard. Toast vid nytt köp. |
| 11 | ORDER → ASSOCIATION_ADMIN (rollup) | Dashboard är aggregat, ingen drill-down per team | Per-team progress-bars + last-order-stamp + drill-down-link. |
| 15 | INTERNAL_ADMIN → ALL_ORGS (oversight) | Kan se men inte agera; demo-session får överdriven access | Demo-block per KC2-1; admin-actions audit-logged; cross-org search/filter. |
| 17 | CLUB_MEMBER → ORDER (B2B) | Ingen reorder, ingen subscription, ingen budget | Hela H5 (B2B ARR-expansion). |
| 19 | SALES_REP → QUOTE | Pipeline har inte drag-and-drop; quote-templates saknas | H6 punkt A, B. |
| 20 | QUOTE → ORDER (acceptance) | Quote-acceptance-flow är manuell; ingen one-click-convert | H6 punkt C; "Konvertera till order"-knapp på quote-detail. |
| 22 | AI → ALL_ROLES (concierge) | Generic answers; no role-relevanta suggested prompts; no actions | H7 punkt A, B, E. |
| 23 | AUDIT_LOG → INTERNAL_ADMIN (forensics) | Logs finns men UI saknar search/filter | `/portal/audit-log` med search by user, action, date-range, entity. |
| 24 | NOTIFICATION → USER (transactional) | Bara email; ingen in-app; ingen SMS-fallback | Notification-inbox + SMS-fallback för bouncade emails. |

---

# DEL 3 — CROSS-CUTTING CONCERNS

> Inte handoffs i sig, utan tvärgående system som påverkar alla roller. Måste stå robust för att roll-grafen ska fungera.

## 3.1 Identitet & Session-konsistens

### Krav

- En user har **en roll åt gången** (men kan ha flera över tid: t.ex. före detta SELLER blir TEAM_LEADER).
- Sessions måste reflektera **live DB-role**, inte cache.
- Demo-sessions får aldrig nå INTERNAL_ADMIN-endpoints i prod.
- Logout slår ut alla tabs.

### Implementation-checklist

- [ ] `/me` returnerar `role` från DB, inte Redis-cache.
- [ ] `refreshSession()` anropas vid > 50% TTL.
- [ ] `assertRealSession()` på alla INTERNAL_ADMIN/SALES_ADMIN-routes.
- [ ] Multi-tab logout-sync via localStorage-event.
- [ ] Audit-log på alla role-changes.

> Connects: KC2 hela.

---

## 3.2 Notifications-pipeline

### Krav

Alla transactional events måste nå rätt user via rätt kanal med rätt fallback.

### Event-types

| Event | Trigger | Channels | Roller |
|-------|---------|----------|--------|
| `order.paid` | Webhook | Email | Supporter, Seller |
| `order.refunded` | Admin action | Email | Supporter |
| `seller.invited` | TL-action | Email | Seller |
| `team_leader.invited` | Assoc-action | Email | TL |
| `team_leader.claimed` | Auth | Email | Assoc-admin |
| `seller.claimed` | Auth | Email + in-app | TL, Assoc-admin |
| `campaign.activated` | Assoc-action | Email + in-app | All-org-members |
| `campaign.ended` | Cron/Assoc | Email + in-app | All-org-members |
| `payout.invoiced` | Settlement | Email + in-app | Assoc-admin, TL |
| `payout.paid` | Fortnox-webhook | Email + in-app | Assoc-admin, TL |
| `quote.sent` | SALES_REP | Email | Club-admin |
| `lead.assigned` | Auto/manual | Email + in-app | SALES_REP |
| `auth.password_changed` | Self | Email | Self |
| `auth.account_deleted` | Self | Email | Self |
| `auth.new_device_login` | Auth | Email | Self |
| `system.degraded` | Health-check | Email | Internal-admin |

### Implementation-checklist

- [ ] `notifications`-tabell + in-app inbox.
- [ ] Email-sender med graceful retry + bounce-handling.
- [ ] SMS-fallback för bouncade kritiska events.
- [ ] User notification-preferences UI (opt-out granular).
- [ ] Internal-admin dashboard "Last 24h notification-summary".

---

## 3.3 Audit-log-koverage

### Krav

Varje state-changing action på en delad entity (kampanj, payout, user, order) måste loggas med actor + meta.

### Coverage-matrix

| Entity | Actions | Currently | Target |
|--------|---------|-----------|--------|
| `user` | create, update_role, password_change, delete | 🟡 (login only) | All |
| `organization` | create, update, assigned_sales_rep | 🔴 | All |
| `campaign` | create, activate, end, settle | 🟡 (settle) | All |
| `team` | create, update, invite_rotated | 🔴 | All |
| `seller` | create, claimed, status_changed | 🔴 | All |
| `order` | create, paid, refunded, cancelled | 🔴 | All |
| `payout` | create, invoiced, paid | 🔴 | All |
| `quote` | create, sent, accepted, lost | 🔴 | All |
| `lead` | create, assigned, scored | 🔴 | All |
| `ai_chat` | message (no content, metadata only) | 🔴 | All |
| `system_settings` | fortnox_connected, klarna_configured | 🔴 | All |

### Implementation-checklist

- [ ] Extend `audit.ts`-usage till alla actions ovan.
- [ ] `/portal/audit-log` UI med search by user, action, entity, date.
- [ ] Read-only export för revisor.

---

## 3.4 RBAC-matrix (Read+Write)

### Krav

Varje route måste ha **explicit roll-allowlist** — inte default-allow.

### Matrix (uttryckt som rule-set)

| Route-prefix | PUBLIC | ASSOC_ADMIN | TEAM_LEADER | SELLER | CLUB_ADMIN | CLUB_MEMBER | SALES_REP | SALES_ADMIN | INTERNAL_ADMIN |
|--------------|:------:|:-----------:|:-----------:|:------:|:----------:|:-----------:|:---------:|:-----------:|:--------------:|
| `/v1/auth/login` | R+W | — | — | — | — | — | — | — | — |
| `/v1/auth/register/*` | R+W | — | — | — | — | — | — | — | — |
| `/v1/shop/:slug` | R | — | — | — | — | — | — | — | — |
| `/v1/checkout/*` | R+W | — | — | — | — | — | — | — | — |
| `/v1/dashboard/seller` | — | — | — | R | — | — | — | — | R |
| `/v1/dashboard/team-leader` | — | R(own) | R(own) | — | — | — | — | — | R |
| `/v1/dashboard/association` | — | R+W(own) | R(own) | — | — | — | — | — | R |
| `/v1/portal/dashboard` | — | — | — | — | R(own) | R(own) | R | R | R |
| `/v1/portal/statistik` | — | — | — | — | R(own) | — | R | R | R |
| `/v1/portal/klubbar` | — | — | — | — | — | — | R(assigned) | R | R |
| `/v1/portal/saljare` | — | — | — | — | — | — | — | R | R |
| `/v1/portal/system` | — | — | — | — | — | — | — | — | R |
| `/v1/association/campaigns` | — | R+W(own) | R(own) | — | — | — | — | — | R |
| `/v1/association/leaders` | — | R+W(own) | — | — | — | — | — | — | R |
| `/v1/teams/:id` | — | R+W(own-org) | R+W(own) | — | — | — | — | — | R |
| `/v1/settlement/*` | — | R(own) | R(own) | — | — | — | — | — | R+W |
| `/v1/payouts/:id/status` | — | — | — | — | — | — | — | — | R+W |
| `/v1/ai/chat` | — | R+W | R+W | R+W | R+W | R+W | R+W | R+W | R+W |
| `/v1/public-chat` | R+W | — | — | — | — | — | — | — | — |
| `/v1/hair-analysis` | R+W | — | — | — | — | — | — | — | — |

### Implementation-checklist

- [ ] Audit alla routes mot matrix.
- [ ] `assertRole(session, allowed[])`-helper.
- [ ] Default-deny pattern: no `if (session)` utan explicit role-check.
- [ ] Test-suite: per route, försök som varje annan roll → 403.

---

## 3.5 Search & Discovery cross-portal

### Krav

En INTERNAL_ADMIN ska kunna hitta vad som helst på 2 sekunder. En ASSOC_ADMIN ska kunna hitta inom sin org.

### Implementation-checklist

- [ ] `Cmd+K`-palette i portal.
- [ ] Search-index över orgs, users, sellers, campaigns, orders (scoped per role).
- [ ] Recents (last 5 visited entities) per user.

---

# Samordning över alla tre masterplaner

```
┌─────────────────────────────────────────────────────────────┐
│ MASTERPLAN 01 (kritiska brister)  ─── BLOCKING            │
│   └─ KC1-8 måste vara gröna innan något annat öppnas       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ MASTERPLAN 03 (rollkopplingar)  ─── PARALLEL during MP02   │
│   └─ Måste hålla yellow → green vart till varje hävstång   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ MASTERPLAN 02 (uppsidor)  ─── VALUE GENERATION             │
│   └─ Varje hävstång H1-H10 leverar mätbar lift             │
└─────────────────────────────────────────────────────────────┘
```

### Dependency-edges (vad blockerar vad)

- `MP01 KC1 (Pengar)` blockerar `MP02 H3, H5` (settlement-confidence, B2B-ARR).
- `MP01 KC2 (Auth)` blockerar `MP02 H6, H9` (sales-rep-velocity, data-decisions).
- `MP01 KC3 (Onboarding)` blockerar `MP02 H1, H3, H4` (seller, onboarding, TL).
- `MP01 KC4 (Cart)` blockerar `MP02 H2` (supporter-conv).
- `MP01 KC5 (AI)` blockerar `MP02 H7` (AI concierge).
- `MP01 KC6 (Mobile)` är cross-cutting för alla hävstänger som touchar UI.
- `MP03 cross-cuts` (notifications, audit, RBAC) blockerar `MP02 H9, H4` (data, TL).

### Veckovis launch-gate

> Veckans freeze-status:
> - 🔴 Röd: MP01 inte 100% klar. Inga hävstänger får påbörjas.
> - 🟡 Gul: MP01 klart, MP03-handoffs i progress. Hävstänger H1-H4 får planeras.
> - 🟢 Grön: MP01 + MP03 kritiska klara. Hela MP02 är öppen.

---

## Referenser

- `docs/masterplan/MASTERPLAN_01_KRITISKA_BRISTER.md` — must-be-done-first.
- `docs/masterplan/MASTERPLAN_02_STORSTA_UPPSIDOR.md` — value-amplifiers.
- `docs/mvp-scout/master/MASTER_01_CRITICAL.md` — P1-katalog (164 fynd).
- `docs/mvp-scout/master/MASTER_02_NECESSARY.md` — P2-katalog (292 fynd).
- `docs/flow-audits/` — per-roll-audit-rapporter (10 filer).
- `public/Feedback_14:5/Modell_register.docx` — datamodell-feedback.
