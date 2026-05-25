# MASTER 01 — KRITISKT (P1)

**164 fynd som blockerar MVP.** Måste vara fixade innan launch.
Format: `[Scout F-X.Y] Titel — Effort: S/M/L` + fil/rad + symptom + fix.

> Tema-grupperna A–J matchar `MASTER_00_INDEX.md` avsnitt 4.

---

## A — Pengaflödet (Klarna · Fortnox · Settlement · Cart-rensning)

*49 fynd. Roten av MVP-blockaden: pengar går in men kan inte räknas av, faktureras eller utbetalas.*

### Klarna & checkout

- **[S25 F-1.1] Klarna webhook blockas av CSRF i prod** — Effort: S
  - File: `apps/api/src/app.ts:44-70` (CSRF_EXEMPT_PATHS — bara Fortnox); `apps/api/src/routes/checkout.ts:279`
  - Symptom: Klarna server push har ingen `x-csrf-token` → 403; alla orders fastnar PENDING om inte payern hittar `/confirm/:orderId`.
  - Fix: Lägg `/v1/checkout/webhook` i `CSRF_EXEMPT_PATHS`; lita på HMAC + IP-allowlist.
  - Ref: scout 25, scout 35 [1.3], platform AUDIT_2026-04-15.

- **[S25 F-1.2] Ej konfigurerad Klarna tillåter fake PAID utan riktig betalning** — Effort: S
  - File: `apps/api/src/lib/payments/klarna.ts:34-36,75-86,121-130`; `apps/api/src/routes/checkout.ts:393-403`
  - Symptom: När KLARNA_USERNAME/PASSWORD saknas → stub-HTML med "Simulera betalning"; `getCheckoutOrder()` returnerar alltid `checkout_complete`. Webhook/confirm flippar order PAID utan PSP.
  - Fix: I prod, reject `POST /create` när `!isKlarnaConfigured()`; kräv explicit `KLARNA_STUB=true` för mock.

- **[S25 F-1.3] Ingen amount-reconciliation före PAID** — Effort: M
  - File: `apps/api/src/routes/checkout.ts:324-335,396-400`; `apps/api/src/lib/payments/klarna.ts:120-144`
  - Symptom: Vilken `checkout_complete` som helst → PAID, oavsett om Klarna `order_amount` matchar `customer_orders.total_ore`.
  - Fix: Parse `order_amount` från Klarna; kräv exakt match före UPDATE; logga mismatch + returnera 409/422.

- **[S25 F-1.4] Avbrutet/cancelled Klarna-checkout = order stuck PENDING** — Effort: M
  - File: `apps/api/src/routes/checkout.ts:279-377`
  - Symptom: Webhook hanterar bara `checkout_complete`; closed widget → order PENDING för alltid; UI: "Din betalning behandlas…"
  - Fix: Hantera Klarna incomplete/cancelled-statuses; cron expirerar stale PENDING → CANCELLED/FAILED.

- **[S25 F-1.5] Bekräftelse-mail bara på webhook — inte från `/confirm`-fallback** — Effort: S–M
  - File: `apps/api/src/routes/checkout.ts:355-368,379-408`
  - Symptom: När webhook blockas eller försenas: `/confirm` markerar PAID utan att skicka mail; UI: "bekräftelse skickas till …" som aldrig kommer.
  - Fix: Extrahera `finalizePaidOrder(orderId)` shared helper: idempotent PAID-transition + email + acknowledgeOrder; anropa från båda paths.

- **[S23 F-1.1] Kassa-total saknar fraktavgift API lägger på** — Effort: S
  - File: `apps/web/src/app/(shop)/shop/[slug]/kassa/page.tsx:92-95,240-244`; `apps/api/src/routes/checkout.ts:168-187`
  - Symptom: Vid "Hemleverans" med subtotal < `campaign.shippingThresholdOre` lägger API till `shippingFeeOre` på Klarna `orderAmount` utan att UI någonsin visar frakt → supporter betalar mer än vad summan säger.
  - Fix: Vid `deliveryType === "DIRECT"` och subtotal < threshold, visa "Frakt"-rad + uppdatera total/moms för att matcha servern.

- **[S23 F-1.2] Server accepterar DIRECT leverans utan leveransadress** — Effort: S
  - File: `apps/api/src/routes/checkout.ts:66-68,206-210`; `kassa/page.tsx:116-120`
  - Symptom: Klient skickar `deliveryType: "DIRECT"` med tom adress → order persisteras med null-fält och går vidare till Klarna.
  - Fix: Vid `DIRECT`, returnera 400 om någon av `shippingAddressLine1/City/PostalCode` saknas.

- **[S23 F-1.3] Klarna session-fail lämnar FAILED-orders utan idempotent retry** — Effort: M
  - File: `apps/api/src/routes/checkout.ts:231-257,195-229`; `kassa/page.tsx:127-129`
  - Symptom: Användare ser "Betalningen kunde inte initieras"; klick igen → ny DRAFT/PENDING-order. DB ackumulerar FAILED-orphans.
  - Fix: Återanvänd existerande FAILED/PENDING-draft för samma seller+customer+items inom TTL.

- **[S22 F-1.2] Cart rensas aldrig efter framgångsrik order** — Effort: S
  - File: `apps/web/src/lib/use-cart.ts:79`; `bekraftelse/page.tsx` (no cart touch)
  - Symptom: Efter Klarna + "Tack för din beställning!" → tillbaka till shop visar gamla kvantiteter. Risk för dubbel-order.
  - Fix: På bekräftelse-success (eller Klarna `checkout_complete` redirect): `clear()` + `sessionStorage.removeItem(storageKey(slug))`.

### Settlement & avräkning

- **[S15 F-1.4] Kan inte avsluta kampanj — blockerar settlement-pipeline** — Effort: M
  - File: `apps/api/src/routes/settlement.ts:67-69`; `apps/api/src/trpc/routers/campaigns.ts:137-176`; `apps/web/src/app/(fundraising)/forening/`
  - Symptom: Admin skapar ACTIVE-kampanjer men har varken UI eller REST-path för att sätta ENDED. Settlement returnerar alltid 400 utan manuell DB/tRPC-intervention.
  - Fix: REST `PATCH /v1/association/campaigns/:id/status` eller wire tRPC; "Avsluta kampanj" på dashboard med konsekvens-copy.

- **[S26 F-1.1] Ingen settlement-UI — API anropas aldrig från web** — Effort: M
  - File: `forening/avrakning/page.tsx`; `(portal)/portal/layout.tsx:59-68`; `apps/api/src/routes/settlement.ts:43-165,167-223`
  - Symptom: ASSOCIATION_ADMIN och INTERNAL_ADMIN kan inte generera avräkning, se payout-status eller trigga Fortnox från produkten. Ops måste använda curl.
  - Fix: Campaign picker → `GET /v1/settlement/by-campaign/:id`; tabell med status-badges; "Generera avräkning" → POST generate.

- **[S26 F-1.2] Kan inte avsluta kampanj i UI — settlement-pipeline onåbar** — Effort: M
  - File: `apps/api/src/routes/settlement.ts:67-69`; `association.ts:405-504`; `forening/` (no end-campaign control)
  - Symptom: `POST /generate` returnerar 400 tills `campaign.status === "ENDED"`. Ingen REST- eller web-path sätter ENDED.
  - Fix: REST `PATCH /v1/association/campaigns/:id/status` med ENDED + UI "Avsluta kampanj".

- **[S26 F-1.3] Fortnox `create-invoice` använder tom orgNumber + fel customer-stub** — Effort: M
  - File: `apps/api/src/routes/settlement.ts:249-267`; `lib/invoicing/fortnox-provider.ts:71-86`
  - Symptom: `create-invoice` skickar `name: "Roots AB"`, `orgNumber: ""`, `email: ""`. Fortnox `CustomerNumber` sätts från tom orgNumber → API-fel i prod.
  - Fix: Join `organizations` på `payout.orgId`; använd `fortnoxCustomerId` eller org-nummer + billing-email.

- **[S26 F-1.4] NullInvoiceProvider gör `create-invoice` alltid till 502 i dev/staging** — Effort: S
  - File: `lib/invoicing/null-provider.ts:21-30`; `settlement.ts:269-274`
  - Symptom: När `FORTNOX_ENABLED !== "true"`, provider returnerar `externalId: null`; settlement behandlar som fel → HTTP 502.
  - Fix: NullProvider returnerar syntetiskt `externalId` i non-prod, eller settlement accepterar `pending` och sätter `status: INVOICED` med null fortnox-id.

- **[S26 F-1.5] Samtidig settlement generate — race double-settlement** — Effort: S
  - File: `apps/api/src/routes/settlement.ts:67-69,76-145`
  - Symptom: Två parallella POSTs medan kampanj är ENDED passerar båda pre-tx-check; båda kör transaction, upsertar payouts, sätter SETTLED.
  - Fix: Flytta status-check + campaign update i samma tx med row lock: `UPDATE campaigns SET status='SETTLED' WHERE id=? AND status='ENDED' RETURNING id`.

- **[S26 F-1.6] `create-invoice` saknar idempotens — duplicate Fortnox-fakturor** — Effort: S
  - File: `apps/api/src/routes/settlement.ts:225-285`
  - Symptom: Double-click eller retry på `POST /create-invoice/:payoutId` skapar en till Fortnox-faktura om första anropet lyckades men klienten timeout:ade.
  - Fix: Om `payout.fortnoxInvoiceId` eller `status !== 'PENDING'`, returnera existerande id; wrap i tx.

- **[S26 F-1.7] Avräkning-UI aggregerar all org-försäljning — missledande vs per-kampanj** — Effort: M
  - File: `forening/avrakning/page.tsx:57-62`; `dashboard.ts:85-97`
  - Symptom: Sidan väljer första ACTIVE/ENDED-kampanjen för margin-label men `totalSalesOre` summerar PAID-orders över ALLA kampanjer i org.
  - Fix: Skicka `campaignId` som query till dashboard eller använd settlement by-campaign API; visa kampanj-väljare.

- **[S15 F-1.3] Avräkning-UI bortkopplad från settlement + payouts** — Effort: M
  - File: `forening/avrakning/page.tsx`; `apps/api/src/routes/settlement.ts:167-223`; `packages/db/src/schema/payouts.ts:15-19`
  - Symptom: Sidan visar live margin-math på PAID-orders, inte persisterade payout-rader. Admins kan inte se PENDING/INVOICED/PAID, Fortnox-id, eller trigga settlement.
  - Fix: Campaign picker → fetch settlement by campaign; tabell per team med status-badges.

- **[S15 F-1.2] Ingen API för att uppdatera customer order delivery-status** — Effort: M
  - File: `packages/contracts/src/campaigns.ts:60-70`
  - Symptom: TL-order-page är read-only för fulfillment; assoc admin kan inte markera bulk-leverans-progress.
  - Fix: `PATCH /v1/dashboard/orders/:id/status` med RBAC (TEAM_LEADER own team, ASSOCIATION_ADMIN org, INTERNAL_ADMIN); audit log.

### Fortnox & invoicing

- **[S27 F-1.1] B2B-klubborder skapar aldrig Fortnox-faktura — `invoiceStatus` stuck NONE** — Effort: L
  - File: `apps/api/src/routes/portal.ts:470-495`; `lib/invoicing/index.ts`; `packages/db/src/schema/orders.ts:43`
  - Symptom: Alla wholesale-orders förblir `invoiceStatus: NONE`, `fortnoxInvoiceId: null`. Klubb `/portal/fakturor` och income-KPIs avancerar aldrig.
  - Fix: Efter order insert → resolve org → customer, anropa `createInvoiceFromOrder`, sätt `invoiceStatus: ISSUED|PENDING`, persistera `fortnoxInvoiceId`.

