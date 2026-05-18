# Role-by-role Gap Audit (Sprint E9)

**Datum:** 2026-05-18
**Författare:** AI-audit
**Källa:** `apps/web/src/app/(portal)/*`, `apps/web/src/app/(fundraising)/*`,
`apps/api/src/routes/*`
**Status:** Klar — 7 roller granskade

Detta är en read-only audit av vad varje inloggad roll faktiskt kan göra
på Roots-plattformen idag, vad som rimligen *borde* finnas för en
trovärdig investor-demo och en riktig kund, och hur stora luckorna är.

---

## TL;DR

| Roll | Vad finns idag | Största luckorna | Demo-OK? |
|---|---|---|---|
| **INTERNAL_ADMIN** | Översikt, klubbar, säljare, ordrar, KPI, system, AI, settings | Ingen användar-/audit-vy | 🟡 Ja, med förbehåll |
| **SALES_REP** | Översikt, pipeline, klubbar, offerter, statistik, AI, settings | Kan inte skapa lead/aktivitet inifrån UI | 🟡 Ja |
| **CLUB_ADMIN** | Översikt, beställ, medlemmar, intäkter, produkter, AI, settings | Ingen faktura-/leveransvy | 🟢 Ja |
| **ASSOCIATION_ADMIN** | Översikt, lag, mål, avräkning, settings | **Kan inte skapa lag/bjuda in lagansvarig från UI** | 🔴 Stor lucka |
| **TEAM_LEADER** | Översikt, säljare (med invite), beställningar, avräkning, settings | Kan inte sätta mål per säljare | 🟡 Ja |
| **SELLER** | Min shop, settings | Inga dedikerade order-/dela-sidor | 🟢 Ja (E8 löste mest) |
| **PUBLIC** | Hem, produkter, registrera, login, hair-analysis, shop/[slug] | OK för demo | 🟢 Ja |

---

## Detaljerad genomgång per roll

### 1. PUBLIC (utloggad besökare)

**Sidor som finns:**
- `/` — landningssida
- `/produkter/*` — produktkatalog (shampoo, conditioner, body-wash)
- `/villkor`, `/sitemap.xml`, `/robots.txt`
- `/login`, `/registrera`, `/registrera/saljare/[token]` — auth-flow
- `/shop/[slug]/...` — säljarens publika shop + kassa + bekräftelse
- Hair-analysis-flöde (lead magnet)

**Slutsats:** Komplett för demo. Inga P0-luckor.

---

### 2. INTERNAL_ADMIN (`admin@roots.se`)

**Sidor som finns** (från `ADMIN_NAV` i portal/layout.tsx):
- `/portal` — översikt med MRR, klubbar, konvertering
- `/portal/klubbar` — alla klubbar
- `/portal/saljare` — alla säljare
- `/portal/bestallningar` — alla beställningar plattformsbrett
- `/portal/statistik` — KPI & statistik
- `/portal/system` — system-status
- `/portal/ai` — AI-assistent
- `/portal/installningar` — kontoinställningar + lösenordsbyte

**Saknas** (sorterat efter prio):
- **🟡 P1 — Användar-administration**
  Det finns inget UI för att skapa/inaktivera/redigera användare eller
  ändra roller. Allt sker via seed eller direkt mot DB.
- **🟡 P1 — Audit log-vy**
  `auditLog()` skriver redan till DB:n (`auth.change_password.ok`,
  m.fl.) men inget UI surfar händelser. För ISAE/SOC-readiness vill man
  se "vem gjorde vad när".
- **🟢 P2 — Demo-reset-knapp**
  För att kunna resetta plattformen mellan demos. Idag krävs psql-
  access.
- **🟢 P2 — AI-agent observability**
  Token-kostnad/throughput per AI-agent (org-normalizer, lead-scorer
  m.fl. som finns i `apps/api/src/lib/ai/agents/*`). Modell_register-
  feedback §8 efterlyser detta.

**Slutsats:** Funktionell för demo. Luckorna är operationella, inte
demo-blockerande.

---

### 3. SALES_REP (`salj@roots.se`)

**Sidor som finns** (`SALES_NAV`):
- `/portal` — översikt med aktiva klubbar, offerter, pipeline-värde
- `/portal/pipeline` — kanban (Lead/Kontaktad/Offert/Stängd)
- `/portal/klubbar` — klubblista
- `/portal/offerter` — alla offerter
- `/portal/statistik` — statistik
- `/portal/ai` — AI
- `/portal/installningar`

**Saknas:**
- **🟡 P1 — Skapa nytt lead från UI**
  Pipeline-vyn visar leads men det är otydligt om en säljare kan lägga
  till en ny prospekt manuellt (t.ex. efter mässmöte). Modell_register-
  feedback §02-crm-pipeline §3 efterlyser `lead_source` + manuell input.
