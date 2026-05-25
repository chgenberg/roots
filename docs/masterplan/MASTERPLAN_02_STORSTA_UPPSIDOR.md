# MASTERPLAN 02 — STÖRSTA UPPSIDOR

**Källa:** 35 MVP-scout-rapporter + 10 flow-audit-rapporter + Säljprocess.pptx + Modell_register.docx.
**Syfte:** Inte buggar — utan **hävstänger**. Var ligger 10x-ökning på conversion, retention, eller seller-success?

> Disciplin: Den här planen öppnas **dagen efter** att MASTERPLAN 01 (kritiska brister) är merged till main. Innan dess är "uppsidor" en distraktion.

---

## Sammanfattning

Plattformen har tio **tydliga hävstänger** där en M-effort-investering ger oproportionerligt mycket värde — antingen i conversion, retention, viralitet, eller operationell skala.

| # | Hävstång | Domän | Hypotes (kvantifierbar uppsida) | Effort |
|--:|----------|-------|---------------------------------|-------:|
| 1 | **Seller-success amplifier** | Seller UX | +30% seller-aktivering, +50% seller-completion | 3 v |
| 2 | **Supporter-conversion at moment of decision** | Shop · Checkout | +20% conversion på shop-page | 2 v |
| 3 | **Association-onboarding-to-active** | Onboarding | Time-to-first-sale: 14d → 3d | 2 v |
| 4 | **TL = the multiplier role** | Team-leader-toolkit | TL-driven sales växer 3–5× | 2 v |
| 5 | **B2B Club ARR-expansion** | Portal Club | Recurring-revenue per kund 2×, churn -50% | 3 v |
| 6 | **Sales-rep velocity** | CRM · Pipeline | Quote-to-close-tid -40%, win-rate +15% | 3 v |
| 7 | **AI som portal-native concierge** | Portal AI | -30% support-tickets, +40% feature-adoption | 2 v |
| 8 | **Trust through transparency** | Marketing · Legal | Bounce-rate på `/foreningsliv` -25% | 1 v |
| 9 | **Data-driven decisions for admins** | Analytics · Drill-down | Admins agerar 3× snabbare på warning-signals | 2 v |
| 10 | **Inbound lead-magnet machine** | Marketing · Hair-analysis | Organic leads 5× på 6 mån | 4 v |

**Totalt:** ~24 manveckor. Med 2 squads parallellt: 12 veckor. Förslag: 6-veckors-sprintar, varje sprint väljer 2–3 hävstänger.

---

## HÄVSTÅNG 1 — Seller-success amplifier

> Sellers är hela värdekedjan. Aktiverade sellers = pengar in. Idag faller 60-70% bort efter signup utan att sälja en enda order.

### Hypotes

- **Idag:** Sellers landar på `/min-shop`, ser en tom dashboard, ingen tydlig "vad nu?"-instruktion.
- **Effekt:** ~30% säljer aldrig. Av de som säljer, ~50% säljer < 5 paket.
- **Lift om vi fixar:** +30% seller-aktivering (säljer minst 1 paket) och +50% seller-completion (säljer ≥ målet).

### Komponenter

**A. Personliga välkomst + onboarding-tour** *(M)*
- `/min-shop` första besök: modal "Hej {firstName}, sätt ditt mål" — 5 / 10 / 25 / 50 paket.
- Tour med 4 steg: "Här är din länk", "Så delar du", "Här ser du dina försäljningar", "Lagets ranking".
- Spara `onboarding_completed_at` på user.

**B. Pre-formaterade share-templates med kontext** *(S)*
- `apps/api/src/routes/sharing.ts:30-94` — endpoints finns men UI använder dem inte.
- Tre nivåer: "SMS till familjen", "Inlägg på Facebook", "Email till klassen".
- Auto-inkludera seller-namn, team-namn, kampanj-mål, shop-länk, deadline.
- QR-kod (print-friendly card).

**C. Real-time team-feedback** *(M)*
- "Just nu säljer du på 12:e plats i laget — 3 paket kvar för att passera Erik."
- Friendly competition utan att exponera namn (respektera `hideFromLeaderboard`).
- Notify när någon passerar dig: "Hej, Erik passerade dig precis 👀 — vill du dela igen?"

**D. Achievement-system + visuella badges** *(M)*
- First sale, 10 sales, 25 sales, sold to 5 different last-names, sold across 3+ days.
- Lagra i `seller_achievements`-tabell.
- Auto-trigga share-modal "Visa ditt achievement!"