- **[S27 F-1.2] `createOrUpdateCustomer` anropas aldrig — `fortnoxCustomerId` aldrig populerad** — Effort: M
  - File: `lib/invoicing/fortnox-provider.ts:52-68`; `packages/db/src/schema/organizations.ts:41`
  - Symptom: `organizations.fortnoxCustomerId` är null för alla orgs. Ingen lookup på lagrad CustomerNumber före invoice create.
  - Fix: Före första faktura: om `fortnoxCustomerId` satt använd den; annars `createOrUpdateCustomer` från org-data, persistera returnerad CustomerNumber.

- **[S27 F-1.3] Fortnox-faktura använder orgNumber som CustomerNumber — API-payload ogiltig** — Effort: S
  - File: `lib/invoicing/fortnox-provider.ts:80-85`; `settlement.ts:252-256`
  - Symptom: `CustomerNumber: order.customer.orgNumber` skickar svenskt org.nr (eller tom sträng) där Fortnox förväntar sitt eget internt CustomerNumber.
  - Fix: Skicka `fortnoxCustomerId` på `InvoiceOrder.customer`.

- **[S27 F-1.4] Fortnox webhook uppdaterar inte DB — UI säger felaktigt att den speglar via webhook** — Effort: M
  - File: `apps/api/src/routes/fortnox-webhook.ts:68-72`; `(portal)/portal/fakturor/page.tsx:9-11`
  - Symptom: `invoice-paid` / `invoice-cancelled`-events loggas bara. Orders och payouts flippar aldrig till PAID/CANCELLED.
  - Fix: Parse event payload för dokumentnummer; UPDATE matchande rader; idempotent via eventId.

- **[S27 F-1.5] `sync-invoice-status`-job är en no-op — ingen polling-fallback** — Effort: M
  - File: `apps/api/src/jobs/sync-invoice-status.ts:11-30`
  - Symptom: Cron körs aldrig. Issued-fakturor förblir ISSUED för alltid om webhook missas.
  - Fix: Select orders/payouts där `fortnoxInvoiceId IS NOT NULL AND status not terminal`; anropa `getInvoiceStatus`; mappa paid/cancelled → DB-enum.

- **[S27 F-1.6] Settlement `create-invoice` ej idempotent — duplicate Fortnox-fakturor på retry** — Effort: S
  - File: `apps/api/src/routes/settlement.ts:225-289`
  - Symptom: Re-POST efter success skapar en till Fortnox-faktura; bara senaste id sparas på payout-raden.
  - Fix: Returnera existerande `invoiceId` om redan INVOICED; 409 om in-flight.

- **[S27 F-1.7] Settlement-faktura använder hårdkodad placeholder-kund — inte föreningen** — Effort: M
  - File: `apps/api/src/routes/settlement.ts:250-257`
  - Symptom: Customer-block är `{ name: "Roots AB", orgNumber: "", email: "" }` medan vi fakturerar föreningens `rootsShareOre`.
  - Fix: Ladda org by `payout.orgId`; använd org-namn, orgNumber, billing-contact; kör customer sync ([1.2]) före faktura.

- **[S27 F-1.8] NullProvider + `FORTNOX_ENABLED=false` blockerar settlement med 502** — Effort: S
  - File: `lib/invoicing/null-provider.ts:21-30`; `settlement.ts:269-273`
  - Symptom: Default deploy returnerar 502 även om NullProvider avsiktligt skickar "pending manual processing".
  - Fix: När NullProvider, sätt payout PENDING + meddelande, returnera 202 med manual-flag; eller exponera INTERNAL_ADMIN "mark invoiced" med externt id-input.

- **[S27 F-1.9] OAuth / `integration_fortnox`-tabell oanvänd — statisk token expirerar i prod** — Effort: L
  - File: `packages/db/src/schema/integrations.ts`; `lib/invoicing/index.ts:16-23`; `.env.example:75-77`
  - Symptom: Produktion Fortnox-auth expirerar; ingen refresh; tabell + OAuth-env-vars är dead code.
  - Fix: Implementera OAuth callback → `integration_fortnox` + token-refresh-middleware; eller dokumentera manuell token rotation.

- **[S18 F-1.7] Fortnox-invoicing ej wired för B2B-klubborder — fakturor-page missledande** — Effort: L
  - File: `apps/api/src/routes/portal.ts:470-495`; `routes/fortnox-webhook.ts:68-72`; `(portal)/portal/fakturor/page.tsx:6-11`
  - Symptom: Alla klubborder stannar på `invoiceStatus: NONE`, `fortnoxInvoiceId: null`. Fakturor-UI lovar Fortnox-sync via webhook; webhook loggar bara.
  - Fix: Vid order confirm, skapa Fortnox-faktura när `org.fortnoxCustomerId` finns; webhook skriver `invoiceStatus`; eller ärlig UI tills integration är live.

### Order confirmation & tracking

- **[S24 F-1.1] Order-bekräftelse-mail bara på webhook — inte på confirm-poll** — Effort: S
  - File: `apps/api/src/routes/checkout.ts:355-367,379-424`
  - Symptom: `/confirm` uppgraderar PENDING→PAID om Klarna är complete, men skickar ingen mail om webhooken inte redan körts. Dev/mock-Klarna → PAID utan mail.
  - Fix: Extrahera `sendOrderConfirmationIfPaid(orderId)`; anropa från webhook och confirm vid PAID-transition (idempotent flag `confirmationEmailSentAt`).

- **[S24 F-1.2] Fulfillment-status-stepper är kosmetisk — ingen SHIPPED/DELIVERED-pipeline** — Effort: M
  - File: `packages/db/src/schema/customer-orders.ts:17-27`; `(shop)/shop/[slug]/order/[orderId]/page.tsx:35-41,153-195`
  - Symptom: Supporters ser 5-step tracker; orders stannar på **Betald** för alltid. "Skickad/Levererad" tänds aldrig.
  - Fix: MVP — `PATCH /v1/dashboard/orders/:id/status` för TEAM_LEADER/INTERNAL_ADMIN; eller dölj steg tills backend finns.

- **[S24 F-1.3] Inget shipment-tracking-link (schema + API + UI)** — Effort: M
  - File: `packages/db/src/schema/customer-orders.ts` (no tracking fields); `checkout.ts:459-470`
  - Symptom: Checklistan förväntar carrier-URL när tillgänglig; ingenting att lagra eller rendera.
  - Fix: Lägg till `carrier`, `trackingUrl`, `shippedAt`; exponera på `order-status`; CTA "Spåra paket" när satt.

- **[S24 F-1.4] Public order-endpoints är oautentiserade capability URLs (IDOR)** — Effort: M
  - File: `apps/api/src/routes/checkout.ts:379-424,427-475`
  - Symptom: Vem som helst med UUID:n kan läsa maskad köpardata + line items + säljarnamn. Slug i `/shop/{slug}/order/{id}` valideras inte server-side mot order's seller.
  - Fix: MVP — HMAC `order_token` i Klarna confirmation URL + kräv i status-API; eller rate-limit + förkorta retention.

- **[S24 F-1.5] Tack-sidan saknar line-item-recap (trust at purchase moment)** — Effort: S
  - File: `bekraftelse/page.tsx:13-18,106-121`
  - Symptom: Supporter ser bara totalt innan hen lämnar; måste öppna mail eller order-status för SKU-listan.
  - Fix: Utöka `GET /confirm/:orderId` med `items[]`; rendera readonly-lista + frakt + "inkl. moms" på bekraftelse.

### Cart-architecture

- **[S22 F-1.1] Kassa ignorerar sessionStorage — cart-persistence halvgjord** — Effort: M
  - File: `kassa/page.tsx:54-60`; `lib/use-cart.ts:52-91`
  - Symptom: Supporter lägger till items på shop (persisteras), refresh:ar `/kassa`, bookmarkar eller landar utan query string → "Din varukorg är tom" trots items i storage.
  - Fix: Importera `useCart(slug)`; derivera från URL när present, annars från `cart` efter `hydrated`.

- **[S22 F-1.3] Sticky bar item-count kan disagree med visad total** — Effort: S
  - File: `shop/[slug]/page.tsx:101-106,339-344`; `lib/use-cart.ts:81`
  - Symptom: Om katalog ändras medan cart persisterad → sticky bar visar "3 produkter" men total kan vara "0 kr".
  - Fix: Efter shop fetch, filtrera cart till aktiva produkt-ids; re-sync storage; visa kort notis om count minskar.

### Shop catalog

- **[S21 F-1.1] Static "399 kr bundle"-kort är inte köpbart — priset kan driva från DB**
  - File: `shop/[slug]/page.tsx (~297-310)`; `apps/api/src/routes/shop.ts (~108-113)`
  - Symptom: "Komplett paket — 399 kr" är hårdkodat utan +/-, ingen checkout-link, och använder inte API:s `bundles[]`. Supporter kan inte köpa den marknadsförda bundle:n.
  - Fix: Mappa `shop.bundles` till add-to-cart-rader; ta bort static-kortet när `bundles.length > 0`.

- **[S21 F-1.2] Shop-katalog ignorerar `campaign_products` — returnerar alla aktiva SKUs**
  - File: `apps/api/src/routes/shop.ts (~54)`
  - Symptom: Query returnerar alla aktiva produkter utan join på `campaign_products`. Kampanjer med begränsad assortment visar hela globala katalogen.
  - Fix: När `campaign_products`-rader finns för `seller.campaignId`, filtrera till dessa product-ids.

- **[S15 F-1.5] Ingen campaign-product-assortment — shops kan visa fel katalog** — Effort: L
  - File: `packages/db/src/schema/campaign-products.ts`; `apps/api/src/routes/association.ts:405-504`
  - Symptom: Campaign create kopplar aldrig produkter; public shop kan exponera alla aktiva SKUs istället för campaign-assortment.
  - Fix: Produkt-multi-select i kampanj-modal; persistera `campaign_products` på create/update.

### Settlement audit + Fortnox status duplicates

- **[S35 F-1.2] Settlement onåbar från UI — ingen END kampanj, ingen avräkning, ingen payout-status**
  - File: `apps/api/src/routes/settlement.ts:67-69`; `forening/avrakning/page.tsx`
  - Symptom: Money loop kan inte stängas i produkten utan curl/DB; assoc admin ser aldrig PENDING/INVOICED/PAID.
  - Fix: Ship REST PATCH campaign→ENDED, wire `/forening/avrakning` till settlement API, honest Fortnox stub, mark payout PAID.

- **[S35 F-1.3] Klarna webhook blockad av CSRF i prod**
  - File: `apps/api/src/app.ts:44-57`; `checkout.ts:279`
  - Symptom: Riktiga betalningar når aldrig PAID.
  - Fix: Lägg `/v1/checkout/webhook` i `CSRF_EXEMPT_PATHS`.

- **[S35 F-1.4] Order confirmation email bara på webhook — mock/dev `/confirm` markerar PAID utan mail**
  - File: `apps/api/src/routes/checkout.ts:355-367 vs 393-404`
  - Symptom: Mock/dev-path lämnar supporter utan mail.
  - Fix: Skicka order-confirmation från `/confirm` också (ej bara webhook).

- **[S35 F-1.6] Association sales-rollup korsar alla kampanjer — dashboard-endpoint har ingen `campaignId`-filter** — Effort: M
  - File: `dashboard.ts:85-97`; `forening/page.tsx:166-178`
  - Symptom: Assoc progress bar kan inkludera försäljning från andra kampanjer.
  - Fix: Filtrera association dashboard på aktiv kampanj.

