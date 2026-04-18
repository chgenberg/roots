# Roots — Masterdokument & Förbättringsplan
_Sammanställning av samtliga flow-audits genomförda 2026-04-18_

**Status:** Läs-endast audits klara. Denna plan definierar **vad**, **i vilken ordning**, och **med vilka skydd** så att inget som redan fungerar går sönder.

**Allt arbete nedan ska:**

1. **Vara additivt först** — lägg till nya endpoints/schemafält parallellt med befintliga innan gammalt tas bort.
2. **Bakåtkompatibelt kontrakt** — ändra aldrig ett fältnamn utan att först publicera det nya vid sidan av det gamla i minst en release.
3. **Feature-flaggas** — allt nytt UX-flöde (winback-mail, kampanjspärr, leaderboard-opt-out) går live bakom flagga per org eller per roll.
4. **Ha regressionsskydd** — varje fas nedan har en egen **“Rör inte”-lista** och **“Verifiera innan release”-checklista**.

---

## 1. Källunderlag

Alla rapporter ligger i `docs/flow-audits/`:

| Flöde | Fil | Findings | P1 |
|---|---|---:|---:|
| Public (utloggat) | `PUBLIC_2026-04-18_1238.txt` | 38 | 3 |
| Association Onboarding | `ASSOCIATION_ONBOARDING_2026-04-18_1241.txt` | 57 | 10 |
| Team Leader | `TEAM_LEADER_2026-04-18_1243.txt` | 62 | 6 |
| Seller | `SELLER_2026-04-18_1245.txt` | 61 | 9 |
| Supporter Checkout | `SUPPORTER_2026-04-18_1247.txt` | 58 | 8 |
| Club Member (B2B) | `CLUB_MEMBER_2026-04-18_1249.txt` | 54 | 14 |
| Sales Rep | `SALES_REP_2026-04-18_1252.txt` | 54 | 10 |
| Internal Admin | `INTERNAL_ADMIN_2026-04-18_1310.txt` | 57 | 13 |
| AI Coach | `AI_COACH_2026-04-18_1312.txt` | 62 | 15 |
| Conversion & Trust | `CONVERSION_TRUST_2026-04-18_1313.txt` | 68 | 18 |
| **Totalt** | | **571** | **106** |

Många findings är samma rotproblem synligt i flera flöden. Planen nedan är strukturerad efter **rotorsak**, inte efter flöde, så att en fix löser flera rader samtidigt.

---

## 2. De åtta rotorsakerna (tema-map)

Varje tema nedan länkar till berörda audit-rapporter och vilka P-nivåer som täcks.

### T1. API ↔ UI-kontraktsglidning (“demo ser ut som live”)
Samma mönster upprepas i portal, sales, klubb, statistik, pipeline, offerter.

- UI läser `s.mrr`, `s.activeClubs`, `s.deals`, `s.orders` — API returnerar `mrrOre`, `totalClubs`, aggregat utan `deals[]`, `orderCount`.
- Fallback-“demokomponenter” blandar sig med fetchad data → operatörer kan inte skilja live från demo.
- Träffar: Internal Admin [1.1]–[1.11], Sales Rep [1.1]–[2.8], Conversion [1.4]–[1.7], Club [2.15].

### T2. Delat shell-paradigm (`/club` vs `/portal`, `/sales` vs `/portal`)
Två parallella shells där den ena är stub och den andra är live → stubben visas för inloggade användare.

- Träffar: Club [1.1]–[1.5], [1.14]; Sales Rep [1.6]–[2.1]; Association Onboarding [4.4].

### T3. AI-lager skickar inloggade användare till publik prompt
- Portal AI + ChatWidget POST:ar till `/v1/ai/public-chat` → alltid `PUBLIC_CHAT_SYSTEM_PROMPT`.
- Den session-baserade `/v1/ai/chat`-routen (som har `aiRateLimit` + `SYSTEM_PROMPT`) är oanvänd av webben.
- `/v1/ai/chat` har dessutom prompt-injection-risk (`...body.history` utan role-strip).
- Träffar: AI Coach [1.1]–[1.14], Sales [2.18]–[2.19], Seller [2.1]–[2.5], Club [2.20].