**E. "Tack-funktion" till köpare** *(S)*
- Senaste 5 köpare visas (anonymiserade) med one-click "Skicka tack-meddelande".
- Pre-formaterad text, supportern får email "Tack från {sellerName}!".

**F. Goal-setting flow + progress-bar** *(S)*
- Visa "{X} av {goal} paket — {progress}%" stort på dashboard.
- "{N} dagar kvar tills kampanjslut".
- Auto-justera goal om seller når 100% (suggested stretch-goal).

### Filer

`apps/web/src/app/(fundraising)/min-shop/page.tsx`, `apps/web/src/components/share-templates.tsx`, `apps/api/src/routes/dashboard.ts` (extend with `teamRank`, `daysRemaining`, `achievements`), nya `seller_achievements`-tabell, `apps/api/src/routes/sharing.ts`.

### Mätbart

- [ ] Seller-aktivering (≥ 1 sale) går från X% till X+30%.
- [ ] Average sales per seller går från X till X×1.5.
- [ ] Share-action-rate (% av sellers som använder share-button) > 60%.

---

## HÄVSTÅNG 2 — Supporter-conversion at moment of decision

> Supporter har redan klickat sig till shop-page. Varje friktion mellan landing och bekräftelse är pengar. Idag förlorar vi ~50% mellan add-to-cart och checkout-complete.

### Hypotes

- **Idag:** Shop-page är funktionell men kall — ingen photo, ingen story, ingen ranking, ingen "tack från säljaren".
- **Effekt:** Cart-abandonment ~50%, checkout-abandonment ~30%.
- **Lift om vi fixar:** +20% conversion på shop-page.

### Komponenter

**A. Trust at moment of decision** *(M)*
- Seller-photo / initials-avatar.
- "Stödjer {teamName} i {orgName}" med klickbar org-länk.
- Personal-message-block: "Hej, jag heter {name} och säljer för att finansiera {goal}."
- (Use `sellers.personalMessage` from previous schema-extension.)

**B. Frictionless mobile checkout** *(M)*
- Express-flow: namn + email + adress + Klarna i 3 steg, inte 6.
- Apple Pay / Google Pay-knapp synlig om device-stödd.
- Auto-fill via `autoComplete`-tokens (Kill-chain 6 fixar grunderna).
- Postal-code → auto-look-up city via `postnummerservice` API.

**C. Social-proof per shop** *(S)*
- "12 personer från ditt område har redan köpt" (anonymiserad).
- "Senaste köpet: 2 minuter sedan i {city}."
- Behöver `customer_orders` med `city` (redan finns).

**D. One-tap-share efter köp** *(S)*
- Bekräftelse-page: stora knappar "Dela på Facebook / Instagram / SMS".
- Pre-formaterad: "Jag stöttade just {teamName}! 🌱 Vill du också? {sellerShopUrl}".
- `navigator.share` med fallback till copy-link.

**E. Refer-a-friend efter köp** *(M)*
- "Tack för ditt köp! Bjud en vän så får {sellerName} extra hjälp."
- Unique URL per supporter (tracked attribution).
- Visa i seller-dashboard: "5 köp från Anders refer-chain".

**F. "Re-order"-CTA i bekräftelse-email** *(S)*
- "Mer hår-omsorg? Köp igen från {sellerName} här."
- Driver återköp under aktiv kampanj.

### Filer

`apps/web/src/app/(shop)/shop/[slug]/page.tsx`, `apps/web/src/app/(shop)/shop/[slug]/kassa/page.tsx`, `apps/web/src/app/(shop)/shop/[slug]/bekraftelse/page.tsx`, `apps/api/src/lib/email/templates.ts`, `apps/api/src/routes/shop.ts` (extend with `socialProof`-counts).

### Mätbart

- [ ] Shop-page → checkout-start conversion: X% → X+15%.
- [ ] Checkout-start → checkout-complete conversion: X% → X+10%.
- [ ] Average order value (AOV): mät baseline; post-fix: refer-driven re-orders > 5% av total revenue.

---

## HÄVSTÅNG 3 — Association-onboarding-to-active

> En association-admin som inte når första försäljning inom 14 dagar är förlorad. Idag faller många på onboarding (skippad wizard, ingen guidance).

### Hypotes

- **Idag:** Signup → tom portal → klick runt → frustration → bounce. Time-to-first-sale: ~14 dagar.
- **Lift om vi fixar:** Time-to-first-sale: 14d → 3d för 80%+ av nya associations.