- **[S35 F-1.7] Cart förloras på checkout reload — kassa ignorerar sessionStorage-cart**
  - File: `kassa/page.tsx:54-60`
  - Symptom: Reload på checkout = cart förloras.
  - Fix: Läs cart från sessionStorage på kassa-sidan.

- **[S35 F-1.8] Fortnox-fakturapath bruten/stub — tom kund + NullProvider 502** — Effort: M
  - File: `apps/api/src/routes/settlement.ts:249-274`
  - Symptom: `create-invoice` skickar empty orgNumber/email stub; NullProvider → 502 i dev.
  - Fix: Wire real org-data; honest Fortnox-stub för dev.

---

## B — Auth, session, GDPR (alla roller)

*31 fynd. Auth-kärnan har stora luckor: ingen lösenordsåterställning, inbjudna kan inte logga in, server validerar inte payloads.*

### Password reset & onboarding-block

- **[S07 F-1.2] "Glömt lösenord" saknas helt från produkten** — Effort: L
  - File: `(auth)/login/page.tsx` (ingen länk); `trpc/routers/auth.ts:105-113`; `apps/api/src/routes/auth.ts` (ingen REST reset)
  - Symptom: Ingen "Glömt lösenord?"-länk på login; tRPC `requestPasswordReset` är no-op-stub utan mail, token-tabell eller UI.
  - Fix: Lägg länk på login → request-form; implementera token + email + set-password-route på REST; tills dess ärlig "Kontakta support".

- **[S11 F-1.1] Password reset-flow helt frånvarande (API + UI + mail)** — Effort: M
  - File: `apps/api/src/routes/auth.ts` (no reset routes); `trpc/routers/auth.ts:105-113`; `(auth)/login/page.tsx:67-108`
  - Symptom: Ingen recovery-path; ingen `/glomt-losenord` eller `/aterstall-losenord/[token]`-rutter; tRPC-stub returnerar success utan att skicka mail; ingen reset-mall.
  - Fix: `password_reset_tokens`-tabell; `POST /v1/auth/forgot-password` (rate-limited, generic 200); skicka reset-länk; reset-sida som konsumerar token engångs; länka från login.

- **[S11 F-1.2] Inbjudna klubbmedlemmar kan inte logga in — ingen accept/set-password-flow** — Effort: M
  - File: `routes/portal.ts:744-748`; `routes/auth.ts:322-334`
  - Symptom: CLUB_ADMIN inviterar medlem; invitee får ingen mail med setup-länk; DB-rad får `passwordHash: invite-pending-{uuid}…` (ej giltig argon2); login returnerar 401.
  - Fix: Återanvänd password-reset-token-mönstret eller dedicerad invite-token; mail "Acceptera inbjudan" → set-password-sida; sätt rätt hash och skapa session.

- **[S18 F-1.6] Inviterade club members kan inte logga in — ingen accept-invite-flow** — Effort: M
  - File: `portal.ts:744-748,676-684`; `(portal)/portal/medlemmar/page.tsx:105-117`
  - Symptom: CLUB_ADMIN klickar "Skicka inbjudan" → rad i tabell, toast success, ingen mail. Invitee får `passwordHash: invite-pending-{uuid}…` — login för alltid 401.
  - Fix: Skicka invite-mail med token-länk; accept-sida sätter lösenord och skapar session.

### Server-side validation gaps

- **[S08 F-1.1] Server enforcar inte password length/complexity på association register** — Effort: S
  - File: `apps/api/src/routes/auth.ts:446-448,461`; `packages/contracts/src/auth.ts:20-33` (unused)
  - Symptom: Klient disablar submit vid `password.length < 8`, men API accepterar valfritt non-empty password; `RegisterAssociationSchema.min(8)` finns men anropas aldrig.
  - Fix: Parse body med `RegisterAssociationSchema.safeParse()`; returnera 400 med field errors.

- **[S08 F-1.2] Session creation-fail efter framgångsrik DB commit → orphan account** — Effort: M
  - File: `apps/api/src/routes/auth.ts:463-507,535-537`; `lib/session.ts:41-43`
  - Symptom: Om `createSession` throws (Redis down): tx redan committat org + user; handler returnerar generic 500; user kan inte retry med samma email (409).
  - Fix: Wrappa `createSession` i try/catch; returnera 503 med "Kontot skapades — logga in" ELLER kompensera tx genom att radera org+user.

- **[S08 F-1.3] Ingen duplicate-organization prevention för association signup** — Effort: M
  - File: `apps/api/src/routes/auth.ts:464-472`; `packages/db/src/schema/organizations.ts:35-36`
  - Symptom: Varje signup insertar ny org-rad; samma förening kan registrera sig två gånger; ingen unique index på `org_number`; ingen namn-normalisering-check.
  - Fix: Om `orgNumber` finns, reject 409 när org finns; valfri pre-submit search by normalized name; unique partial index på `org_number where not null`.

- **[S08 F-1.4] Ingen server-side email-format-validation** — Effort: S
  - File: `apps/api/src/routes/auth.ts:446-448,478`
  - Symptom: Malformed strings (e.g. `"not-an-email"`) passerar API om truthy; lagras i DB; welcome-mail kan tysta fail.
  - Fix: Enforcera via `RegisterAssociationSchema` (har redan `z.string().email()`).

- **[S09 F-1.3] Server-side password-policy saknas på `POST /register/team-leader`** — Effort: S
  - File: `apps/api/src/routes/auth.ts:563-565,578`
  - Symptom: UI enforcar min 8 chars; API checkar bara `!password`; client-side bypass kan registrera 1-char-password.
  - Fix: Shared validator: min 8, max 128; returnera `{ error: "Lösenord måste vara 8–128 tecken." }` före hash.

- **[S10 F-2.2] API skippar `RegisterSellerSchema` — password-length inte enforcad server-side** — Effort: S (listad här fast P2)
  - File: `packages/contracts/src/auth.ts:56-62`; `apps/api/src/routes/auth.ts:727-731`
  - Symptom: Klient kräver ≥8 chars; API checkar bara truthy `password`; direkt API-call med 1-char-password lyckas.
  - Fix: `RegisterSellerSchema.safeParse(body)` före DB-arbete.

### Minor consent & seller privacy (Fas 6 = dead code)

- **[S10 F-1.2] Ingen minor/guardian-consent-workflow vid säljarsignup** — Effort: L
  - File: `apps/api/src/routes/auth.ts:719-828`; `(auth)/registrera/saljare/[token]/page.tsx`; `packages/db/src/schema/users.ts:30-35`
  - Symptom: Youth-säljare registrerar med fullt juridiskt namn, ingen birth-year, ingen guardian email/consent; public shop exponerar `displayName` + namn-derived slug omedelbart.
  - Fix: Lägg birth-year (eller age band) i formuläret; om under 16 → collect guardian-email, blockera public shop tills consent token bekräftad; default `hideFromLeaderboard` + föreslå `publicAlias`.

- **[S30 F-1.1] Fas 6 schema-kolumner är dead code — minor consent + seller privacy oenforced** — Effort: L
  - File: `packages/db/src/schema/users.ts:33-35`; `sellers.ts:43-45`; `routes/auth.ts:762-780`; `routes/shop.ts:85-86`
  - Symptom: DB har `birth_year`, `guardian_user_id`, `guardian_consent_at`, `public_alias`, `hide_from_leaderboard`, `personal_message` men ingen API-route läser eller skriver dem. Public shop exponerar alltid `displayName`.
  - Fix: Wire register/seller + shop snapshot + leaderboard till kolumnerna; inte en schema-ändring — men schema utan app = compliance MVP-blocker.

- **[S30 F-1.2] `guardian_user_id` saknar FK till `users(id)`** — Effort: S
  - File: `packages/db/src/schema/users.ts:34`; `drizzle/0001_minor_consent_and_seller_privacy.sql:6-10`
  - Symptom: Index finns men ingen referential integrity; invalid guardian-UUIDs kan lagras; radering av guardian-user lämnar dangling references utan ON DELETE-policy.
  - Fix: Ny idempotent migration som lägger FK `guardian_user_id REFERENCES users(id) ON DELETE SET NULL`; lägg `.references()` i Drizzle.

### Session lifecycle

- **[S10 F-1.1] Tyst session-takeover när annan user är inloggad** — Effort: M
  - File: `apps/api/src/routes/auth.ts:790-798`; `(auth)/registrera/saljare/[token]/page.tsx`
  - Symptom: Förälder/coach inloggad på delad enhet öppnar säljar-invite; framgångsrik signup skriver över `rootsSessionId` med ny SELLER-session — ingen varning, inget merge, ingen logout-first-prompt.
  - Fix: Detektera aktiv session i API eller sida; returnera 409 `{ kind: "SESSION_CONFLICT" }`; UI visar confirm-switch-banner; eller forcera logout före formulär.

- **[S07 F-1.3] In-memory demo-login sätter orgId:null — fundraising dashboards 403** — Effort: M
  - File: `apps/api/src/routes/auth.ts:68-73,199-220`
  - Symptom: Demo-emails authenticerar men session har `orgId: null`; fundraising-layout/API returnerar 403 "Ingen organisation" om inte `pnpm db:seed:demo` skapade riktiga rader.
  - Fix: Föredra DB-seedade demo-users i staging; eller blockera demo-fundraising-roller utan orgId med tydligt fel.

### Auth deep-link & routing

- **[S09 F-1.1] Org-search oanvändbar pre-login — existing-org attach bruten** — Effort: M
  - File: `(auth)/registrera/page.tsx:71-86`; `routes/auth.ts:831-835`
  - Symptom: Coach skriver föreningsnamn i steg 1; dropdown stannar tom; ingen fel visas; user antar att föreningen "finns inte" och skapar duplicate org.
  - Fix: Tillåt anonym org-search för registration (rate-limited) ELLER deferra search till post-auth med tydligt copy; ytligör 401/403 i UI.

- **[S09 F-1.2] Ingen aktiv kampanj → konto skapas, team skippas, user skickas till bruten `/lag`** — Effort: M
  - File: `routes/auth.ts:645-665,700-712`; `(auth)/registrera/page.tsx:137-143`; `(fundraising)/lag/page.tsx:40-45,87-94`; `routes/dashboard.ts:225-236`
  - Symptom: Registration lyckas, auto-redirect till `/lag`; `/v1/dashboard/my-team` returnerar 404 "Inget lag hittades"; UI visar generic fel utan förklaring att föreningen saknar aktiv kampanj.
  - Fix: Returnera explicit flag t.ex. `{ teamCreated: false, reason: "NO_ACTIVE_CAMPAIGN" }`; redirect till holding-sida; eller blockera self-serve TL-signup och rutta coaches bara via `/registrera/lagansvarig/[token]`.

- **[S10 F-1.3] Ogiltig invite-token rejectas inte förrän form-submit** — Effort: M
  - File: `(auth)/registrera/saljare/[token]/page.tsx`
  - Symptom: User klistrar in fel/expired/roterad invite-URL, ser full signup-form, fyller 4 fält, submit → "Ogiltig inbjudningslänk." Lagansvarig-flödet GETar redan preview on mount.
  - Fix: Lägg `GET /v1/auth/seller-invites/:token` returnerande teamName, orgName, campaignName; on 404 rendera `<InviteNotFound />`; mirror lagansvarig-UX.

- **[S10 F-1.4] Registrering tillåten när campaign inte är ACTIVE** — Effort: S
  - File: `apps/api/src/routes/auth.ts:734-742`
  - Symptom: Seller fullföljer signup för team vars kampanj är ENDED/SETTLED; landar på min-shop med shop visible men checkout disabled; wasted onboarding.
  - Fix: Join campaign i handler; reject non-ACTIVE med 410 + "Kampanjen är avslutad"; visa samma på invite-preview.