### T4. Tillit / juridisk identitet (`roots.se` ≠ `rootshaircare.se`, `hej@` ≠ `support@`)
- Epost-mallar länkar till `rootshaircare.se/logga-in`; avsändare default `noreply@rootshaircare.se`.
- Org.nr, moms, postadress saknas i footer, kontakt, villkor, integritet, JSON-LD.
- Träffar: Conversion [1.15]–[1.17], [2.1]–[2.3]; Public [2.5]; Association Onboarding [3.4]–[3.5].

### T5. Barn & föräldrasamtycke
- Ingen ålders-gate, ingen vårdnadshavare-roll, ingen opt-out från leaderboards.
- Public shop-slug härleds från `displayName`; namngivna rankinglistor visas.
- Lagledare skapar säljare med eget valt lösenord.
- Träffar: Seller [1.1]–[1.9], [2.18]–[2.21]; Team Leader [1.2]–[1.4], [2.24]; Conversion [1.10]–[1.13].

### T6. Livscykel / retention (ingen schemaläggare kör)
- `pg-boss` finns i `package.json` men importeras inte.
- `milestoneEmail`, `getCampaignStartTemplate`, `getMilestoneTemplate` är definierade men anropas aldrig.
- `audit_logs`-schema finns men skrivs/läses aldrig.
- Ingen abandoned-signup-recovery, ingen winback, inga quote-expiry-reminders.
- Träffar: Conversion [Retention Leaks 1–5]; Association [2.10]–[2.11]; Team Leader [2.12]; Sales [1.10], [2.15]–[2.17].

### T7. Supporter-commerce / kampanjlogik
- `campaign.status !== ACTIVE` visas först vid checkout → användaren har redan lagt tid.
- Kassan visar inga rader/summa/moms/frakt/villkor.
- Cart ligger i `useState` + URL-parametrar → reload förstör.
- Bundle-kort är statisk marknadsföring, inte kopplad till DB-priser.
- Shop-katalog hämtar alla aktiva produkter, inte kampanjens sortiment.
- Träffar: Supporter [1.1]–[1.8], [2.1]–[2.4]; Conversion [1.8], [1.9].

### T8. Stubbad funktionalitet som utlovas i UI
- tRPC `club` + `sales` routers returnerar `[]` / syntetiska UUIDs.
- “Bjud in medlem”, “Ny offert”, “Skicka påminnelse”, “Byt lösenord” = toasts utan backend.
- Invite-tokens kan aldrig roteras från UI trots att `regenerateInviteToken` finns server-side.
- Träffar: Club [1.2]–[1.4], [1.13]; Sales Rep [1.4]–[1.10]; Association [1.3]–[1.6]; Team Leader [2.8], [2.15].

---

## 3. Faserad plan — bakåtkompatibel

Varje fas är **stand-alone releasable**. Inget i fas N+1 kräver att fas N är live för kärnflödena — bara för den specifika fix som fas N+1 adresserar.

Totalt estimat: **8–12 veckor** med ett litet team, där P1-arbetet (fas 1–3) är ~3–4 veckor.

---

### Fas 0 — Skyddsnät innan vi rör något (vecka 0, 1–2 dagar)

Syftet är att upptäcka regressions **innan** kund märker.

1. **Snapshot-test-suite för API-kontrakt** (ingen produktkodändring behövs):
   - Skapa ett litet integrationstest (Vitest eller liknande) som träffar `GET /v1/portal/dashboard`, `/statistics`, `/pipeline`, `/quotes`, `/orders`, `/system`, `/shop/by-slug/:slug`, `/v1/ai/public-chat` med en seed-databas och **låser nuvarande JSON-form** via `toMatchSnapshot`.
   - När vi ändrar ett fält i fas 1 ser vi exakt var UI måste uppdateras parallellt.
2. **E2E-rök på kritiska vägar** (kan vara 5 minuter-Playwright eller ett Cypress-skript):
   - `/registrera` (förening) → `/forening`
   - `/login` (alla roller) → landa på rätt shell utan `Forbidden`
   - `/shop/[slug]` → lägg i kundvagn → `/kassa` → betalningsstubben nås
   - `/portal` för `INTERNAL_ADMIN`, `CLUB_ADMIN`, `SALES_REP`