### Komponenter

**A. Post-signup onboarding-checklist** *(M)*
- `/forening?onboarding=1` — modal med 5 steg:
  1. ✓ Förening skapad.
  2. ☐ Skapa första kampanj.
  3. ☐ Bjud in 1 lagledare.
  4. ☐ Aktivera kampanjen (status DRAFT → ACTIVE).
  5. ☐ Dela kampanj-länk med första TL.
- Persisterad i `user.onboarding_state` JSON.
- Confetti vid 5/5 ✓.

**B. Campaign-templates** *(M)*
- "Höstkampanj 2026", "Klassresan", "Lägret", "Nyårsfundraiser".
- Pre-fyllda settings: duration (28 dagar), goal (50k SEK), products (3-pack standard).
- Admin kan tweaka.
- ~6 templates baserade på Säljprocess.pptx-feedback.

**C. Pre-launch-confidence-checklist** *(S)*
- Innan campaign aktiveras (DRAFT → ACTIVE), modal:
  - "Du har 3 lagledare ✓ / 0 ⚠️"
  - "Du har en deadline ✓ / 0 ⚠️"
  - "Du har valt produkter ✓"
  - "Du har bestämt vinstmål ✓"
- Varna men tillåt aktivering ändå.

**D. Live team-progress dashboard på `/forening`** *(M)*
- Idag visar bara totals.
- Lägg per-team progress-bars, last-order-timestamp, "team X har inte sålt på 5 dagar — bjud in eller följ upp".
- Drill-down per team.

**E. Settlement-confidence transparency** *(S)*
- Visa preview av settlement **medan kampanjen pågår** (live calculation).
- "Hittills tjänat {amount} SEK. Roots-andel: {x}%. Klart att betalas ut: {date}."
- Bygger trust långt innan settlement faktiskt körs.

**F. "Bjud in styrelsen / extra admins"** *(M)*
- Idag bara en admin per org → bus-factor 1.
- `/forening/installningar` → "Bjud in fler admins" med role `ASSOCIATION_ADMIN`.
- Audit-log varje delegation.

### Filer

`apps/web/src/app/(fundraising)/forening/page.tsx`, `apps/web/src/app/(auth)/registrera/page.tsx`, `apps/api/src/routes/association.ts`, nya `campaign_templates`-tabell, `packages/db/src/schema/users.ts` (add `onboarding_state` jsonb).

### Mätbart

- [ ] Time-to-first-sale (signup → first paid order): median 14d → 3d.
- [ ] Onboarding-checklist completion: > 80% når 5/5 inom 7 dagar.
- [ ] Association-signup → activated-campaign within 24h: > 70%.

---

## HÄVSTÅNG 4 — Team-leader = the multiplier role

> En TL är hävstångs-roll: 1 TL hanterar 20-50 sellers. Bra TL-toolkit = exponentiellt bättre kampanjresultat.

### Hypotes

- **Idag:** TL kopierar manuellt invite-länkar, har ingen översikt över zero-sales-sellers, ingen QR.
- **Lift om vi fixar:** Aktiva TL → seller-aktivering 1.5×, team-sales 3-5×.

### Komponenter

**A. Bulk seller-invite + CSV-import** *(M)*
- `/forening/lag/saljare` → "Bjud in flera" med email-list eller CSV-upload.
- API skapar inactive seller-records, skickar invites batchat, rate-limited.
- Audit-log per invite.

**B. Live seller-monitoring med nudge-actions** *(M)*
- TL-dashboard: tabell med sellers + "senaste aktivitet"-stamp.
- Chip "Har inte börjat" (signup men 0 sales).
- One-click "Skicka påminnelse" — mail med pre-skriven text.
- Filter: "Behöver follow-up" som default-view.

**C. QR-codes everywhere** *(S)*
- `qrcode` npm-paket finns redan i hair-analysis.
- TL-team-invite-URL → QR (print-friendly card).
- Seller-shop-URL → QR (för fysisk delning på event).
- Re-användbar `<QrCard>`-komponent.

**D. SMS/email-templates exposed in UI** *(S)*
- `apps/api/src/routes/sharing.ts:30-59` — `GET /sharing/team-leader-templates` finns men UI använder inte.
- Knappar "Kopiera SMS" / "Kopiera e-post" på `/forening/lag/saljare`.
- Templates tagging: `{teamName}`, `{leaderName}`, `{sellerName}`, `{campaignEnd}`.