### Portal RBAC & access

- **[S12 F-1.1] `/portal/*` skyddat ENBART client-side — middleware passerar** — Effort: M
  - File: `apps/web/src/middleware.ts:17-21,105-107`
  - Symptom: Matcher kör gate + role checks bara för `/forening`, `/lag`, `/min-shop`. Vilken user med `rootsSessionId` som helst kan ladda `/portal/system`, `/portal/saljare` etc.
  - Fix: Lägg `/portal` i `PROTECTED_ROUTES` med allowed portal-roles (CLUB_*, SALES_*, INTERNAL_ADMIN); eller server-layout som redirectar fundraising-roles till `/forening`/`/lag`/`/min-shop`.

- **[S12 F-1.2] `getNavItems()` default-branch exponerar ADMIN_NAV till fundraising-roles** — Effort: S
  - File: `(portal)/portal/layout.tsx:71-75,86-89`
  - Symptom: Roller utanför CLUB_*/SALES_* (SELLER, TEAM_LEADER, ASSOCIATION_ADMIN eller typo) får ADMIN_NAV: System, Audit-log, Alla klubbar, Säljare, etc.
  - Fix: Explicit map per Role enum; för non-portal roller redirect ut ur layout eller visa "Behörighet saknas".

- **[S12 F-1.3] Deep-link RBAC: API blockar, UI vilseleder (SELLER → /portal/system)** — Effort: M
  - File: `apps/api/src/routes/portal.ts:1509-1514`; `(portal)/portal/system/page.tsx:63-82`
  - Symptom: SELLER/TEAM_LEADER med session-cookie öppnar `/portal/system` → ser admin-chrome via [1.2]; `portalFetch` får 403; `.catch(() => {})` lämnar tomma health-cards (ser ut som "no incidents", inte "no access").
  - Fix: Kombinera [1.1]/[1.2] + dedicerad `/portal/ingen-behorighet`-sida när API returnerar 403.

- **[S12 F-1.4] `GET /v1/portal/products` — vilken session som helst, ingen portal-role-guard** — Effort: S
  - File: `apps/api/src/routes/portal.ts:272-283`
  - Symptom: SELLER/TEAM_LEADER/ASSOCIATION_ADMIN kan läsa full B2B-produktkatalog via REST om de hittar pathen.
  - Fix: Mirror `/dashboard`: reject non-portal-roles med 403.

- **[S12 F-1.5] `GET /v1/portal/orders` och `/quotes` — ofullständiga role-gates** — Effort: M
  - File: `apps/api/src/routes/portal.ts:289-320,908-952`
  - Symptom: `/orders` listar upp till 100 rader för INTERNAL_ADMIN/SALES_ADMIN globalt, eller via `session.orgId` för andra (inkl. ASSOCIATION_ADMIN på fundraising-org) — ingen `isPortalRole`. `/quotes` ingen portal/fundraising-guard.
  - Fix: Lägg `isPortalRole` + per-role scoping konsistent med `/orders/:orderId` och `/pipeline`.

- **[S12 F-1.6] Ingen inactive/banned/deleted-user enforcement på session/me** — Effort: M
  - File: `apps/api/src/routes/auth.ts:120-186,363-420`
  - Symptom: Giltig session-cookie fortsätter funka tills expiry även om kontot borde vara disablat; `/me` returnerar user från session.role utan DB-revalidation.
  - Fix: På `/me` och `requireSession`, ladda om user-rad och avvisa DISABLED/BANNED; valfri session-version-field som bumps vid admin suspend.

### Inactive seller propagation

- **[S16 F-1.2] Seller INACTIVE inte enforced på public shop eller checkout** — Effort: S
  - File: `apps/api/src/routes/shop.ts:24-32`; `routes/checkout.ts:82-90`; `lag/saljare/page.tsx:58-94`
  - Symptom: Team leader pausar säljare ("Pausa"); toast säger säljare gömd från ranking. Supporters kan fortfarande öppna `/shop/[slug]` och fullfölja checkout.
  - Fix: Returnera 404/410 från shop för INACTIVE; reject checkout med tydlig text.

### Team leader creates seller credentials

- **[S16 F-1.3] Team leader skapar säljar-credentials (consent/minderåriga)** — Effort: M
  - File: `lag/saljare/page.tsx:205-245,330-337`; `routes/dashboard.ts:466-539`
  - Symptom: "Lägg till säljare"-form kräver coach att sätta säljar-email + password (min 6 client-side). Youth-säljare väljer aldrig sitt eget password; ingen forced reset.
  - Fix: MVP — föredra invite-only; eller generera one-time reset-link / temp-password-mail vid create.

### Onboarding dead-end

- **[S16 F-1.6] Onboarding dead-end: konto utan team → bruten `/lag`** — Effort: M
  - File: `routes/auth.ts:645-665,700-712`; `(auth)/registrera/page.tsx:137-143`; `(fundraising)/lag/page.tsx:40-45,87-94`
  - Symptom: Self-serve TL-register lyckas men hoppar över `teams` insert när org saknar ACTIVE kampanj. UI redirectar alltid till `/lag`; `GET /v1/dashboard/my-team` → 404.
  - Fix: Campaign-pending holding-sida; blockera self-serve tills kampanj finns; eller rutta via invite only.

### Seller portal Fas 6 not wired

- **[S17 F-1.1] Säljare kan inte editera profil — Fas 6-schema orphaned** — Effort: M
  - File: `sellers.ts:35-45`; `(fundraising)/installningar/page.tsx:216-268`; `routes/dashboard.ts:365-464`
  - Symptom: Produktchecklista förväntar displayName, publicAlias, personalMessage, hideFromLeaderboard self-edit. UI säger explicit "kontakta lagansvarig". Ingen `PATCH /v1/dashboard/seller/me`.
  - Fix: Lägg `PATCH /v1/dashboard/seller/profile` (SELLER-only); wire form i `/installningar` eller dedicerad profil-tab.

- **[S17 F-1.2] Public shop ignorerar `publicAlias` och `personalMessage`** — Effort: M
  - File: `routes/shop.ts:82-88`; `shop/[slug]/page.tsx:190-199`; `layout.tsx:23-26`
  - Symptom: Säljare sätter privacy/voice-fields (när UI finns) men supporters ser fortfarande juridiskt namn + campaign boilerplate.
  - Fix: Returnera `publicName: seller.publicAlias ?? seller.displayName`, `personalMessage` från API; shop visar personligt meddelande; metadata använder publicName.

- **[S21 F-1.3] `publicAlias` och `personalMessage` i schema men omitterade från API+UI**
  - File: `packages/db/src/schema/sellers.ts (~43-45)`; `apps/api/src/routes/shop.ts (~82-88)`; `shop/[slug]/page.tsx (~39-45, ~156-158)`
  - Symptom: Shop-header visar alltid juridiskt `displayName`; minderåriga kan inte använda pseudonym.
  - Fix: Utöka seller-JSON; UI: `(publicAlias ?? displayName)` + valfri `personalMessage`-block.

### Audit logs

- **[S30 F-1.3] `audit_logs` har noll index — admin-UI degraderar när Fas 5-logging rullas ut** — Effort: S
  - File: `packages/db/src/schema/audit.ts:3-11`; `routes/admin.ts:97-113`; `routes/notifications.ts:296-303`
  - Symptom: Varje audit-list/notification-poll scannar hela tabellen.
  - Fix: Additiv migration med `audit_logs_created_at_idx`, optional `audit_logs_action_created_at_idx`, `audit_logs_user_id_created_at_idx`.

### S07 demo audit gaps

- **[S07 F-1.1] Welcome email CTA länkar till `/logga-in` — route finns inte** — Effort: S
  - File: `apps/api/src/lib/email/templates.ts:61`
  - Symptom: Post-registration welcome-mail button href är `${siteUrl()}/logga-in`; web serverar login bara på `/login`.
  - Fix: Byt till `/login` eller lägg permanent redirect `/logga-in` → `/login` i next.config.

---

## C — Roll-handoffs & onboarding (registrera, invite, navigation)

*18 fynd. Användare hittar inte rätt; CTA pekar till fel sida; roller ser fel surface.*

- **[S02 F-1.1] Föreningsliv beskriver fel affärsmodell för ASSOCIATION_ADMIN** — Effort: M
  - File: `(marketing)/foreningsliv/page.tsx:16-20,42-45,17-27`
  - Symptom: Steps lovar "Beställ → Välj antal paket direkt i vår portal" och "Administrera beställningar"; faktiska post-signup-flödet är register → kampanj → invite teams/säljare → supporters köper via personlig shop.
  - Fix: Skriv om STEPS/FEATURES/hero för att matcha campaign → lag → säljare → delningslänk-flow; länka till `/registrera` med "förening"-path.

- **[S02 F-1.2] Föreningsliv-CTA landar på bruten team-registration-path** — Effort: M
  - File: `(marketing)/foreningsliv/page.tsx:48-52,145-148`; `(auth)/registrera/page.tsx:71-86`; `routes/auth.ts:831-835`
  - Symptom: CTAs → `/registrera`; team-leader-path anropar `GET /v1/auth/organizations/search` anonymt och får 401; UI visar tom org-lista utan fel.
  - Fix: På `/foreningsliv`, klargör två paths (förening vs lagledare); öppna org search pre-auth eller deferra team search; ytligör 401-copy på registrera.

- **[S03 F-1.1] B2B-portal länkar till marketing-PDP med fel checkout-CTA**
  - File: `(portal)/portal/produkter/page.tsx (~104-125, ~179)`; `(marketing)/produkter/[slug]/page.tsx (~165-167, ~193-195)`
  - Symptom: `/portal/produkter` länkar till `/produkter/[slug]`, men PDP-CTAs säger alltid "Beställ via din förening" → `/foreningsliv`, inte portal cart eller `/portal/bestallningar`. CLUB_MEMBER-flow bryts vid purchase intent.
  - Fix: Detektera session/role eller `?from=portal` och visa "Lägg i beställning" → portal cart; behåll föreningsliv-CTA för PUBLIC.

- **[S03 F-1.2] Ingen "Lägg i kundvagn" / add-to-cart på marknadsförings-produkt-surfaces**
  - File: `(marketing)/produkter/page.tsx (~117-124, ~137-141)`; `(marketing)/produkter/[slug]/page.tsx (~163-167)`
  - Symptom: Listing och detail exponerar pris + "Läs mer"/föreningsliv-CTAs bara; noll path från `/produkter` till supporter-shop eller B2B order-dialog.
  - Fix: Sekundär CTA för CLUB_MEMBER ("Beställ i portalen") och klargör PUBLIC-path.

- **[S03 F-1.3] Produkt-katalog hårdkodad i marketing — inte DB/API source of truth**
  - File: `(marketing)/produkter/page.tsx (~15-46)`; `[slug]/page.tsx (~13-84, ~106)`; `packages/db/src/seed.ts (~112-139)`; `lib/portal-products.ts (~1-54)`; `components/sections/products-preview.tsx (~7-32)`
  - Symptom: Full produkt-records hårdkodade lokalt; DB-seed har andra display-names, engelska beskrivningar; portal har andra hero-bilder. Priser matchar idag men drifter tyst.
  - Fix: Fetcha aktiva produkter server-side (tRPC eller `/v1/portal/products` public-variant) eller importera en delad katalog; formatera priser från `priceOre` via shared `formatSek`.