3. **Feature-flagg-helper** i `apps/api/src/lib/flags.ts`:
   ```ts
   export function featureOn(name: string, ctx?: { orgId?: string; role?: string }) {
     const env = process.env[`FEATURE_${name}`] ?? "off";
     if (env === "on") return true;
     // stöd för per-org allowlist via env: FEATURE_X_ORGS=uuid1,uuid2
     ...
   }
   ```
   Alla nya UX-flöden nedan bakom en sådan flagga.

**Rör inte:** inget produktionsflöde ändras i fas 0.

---

### Fas 1 — Kontraktsreparation + tydlig demo-flagg (vecka 1–2)

Mål: `AdminDashboard`, `Statistik`, `Offerter`, `Pipeline`, `Saljare`, `System`-sidan och `Klubbar`-listan slutar visa **0 eller fel enhet** när API faktiskt svarar.

**Princip:** Lägg till nya fält vid sidan av, deprekera gamla efter en release.

**API (`apps/api/src/routes/portal.ts`):**
- `GET /portal/dashboard` → returnera både `{ mrrOre, totalClubs, … }` och nya **`ui:`-vänliga** alias `{ mrr, activeClubs, hairConversion }` (öre-konvertering gjord på servern).
- `GET /statistics` → lägg till `{ orders, revenue }` (SEK) vid sidan av `{ orderCount, revenueOre }`.
- `GET /pipeline` → lägg till `deals: []` med `{ id, stage, org, value, daysInStage }`.
- `GET /portal/system` → returnera `{ services, aiUsage, rateLimits, recentEvents, uptime, latency }` — fallback-ut som UI redan ritar.
- Nytt fält `isDemo: boolean` på alla dashboard-endpoints.

**UI (`apps/web/src/app/(portal)/portal/*`):**
- Läs nya alias. Behåll de gamla cellerna oförändrade för en release → uppdatera till enbart nya i fas 3.
- Om `isDemo === true`: visa ett diskret `DEMO`-pillet (ny komponent `<DataSourceBadge />`).
- Ta bort hårdkodat `+24%`, `45 000 kr`, `totalValue = "45 900 kr"` — byt mot beräknat värde från de redan hämtade raderna. Om API inte har siffran, dölj texten istället för att fabricera.

**Findings som stängs:** Internal Admin 1.1, 1.2, 1.4, 1.5, 1.9–1.11; Sales Rep 1.1, 1.2, 2.3–2.5; Conversion 1.4–1.7.

**Rör inte:**
- Ingen ändring i `checkout.ts`, Klarna-webhook, seed-data, auth-session.
- Inga **borttagningar** av gamla fält ännu.

**Verifiera innan release:**
- Snapshot-testerna visar endast **tillägg** av fält.
- `INTERNAL_ADMIN` i test-miljö ser rätt MRR vs `totalOrders`.

---

### Fas 2 — Supporter-commerce korrekthet (vecka 2–3)

Kritiskt eftersom det är intäktsflödet och också där “dark pattern-risken” är störst.

**Gate inaktiva kampanjer tidigt:**
- `GET /shop/by-slug/:slug` returnerar redan `campaign.status` + `endDate`. Utöka `ShopData`-typen i UI och rendera:
  - **Om `status !== ACTIVE`**: ersätt CTA-knappen med `<CampaignClosedNotice />` (ny komponent). Visa `endDate`. Checkout-knappen disabled, inte gömd.
  - Verifiera även server-side: checkout svarar redan 400 — behåll som safety net.

**Kassa-sammanfattning:**
- Ny komponent `<CartSummary items=... products=.../>` som hämtar produktnamn från samma `/v1/portal/products`-endpoint (eller publik variant) och visar rader, delsumma, frakt, “priser inkl. moms”.
- Lägg synliga länkar till `/villkor` + `/integritet` under CTA.
- Ny liten footer i `(shop)/layout.tsx` med kontakt + org.nr (från Fas 4).