**E. Invite-token-rotation (UI)** *(S)*
- Connect till `MASTERPLAN_01 KC3-4` (backend).
- TL-knapp "Skapa ny invite-länk" med confirm-dialog.

**F. Realtime-freshness / pull-to-refresh** *(M)*
- 60s-polling på team-dashboard ELLER SSE.
- Visa "Nytt köp! Erik sålde just 2 paket" som toast.
- Opt-in browser-notifications.

**G. Team-broadcast email** *(M)*
- "Skicka gemensam uppdatering" till alla aktiva sellers.
- Pre-formaterad eller free-text.
- Rate-limited (1/dag).

### Filer

`apps/web/src/app/(fundraising)/lag/page.tsx`, `apps/web/src/app/(fundraising)/lag/saljare/page.tsx`, `apps/api/src/routes/sharing.ts`, `apps/api/src/routes/dashboard.ts`, nya `<QrCard>`-komponent, optional SSE-endpoint `/v1/team/:id/events`.

### Mätbart

- [ ] Aktivt TL-engagement (loggar in ≥ 2×/vecka): > 75%.
- [ ] Seller-aktivering inom team med aktiv TL: 1.5× jämfört utan.
- [ ] Genomsnittlig team-sales: 3-5× lift mellan inactive/active TL.

---

## HÄVSTÅNG 5 — B2B Club ARR-expansion

> Klubb-kunder är ARR (Annual Recurring Revenue). En klubbkund är värd 10-100× en supporter över livstid. Idag har vi ingen reorder-, subscription- eller budget-funktion.

### Hypotes

- **Idag:** CLUB_MEMBER lägger order, måste manuellt återskapa nästa månad. Ingen automation.
- **Lift om vi fixar:** Average order frequency: 1.2/år → 4-6/år. Churn -50% när budget-/subscription-features kommer.

### Komponenter

**A. Reorder från order-history** *(M)*
- `/portal/bestallningar` → varje order har "Beställ igen"-knapp.
- Pre-fillar dialog-cart med samma line-items.
- Asserta: 1-click reorder på senaste 30-dagars-order.

**B. Subscription-management UI** *(L)*
- `/portal/abonnemang` — visa aktiva subscriptions (om DB:n stödjer).
- Skapa subscription från order: "Beställ detta var 4:e vecka".
- Pause / cancel / next-delivery-date.
- Webhook till Klarna för auto-debitering.

**C. Budget-tracking + alarm vid 80%** *(M)*
- `org_budgets`-tabell: `org_id, period (monthly|quarterly|annual), amount_ore, created_by`.
- `/portal/budget` med progress-bar.
- Auto-mail vid 80% / 100%.
- CLUB_ADMIN-only setup.

**D. Bulk-quote-request för stora orders** *(M)*
- "Begär offert" på portal: form med expected_quantity, delivery-date, special-requests.
- Routar till SALES_REP (territory) via assignment-rules.
- Connect till sales-pipeline (Hävstång 6).

**E. Invoice-PDF-download per order** *(S)*
- `/portal/bestallningar/[id]` → "Ladda ner faktura" — länkar Fortnox-PDF.
- Filterbar per period för revisor-export.

**F. CSV/Excel export av order-history** *(S)*
- `/portal/bestallningar` → "Exportera" → CSV med kolumner: datum, produkt, antal, pris, totalt.
- För admin-budget-review.

**G. "Snabb-beställ samma som förra månaden"** *(S)*
- Dashboard-widget med pre-fylld senaste order.
- 1-click → till kassa.

### Filer

`apps/web/src/app/(portal)/portal/bestallningar/page.tsx`, `apps/web/src/app/(portal)/portal/bestallningar/[id]/page.tsx`, nya `/portal/abonnemang/page.tsx`, nya `/portal/budget/page.tsx`, `apps/api/src/routes/portal.ts`, nya schema-tabeller `subscriptions`, `org_budgets`.

### Mätbart

- [ ] Reorder-rate (% av kunder som beställer ≥ 2x på 6 mån): > 60%.
- [ ] Subscription-conversion: > 25% av aktiva CLUB-kunder.
- [ ] Average order frequency: lift från 1.2/år till > 4/år.

---

## HÄVSTÅNG 6 — Sales-rep velocity

> SALES_REP är fältsäljare som måste kunna agera snabbt. Idag tar quote-to-close veckor pga dålig tooling.

### Hypotes