- **[S15 F-1.1] Ingen leveranser-vy för ASSOCIATION_ADMIN — kan inte se eller fulfilla org-ordrar** — Effort: L
  - File: `(fundraising)/layout.tsx:90-97`; `lag/bestallningar/page.tsx`; `routes/dashboard.ts:49-132`
  - Symptom: Föreningsadmin har ingen order-lista, filter, detail-dialog eller CSV-export. Team leaders använder `/lag/bestallningar`; assoc admin's middleware tillåter `/lag` men `GET /v1/dashboard/my-team` returnerar 404.
  - Fix: Lägg `/forening/leveranser` + `GET /v1/dashboard/association/orders` (org + optional campaign-filter); återanvänd OrderDetailDialog + orders-csv.

- **[S15 F-1.6] Dashboard aggregerar alla kampanjer — missledande progress + leaderboard** — Effort: M
  - File: `routes/dashboard.ts:64-98,109-127`; `forening/page.tsx:166-181,183-185`
  - Symptom: `totalSalesOre` / `totalOrders` summerar varje PAID-order i org; progress bar använder aktiv kampanjs goal mot org-wide totals. Teams från gamla kampanjer dyker upp i ranking.
  - Fix: Scope stats/teams/sellers till vald eller aktiv kampanj; campaign-switcher i header.

- **[S15 F-1.7] Team-goal PATCH saknar CSRF — failar i prod** — Effort: S
  - File: `forening/mal/page.tsx:71-80`; `apps/api/src/app.ts:61-68`; `lib/api.ts:27-28`
  - Symptom: Save team-goals via raw `fetch` returnerar 403 "Invalid or missing CSRF token" när API:s CSRF är enforced (prod/staging).
  - Fix: Byt till `apiFetch("/v1/dashboard/association/team-goals", { method: "PATCH", body: … })`.

- **[S15 F-1.8] Briefade `/portal/*`-routes saknas; role misroutes om user landar på `/portal`** — Effort: S
  - File: `(portal)/portal/page.tsx:614-620`; `routes/portal.ts:69-75`
  - Symptom: Inga `/portal/kampanjer`, `/leveranser`, `/utbetalningar`. Manuell navigation till `/portal` visar internal-admin-KPIs; API-anrop failar med 403. `/portal/saljare` listar SALES_REP-pipeline, inte ungdoms-säljare.
  - Fix: Redirecta ASSOCIATION_ADMIN från `/portal` → `/forening` i layout eller middleware; dokumentera canonical routes.

- **[S16 F-1.4] Ingen `TEAM_LEADER`-branch i `/portal` — fel dashboard om besökt** — Effort: S
  - File: `(portal)/portal/page.tsx:610-620`; `layout.tsx:71-74,142-143`
  - Symptom: Om coach bookmarkar `/portal` eller följer generic "portal"-länk → AdminDashboard med ADMIN_NAV ("Alla klubbar", "System", "Audit-log") och fetchar `GET /portal/dashboard` som internal admin.
  - Fix: Redirecta `TEAM_LEADER` → `/lag` i portal-layout eller middleware; eller lägg real TL-dashboard-branch.

- **[S16 F-1.5] `portal/saljare` är fel surface för team leaders** — Effort: S
  - File: `(portal)/portal/saljare/page.tsx:42-64,69-72`
  - Symptom: Sid-titel "Säljare" / "Säljteamets prestation" fetchar `portalFetch("/sellers")` — internal sales-rep pipeline (klubbar, pipelineOre, closedOre), inte team-youth-roster.
  - Fix: Role-check i sida eller nav: TL → `/lag/saljare`; restrict `/portal/saljare` till SALES/ADMIN.

- **[S17 F-1.5] Ingen SELLER-branch i `portal/page.tsx` — fel dashboard om route hittas** — Effort: S
  - File: `(portal)/portal/page.tsx:610-620`; `middleware.ts`; `routes/portal.ts:70-74`
  - Symptom: SELLER som navigerar till `/portal` passerar portal-layout-auth men renderar AdminDashboard-fallback med em-dash-KPIs; API failar tyst → tomma admin-widgets, inte seller-shop.
  - Fix: Redirecta SELLER/TEAM_LEADER/ASSOCIATION_ADMIN bort från `/portal/*` i layout eller middleware; eller lägg explicit SELLER-redirect till `/min-shop`.

- **[S20 F-1.2] SALES_REP nav länkar till `/portal/statistik` men API returnerar 403 — silent failure** — Effort: S
  - File: `(portal)/portal/layout.tsx:49-56`; `routes/portal.ts:1124-1128`; `statistik/page.tsx:140-143`
  - Symptom: Sales rep öppnar "Statistik" från sidebar; sidan renderar med em-dash-KPIs och "Ingen omsättningshistorik ännu" / "Inga ordrar registrerade ännu" — läser som tom tenant, inte "du saknar behörighet".
  - Fix: Ta bort statistik från SALES_NAV och länka till `/portal/pipeline` (eller bygg rep-scoped stats); på 403 visa explicit "Statistik finns under Pipeline" CTA.

- **[S14 F-1.1] Ingen quote-status-lifecycle efter create — reps kan inte avancera deals** — Effort: M
  - File: `routes/portal.ts` (POST /quotes only); `(portal)/portal/offerter/page.tsx`
  - Symptom: Rep kan skapa DRAFT eller SENT vid submit. Kan inte senare skicka draft, markera accepted/rejected, eller expire. Pipeline-kanban är read-only.
  - Fix: PATCH med role + ownership-guard; wire row-actions (Skicka, Acceptera, Neka); på ACCEPTED valfritt sätt org `crmStatus=CUSTOMER`.

- **[S14 F-1.2] "Skicka offert"/SENT-status levererar varken mail eller PDF** — Effort: M–L
  - File: `routes/portal.ts:1019-1106`; `offerter/page.tsx:324-350`
  - Symptom: Checkbox "Skicka direkt" persisterar `status: SENT` i DB men customer får ingenting; rep tror offert skickades.
  - Fix: På SENT-transition, enqueue transactional email med quote-summary/PDF; ytligör send-failure i UI.

- **[S14 F-1.3] Sales dashboard pipeline-funnel + top clubs populeras aldrig** — Effort: S–M
  - File: `(portal)/portal/page.tsx:54-59,212-231,270-323`; `routes/portal.ts:165-177`
  - Symptom: Efter `/dashboard` fetch visas KPI-cards live, men 4-step-funnel stannar 0/Lead-Stängd och "Toppklubbar" stannar tomma dashed box — även när `/portal/pipeline` har deals.
  - Fix: Utöka dashboard-response med stage-counts från `/pipeline`-aggregates + top N orgs by revenue/quote value; eller ta bort funnel tills wired.

- **[S14 F-1.4] Dashboard "Offerter ute" och "Stängda denna månad" använder fel counts** — Effort: S
  - File: `routes/portal.ts:131-144,158-171`; `(portal)/portal/page.tsx:225-226`
  - Symptom: "Offerter ute" räknar alla quotes för rep (inkl. ACCEPTED/REJECTED). "Stängda denna månad" räknar all-time ACCEPTED utan månadsfilter trots labeln.
  - Fix: Filtrera öppna quotes till non-terminal statuses; lägg `date_trunc('month', …)`-filter för closed metric eller byt label.

---

## D — Commerce / Shop / Cart (D2C-flödet)

*16 fynd. Cart, shop, kassa och bekräftelse fungerar men har stora luckor.*

- **[S03 F-1.4] ProductJsonLd SKU matchar inte databasens SKUs**
  - File: `(marketing)/produkter/[slug]/page.tsx (~110-116)`; `packages/db/src/seed.ts (~114-137)`
  - Symptom: Detail-sidan bygger `ROOTS-SHAMPOO-001` etc.; seeded SKUs är `ROOTS-SH-001`, `ROOTS-CO-001`, `ROOTS-BW-001`. Structured data, ERP, och order lines reconcilierar inte.
  - Fix: Skicka real `sku` från katalog/DB-rad in i ProductJsonLd.

- **[S03 F-1.5] ProductJsonLd `image` är relativ path**
  - File: `components/json-ld.tsx (~73-74)`; `(marketing)/produkter/[slug]/page.tsx (~115)`
  - Symptom: Skickar `/images/m3.jpg`; Google Rich Results förväntar absoluta URLs; `metadataBase` finns men används inte.
  - Fix: `new URL(product.image, metadataBase).toString()` (eller `${SITE_URL}${product.image}`).

- **[S21 F-1.4] Social proof-checklistitems saknas — ingen peer/team ranking-copy**
  - File: `shop/[slug]/page.tsx` (entire file)
  - Symptom: Checklista förväntar "X andra har köpt" och "topp 5 i lag". Sidan visar bara `{orderCount} beställningar hittills` inom individual goal progress (gömt när `individualGoal` falsy).
  - Fix: Ytligör `stats.orderCount` som hero social proof; valfri team-rank-API.

- **[S21 F-1.5] "Skicka som present"-toggle inte implementerad någonstans i supporter-funnel**
  - File: `shop/[slug]/page.tsx`; `shop/[slug]/kassa/page.tsx`; `routes/checkout.ts`
  - Symptom: Checklist-feature helt frånvarande. Gift-köpare kan inte flagga intent före checkout.
  - Fix: Toggle på shop eller kassa + persistera till checkout-payload/order-metadata.

- **[S21 F-1.6] Per-shop Open Graph-bild inte satt — shares använder generic site-hero**
  - File: `shop/[slug]/layout.tsx (~46-61)`
  - Symptom: `generateMetadata` sätter title/description/url men inga `images`. Root-layout-default (`/images/h1desktop.jpg`) gäller.
  - Fix: Lägg `openGraph.images`/`twitter.images` (säljar-avatar eller campaign/produktcollage).

- **[S18 F-1.1] Produkter → beställningar tappar cart — multi-SKU-flow bruten** — Effort: M
  - File: `(portal)/portal/produkter/page.tsx:165-181`
  - Symptom: User väljer kvantiteter på `/portal/produkter`; sticky bar navigerar via `window.location.href = "/portal/bestallningar"` utan query, sessionStorage, eller POST. Cart-state är page-local `useState` — selections försvinner.
  - Fix: Skicka cart via sessionStorage/URL-params, eller merga ordering i produkter-sidan, eller öppna PortalOrderDialog pre-filled från catalog-state.

- **[S18 F-1.2] Order submit visar alltid success — failures tysta för user** — Effort: S
  - File: `(portal)/portal/bestallningar/page.tsx:141-183`
  - Symptom: `handleSubmit` fångar API-fel (console only) och kör unconditional `setSubmitted(true)` + clear cart. User ser "Beställning skickad!" även när `portalFetch` kastade.
  - Fix: Sätt `submitted` bara när response innehåller order; visa toast/alert på fail; behåll cart vid fel.

- **[S18 F-1.3] Fallback-katalog-ids skapar 0 kr ghost orders när API otillgänglig** — Effort: S
  - File: `bestallningar/page.tsx:39-43,86-88,145-151`; `routes/portal.ts:455-493`
  - Symptom: `CATALOG_FALLBACK_PRODUCTS` använder ids `"1"`, `"2"`, `"3"` (inte UUIDs). Om `/products` failar kan user submita; API skippar okända IDs, insertar order med `totalOre: 0` och noll line rows.
  - Fix: Disabla submit när products inte laddade från API; servern reject när `lines.length === 0` eller `totalOre === 0`.

- **[S18 F-1.4] Ingen leveransadress, PO, eller ship-to på B2B-ordrar** — Effort: L
  - File: `routes/portal.ts:437-440`; `packages/db/src/schema/orders.ts:30-50`; `organizations.ts`
  - Symptom: Wholesale-köpare kan inte specificera leveransplats, reference eller instruktioner. Order-dialog samlar bara qty.
  - Fix: Lägg org-leveransadress (eller adressbok), ship-to-snapshot på order, valfria PO/reference-fields.