**Cart-persistens:**
- Wrapa cart-state i ett hook `useCart(slug)` som läser/skriver **`sessionStorage` `roots-cart:${slug}`**. URL-parametrar behålls som delningsformat → bakåtkompatibelt för redan utskickade länkar.

**Bundles:**
- Utöka `ShopData.bundles` i API (fältet finns redan i DB), rendera dem som riktiga add-to-cart-kort. Ta bort det statiska “399 kr”-kortet när `bundles.length > 0`; håll kvar som fallback om inga bundles är kopplade till kampanjen.

**Shop-sortiment:**
- `/shop/by-slug/:slug` börjar filtrera på `campaign_products` om raden finns; behåll `products.active` som fallback → kampanjer utan explicit sortiment fungerar som idag.

**OG-metadata för personlig shop:**
- Lägg en server-komponent `app/(shop)/shop/[slug]/head.tsx` med `generateMetadata({ params })` som hämtar shopen och returnerar title/description/OG-image (per-säljare bild eller kampanjkort). Ingen förändring i själva client-komponenten nödvändig.

**Findings som stängs:** Supporter 1.1, 1.4, 1.6, 2.1–2.4, 2.14, 2.17; Conversion 1.8, 1.9; Seller 1.4, 1.5.

**Rör inte:**
- Klarna-integration, `checkout.ts`-webhookens orderstatusmappning, refund-flödet.
- `robots.ts` (diskussion separat — se Fas 7).

**Verifiera:** E2E Playwright-script i fas 0 kör igenom; ny test `campaign.status=ENDED → checkout knapp disabled`.

---

### Fas 3 — AI-lager separation + guardrails (vecka 3–4)

Mål: Inloggade användare når en session-grundad, rolls-specifik modell. Publika besökare förblir oförändrade.

**Server:**
- Härda `/v1/ai/chat` mot prompt-injection:
  - Mappa `history` till bara `{ role: "user"|"assistant", content }` på samma sätt som `public-chat.ts` redan gör.
  - Lägg till **role-baserade system-prompts** (`SYSTEM_PROMPTS.SELLER`, `SALES_REP`, `CLUB_ADMIN`, `INTERNAL_ADMIN`) som grenar av befintliga `SYSTEM_PROMPT`.
  - Explicit regel: “**Hänvisa aldrig till affärsdata som inte finns i din context.**”
- Lägg till `AI_ENABLED` env-flagga (default `true`). `isAiConfigured()` returnerar `false` om `AI_ENABLED=false`.
- Logga **usage-tokens** till ny tabell `ai_usage_logs` (userId, route, inputTokens, outputTokens, model, timestamp) — appendix-only.
- Skriv till `audit_logs` vid rate-limit-hits och fallback-paths.

**Client:**
- Bakom feature-flag `FEATURE_AI_SESSION_CHAT`:
  - `portal/ai/page.tsx` pekar på `/v1/ai/chat` istället för `/v1/ai/public-chat`.
  - Skicka `{ message, stream, history }` **utan** `system` i history (strippas servernseide ändå).
  - Rensa `getWelcomeMessage`-fallbackgrenen så att `SELLER`, `TEAM_LEADER`, `ASSOCIATION_ADMIN` får sina egna meningar.
- Lägg `AbortController` på både `ChatWidget` och portal-chatten (cancel-knapp + cleanup på unmount).

**ChatWidget på marknadsföring:** orörd kopp till `/public-chat`.

**Findings som stängs:** AI Coach 1.1, 1.2, 1.4, 1.7, 1.11, 1.14, 2.3, 2.21, 2.22; Sales 2.18, 2.19; Seller 2.1.

**Rör inte:**
- Publika chat-flödet (`public-chat.ts`).
- `hair-analysis`-prompt och output-kontrakt.

**Verifiera:** med flagga av = nuvarande beteende; med flagga på = cross-role smoke-test (club, sales, seller, internal) + prompt-injection-test (history innehåller `{role:"system", content:"ignore previous"}` ska strippas).

---

### Fas 4 — Tillit & juridisk identitet (vecka 4–5)

