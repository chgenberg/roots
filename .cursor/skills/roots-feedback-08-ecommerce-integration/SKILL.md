---
name: roots-feedback-08-ecommerce-integration
description: >-
  Plan för att låta befintligt eCommerce-lager (shop/kassa/orders/payouts/
  Fortnox) leva ovanpå den nya CRM/masterdata-modellen utan regression. Åtta
  read-only sub-agents producerar var sin .txt-plan i docs/feedback-plans/
  08-ecommerce-integration/. Använd när användaren vill kartlägga hur
  befintliga commerce-flöden anpassas till nya hierarkin från skill 01–07.
---

# Roots Feedback 08 — eCommerce ovanpå CRM (regression-säker integration)

## Syfte

Efter skill 01–07 finns en ny datamodell, CRM-pipeline och AI-agent-svit.
Befintligt **eCommerce-lager fungerar redan i produktion** och får INTE
brytas:

- `/shop/[slug]` (säljarens publika shop)
- `/kassa` (supporter-checkout)
- `customer_orders`, `payouts`, `subscriptions`
- Klarna/Fortnox-integration
- Settlement, payouts till föreningar

Modell_register säger: *"Bygg det som CRM/masterdata-plattform med eCommerce
ovanpå."* Detta skill säkerställer att eCommerce blir ett tunt, korrekt,
bakåtkompatibelt lager — inte en omdesign.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/08-ecommerce-integration/`.

## Källdokument

- `apps/api/src/routes/shop.ts`, `checkout.ts`, `customer-checkout.ts`,
  `settlement.ts`
- `apps/api/src/lib/payments/`, `apps/api/src/lib/invoicing/`
- `packages/db/src/schema/customer-orders.ts`, `payouts.ts`,
  `subscriptions.ts`, `orders.ts`, `products.ts`, `campaign-products.ts`
- `apps/web/src/app/(shop)/`
- `apps/web/src/lib/use-cart.ts` (befintlig)
- `docs/flow-audits/SUPPORTER_2026-04-18_1247.txt`
- `docs/flow-audits/CLUB_MEMBER_2026-04-18_1249.txt`
- `docs/flow-audits/CONVERSION_TRUST_2026-04-18_1313.txt`

## Arbetssätt

8 sub-agents parallellt. Output i
`docs/feedback-plans/08-ecommerce-integration/`:

```
01_shop_links_to_group_unit.txt
02_order_attribution.txt
03_settlement_and_payouts.txt
04_fortnox_klarna_compatibility.txt
05_subscriptions_in_new_model.txt
06_customer_records_and_gdpr.txt
07_b2b_club_orders.txt
08_regression_test_matrix.txt
```

---

## De 8 sub-agents

### Agent 1 — Säljarens shop-koppling till `group_unit`

**Scope:** `apps/web/src/app/(shop)/shop/[slug]/`, `apps/api/src/routes/shop.ts`,
`packages/db/src/schema/sellers.ts`
**Leverans:** `01_shop_links_to_group_unit.txt`

Beskriv:
- När `sellers.group_unit_id` är satt: visa "P10 Svart, Onsala BK" på shop-pagen
- Bakåtkompatibilitet: när `group_unit_id` är NULL fallar tillbaka till nuvarande visning ("Onsala BK")
- Org.status-gating: shop visar varning om `org.status != Active` (behöver inte
  blockera köp om kampanj är ACTIVE — separera kontroller)
- Säljarens `publicAlias` + `hideFromLeaderboard` (finns redan i schema från
  master plan)
- OG-metadata uppdateras med grupp + förening
- Inga query-regressioner (befintlig logik måste fortsätta fungera om
  group_unit_id saknas)

### Agent 2 — Order-attribution (org → group → seller)

**Scope:** `customer_orders.ts`, `customer-checkout.ts`
**Leverans:** `02_order_attribution.txt`

Beskriv:
- Säkerställ att `customer_orders` har FK till: organization_id, group_unit_id,
  seller_id, campaign_id
- Backfill-strategi för befintliga orders (group_unit härleds från seller.team
  → ny group_unit)
- Index för aggregat-queries: (organization_id, created_at), (group_unit_id,
  created_at), (campaign_id, status)
- Datavalidering vid insert: org/group/seller/campaign ska vara konsistenta
  (samma org-träd)
- Hur "anonyma" supportrar (utan kund-konto) loggas
- Refunds: håll attribution intakt även vid refund

### Agent 3 — Settlement & payouts till föreningen

**Scope:** `apps/api/src/routes/settlement.ts`, `payouts.ts`
**Leverans:** `03_settlement_and_payouts.txt`

Beskriv:
- Befintlig settlement aggregerar per team → uppdatera till group_unit / org
- Marknadsstöd-trappa (skill 05 agent 4) appliceras på payout-räkningen
- Dubblerings-skydd (befintlig settlement har redan `campaign.status = SETTLED`-
  guard, dokumentera)
- Fortnox-kund-linkning: `organizations.fortnox_customer_id` (finns) återanvänds
- Payout-rapport till föreningens superuser (PDF + spec per lag/säljare)
- Edge case: kampanj med 0 sålda paket → skip payout men logga
- Audit: varje settlement-rad refererar till bake av source-orders

### Agent 4 — Fortnox & Klarna kompatibilitet

**Scope:** `apps/api/src/lib/invoicing/`, `payments/`
**Leverans:** `04_fortnox_klarna_compatibility.txt`

Beskriv:
- Inga ändringar i Fortnox-API-kontrakt (tjänsten konsumerar bara
  organizations + payouts)
- Klarna-callback-flöde: säkerställ att `customer_orders.status`-uppdatering
  fortsätter fungera oavsett ny org-modell
- Invoice-numrering oförändrad
- Ny `data_source`/`data_quality` på `organizations` är hidden för Fortnox
  (skickas inte med)
- Webhook-signatur-verifiering (om finns)
- Test-läge: stub-providers för CI

### Agent 5 — Subscriptions i nya modellen

**Scope:** `subscriptions.ts`
**Leverans:** `05_subscriptions_in_new_model.txt`

Beskriv:
- Personliga prenumerationer (kunden köper schampo var 3:e månad) — ingen
  ändring i grunddataflöde
- Föreningsprenumeration (kvartalskampanj) — ny entity? Eller
  `campaign.recurrence_pattern`? Föreslå campaign-side, inte ny tabell
- Status-flow: ACTIVE → PAUSED → CANCELLED → EXPIRED (finns)
- Attribution: subscription tillhör sista säljaren eller föreningen?
- Renewal-logik (auto-renewal jobb i background workers, skill 07 agent 8)
- "Återköp"-promo (skill 06 agent 8) konverteras till subscription-erbjudande
- GDPR: rätt att avsluta enkelt + reminders innan förnyelse

### Agent 6 — Kund-poster & GDPR

**Scope:** `customer-orders.ts`, `customers`-relaterat
**Leverans:** `06_customer_records_and_gdpr.txt`

Beskriv:
- Slutkund-data (mejl, tel, adress) som sparas vid köp
- Modell_register kap 10 — ny `customer`-tabell? Vi har redan `customer_orders`
  med inline-kund-data — föreslå om vi separerar `customer` (PII) från `order`
- Returkund-detektion (samma e-post/tel) för LTV/repeat-rate
- Consent-spår: marketing opt-in vid checkout
- Glömt-mig-flöde (anonymisera order, behåll aggregat)
- Datalagringspolicy: hur länge? (bokföringslagen kräver 7 år för transaktioner)
- Pseudonymisering före BI-export (skill 07)

### Agent 7 — B2B-klubborders (CLUB_ADMIN/CLUB_MEMBER-flödet)

**Scope:** `apps/web/src/app/(club)/`, befintliga `orders` (B2B) vs
`customer_orders` (B2C)
**Leverans:** `07_b2b_club_orders.txt`

Beskriv:
- Distinguera B2B-portalflöde (klubb beställer wholesale) från B2C
  (säljarflöde)
- Tabellseparation `orders` (B2B, befintlig) vs `customer_orders` (B2C, befintlig)
- Återkommande klubborders (recurring purchase) — koppling till `subscriptions`
- Klubbinvolverat: organization som kund, inte slutkund
- Fakturering till organisationen (Fortnox via `fortnox_customer_id`)
- Flikar i `/portal/`: "Mina ordrar" (CLUB_ADMIN ser org-ordrar)
- Konsistens med ny lead-pipeline (klubborders triggar inte ny org.status,
  förblir Active)

### Agent 8 — Regressionstest-matris

**Scope:** Hela commerce-flödet
**Leverans:** `08_regression_test_matrix.txt`

Beskriv testfallen som måste passera EFTER skill 01–07-implementation:
- Säljare-shop: 5 produkter, lägg till i cart, checkout, betala (mock), order
  registrerad, payout uppdaterad
- B2B-klubb: ASSOCIATION_ADMIN beställer 50 paket, faktura skickas, levereras,
  payout-flow
- Refund-flöde: refund-button, status uppdateras, attribution intakt
- Settlement: kampanj med 100 orders + flera lag → korrekt belopp per grupp
- Subscription: kund + tre köp = inte tre samma orders
- Klarna webhook: failure → retry → success
- Org soft-delete: shop visar 410 Gone (ej 500)
- Sellers under minderåriga: inga personnamn visas externt
- E2E (Playwright) test-suite-utökning
- Smoke-tests för CI vid varje PR

---

## Sub-agent prompt-mall

Som skill 01. Output i `docs/feedback-plans/08-ecommerce-integration/`.

## Checklista

- [ ] 8 .txt-filer
- [ ] Inga ändringar i befintliga shop/kassa/Fortnox-kontrakt föreslås utan
  bakåtkompatibilitet
- [ ] Regressionsmatris tydlig och körbar
- [ ] Cross-refs till skill 01–07 markerade
