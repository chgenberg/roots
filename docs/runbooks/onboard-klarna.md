# Onboard Klarna

> MASTERPLAN_01 KC1 — koppla på Klarna checkout (när vi har avtalet).
> Tills detta är gjort kör vi `NullProvider` → ordrar fastnar i
> "PENDING (mock)" och kan flippas manuellt via admin-knapp för tester.

## Förutsättningar

- [ ] Klarna merchant-konto inrättat på `https://merchants.klarna.com`.
- [ ] Avtal signerat (test-konto räcker inte — production-Klarna kräver
      uppgifter om bolagsform, kontonr etc).
- [ ] `merchant_id` + API-credentials (Username + Password) noterade.
      Klarna kallar dem `username` och `shared_secret`.

## Env-variabler

Lägg dessa i Railway (prod) **innan** du deployar koden — boot-
validation (`validate-env.ts`) fail:ar annars i prod.

| Variabel | Värde | Anteckning |
|---|---|---|
| `KLARNA_USERNAME` | `PK00000_xxxxxxxx` | "EID" från merchant portal |
| `KLARNA_PASSWORD` | `xxxxx-xxxxx-xxxxx` | "Shared secret" |
| `KLARNA_WEBHOOK_SECRET` | `<gen 32-byte hex>` | Vi väljer själva. Spara i 1Password. |
| `KLARNA_WEBHOOK_IPS` | `83.140.0.0/16,...` | Komma-separerad. Hämtas från Klarnas IP-allowlist-doc. |
| `KLARNA_BASE_URL` | `https://api.klarna.com` (prod) eller `https://api.playground.klarna.com` (test) | |

## Wiring-steg

1. **Skapa webhook i Klarna**
   - Merchant portal → Settings → Push notifications.
   - URL: `https://api.roots.se/v1/checkout/webhook/{checkout.order.id}`
   - Sign with secret = `KLARNA_WEBHOOK_SECRET` (samma som env).
2. **Deploya med nya env-vars satta**. `validate-env` blockar boot om
   `KLARNA_USERNAME`/`KLARNA_PASSWORD` saknas i prod.
3. **Smoke-testa**:
   ```bash
   # Ska returnera 503 om webhook ej konfigurerad, 401 om signaturfel,
   # 200 vid valid signature.
   curl -X POST https://api.roots.se/v1/checkout/webhook/test-order-id
   ```
4. **Test-köp**: lägg en order i staging (playground-Klarna), kolla
   att `customer_orders.status` flippar PENDING → PAID inom 5 s,
   och att `audit_logs` har en rad `order.paid` med
   `source: "klarna_webhook"`.
5. **Aktivera produktions-trafik**: byt `KLARNA_BASE_URL` till
   `https://api.klarna.com` och `KLARNA_USERNAME`/`KLARNA_PASSWORD`
   till prod-credentials.

## Rollback om Klarna agerar konstigt

Sätt `KLARNA_USERNAME=` (tom string). `Klarna lib`-init logg:ar
"missing creds" och faller tillbaka på en stub som returnerar 503
till alla calls. Användarna ser "Betalningen kunde inte initieras"
istället för en halv-charge. Mer skonsamt än hel deploy-rollback.

## När detta är klart

- [ ] Synthetic-cron-jobbet (`scripts/synthetic.mjs`) börjar inkludera
      en faktisk Klarna-status-check.
- [ ] Vi kan ta bort fallback-bannret "betalning under test" från
      checkout-UI (om vi har en sådan).