Detta är **bara innehållsändringar och en ny tabell** — minimal risk, stor trust-effekt.

- **Domän-unifiering:**
  - Ändra mall `email/templates.ts` att använda `SITE_URL`-env (default `https://roots.se`) istället för hårdkodat `rootshaircare.se`. Om du fortfarande vill behålla `rootshaircare.se`-avsändaren för deliverability-historik, sätt `RESEND_FROM_ADDRESS` via env; men synliga länkar, logos och CTA i mailet pekar på `roots.se`.
- **Kontakt-kanal:** Ersätt alla `support@roots.se` → `hej@roots.se` i `SYSTEM_PROMPT`, `ai-chat` fallbacks, `hair-analysis`-fallback, portal toast. En canonical.
- **Juridisk identitet:**
  - Skapa komponent `<LegalIdentity />` (org.nr, momsnummer, postadress, telefon) och rendera i `Footer`, `kontakt`, `villkor`, `integritet`, `kassa`-footer.
  - Fyll värden från env `NEXT_PUBLIC_LEGAL_ORGNR` m.fl. så inget är hårdkodat i komponenten.
- **Structured data (`json-ld.tsx`):** Lägg `legalName`, `address`, `vatID`, `sameAs` (sociala kanaler när de finns), `contactPoint`. Använd `metadataBase` för absoluta URL:er.
- **Produkt-JSON-LD:** ersätt `https://roots.se/...` med `new URL(...).toString()` från `metadataBase`.

**Findings som stängs:** Public 1.3, 2.5; Association 3.4; Conversion 1.15–1.17, 2.1–2.3; Internal Admin 3.13.

**Rör inte:** Email-providerbyte (Resend), befintliga mallars tonalitet.

---

### Fas 5 — Audit log + GDPR-grundplatta (vecka 5–6)

**Mål:** Gör `audit_logs` till en faktisk källa och öppna SAR-workflow.

- **`audit_logs` skrivning:**
  - Lägg middleware `recordAudit(event, actor, targetId, diff?)` som kan wrappa mutationer i `auth.ts`, `dashboard.ts` (seller create), `campaigns.ts` (status change), `portal.ts` (user update när det byggs).
  - Skriv minst: login, failed login (>3 samma IP), seller create, campaign status change, rate-limit hit, AI injection-attempt, admin fetch av `/members`.
  - Append-only policy via DB-grant (kan göras med Postgres `REVOKE UPDATE, DELETE` för app-rollen mot tabellen).
- **GDPR SAR-export:** Ny endpoint `POST /v1/portal/gdpr/export` för `INTERNAL_ADMIN` som genererar en ZIP med användarens profil, orders, leads, konsent, AI-konversationer om de lagras. Återanvänd `generateOrdersCsv` som redan finns men är oanvänd.
- **GDPR delete/anonymize:** Ny endpoint `POST /v1/portal/gdpr/anonymize` som sätter `users.email = 'deleted+<uuid>@roots.se'`, `name = 'Borttagen användare'`, nollställer adress och `seller.displayName` men behåller order-historik (nödvändig bokföring 7 år).
- **Admin UI:** ny sida `/portal/gdpr` bakom `INTERNAL_ADMIN` för sök + trigger av ovan.

**Findings som stängs:** Internal Admin 1.6, 1.12, “GDPR / AUDIT GAPS”-sektionen; Team Leader 2.18; AI Coach 2.22.

**Rör inte:** Redan beställda orders, bokförda fakturor, Klarna-webhookens id-kopplingar.

---

### Fas 6 — Barn & minoritetssamtycke (vecka 6–7)

Extra varsam fas — inget befintligt barnkonto ska låsas ute.

- **Schema-tillägg (additivt):**
  - `users.birthYear int null`
  - `users.guardianUserId uuid null → users.id`
  - `sellers.publicAlias text null` (pseudonym för slug + shop header)
  - `sellers.hideFromLeaderboard boolean default false`
  - `sellers.personalMessage text null`
- **Slug-strategi:**
  - Behåll `shopSlug` som idag för befintliga säljare.
  - Nya säljare får slug härledd från `publicAlias ?? displayName`. Lägg till ett alias `s/<short-id>` som alltid fungerar.