- **[S18 F-1.5] Recurring/subscription-ordrar — inte implementerade för klubbar** — Effort: L
  - File: `packages/db/src/schema/subscriptions.ts`; `(portal)/portal/*`; `routes/portal.ts`
  - Symptom: Checklist-item "set up, pause, cancel recurring orders" har noll surface.
  - Fix: Lägg org-scoped subscription-model (eller återanvänd orders + cron), CRUD-API, portal-sida med pause/cancel.

- **[S18 F-1.8] Order list status-mapping använder fel field — tracking missledande** — Effort: S
  - File: `bestallningar/page.tsx:96-108`
  - Symptom: Mappar `o.status === "PAID"` → "Levererad", men API `orders.status` enum är PENDING|CONFIRMED|SHIPPED|DELIVERED|CANCELLED — aldrig PAID. `invoiceStatus` PAID ignoreras. DELIVERED-ordrar visar "Under behandling".
  - Fix: Mappa `order.status` till delivery-labels; visa `invoiceStatus` separat; fix KPI-filters.

- **[S17 F-1.3] Dashboard-stats motsäger "Senaste beställningar"** — Effort: S
  - File: `routes/dashboard.ts:599-610 vs 612-616,639-655`; `min-shop/page.tsx:152-165 vs 330-381`
  - Symptom: "Sålt" / "Beställningar" KPI:er räknar PAID only; `orders`-array inkluderar alla statuses (PENDING etc). Säljare ser "0 beställningar" men en pending rad i feeden.
  - Fix: Filtrera feed till PAID-only ELLER lägg unpaid-badge + separat "Väntar på betalning"-sektion; aligna KPI-labels.

- **[S17 F-1.4] `first_sale` milestone "Nästa" visar nonsense vid noll sales** — Effort: S
  - File: `lib/milestones.ts:56-62,164-215`; `min-shop/page.tsx:248-255`
  - Symptom: Ny säljare med 0 PAID-orders ser "Nästa: Första försäljningen! 0 kr kvar" eftersom `first_sale` har `thresholdOre: 1` och `getNextMilestone` behandlar som öre-gap.
  - Fix: Special-case `first_sale` när `orderCount === 0`; skippa öre-math.

- **[S16 F-1.1] Order KPI vs revenue-mismatch på team overview** — Effort: S
  - File: `(fundraising)/lag/page.tsx:156-157,112`; `routes/dashboard.ts:274-296,343-345`
  - Symptom: "Beställningar" card visar `orders.length` (alla statuses); "Total försäljning" aggregerar PAID-only via `salesBySeller`. Coach ser t.ex. 12 ordrar men 800 kr.
  - Fix: Visa PAID-count i KPI (eller splitta "Väntande" vs "Betalt"); aligna label-copy.

---

## E — AI guardrails

*9 fynd. AI fungerar men har säkerhets- och kostnads-risker.*

- **[S29 F-1.1] Redis rate limits fail open — AI-abuse unbounded vid Redis-outage** — Effort: M
  - File: `apps/api/src/lib/rate-limit.ts:29-31`; used by `aiRateLimit`, `hairAnalysisIpRateLimit`, `public-chat`
  - Symptom: Vilket Redis-fel som helst → `{ allowed: true }`. Public chat, authenticated chat, och hair analysis delar denna path.
  - Fix: Fail closed för `rl:pub-chat:*`, `rl:ai:*`, `rl:hair:*` (503 + retryAfter) eller process-local sliding window fallback.

- **[S29 F-1.2] Hair analysis rate limit tyst skipped när Redis kastar** — Effort: S
  - File: `apps/api/src/routes/hair-analysis.ts:81-91`
  - Symptom: Tom `catch` efter `hairAnalysisIpRateLimit` — kommentar säger "allow in development" men gäller i prod också. Vision-anrop fortsätter utan IP-cap.
  - Fix: Ta bort catch-bypass; använd samma fail-closed-policy som [1.1] eller reject med 503.

- **[S29 F-1.3] Per-role-guardrails inte applicerade i prod — session-route oanvänd** — Effort: S
  - File: `routes/ai-chat.ts:126-136`; `lib/ai/system-prompt.ts:60-105`
  - Symptom: `buildSystemPrompt(session.role, userName)` laddar role-specific context och striktare CRM-deferrals. Web-portal POSTar till `/v1/ai/public-chat` → alla inloggade får visitor-prompt medan UI lovar pipeline/KPI-hjälp.
  - Fix: Peka portal-AI på `/v1/ai/chat`; aktivera `FEATURE_PORTAL_AI_SESSION_ENDPOINT` för rollout.

- **[S29 F-1.4] Inga `audit_logs` för AI rate-limit-hits, fallbacks eller upprepade fel** — Effort: M
  - File: `routes/ai-chat.ts` (429 at 84-92); `public-chat.ts` (429 at 28-36); `hair-analysis.ts` (429 at 83-87)
  - Symptom: `auditLog()` används i auth/campaign men aldrig från AI-routes. Admin-system visar "Inga händelser" för AI-abuse; ingen trail för compliance eller cost-investigation.
  - Fix: `void auditLog({ action: "ai.rate_limited"|"ai.fallback"|"ai.error", userId, meta: { route, ip, model } })` på 429, fallback:true, och upprepade 502s.

- **[S29 F-1.5] Hair-analysis OpenAI-fail returnerar 502 — ingen graceful fallback** — Effort: S
  - File: `routes/hair-analysis.ts:136-151`
  - Symptom: Kill-switch returnerar 200 + strukturerad JSON-fallback. Runtime OpenAI-timeout/5xx kastar → `{ error: msg }` 502 — wizard visar generic failure; user tappar lead-magnet-värde.
  - Fix: Fånga vision-errors; returnera samma shape som kill-switch-fallback med `fallback: true` och generic package-rekommendation.

- **[S19 F-1.1] Portal AI anropar fortfarande public-endpoint — role-aware system-prompt aldrig applicerad** — Effort: S
  - File: `(portal)/portal/ai/page.tsx:18,124-136`
  - Symptom: Authenticated portal-users POSTar till `/v1/ai/public-chat`. Servern prependar `PUBLIC_CHAT_SYSTEM_PROMPT` som explicit refuserar CRM/pipeline/admin-svar, medan UI-welcome/chips lovar pipeline, KPI och admin-hjälp.
  - Fix: Peka API_URL till `/v1/ai/chat`; gate rollout på `FEATURE_PORTAL_AI_SESSION_ENDPOINT`.

- **[S19 F-1.2] Fel suggestion-chips för ASSOCIATION_ADMIN, TEAM_LEADER, SELLER** — Effort: S
  - File: `(portal)/portal/ai/page.tsx:231-248`
  - Symptom: Dessa roller får internal-admin-chips ("Vilka KPI:er ska jag titta på idag?", "Systemstatus", "Trender i håranalyskonvertering") medan welcome-text korrekt targetar kampanj/team-motivation/shop-sharing.
  - Fix: Lägg explicita chip-sets per ASSOCIATION_ADMIN, TEAM_LEADER, SELLER, INTERNAL_ADMIN.

- **[S19 F-1.3] Sales-facing chips lovar pipeline-data modellen inte kan accessera** — Effort: S
  - File: `(portal)/portal/ai/page.tsx:238-242`; `public-chat.ts:77-80`
  - Symptom: Chip "Sammanfatta min pipeline" implicerar live CRM-summary. Public-prompt har ingen pipeline-context och instruerar refusal av CRM-svar — hög hallucination/false-confidence-risk.
  - Fix: Omformulera chips till flow-level-frågor ("Hur fungerar pipeline i portalen?") tills data-grounding finns.

- **[S19 F-1.4] Per-user AI rate-limit bypassad — portal delar anonym IP-bucket** — Effort: S
  - File: `(portal)/portal/ai/page.tsx:18`; `ai-chat.ts:84-92`; `public-chat.ts:18-20`
  - Symptom: Inloggade portal-users träffar `pub-chat:${ip}` (30/h per IP) istället för `aiRateLimit(session.userId)` (30/min per user). Delad office-IP eller NAT kan blockera hela teams.
  - Fix: Switcha till `/v1/ai/chat` efter [1.1]; valfritt behåll IP-cap som sekundär abuse-guard på public-chat.

- **[S06 F-1.1] Redis rate-limit fail-open — unlimited public chat under Redis-outage** — Effort: M
  - File: `apps/api/src/lib/rate-limit.ts:29-31`
  - Symptom: `checkRateLimit` catch returnerar `{ allowed: true }` på Redis-errors; public chat delar denna path via `publicChatRateLimit`.
  - Fix: Fail closed för `pub-chat:*` (503 + retryAfter) eller short-lived process-local counter när Redis otillgänglig.

- **[S06 F-1.2] Dialog förblir keyboard-fokuserbar när visuellt stängd** — Effort: S
  - File: `apps/web/src/components/chat-widget.tsx:236-337`
  - Symptom: Panel stannar mountad med `pointer-events-none opacity-0` när `open=false`; close-knapp, textarea, send förblir i tab-order.
  - Fix: Conditionally render dialog när open, eller sätt `inert`/`aria-hidden="true"` och disabla focusables när stängd.

- **[S06 F-1.3] Stänga dialog (ESC/backdrop/X) avbryter inte in-flight stream** — Effort: S
  - File: `chat-widget.tsx:74-76,228-231,256-258`
  - Symptom: User kan stänga chat medan `streaming=true`; fetch fortsätter, konsumerar rate-limit och OpenAI-tokens; state uppdateras off-screen.
  - Fix: På varje close-path, anropa `stop()` om streaming; valfritt pausa UI-updates när `!open`.

---

## F — Data architecture (B2B `orders` vs B2C `customer_orders`)

*4 fynd. Admin-metrics är blinda för fundraising-flödet.*

- **[S13 F-1.2] Admin `/dashboard`-API ignorerar leaderboard, recentActivity, systemHealth — rika block hydreras aldrig** — Effort: M
  - File: `routes/portal.ts:251-262`; `(portal)/portal/page.tsx:434-436,474-537`
  - Symptom: "Säljare — topplista", "Senaste händelser", och system-card stannar tomma (eller false-green per [1.1]) även när sellers/quotes/audit-data finns.
  - Fix: Utöka `/dashboard` för INTERNAL_ADMIN: top sellers från `/sellers`-aggregates, recent från `audit_logs`, service-summary från `/system`-probe — eller ta bort UI-block tills wired.

- **[S13 F-1.3] "Aktiva klubbar" KPI räknar alla organizations, inte clubs** — Effort: S
  - File: `routes/portal.ts:236-259`
  - Symptom: Admin-tile "Aktiva klubbar" inkluderar leads, associations, och andra org-typer — inflaterad vs sales-dashboards som filtrerar `organizations.type = 'club'`.
  - Fix: `WHERE type = 'club'` (och valfritt `crm_status != 'LEAD'`) för att matcha SALES_ADMIN-semantik.

- **[S13 F-1.4] "MRR (betalda ordrar)" är livstidskumulativ revenue, inte monthly recurring** — Effort: S
  - File: `routes/portal.ts:239-258`; `(portal)/portal/page.tsx:417-420`
  - Symptom: Ops/investors som läser andra KPI:n tror det är recurring MRR; värdet är `SUM(orders.totalOre) WHERE invoiceStatus = 'PAID'` över hela tiden.
  - Fix: Byt UI till "Totalt betalt (alla tider)" eller beräkna rolling-30d/månads-PAID-sum.