- **🟡 P1 — Aktivitetslogg per lead**
  Säljaren bör kunna logga samtal/möten/mejl per lead. Backend har
  redan `lead_activity` i feedback-planen men UI saknas.
- **🟢 P2 — Provision/kommission-vy**
  "Vad har jag tjänat denna månad" — vanligt i sälj-CRM.
- **🟢 P2 — Min kalender / möten**
  Integration mot Outlook/Google Calendar — inte demo-kritiskt.

**Slutsats:** Pipeline-vyn syns, men "skapa lead"-knappen är viktig för
ett trovärdigt sälj-CRM. Bör fixas innan kunddemo.

---

### 4. CLUB_ADMIN (`klubb@demo.se`)

**Sidor som finns** (`CLUB_NAV`):
- `/portal` — översikt (medlemmar, ordrar, intäkter, nästa leverans)
- `/portal/bestallningar` — beställ produkter (B2B-flow)
- `/portal/medlemmar` — medlemslista + inbjudningar
- `/portal/intakter` — intäktsrapport
- `/portal/produkter` — produktkatalog
- `/portal/ai` — AI
- `/portal/installningar`

**Saknas:**
- **🟡 P1 — Faktura-historik**
  Eftersom Fortnox-integrationen redan finns på backend bör klubben
  kunna se sina fakturor i UI:t (PDF-länk, status, förfallodatum).
  Modell_register §8 — eCommerce-integration efterlyser detta.
- **🟡 P1 — Leveransadress-hantering**
  Om klubben byter klubbhus måste de kunna uppdatera leveransadress
  utan support-kontakt.
- **🟢 P2 — Klubbinformation (org-uppgifter)**
  Telefon, kontaktperson, orgnr. Just nu read-only i `/installningar`.
- **🟢 P2 — Notifikationer/inkorg**
  Vad har Roots skickat till klubben senaste 30 dagarna.
- **🟢 P3 — FAQ/hjälp**

**Slutsats:** Funktionellt komplett för demo. Faktura-vyn är den
viktigaste affärsmässiga luckan.

---

### 5. ASSOCIATION_ADMIN (`forening@demo-if.se`) — **🔴 STÖRST LUCKA**

**Sidor som finns:**
- `/forening` — översikt, lag-ranking, mål, intäkter
- `/forening/lag` — alla lag (visning)
- `/forening/mal` — kampanjmål
- `/forening/avrakning` — avräkning
- `/installningar` — profil + lösenordsbyte (E8)

**Saknas (kritiskt):**
- **🔴 P0 — Skapa nytt lag / bjuda in lagansvarig**
  Idag måste lagansvariga själva gå till `/registrera` och välja "Lag"
  + skriva in föreningens namn. Det är ett **dåligt UX-flow** — en
  förening ska kunna logga in, klicka "Skapa nytt lag" och få en
  inbjudningslänk att skicka till tränaren. Backend-endpointen
  `POST /v1/auth/register/team-leader` finns redan; det saknas bara en
  UI-action + en token-baserad endpoint.
- **🔴 P0 — Skapa ny kampanj**
  Det finns ingen "starta ny kampanj"-knapp. Föreningen kan idag bara
  se sin existerande seed-kampanj.
- **🟡 P1 — Föreningsinformation**
  Uppdatera namn, kontaktperson, orgnr, adress, logo. Idag bara
  read-only.
- **🟡 P1 — Meddelanden till lag/säljare**
  Skicka ett peppmeddelande till alla säljare i en kampanj.
- **🟡 P1 — Rapport-export**
  Excel/PDF-export av kampanjresultat (säljare-ranking, ordrar,
  intäkter) för styrelsemöten.
- **🟢 P2 — Setup-wizard för förstagångsanvändare**
  Förening registrerar sig → guidas igenom "Skapa kampanj" → "Bjud in
  lag" → "Bjud in säljare" → "Kör".

**Slutsats:** **🔴 Inte demo-redo som självständig flow.** Om en
investor frågar "hur startar en ny förening en kampanj?" får man säga
"det går via en separat URL". Måste fixas före kund-onboarding.

---

### 6. TEAM_LEADER (`lag@demo-if.se`)

**Sidor som finns:**
- `/lag` — översikt, säljare-ranking
- `/lag/saljare` — alla säljare + inbjudningslänk (`/registrera/saljare/[token]`)
- `/lag/bestallningar` — alla beställningar för laget
- `/lag/avrakning` — betalstatus per kund
- `/installningar` — E8