- **Registreringsflöde:**
  - `/registrera/saljare/[token]` visar ett frivilligt fält “Födelseår” och “Förälder/vårdnadshavares e-post” som lagras men inte blockerar.
  - Om `birthYear < currentYear - 15` → skicka **guardian-consent-mail** till angiven epost med en opt-out-länk (samma pattern som password reset). Utan samtycke: `hideFromLeaderboard = true`, `publicAlias` default satt till förnamn + första bokstav.
- **Public shop UI:** byt `displayName` mot `publicAlias ?? displayName`.
- **Team-leader leaderboard UI:** respektera `hideFromLeaderboard` (visa som “Anonym säljare”).
- **Lösenord för minderårig:** lagledarens “Skapa säljare inline” skickar istället ett självvalts-lösenord-mail och sätter temporärt token (återanvänd reset-flödet från fas 5).
- **`POST /register/seller`:** detektera existerande session → returnera 409 med `{ kind: "SESSION_CONFLICT" }` → UI visar `<StillLoggedInBanner />` istället för att tysta skriva över cookien.

**Findings som stängs:** Seller 1.1, 1.6–1.9, 2.18–2.20; Team Leader 1.2, 2.24; Conversion 1.10–1.13.

**Rör inte:**
- Befintliga säljares shop-URL:er. Deras slug förblir giltig.
- Befintliga orders / commission-beräkningar.

---

### Fas 7 — Livscykel / retention (vecka 7–8)

Plugga in jobb-runnern som redan finns i `package.json`.

- **`pg-boss` uppstart** i ett nytt `apps/api/src/workers/boss.ts` som registreras i `app.ts` bakom env `WORKERS_ENABLED=true`. Lokalt körs endast när env är satt → zero impact tills utrullning.
- **Scheduled queries (nattlig kl 03:00 Europe/Stockholm):**
  - Stäng kampanjer där `endDate < now AND status = ACTIVE` → sätt `ENDED` (API:t refuserar redan checkouten, detta är städning).
  - Sätt `quotes.status = EXPIRED` för `validUntil < now AND status IN (SENT, ACCEPTED_DRAFT)`.
- **Mail-jobb (aktivera befintliga oanvända mallar):**
  - `milestoneEmail` → skicka till säljare + lagansvarig vid ny milstolpe (driv från event i checkout-webhook).
  - `getCampaignStartTemplate` → email när kampanj går `DRAFT → ACTIVE`.
  - `getMilestoneTemplate` → SMS-varianten via befintlig sharing-endpoint.
  - **Day-3 nudge** för säljare utan första order (tonsäker formulering, opt-out i mailfoten).
  - **Winback efter kampanjslut** till `ASSOCIATION_ADMIN` (“Vill ni köra en ny kampanj?”).
- **Register-abandon-recovery:** i `/registrera` persistera draft i `registration_drafts`-tabell (ny), e-posta “fortsätt registreringen” om `updatedAt < now - 24h AND completedAt IS NULL`.
- **Seller-share-telemetri:** lägg `sellers.lastSharedAt` och skriv det från en ny `POST /v1/sellers/:id/share-ping` som min-shop anropar när `navigator.share` lyckas. Används för nudge-mail.

**Findings som stängs:** Conversion Retention Leaks 1–5 + 2.9–2.15; Association 2.10–2.11; Team Leader 2.12; Sales 1.10.

**Rör inte:** Transaktionella mail som redan skickas (`welcomeEmail`, `orderConfirmationEmail`).

---

### Fas 8 — CRM & B2B-kompletthet (vecka 8–10)

Mål: ersätt stubbade routers med riktiga implementationer, utan att bryta `/club`-demo-skalet eller `/sales`-skalet innan ersättning är verifierad.

