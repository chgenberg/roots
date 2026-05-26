# Onboard Fortnox

> MASTERPLAN_01 KC1.4 — koppla på Fortnox faktura-export (när vi har
> bokföringsbyrå-OK + token). Tills detta är gjort kör vi
> `NullInvoiceProvider` som "fakar" hela flödet i minnet — settlement
> kan testas E2E utan att riktig Fortnox är inkopplad.

## Vad fungerar redan idag (utan Fortnox)

- ✅ `POST /v1/settlement/create-invoice/:payoutId` — laddar org-data,
      kallar provider, sätter `payout.status = INVOICED`. NullProvider
      returnerar deterministiska `NULL-INV-xxxx` ID:n.
- ✅ `PATCH /v1/payouts/:id/status` (PAID/INVOICED) — fungerar helt
      utan extern provider. INTERNAL_ADMIN flippar via UI när bank-
      transfer är gjord manuellt.
- ✅ Audit `payout.invoiced` + `payout.paid` emitas oavsett provider.
- ✅ E-postnotifiering `payoutPaidEmail` till ASSOCIATION_ADMIN
      körs oavsett (Resend-konfig eller MockSender i dev).

## Förutsättningar för riktig Fortnox-koppling

- [ ] Bokföringsbyrån har gett klartecken (de äger Fortnox-kontot).
- [ ] OAuth-app skapad i Fortnox developer portal.
- [ ] Access token (long-lived eller refresh-token-flow) hämtad.
- [ ] Vi har bestämt vilket artikelnummer/intäktskonto Roots-andelen
      bokförs på (default: ArticleNumber `SETTLEMENT`, AccountNumber
      `3001` — försäljning Sverige 25% moms).

## Env-variabler

| Variabel | Värde | Anteckning |
|---|---|---|
| `FORTNOX_ENABLED` | `true` | Switch som triggar val av `FortnoxInvoiceProvider` istället för `NullInvoiceProvider`. |
| `FORTNOX_ACCESS_TOKEN` | `<long token>` | OAuth access-token. Roteras enligt Fortnox-policy. |
| `FORTNOX_WEBHOOK_SECRET` | `<gen 32-byte hex>` | För `/v1/integrations/fortnox/webhook` HMAC. |

## Wiring-steg

1. **Verifiera schema-readiness**:
   ```sql
   -- Bör returnera 3 rader (paid_at, paid_by_user_id, payment_reference)
   SELECT column_name FROM information_schema.columns
     WHERE table_name='payouts'
       AND column_name IN ('paid_at','paid_by_user_id','payment_reference');
   ```
   (Migration `0008_payout_paid_metadata.sql` lägger dem.)
2. **Lägg env-variablerna i Railway** innan deploy.
3. **Deploya**. Boot-log:en ska säga "FortnoxInvoiceProvider initialised"
   (annars fortsätter NullProvider tyst — kolla `FORTNOX_ENABLED`-värdet).
4. **Smoke-testa** mot Fortnox staging:
   ```bash
   curl -X POST -H "Cookie: roots_session=..." \
     https://api.roots.se/v1/settlement/create-invoice/<payout-id>
   ```
   Förväntat: response `{ ok: true, invoiceId: "<numerisk>" }`.
   Verifiera i Fortnox UI att fakturan har korrekt kund + 25% moms.
5. **Fyll i föreningens postadress** i `/forening/installningar` (när
   det UI:t finns; just nu sätts bara `postalCode` + `municipality`
   från masterdata). Utan postadress accepterar Fortnox kunden men
   PDF-fakturan blir tom på till-adress.

## Datastruktur som behöver fyllas i innan riktig fakturering

Befintligt i `organizations`-tabellen:

- ✅ `name` / `displayName`
- ✅ `orgNumber` (krävs för Fortnox-lookup)
- ✅ `postalCode` (masterdata v1)
- ✅ `municipality` (masterdata v1)

**Saknas** (kommande story `KC1.4b` — schema-utvidgning):

- ❌ `billing_email` — idag fallback till primär ASSOCIATION_ADMIN
- ❌ `address_line1` — gatuadress (Fortnox PDF blir tom utan)
- ❌ `contact_phone` — Fortnox accepterar `Phone1` på Customer

När de läggs till: uppdatera SELECT-listan i
`apps/api/src/routes/settlement.ts` (kommentar `MASTERPLAN_01 KC1.4`)
och passera dem som `customer.phone`/`customer.address.street` —
provider-interface:t accepterar dem redan.

## Fortnox-webhook (invoice paid)

`apps/api/src/routes/fortnox-webhook.ts` har en stub för
`invoice-paid`-event. När bokföring vill auto-flippa payout-status
PAID när Fortnox-fakturan markeras betald:

```ts
// I switch(eventType) → case "invoice-paid":
//   1. Hitta payout via payouts.fortnoxInvoiceId === body.invoiceId
//   2. Kalla intern service-token mot PATCH /v1/payouts/:id/status
//      med { status: "PAID", paymentReference: body.invoiceId }
```

Tills dess sätter INTERNAL_ADMIN status manuellt via portal-UI.

## Rollback om Fortnox börjar agera fel

Sätt `FORTNOX_ENABLED=false`. Boot:ar med NullProvider, alla nya
`create-invoice`-anrop blir mock:ade `NULL-INV-xxxx`. Existerande
INVOICED-rader påverkas inte (de pekar redan på Fortnox-ID:n). När
problemet är löst → byt tillbaka till `true` och kör om eventuella
misslyckade payouts manuellt.