- **[S20 F-1.1] `/statistics` ignorerar `customer_orders` — platform-KPIs missar fundraising-revenue** — Effort: L
  - File: `routes/portal.ts:1143-1271`; `customer-orders.ts`; `routes/portal.ts:564-609`; `seed-demo.ts:695`
  - Symptom: INTERNAL_ADMIN "KPI & Statistik" visar nära-noll revenue på seeded/demo-platform där supporter-checkout är primär revenue stream. Top products, monthly charts, 30d KPIs queryar bara `orders` + `order_lines`.
  - Fix: Mirror clubs-aggregate-pattern — union PAID `customer_orders` med `orders` (respektera orderScope), join `customer_order_lines` för top products.

- **[S20 F-1.3] `isDemo` returneras av API men aldrig surfaceas — trust-gap empty vs live** — Effort: S
  - File: `routes/portal.ts:1300`; `statistik/page.tsx`; `(portal)/portal/page.tsx:214-248`
  - Symptom: Brand-new org och INTERNAL_ADMIN med noll B2B-ordrar visar identisk tom UI; ingen "Demo-data"/"Live"-badge trots att Fas 1 master plan kräver isDemo-synlighet.
  - Fix: Parse `isDemo` från response; rendera `DataSourceBadge` bredvid h1 (matcha dashboard); när isDemo && !loading visa hjälpcopy.

- **[S13 F-1.5] System-page-telemetry strukturellt wirad men operationellt tom** — Effort: M
  - File: `routes/portal.ts:1559-1582,1566-1573`; `(portal)/portal/system/page.tsx:109-172,185-188`
  - Symptom: `/portal/system` laddar för INTERNAL_ADMIN men AI-usage visar alla "—", rate-limit-bars saknar `current`-värden, varje service-uptime är "—", AI-status reflekterar bara `OPENAI_API_KEY`-presence (inte reachability).
  - Fix: Emit Redis-counters för AI tokens/sessions; populera rate-limit-gauges; valfri lightweight OpenAI-ping; visa "Ej mätt"-styling när null.

- **[S13 F-1.6] Masterdata admin-UI saknas (Riksorganisation → Segment)** — Effort: L
  - File: `(portal)/portal/layout.tsx:59-68`; `packages/db/src/schema/master-riksorganisation.ts`; `master-segment.ts`
  - Symptom: INTERNAL_ADMIN har ingen portal-route för att browsa/editera riksorganisationer eller segment — Modell_register Fas 1 förväntar hierarkisk masterdata-ops-surface.
  - Fix: MVP minimum: read-only list + search för riksorg/segment med länk från ADMIN_NAV; full CRUD kan följa feedback-skill 01.

- **[S13 F-1.1] Admin dashboard system-status-card visar false-green health före fetch** — Effort: S
  - File: `(portal)/portal/page.tsx:79-83,398,546-560`
  - Symptom: INTERNAL_ADMIN landar på `/portal` och ser tre services (API, Redis, AI) med gröna prickar och badge-text "—", implicerande operational status.
  - Fix: Default `ok: false` eller neutral "Okänd" tills hydratiserad; eller fetcha `/portal/system` för sidebar-cardet; mappa unknown till `secondary`-badge.

- **[S35 F-1.1] INTERNAL_ADMIN metrics blinda för fundraising-sales — använder B2B `orders`, inte `customer_orders`**
  - File: `apps/api/src/routes/portal.ts:233-259,1189-1196`
  - Symptom: Flywheel-revenue osynlig högst upp; admin kan inte se supporter-sales flywheel-metrics.
  - Fix: Fixa admin-KPIs + `/portal/statistik` att unionera eller prioritera `customer_orders`.

- **[S35 F-1.5] Admin dashboard false-green system-health on load**
  - File: `(portal)/portal/page.tsx:79-83,398`
  - Symptom: Admin-dashboard-card använder `FALLBACK_ADMIN_SYSTEM_HEALTH` med `ok: true` före fetch — false-green vid första paint.
  - Fix: Default till unknown/loading tills fetch klar.

---

## G — Mobil & A11y

*15 fynd. iOS-zoom, för små tap targets, dolda paneler tabbbara, skip-link bryts.*

### Inputs och tap targets

- **[S33 F-1.1] Global `<Input>` på 14px triggar iOS-auto-zoom vid varje form-focus** — Effort: S
  - File: `components/ui/input.tsx:10`; kaskaderar till login, registrera, kassa, portal-modaler, fundraising-settings, hair-analysis-wizard
  - Symptom: På iPhone Safari, tap på text-field zoomar sidan ~1.1×; layout-jump; user måste pinch-out efter varje fält.
  - Fix: Byt default-Input till `text-base` (16px) på mobil via `text-base md:text-sm` eller unconditional `text-base`; mirror i hair-analysis native `<input>`-classes.

- **[S32 F-1.3] Shared Input använder text-sm (~14px) — iOS Safari zoom on focus** — Effort: S
  - File: `components/ui/input.tsx:10`
  - Symptom: Alla scoped forms använder `Input` med `text-sm`. På iOS triggar focused inputs <16px viewport-zoom.
  - Fix: `text-base` på Input vid md breakpoint ner, eller `text-base` globalt för form-controls.

- **[S32 F-1.2] Checkout-form saknar autocomplete — mobil autofill bruten** — Effort: S
  - File: `kassa/page.tsx:257-286,337-364`
  - Symptom: `customerName`, `customerEmail`, `customerPhone`, address-fields har ingen `autoComplete`. iOS/Android erbjuder inte sparad kontakt/adress på högsta-friktion supporter-steg.
  - Fix: Lägg `name`, `email`, `tel`, `address-line1`, `postal-code`, `address-level2` per WHATWG-mapping.

- **[S33 F-1.2] Långa URL-copy-rows tvingar horisontell page-scroll vid ~360px** — Effort: S
  - File: `min-shop/page.tsx:283-291`; `lag/page.tsx:211-224`; `forening/lag/page.tsx:244-261`; `installningar/page.tsx:286-291`
  - Symptom: Read-only `<Input value={fullUrl}>` inom `flex gap-2` expanderar förbi viewport; body scrollar sidledes; copy-knapp kan klippa.
  - Fix: Wrappa input i `min-w-0 flex-1`; lägg `truncate` eller stacka vertikalt på `max-sm:flex-col`; föredra copy-only-mönster.

- **[S33 F-1.3] Shop sticky cart-bar täcker sista innehåll och legal footer** — Effort: S
  - File: `shop/[slug]/page.tsx:166,331-354`; `(shop)/layout.tsx:17-41`
  - Symptom: Med items i cart scrollar supporter till delivery-info eller footer-villkor/integritet — innehåll gömt under ~64px+ fixed bar.
  - Fix: Conditional bottom padding på main matchande cart-bar-höjd + safe-area; eller inset spacer-div ovanför footer.

- **[S33 F-1.4] Auth/register-layout vertikalt centrerar forms — submit CTA gömd bakom mobile keyboard** — Effort: M
  - File: `(auth)/layout.tsx:17-18`; `(auth)/registrera/page.tsx`
  - Symptom: På `/login` och `/registrera`, `flex-1 items-center justify-center` håller card mid-screen; keyboard pushar fields up men "Skapa konto"/"Nästa" kan sitta under keyboard; Enter-key inkonsistent.
  - Fix: `@media (max-width: 767px)` switcha main till `items-start pt-6 pb-8 overflow-y-auto`; wrappa steps i `<form onSubmit>`; scrolla focused field i view.

- **[S33 F-1.5] Dual fixed bottom chrome på produkt-detail — chat-FAB överlappar sticky CTA** — Effort: S
  - File: `(marketing)/produkter/[slug]/page.tsx:187-197`; `chat-widget.tsx:340-355`; `(marketing)/layout.tsx:16`
  - Symptom: På `/produkter/shampoo` vid 360px, user ser sticky "Beställ via din förening"-bar OCH chat-FAB bottom-right; FAB sitter på bar/CTA-zon; thumb-target ambiguity.
  - Fix: Dölj ChatWidget på routes med bottom sticky bars, höj FAB till `bottom-24` när sticky-bar present, eller merga till en bottom-sheet.

### Accessibility

- **[S34 F-1.1] Skip-to-content-länk bruten utanför marketing-shell** — Effort: S
  - File: `apps/web/src/app/layout.tsx:79-84`; `(marketing)/layout.tsx:14`
  - Symptom: "Hoppa till innehåll" är global, men `id="main-content"` finns bara på `(marketing)/layout.tsx`. På `/login`, `/portal/*`, `/shop/*`, `/forening`, `/min-shop` etc. gör skip-link inget useful.
  - Fix: Lägg `id="main-content"` till `<main>` i `(auth)/layout.tsx`, `(portal)/portal/layout.tsx`, `(fundraising)/layout.tsx`, och shop-pages.
  - WCAG: 2.4.1 Bypass Blocks (A)

- **[S34 F-1.2] Auth-pages har inget document `<h1>` — CardTitle renderar `<div>`** — Effort: S
  - File: `components/ui/card.tsx:25-28`; `(auth)/login/page.tsx:64`; `registrera/page.tsx:170,262`; etc.
  - Symptom: Screen readers och heading-navigation skippar primary page-title på varje auth/registration-screen.
  - Fix: Byt `CardTitle` att rendera `h1` (eller acceptera `asChild`/level-prop); säkerställ en h1 per auth-sida.
  - WCAG: 1.3.1, 2.4.6 (AA)

- **[S34 F-1.3] Site search-dialog saknar accessible name (ingen DialogTitle)** — Effort: S
  - File: `components/search-dialog.tsx:151-167`
  - Symptom: Radix DialogContent utan DialogTitle triggar console-warning och lämnar modal unnamed för AT.
  - Fix: Lägg `<DialogTitle className="sr-only">Sök på Roots</DialogTitle>`.
  - WCAG: 4.1.2 (A)

- **[S34 F-1.4] Stängd chat-panel förblir i keyboard tab-order** — Effort: S
  - File: `chat-widget.tsx:236-337`
  - Symptom: När chat stängd (`opacity-0 pointer-events-none`), focus kan tabba in i textarea, send, stop, close-knappar inom off-screen dialog.
  - Fix: När `!open`, lägg `hidden`/`inert`/`aria-hidden="true"` på dialog-container, eller conditionally unmount panel-innehåll.
  - WCAG: 2.1.1, 2.4.3 (A)

- **[S34 F-1.5] Mobile marketing-nav-overlay fokuserbar när visuellt gömd** — Effort: M
  - File: `header.tsx:196-272`
  - Symptom: Full-screen mobile-menu använder `opacity-0 pointer-events-none` när stängd men förblir i DOM; Tab når nav-links, search, CTAs medan menyn ser stängd ut.
  - Fix: Toggla `inert` + `aria-hidden` på overlay när stängd; trap focus + ESC när öppen; restore focus till burger.
  - WCAG: 2.1.1, 2.4.3

- **[S34 F-1.6] Portal sidebar off-screen-links fortfarande tabbbara på mobil** — Effort: M
  - File: `(portal)/portal/layout.tsx:156-217`
  - Symptom: På viewports < lg, sidebar är `-translate-x-full` när stängd men nav-links, logout, help förblir nåbara via tangentbord.
  - Fix: Sätt `inert={!sidebarOpen}` på aside för mobil, eller `hidden lg:flex`-mönster; trap focus när öppen.