**Sales:**
- Fyll `salesRouter` med riktiga procedures (`dashboard`, `quotes.list/create/send`, `customers.list/detail`, `orders.list`). Alla scoped på `salesRepId = session.userId` eller org-med membership för `SALES_ADMIN`.
- **Fix `GET /v1/portal/quotes`** så att non-admin-grenen filtrerar på `quotes.salesRepId` istället för `quotes.userId`. Tillägg inte `userId` i schemat förrän vi är säkra på migration — först alias-flagga i API.
- PDF-preview: enkel server-side rendering via `@react-pdf/renderer` bakom `/v1/quotes/:id/pdf` → ingen client-dep-påverkan.
- Commission: ny `commission_rules`-tabell (flat % per rep tills vidare), ny `/portal/intakter`-gren för reps.

**Club:**
- Ta `trpc.club.orders` från stub till faktisk query på `orders` + `orderLines`.
- Delad cart mellan `/portal/produkter` → `/portal/bestallningar`: lagra i `sessionStorage` med key `roots-b2b-cart:${orgId}`.
- “Beställ igen”-knapp på `bestallningar`-rad som laddar senaste ordern som bas.
- Volympriser: ny `product_tiers (productId, minQty, priceOre)`-tabell (tomt tills produktägare fyller).

**Invite token TTL + UI:**
- Additivt fält `teams.inviteTokenExpiresAt timestamp null`. Nya tokens får `+90d`; gamla förblir giltiga tills rotation.
- UI-knapp “Ny inbjudningslänk” → anropar befintliga `regenerateInviteToken`.

**Findings som stängs:** Club 1.1–1.14; Sales Rep 1.3–1.10, 2.2; Association 1.7–1.9; Team Leader 2.5–2.8.

**Rör inte:** Fortnox/fakturaspår, Klarna-webhooken, redan utskickade invite-mail.

---

### Fas 9 — Mobil & delnings-polish (vecka 10–11)

Låg risk, många quick wins.

- `Input` default `text-base` (≥16px) för att undvika iOS-zoom; behåll `text-sm` som opt-in via prop.
- `min-w-0` + `truncate` på invite-URL-rader (team leader + seller-listor).
- `pb-[env(safe-area-inset-bottom)]` på sticky cart-bar + chat-FAB.
- Lägg `sms:?body=` + `whatsapp://send?text=` deep-links bredvid `navigator.share` i `min-shop`.
- Wire `GET /v1/sharing/shop-share-template` i `min-shop` — visa “Kopiera SMS”-ruta med SMS-tunad copy istället för hela `campaign.story`.
- QR-nedladdning som PNG-knapp på `min-shop`.
- Publikt shop: per-SKU OG-bilder via Next `opengraph-image.tsx` per route.

**Findings som stängs:** Seller 2.13–2.16, 3.18; Team Leader 2.19–2.20; Supporter 3.2–3.3, 3.10; Public 2.12.

---

### Fas 10 — Etisk gamification-redesign (vecka 11–12)

Känslig fas — förändringen är synlig för säljare. Rulla i begränsad pilot (en förening) innan bred utrullning.

- **Milestones “paket” vs order count:** byt beräkningen så att servern summerar `order_lines.qty` istället för `COUNT(orders)`. Behåll `orderCount` som fält, lägg nytt `itemsSold`.
- **“Effort-först”-läge:** org-admin kan välja “Privat ranking” → leaderboard visar bara säljarens egen position + topp 3 anonymiserade.
- **Stänga feminin-konkurrensretorik:** byt “Skicka denna länk till dina spelare” → “Skicka länken till dem som vill sälja”.
- **Public shop:** ta bort specifik progress-% om `hideFromLeaderboard = true`.
- **Marknadsförings-“stats”:** gör om `STATS`- och `ACHIEVEMENTS`-arrayerna till queries mot publika aggregat (t.ex. `COUNT(distinct organizations) WHERE status = ACTIVE`) eller ta bort siffrorna helt. Lägg `lastUpdated`.
- **Grade label:** byt `"Starter"` → `"Nybörjare"`.

**Findings som stängs:** Gamification i Conversion 1.10–1.13; Seller 1.3, 3.7; Team Leader 2.24, 3.13.

**Rör inte:** Existerande utbetalningar / `estimatedEarningsOre`-beräkning.

---

## 4. Kors-regressionsskydd per fas