- **Idag:** SALES_REP hanterar quotes manuellt, ingen pipeline-drag-and-drop, ingen template-library, ingen commission-prognos.
- **Lift om vi fixar:** Quote-to-close-tid -40%, win-rate +15%.

### Komponenter

**A. Pipeline drag-and-drop mellan stages** *(M)*
- `/portal/pipeline` — idag visar 5 kolumner men dropping gör inget.
- Implementera via `@dnd-kit/sortable`.
- Stage-change triggar status-update på backend + audit-log.

**B. Quote-template-library** *(M)*
- 5-10 vanliga product-mixes (standard, premium, value, season-package).
- Per-template: pre-fylld line-items, default-discount, default-payment-terms.
- SALES_REP väljer template → kopierar → modifierar.

**C. Quote-PDF + email-send-flow** *(M)*
- "Skicka offert"-knapp på `/portal/offerter/[id]`.
- Genererar PDF (HTML→PDF eller PDFKit).
- Mailar till `contactEmail` (från quote eller club-admin).
- Audit-log "quote.sent".

**D. Commission-prognos i dashboard** *(M)*
- Beräkna från pipeline: `Σ(deal.expectedValue * stage.probability * commissionRate)`.
- Visa "Förväntad provision: {amount} SEK denna månad".
- Drill-down till per-deal.

**E. Lead-intake form med scoring** *(M)*
- Public `/blilevorantor` eller portal-internal "Lägg till lead".
- Auto-scoring: org-size (anställda), industry, current-spend (manual estimate).
- Assigna till SALES_REP via territory-rules.

**F. "Mina kunder"-view för SALES_REP** *(S)*
- `/portal/klubbar?assignedTo=me` filter.
- Default-view för SALES_REP, inte global catalog.

**G. Search/filter på quotes** *(S)*
- `/portal/offerter` — filter by status, org, rep, date-range.
- Save filter-presets.

**H. Schemalägg follow-up på leads** *(M)*
- `lead_followups`-tabell: `lead_id, due_at, type (call|email|meeting), done_at`.
- Dashboard "Att göra idag"-widget.
- Email-reminder kvällen före.

### Filer

`apps/web/src/app/(portal)/portal/pipeline/page.tsx`, `apps/web/src/app/(portal)/portal/offerter/page.tsx`, `apps/web/src/app/(portal)/portal/offerter/[id]/page.tsx`, `apps/web/src/app/(portal)/portal/klubbar/page.tsx`, `apps/api/src/routes/portal.ts`, nya `quote_templates`-, `lead_followups`-tabeller, PDF-gen-lib.

### Mätbart

- [ ] Avg time quote→close: X dagar → X*0.6.
- [ ] Win-rate (won/total): X% → X*1.15.
- [ ] SALES_REP NPS efter 30 dagars usage: > 8.

---

## HÄVSTÅNG 7 — AI som portal-native concierge

> AI är hjärtat i Roots "Open Claw"-positioning. Idag är AI:n en passiv chat. Den ska vara en aktiv produktivitetsförhöjare som minskar support-tickets och ökar feature-adoption.

### Hypotes

- **Idag:** AI svarar på frågor men erbjuder inga actions, inga shortcuts, ingen kontext.
- **Lift om vi fixar:** -30% support-tickets ("Hur gör jag X?"), +40% adoption av sekundära features.

### Komponenter

**A. Role-aware suggested prompts** *(S)*
- Empty-state på `/portal/ai` visar 3-5 role-relevanta starters:
  - ASSOCIATION_ADMIN: "Skapa kampanj", "Bjud in lagledare", "Sök igenom våra sellers".
  - TL: "Bjud in säljare", "Vem har inte sålt än?", "Skicka påminnelse".
  - SELLER: "Hjälp mig dela", "Hur många paket kvar?", "Tips för fler köpare".

**B. AI-replies med klickbara portal-länkar** *(M)*
- `/portal/ai/page.tsx:312-328` — link-detector för `/portal/...`-paths.
- Konvertera till `<Link>`-komponenter.
- Asserta: "Du kan se det här under /portal/statistik" blir klickbart.

**C. Save-response till notes** *(S)*
- "Spara svar"-knapp på varje AI-message.
- Lagra i `user_notes`-tabell.
- Tillgänglig i `/portal/anteckningar`.

**D. AI-feedback thumbs (thumbs up/down)** *(S)*
- Per message: 👍 / 👎.
- Optional comment vid 👎.
- Lagra i `ai_feedback`-tabell för fine-tuning-data.