- **[S34 F-1.7] Hair-analysis-wizard: sex `<select>`-fält ej programmatically labeled** — Effort: S
  - File: `hair-analysis-lead-dialog.tsx:567-648`
  - Symptom: `<Label>`-text är visuell bara — ingen `htmlFor`/`id`-pairing på wash frequency, hair type, scalp, heat tools, chemical treatment, swim frequency.
  - Fix: Lägg unique `id` per select och `htmlFor` på varje Label.
  - WCAG: 1.3.1, 3.3.2, 4.1.2

- **[S34 F-1.8] AI-chat-meddelanden ej announced — saknar aria-live-region** — Effort: S
  - File: `chat-widget.tsx:267-297`; `(portal)/portal/ai/page.tsx:294-337`
  - Symptom: Nya assistant-meddelanden (inkl. streamed tokens) dyker upp tyst; SR-users måste manuellt hitta message-listan.
  - Fix: Wrappa message-list i `aria-live="polite"` + `aria-atomic="false"`-region.
  - WCAG: 4.1.3 (AA)

### Forms (overlap with mobile)

- **[S32 F-1.1] Portal "Ny beställning" visar success efter failed API-call** — Effort: S
  - File: `(portal)/portal/bestallningar/page.tsx:141-183,212-219`
  - Symptom: `handleSubmit` catch bara `console.error`s; execution fortsätter till `setCart({})`, `setSubmitted(true)`. User ser "Beställning skickad!" även när POST failade.
  - Fix: På failure sätt `submitError` state, behåll dialog i edit mode, visa svenskt fel; bara `setSubmitted(true)` när order skapad.

- **[S32 F-1.4] Registration-wizard är inte ett `<form>` — native validation och a11y-tree brutna** — Effort: M
  - File: `(auth)/registrera/page.tsx:285-521`
  - Symptom: Steps 1-3 är `<div>` + `Button onClick`. `required` på Inputs i steps 1-2 fires aldrig. Enter advancerar/submitar inte.
  - Fix: Wrappa varje step i `<form onSubmit>` eller en form med step-fieldsets; anropa `reportValidity()` före step-advance; `aria-current="step"`.

- **[S32 F-1.5] Team registration org-search-field failar tyst (401)** — Effort: M (API) / S (UI error)
  - File: `(auth)/registrera/page.tsx:71-86,348-373`
  - Symptom: Anonymous `fetch` till `/v1/auth/organizations/search` returnerar 401; UI visar tom dropdown — user tror org inte finns. Inget `role="alert"`, ingen retry-guidance.
  - Fix: Öppna search pre-auth ELLER visa explicit fel under orgSearch-field; disabla team-path med länk till association-signup.

### S01 hero LCP

- **[S01 F-1.2] Hero LCP-bilder är ~5 MB var, mislabeled PNG-som-JPG, båda markerade `priority`** — Effort: M
  - File: `components/sections/hero.tsx:10-30`
  - Symptom: På mobil (360px) väntar first-paint på `h1mobile.jpg` (~5.2 MB, actually PNG). Desktop-branch laddar också ~4.8 MB med `priority`. Slow 3G/4G first visit visar blank hero i flera sekunder.
  - Fix: Re-export som WebP/AVIF vid ≤200 KB mobile / ≤400 KB desktop; använd `<picture>` eller single responsive srcset; behåll `priority` på en visible branch only.

---

## H — API contracts & schema-drift

*6 fynd. Kontrakt finns men följs inte; index saknas; envelopes inkonsekventa.*

- **[S31 F-1.1] Ingen stable machine-readable error-`code` på REST-surface** — Effort: M
  - File: alla `apps/api/src/routes/*.ts`; `app.ts onError (154-163)`
  - Symptom: Varje failure är `{ error: "…" }` (svensk prosa). Klienter kan inte branscha på `CSRF_INVALID`, `RATE_LIMITED`, `ORG_MISSING` utan string-matching.
  - Fix: Lägg optional `code: z.string()` till `apiErrorSchema`; mappa kända fall i shared `jsonError(c, { error, code, status })`.

- **[S31 F-1.2] `settlement/*` returnerar 403 för okrypterade callers (borde vara 401)** — Effort: S
  - File: `routes/settlement.ts:26-45,168-169,226-227`
  - Symptom: `requireAdmin()` returnerar `null` för missing cookie, expired session, ELLER fel role; handler alltid `c.json({ error: "Behörighet saknas" }, 403)`.
  - Fix: Splitta `requireSession` → 401 `"Ej inloggad"`, sedan role/org-check → 403.

- **[S31 F-1.3] `@roots/contracts` inte enforced vid REST-emit-boundary (bara offline tests)** — Effort: M
  - File: `packages/contracts/src/portal.ts`; `portal.contract.test.ts`; `portal.ts` (no `.parse()`)
  - Symptom: MASTER_PLAN T1-drift (UI-keys vs API-keys) kan shippas trots att contracts finns; server avvisar aldrig sin egen malformed JSON före send.
  - Fix: I portal-handlers, `dashboardResponseSchema.parse(payload)` före `c.json`, eller shared `emitContract(c, schema, data)`.

- **[S31 F-1.4] Rate-limits saknar standard `X-RateLimit-*` / `Retry-After`-headers** — Effort: S
  - File: `lib/rate-limit.ts`; `auth.ts:106-111`; `ai-chat.ts:86-91`; `public-chat.ts:30-35`; `hair-analysis.ts:84-87`; `contact.ts:35`
  - Symptom: 429-bodies inkluderar ibland `retryAfter` men inga response-headers; login/contact-limits ger bara `{ error }`.
  - Fix: Middleware/helper `applyRateLimitHeaders(c, result)` som sätter `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

- **[S31 F-1.5] List-endpoints använder hårdkodade caps utan query-pagination (förutom audit-log)** — Effort: M
  - File: `portal.ts` (orders/quotes/clubs/pipeline limits 25-100); `notifications.ts FEED_LIMIT`; `admin.ts:68-69` (GOOD)
  - Symptom: Sales/club-portals trunkerar tyst; inget `?limit=&offset=`-kontrakt för integratörer.
  - Fix: Dokumentera defaults; acceptera `limit` (max cap) + `offset` på high-volume GETs; returnera `{ items, total, limit, offset, hasMore }`.

---

## I — Communications & notiser (e-post)

*4 fynd. Welcome-mail trasig, milstolp-mail aldrig skickade, produktion kan boota utan email.*

- **[S28 F-1.1] Welcome-mail login-CTA pekar till `/logga-in` — 404** — Effort: S
  - File: `lib/email/templates.ts:61`; `(auth)/login/page.tsx`
  - Symptom: Alla fyra welcome-email-triggers skickar button "Logga in" → `{siteUrl}/logga-in`. Ingen `/logga-in`-route eller redirect i web.
  - Fix: Byt href till `/login` ELLER lägg permanent redirect `/logga-in` → `/login`.

- **[S28 F-1.2] Produktion kan köra utan riktig email-leverans** — Effort: S
  - File: `lib/email/index.ts:15-24`; `lib/validate-env.ts:66-68`
  - Symptom: Missing `RESEND_API_KEY` väljer MockEmailSender; returnerar `{ success: true }` lokalt. Registration och order-confirmations verkar lyckas men når aldrig recipients.
  - Fix: Fail boot i prod om `RESEND_API_KEY` unset.

- **[S28 F-1.3] Email-footer saknar mandatory LegalIdentity-fält** — Effort: S
  - File: `lib/email/templates.ts:33-35`; `lib/legal-identity.ts:13-33`
  - Symptom: Footer visar bara company-name + site + email. Email-recipients (särskilt order-confirmation) ser ofullständig sender-identity.
  - Fix: Footer = legalName, orgNumber, `formatAddressSingleLine()`, hej@roots.se, roots.se-link.

- **[S28 F-1.4] Milestone-mails skickas aldrig — gamification-loop bruten** — Effort: M
  - File: `lib/email/templates.ts:113-132`; `lib/communication-templates.ts:88-105`
  - Symptom: HTML `milestoneEmail` och plain `getMilestoneTemplate` finns; ingen route/job anropar dem efter checkout eller campaign-progress.
  - Fix: På checkout-webhook efter PAID, beräkna team-kumulativ försäljning mot thresholds; fan-out via `milestoneEmail` (dedupe per threshold).

---

## J — Trust, legal & SEO

*3 fynd. Telefon-placeholder i JSON-LD; AI-disclosure saknas; org-uppgifter osverifierade.*

- **[S04 F-1.1] Placeholder-telefon i publicerad legal-identity**
  - File: `lib/legal-identity.ts (contact.phone: "+46 8 000 000 00")`; `components/json-ld.tsx (OrganizationJsonLd → telephone)`
  - Symptom: Fake telefon i schema.org Organization vilseleder konsumenter och search-engines; JSON-LD emitterar den fast LegalIdentityBlock inte visar telefon i UI.
  - Fix: Ersätt med verifierat business-phone före launch; lägg telefon i LegalIdentityBlock när `showContact=true`, eller ta bort telephone från JSON-LD tills riktig.

- **[S04 F-1.2] Registered address / org.nr inte verifierbart från repo**
  - File: `lib/legal-identity.ts`
  - Symptom: `orgNumber "559517-3210"`, `vatId "SE559517321001"`, `street "Storgatan 1"` läser som generic placeholder; om inte matchar Bolagsverket/Fortnox publiceras false trader-identity överallt.
  - Fix: Bekräfta mot company-registration; uppdatera `legal-identity.ts` till exakt registrerad postadress.

- **[S04 F-1.3] Integritetspolicy saknar AI/automated-decision-disclosure för håranalys**
  - File: `(marketing)/integritet/page.tsx`
  - Symptom: Sektion 2 nämner håranalys-bilder + OpenAI, men inget Art. 13/22-språk om automated profiling, logic involved, significance/consequences, eller right to human review.
  - Fix: Lägg subsektion under håranalys eller "Dina rättigheter" som täcker automated analysis, opt-out/human-contact-path, och att rekommendationer är advisory inte binding.

---

## GDPR-fynd (cross-cuts B)

- **[S01 F-1.1] Hero primary CTA opt-in:ar tyst users till newsletter-marketing** — Effort: S
  - File: `components/sections/hero-lead.tsx:10-21` → `hair-analysis-lead-dialog.tsx:164,193,210,305`
  - Symptom: Visitor klickar "Starta din håranalys"; efter GDPR consent-checkbox inkluderar API-payload alltid `newsletterConsent: true` utan visible marketing-opt-in.
  - Fix: Lägg separat ocheckad checkbox bundet till `newsletterConsent`; default `false`; skicka `true` bara när checked.

- **[S05 F-1.1] Newsletter-consent skickas opted-in utan visible control** — Effort: S
  - File: `hair-analysis-lead-dialog.tsx:164,193,305-306`; `routes/hair-analysis.ts:102`; `leads.ts:7`
  - Symptom: `const [newsletterConsent] = useState(true)` — fixed true, ingen checkbox; payload alltid `newsletterConsent: true` medan integritet §3 kräver explicit consent (Art. 6.1 a).
  - Fix: Separat checkbox + copy, default false; persistera i draft; skicka true bara när checked.

- **[S05 F-1.2] `ageConfirmed: true` skickas utan någon age-gate i UI** — Effort: S
  - File: `hair-analysis-lead-dialog.tsx:306`; `hair-analysis.ts:103`
  - Symptom: Klienten hårdkodar `ageConfirmed: true`; DB lagrar det; ingen 18+-checkbox eller copy trots composer-agent 01 UX-spec.
  - Fix: Lägg explicit age-confirmation på gate-step eller ta bort fält från contract.

---

**Total i P1: 164 fynd verifierade.**

Se `MASTER_02_NECESSARY.md` för P2 (292) och `MASTER_03_IMPROVEMENT.md` för P3 + P4 (281).