| Fas | Behov av flagga | Data-migration | UI-text ändras | Risk-nivå |
|---|---|---|---|---|
| 0 | — | — | — | 0 |
| 1 | `FEATURE_DASHBOARD_ALIASES` | nej | nej (endast badges) | Låg |
| 2 | `FEATURE_SHOP_CAMPAIGN_GATE`, `FEATURE_CART_PERSIST` | nej | ja (footer) | Medel |
| 3 | `FEATURE_AI_SESSION_CHAT` | ny tabell `ai_usage_logs` | nej | Medel |
| 4 | — | nej | ja | Låg |
| 5 | — | `audit_logs` grants | nej (admin-only UI) | Medel |
| 6 | `FEATURE_MINOR_CONSENT` | nullable columns | ja (register-form) | Hög (barn-data) |
| 7 | `WORKERS_ENABLED`, `FEATURE_WINBACK_MAILS` | `registration_drafts` | endast mail-copy | Medel |
| 8 | `FEATURE_SALES_LIVE`, `FEATURE_CLUB_LIVE` | nya tabeller additivt | ja | Hög (ersätter demo) |
| 9 | — | nej | nej | Låg |
| 10 | `FEATURE_GAMIFICATION_V2` | nej (queries) | ja | Medel (synligt för säljare) |

---

## 5. “Rör inte”-lista (gäller hela programmet)

Oavsett fas ska följande inte ändras utan separat beslut:

1. **`checkout.ts`-Klarna-webhooken** (mottagning, orderstatus, mailtrigger) — betalrails är levande intäkt.
2. **Befintliga `shopSlug`-värden** för redan aktiva säljare.
3. **Publik `public-chat`-system prompt** (bibehålls som är; ändringar görs endast i den session-baserade).
4. **`.env.example`** som konfigurationskontrakt — lägg till nya keys, ta aldrig bort gamla.
5. **`welcomeEmail` + `orderConfirmationEmail`** — transaktionellt nuvärde.
6. **Fortnox- eller bokföringsintegrationer** (om/när de kopplas in — denna plan rör dem inte).

---

## 6. KPI:er för att mäta framgång

Sätt baseline innan fas 1 rullas ut:

- **Portal**: andel dashboard-laddningar där `isDemo === false` för inloggad `INTERNAL_ADMIN` / `SALES_REP`.
- **Supporter**: abandoned-cart-ratio på `/kassa` (minst en vy utan submit) — ska sjunka efter fas 2.
- **AI**: andel portal-AI-requests mot `/chat` (inte `/public-chat`) efter fas 3 utrullning.
- **Retention**: 7-dagars aktivitet efter association-register — baseline nu ~0 utanför registreringen.
- **Trust**: `impressions`-baserad Hotjar/Fullstory på `LegalIdentity`-komponent — mål: visas på 100 % av marketing- och checkout-views.
- **Barn-samtycke**: andel nya säljare under 15 år med `guardianUserId != null` — mål 95 % post fas 6.

---

## 7. Rekommenderad arbetsordning (TL;DR)

**Om bara en månad får dedikeras i taget, välj i denna ordning:**

1. **Fas 0** (testsnare) + **Fas 1** (kontraktsalias + `isDemo`) — låser in att inget brister omärkt.
2. **Fas 2** (kampanj-status + kassa-summa) — störst omedelbar trust- och intäktseffekt.
3. **Fas 3** (AI session-route + guardrails) — stänger största hallucination-risken för interna användare.
4. **Fas 4** (juridisk identitet + domän-unifiering) — liten kod, stor effekt på förtroende.
5. **Fas 5** (audit + GDPR-export) — skyddar bolaget innan vidare tillväxt.
6. **Fas 6** (minor-consent) innan vi skalar seller-antalet.
7. **Fas 7** (lifecycle) när workern är re-verifierad.
8. **Fas 8** (sales/club live) för intäktsuppsida.
9. **Fas 9–10** (polering + etik) som kontinuerliga hygien-passes.

---

_Denna plan är avsiktligt additiv. Första merge i varje fas kan roll-backas via feature-flag utan att data förstörs. När en fas är verifierad i staging + pilot-org, ta bort de legacy-fält som planen markerar för deprekering i nästa huvudrelease._