**E. "Show source"-länk när AI refererar till portalfunktion** *(M)*
- Pre-bygg en knowledge-base med portal-help-articles.
- AI taggar källor i response: "Enligt /portal/help/avrakningar...".
- UI renderar som footnote.

**F. AI weekly-insights på dashboard** *(M)*
- Cron-job 1×/vecka per active user.
- Generera 3 insights: "Du har 3 zero-sales-sellers", "Erik passerade dig denna vecka", "Settlement körs om 5 dagar".
- Email + dashboard-widget.

**G. AI sammanfattningar av offerter** *(M)*
- SALES_REP: "Sammanfatta denna kund-historik" → genererar 3-paragraph summary baserat på quotes + orders + activities.

**H. AI-skriv-hjälp för säljmeddelanden** *(M)*
- TL/SELLER: "Skriv ett påminnelse-SMS till Anders som inte sålt på 5 dagar".
- Returnerar 3 förslag i olika ton (vänlig/peppande/proffsig).

### Filer

`apps/web/src/app/(portal)/portal/ai/page.tsx`, `apps/api/src/routes/ai-chat.ts`, `apps/api/src/lib/ai/system-prompt.ts`, nya `ai_feedback`-, `user_notes`-tabeller, weekly-insights cron-job.

### Mätbart

- [ ] Support-tickets per active user/månad: X → X*0.7.
- [ ] AI-usage per active user/vecka: > 3 messages.
- [ ] Adoption av sekundära features (insights, save-notes): > 30% av active users.

---

## HÄVSTÅNG 8 — Trust through transparency

> Bouncad på `/foreningsliv` är ofta trust-relaterad. "Vad är detta egentligen?" "Är ni nya?" "Hur jobbar ni?" Idag har vi 0 social proof, 0 transparency.

### Hypotes

- **Idag:** Marketing-sidor är polish men har inga referenser, ingen status-page, inga reella siffror.
- **Lift om vi fixar:** Bounce-rate på `/foreningsliv` -25%, signup-rate +10%.

### Komponenter

**A. Honest "pilot-numbers"-block** *(S)*
- "We're in pilot — joined föreningar: 12. Total sales: 245k SEK. Founded: 2024."
- Auto-update från DB.
- Inte fabricerat — verklig data, transparency-as-marketing.

**B. Real testimonials post-pilot** *(M — manuellt arbete)*
- Efter 3 mån pilot, hämta tillstånd från 3-5 föreningar.
- Photo + quote + kampanj-resultat.
- Embed på `/foreningsliv`, `/om-oss`.

**C. Public status-page (status.roots.se)** *(M)*
- Använd Better Stack eller Hetrix eller bygg själv.
- Per-service uptime: API, Web, Klarna-webhook, Fortnox.
- Incident-historik.
- Länka från footer.

**D. Annual transparency report (PDF)** *(M — engångsarbete)*
- "Roots 2026 — så här gick det".
- Hur mycket gick till föreningar (50.5%), hur mycket till Roots (X%), team-storlek, future plans.
- Inspireras av Buffer Open.

**E. Open changelog** *(S)*
- `/changelog`-route eller Tweet-feed.
- "Vad vi släppt senaste veckan".
- Bygger förtroende genom transparens.

**F. Press-kit-page** *(S)*
- `/press` med logos, founder-photos, fakta, contact.
- Reducerar friction för journalister/influencers.

**G. "Bli partner"-page för PR-byråer** *(M)*
- `/partner` med kontaktformulär.
- Mer trafik från PR-co-marketing.

**H. Legal-identity konsekvent överallt** *(S)*
- Redan delvis fixat. Verifiera att org.nr finns i:
  - Footer (alla layouts)
  - JSON-LD Organization
  - Email-footers
  - Köpvillkor + integritetspolicy
  - About-page

### Filer

`apps/web/src/app/(marketing)/foreningsliv/page.tsx`, `apps/web/src/app/(marketing)/om-oss/page.tsx`, nya `/changelog/page.tsx`, nya `/press/page.tsx`, nya `/partner/page.tsx`, `apps/web/src/components/legal-identity-block.tsx`.

### Mätbart

- [ ] Bounce-rate `/foreningsliv`: -25%.
- [ ] Signup-rate per visit: +10%.
- [ ] Mention-rate i social/press: 2× efter transparency-report.

---

## HÄVSTÅNG 9 — Data-driven decisions for admins

> Admins ser tomma dashboards eller hårdkodade nummer idag. Bra data-tooling = admins reagerar 3× snabbare på warning-signals.