**Saknas:**
- **🟡 P1 — Sätt mål per säljare**
  Idag är `individualGoal` hårdkodad i seed-data. Lagansvarig bör
  kunna justera per säljare (eller låta säljaren sätta egna mål).
- **🟡 P1 — Inaktivera säljare**
  Om en säljare hoppar av — finns ingen "soft delete"-knapp.
- **🟢 P2 — Meddelanden / coaching**
  Skicka ett peptalk till hela laget eller per säljare.
- **🟢 P2 — Lagets ekonomi**
  Net intäkt till laget (efter marginal).
- **🟢 P3 — Logistik / packlistor**
  Modell_register §06-campaign-execution §7 efterlyser packlistor när
  kampanjen stängs.

**Slutsats:** Demo-OK. Coaching-mål är trevliga att ha för en investor-
demo men inte kritiska.

---

### 7. SELLER (`felicia.assoc@demo-if.se`)

**Sidor som finns:**
- `/min-shop` — KPI:er, grade, mål, milstolpar, dela-verktyg, senaste ordrar
- `/installningar` — E8

**Saknas:**
- **🟡 P1 — Dedikerad beställnings-historik**
  `/min-shop` visar bara "Senaste beställningar" (max 5–10) i ett kort.
  En full vy med filter (datum, status) skulle vara naturlig.
- **🟢 P2 — Dela-templates**
  Idag finns "Dela via SMS / sociala medier"-knapp på `/min-shop` som
  använder Web Share API. En dedikerad sida med färdiga texter och
  bilder vore en differentieringspunkt — Modell_register §06 §6.
- **🟢 P2 — Profilbild + bio på publik shop**
  Köpare ser idag bara säljarens "displayName" (förnamn). En kort bio
  + bild skulle öka konverteringen.
- **🟢 P3 — Tips / coaching från Roots**
  AI-genererade tips ("dela igen efter 3 dagar", "tacka kunderna").

**Slutsats:** Demo-OK efter E8. Inga blockerare.

---

## Övergripande luckor (alla roller)

- **🟡 P1 — Notifikationer/inkorg i header**
  Klockikon i toppmenyn som visar nya ordrar/mål-uppdateringar.
  Backend stöder det redan via `auditLog`, men inget UI.
- **🟢 P2 — Hjälp/FAQ-portal**
  En `/hjalp`-route med vanliga frågor per roll + kontaktformulär.
- **🟢 P2 — Onboarding/wizard för första inloggning**
  Tour-overlay som guidar nya användare igenom sidebaren.
- **🟢 P3 — 2FA**
  Inte krav för demo, viktigt inför skarp produktion.

---

## Föreslagen prioritering (Sprint E9 → E11)

### E9 — kritiska luckor (innan investor-demo) [~2h]

1. **ASSOCIATION_ADMIN: "Skapa nytt lag"-knapp** på `/forening/lag`
   med modal som POSTar till en ny endpoint som genererar
   inviteToken + lagansvarig-länk. (🔴 P0)
2. **ASSOCIATION_ADMIN: "Starta ny kampanj"-knapp** på `/forening`
   eller `/forening/mal`. (🔴 P0)
3. **SALES_REP: "Skapa nytt lead"-knapp** på `/portal/pipeline`
   eller `/portal/klubbar`. (🟡 P1)

### E10 — närliggande affärsvärde [~4h]

4. **SELLER: `/min-shop/bestallningar`** dedikerad order-historik.
5. **CLUB_ADMIN: `/portal/fakturor`** Fortnox-faktura-vy.
6. **TEAM_LEADER: redigera individualGoal per säljare** i `/lag/saljare`.

### E11 — operationell mognad [senare]

7. **INTERNAL_ADMIN: `/portal/audit-log`** händelsehistorik.
8. **Notifikationer/inkorg** i header för alla roller.
9. **Hjälp/FAQ-portal** under `/hjalp`.

---

## Verifierad backend-status

Av topp-luckorna ovan har dessa backend-endpoints som redan kan
användas — det är *bara* UI som saknas:

- ✅ `POST /v1/auth/register/team-leader` — finns
- ✅ `POST /v1/auth/register/seller` — finns
- ❌ "Skapa kampanj" — endpoint saknas, både backend och UI
- ❌ "Skapa lead" från CRM — endpoint saknas
- ✅ `auditLog()` — skrivs, men ingen GET-endpoint för UI
- ❌ "Skapa fakturavy" — Fortnox-data behöver exponeras

Det betyder att E9-punkt 1 (skapa lag/bjud in lagansvarig) kan
implementeras på frontend-sidan med befintlig backend, medan E9-punkt 2
(skapa kampanj) behöver en ny backend-endpoint.