### Hypotes

- **Idag:** Statistik-page visar staplar. Ingen drill-down. Ingen export. Ingen jämförelse. Ingen alert.
- **Lift om vi fixar:** Admins identifierar problem-team inom timmar, inte veckor.

### Komponenter

**A. Drill-down på varje KPI** *(M)*
- `/portal/page.tsx` — KPI-cards är passive numbers.
- Wrappa i `<Link>`-komponenter, klick → detalj-view med per-team/per-seller breakdown.
- "Visa detaljer →"-link.

**B. CSV/Excel export på alla tabeller** *(S)*
- "Exportera"-knapp på `/portal/statistik`, `/forening/avrakning`, `/portal/bestallningar`, etc.
- Client-side CSV-generation.
- För export till revisor / styrelse-presentation.

**C. Period-jämförelse (vs föregående period)** *(S)*
- Varje KPI får sub-text: "+12% jmf föregående 30 dagar".
- Color: green (positive), red (negative).
- Tooltip: "Föregående: X".

**D. Annotations på charts (campaigns, events)** *(M)*
- Overlay markers vid kampanjstart, slut, settlement, push-mail.
- Hover visar context: "Kampanj 'Höstkampanj 2026' startade 1 september".

**E. Geografisk fördelning (karta)** *(M)*
- Postnummer-aggregate.
- Heat-map per region.
- Bra för ASSOCIATION_ADMIN att se "var är våra köpare".

**F. Cohort-analys av säljare** *(L)*
- Visa per signup-vecka: hur många aktiverade, sålde > N, churnade.
- Identifiera trend: "Sellers från vecka 12 var 30% mer aktiva — vad gjorde vi annorlunda?"

**G. Alert-engine (anomaly detection light)** *(M)*
- Cron-job analyserar daily-trends.
- Trigger: "Settlement-cycle slutar om 3 dagar, 5 teams har 0 sales".
- Email till INTERNAL_ADMIN + relevant ASSOCIATION_ADMIN.

**H. Custom dashboard-widgets** *(L — defer post-MVP)*
- User kan välja vilka widgets som visas.
- Save layout per user.

### Filer

`apps/web/src/app/(portal)/portal/page.tsx`, `apps/web/src/app/(portal)/portal/statistik/page.tsx`, `apps/web/src/components/csv-export-button.tsx` (ny), `apps/api/src/routes/portal.ts` (extend statistics endpoints), cron-jobs i `apps/api/src/jobs/`.

### Mätbart

- [ ] Time-to-action på warning-signals: X dagar → X*0.3.
- [ ] Antal admins som använder export-funktionen: > 50% månadsvis.
- [ ] Anomaly-alerts → resolution time: < 24h för 80%.

---

## HÄVSTÅNG 10 — Inbound lead-magnet machine

> Outbound är dyrt. Inbound är fritt och skalar. Hair-analysis är vår första lead-magnet — vi har bara skrapat ytan.

### Hypotes

- **Idag:** Hair-analysis kör men finns inte på fler ställen, ingen kvarvarande funnel post-result.
- **Lift om vi fixar:** Organic-leads 5× på 6 mån.

### Komponenter

**A. Hair-analysis-quiz utan foto** *(M)*
- Alternativ för users utan photo-villig.
- 10-12 frågor → resultat + product-recommendation.
- Mindre friction, högre conversion.

**B. "Boka samtal" via Cal.com på `/foreningsliv`** *(S)*
- Embed Cal.com-widget.
- Connect till sales-rep pipeline.
- Auto-genererar lead i `crm`-tabell.

**C. ROI-calculator för föreningar** *(M)*
- `/foreningsliv/kalkylator` — "Hur mycket kan vi tjäna?"
- Input: antal sellers, average sales per seller, kampanj-längd.
- Output: estimerad förtjänst, jämförelse vs traditionell försäljning.
- Lead-gate efter resultat ("Få detaljerad analys via email").

**D. SEO-rich blog/case-studies-sektion** *(L)*
- `/inspiration` eller `/case` med MDX-posts.
- Per kund-success-story.
- Long-tail SEO för "fundraising förening", "klassresa finansiering", etc.

**E. Programmatic SEO (en sida per kampanj-typ)** *(L)*
- `/foreningsliv/klassresa-finansiering`, `/lagresa`, `/lagerverksamhet`, etc.
- Templated content med real-data där tillgängligt.
- Per-page lead-magnet.

**F. Newsletter signup** *(S)*
- Footer + several marketing-pages.
- Lead till `waitlist_signups` (redan finns) ELLER ny `newsletter_subscribers`.
- Monthly newsletter med best-practices för fundraising.

**G. Referral-program** *(M)*
- Befintliga associations får extra Roots-share-rabatt om de hänvisar nya.
- Tracked via unique referral-URL.
- Audit + payout per claim.

**H. Lead-scoring + assignment** *(M)*
- Connect alla lead-magnets till `crm`-pipeline.
- Auto-score baserat på org-size, industry, kampanj-typ.
- Auto-assign till SALES_REP via territory.

### Filer

`apps/web/src/app/(marketing)/foreningsliv/kalkylator/page.tsx` (ny), `apps/web/src/app/(marketing)/inspiration/page.tsx` (ny), `apps/web/src/components/hair-analysis-lead-dialog.tsx` (extend with quiz-mode), `apps/api/src/routes/leads.ts` (ny), nya `newsletter_subscribers`-tabell, `referral_tracking`-tabell.

### Mätbart

- [ ] Organic-leads per månad: X → X*5 inom 6 mån.
- [ ] Hair-analysis-completion: X% → X+20% med quiz-mode.
- [ ] Cal.com-bokningar per månad: > 20.
- [ ] Newsletter-subscribers: > 500 inom 6 mån.

---

## SAMORDNINGSPLAN

### Sprint-allokering (förslag 12-veckors arc, 2 squads)

| Sprint | Vecka | Squad A | Squad B |
|--------|-------|---------|---------|
| 1 | 1–2 | Hävstång 1 (Seller-amplifier) | Hävstång 8 (Trust) |
| 2 | 3–4 | Hävstång 1 forts. | Hävstång 2 (Supporter-conv.) |
| 3 | 5–6 | Hävstång 3 (Onboarding) | Hävstång 2 forts. |
| 4 | 7–8 | Hävstång 4 (TL multiplier) | Hävstång 7 (AI concierge) |
| 5 | 9–10 | Hävstång 5 (B2B ARR) | Hävstång 9 (Data) |
| 6 | 11–12 | Hävstång 6 (Sales velocity) | Hävstång 10 (Lead-magnet) |

### Hypotes-validering — varje hävstång måste mätas

> Varje hävstång börjar med **baseline-mätning** (vecka 0) och slutar med **post-implementation-mätning** (4 veckor efter release).
> Om lift-hypotesen failar > 50% — pause + iterate, ingen ny hävstång öppnas.

### Prioritetsregel om resurs blir knapp

1. Färdigställ hävstång du började på (no half-built features).
2. Pick högsta-lift-per-effort: 1 → 4 → 2 → 3 → 5.
3. AI, Trust, Data, Lead-magnet kan parallelliseras med rätt skills.

### Cross-cutting concerns för alla hävstänger

- **Audit-log:** Varje ny user-action loggas via `audit.ts`-helper.
- **Feature-flag:** Varje ny feature wrapped i `isEnabled("FEATURE_X")` för safe-rollback.
- **Mätning:** Varje hävstång lägger till sin success-metric i `/portal/system`-dashboard.
- **Backward-compat:** Inga breaking changes på public API; additive-only.

---

## Anti-mönster att undvika

- ❌ **Bygg en hävstång till 50% och hoppa till nästa.** Halvbyggda features = teknisk skuld.
- ❌ **Skippa mätning.** Utan baseline → kan inte säga om vi lyckades.
- ❌ **Lägg flera hävstänger i samma release.** Omöjligt att attribuera lift.
- ❌ **Lyssna på första anekdotiska feedbacken och iterera.** Vänta tills 4-veckors-mätningen.
- ❌ **Öppna en hävstång innan MASTERPLAN_01 är 100% grön.** Tekniska brister sänker lift-effekten av allt nytt.

---

## Referenser

- `docs/mvp-scout/master/MASTER_02_NECESSARY.md` — P2-katalog (många komponenter härifrån).
- `docs/mvp-scout/master/MASTER_03_IMPROVEMENT.md` — P3+P4-katalog (nice-to-haves).
- `public/Feedback_14:5/Säljprocess.pptx` — feedback från kollega (kampanj-templates, support-tiers).
- `docs/masterplan/MASTERPLAN_01_KRITISKA_BRISTER.md` — must-be-done-first.
- `docs/masterplan/MASTERPLAN_03_ROLLKOPPLINGAR.md` — för cross-role-handoff-integritet.
