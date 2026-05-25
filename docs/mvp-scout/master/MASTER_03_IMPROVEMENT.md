# MASTER 03 — FÖRBÄTTRING & POLISH (P3 + P4)

**281 fynd** som höjer kvaliteten men inte blockerar launch.

- **P3 — Förbättring (194 fynd):** Tas vid soft-launch / inom första 30 dagarna efter MVP.
- **P4 — Polish (87 fynd):** Backlog för v1.1 / kontinuerlig kvalitetsförbättring.

Format: `[Scout F-X.Y] Titel (Effort) — kort fix.`
Tema-grupperna A–J matchar `MASTER_00_INDEX.md` avsnitt 4.

---

# DEL 1 — P3 (194 fynd)

## A — Pengaflöde & Commerce-detaljer

### Klarna / Settlement / Fortnox

- **[S25 F-3.1] Inga partial-refunds / line-level-refund (M)** — utöka schema med `refund`-rader; admin-UI för per-line refund.
- **[S25 F-3.2] No support för avbruten Klarna-checkout (S)** — read `?status=cancelled` på return-URL; visa "Du avbröt — vill du försöka igen?".
- **[S25 F-3.3] Currency hårdkodad SEK utan plats för EUR/NOK (S)** — `currency`-fält på order; defaulta SEK; gör API-contract currency-aware.
- **[S25 F-3.4] No persistent payment-failure-log (S)** — sparra Klarna-fel-svar i `payment_errors`-tabell för support-debug.
- **[S25 F-3.5] No anti-fraud rate-limit per email/IP på checkout (S)** — 5 attempts/15min/email; logga > 5 till audit.
- **[S26 F-3.1] No notify-emails när payout genereras (S)** — TL + association-admin mail "Avräkning klar".
- **[S26 F-3.2] No CSV/Excel-export av settlement-rapport (S)** — `GET /v1/settlement/:campaignId/export?format=csv`.
- **[S26 F-3.3] No campaign-summary-PDF för revisor (M)** — PDFKit eller HTML→PDF för signing.
- **[S27 F-3.1] Fortnox-config-flow är dokument-läs-bara — no UI (M)** — `/portal/installningar/fortnox` med OAuth-flow + connection-test.
- **[S27 F-3.2] No retry-queue för failed invoice-creates (M)** — `invoice_jobs`-tabell med status; cron retry.
- **[S27 F-3.3] No Fortnox-driftövervakning på `/portal/system` (S)** — extend system-health med Fortnox-ping.
- **[S22 F-3.1] No "Spara cart för senare" / wishlist (S)** — namnge cart, lagra i localStorage med expiry.
- **[S22 F-3.2] No notification om cart abandoned > 1h (M)** — opt-in email "Vi sparade din kundvagn".
- **[S22 F-3.3] Cart-icon-bubble visar items totalt, inte unika produkter (S)** — `uniqueCount` på `useCart`.
- **[S22 F-3.4] No upsell efter cart-add ("Kunder köper också...") (M)** — modal eller drawer efter add med kompletterande produkter.

### Cart-UX

- **[S23 F-3.1] No order-receipt-print från bekräftelse (S)** — `window.print()` + print-CSS.
- **[S23 F-3.2] No "Lägg till i kalender" för leverans-datum (S)** — ICS-fil för planerad leverans.
- **[S23 F-3.3] Kassa-form har ingen mobile auto-advance mellan fält (S)** — `inputMode` korrekt + `nextElementSibling.focus()` på `Enter`.
- **[S23 F-3.4] Kort-länk till villkor/integritet öppnar full sida — disrupterande (S)** — visa i modal i kassa-context.
- **[S24 F-3.1] No SMS-bekräftelse-option (S)** — opt-in `notify_sms` flag + 46elks/Twilio.
- **[S24 F-3.2] No "Lägg till min lagledare på mailen" (S)** — checkbox kopiera TL.

## B — Auth, session & GDPR

- **[S11 F-3.1] No login-history för slutanvändaren (S)** — `/portal/installningar/sakerhet` lista senaste 10 sessions.
- **[S11 F-3.2] No email-notify vid login från ny enhet (M)** — track UA/IP-hash; mail "Ny inloggning från X" med revoke-länk.
- **[S11 F-3.3] No "force re-auth" inför känsliga actions (M)** — bekräfta lösenord innan `delete-account` eller settle-button.
- **[S11 F-3.4] Password-strength-meter saknas i signup (S)** — `zxcvbn` eller enkel `length+character-class`-check.
- **[S11 F-3.5] No "forgot password"-UI synlig i alla register-flows (S)** — länk på alla login-screens.
- **[S07 F-3.1] No "remember me" — alltid 7-day-TTL (S)** — checkbox extends till 30d.
- **[S07 F-3.2] No CAPTCHA på public signup-endpoints (S-M)** — hCaptcha eller turnstile på register-routes.
- **[S08 F-3.1] No org-logo-upload i registration (M)** — defer till `/installningar`.
- **[S08 F-3.2] No "Spara utkast" mellan steg (S)** — sessionStorage-persistence av wizard-state.
- **[S08 F-3.3] No invite-by-email i registration (M)** — efter steg 3, "Bjud in fler admins?".
- **[S09 F-3.1] Welcome-email saknar teamname personalisering (S)** — `{{teamName}}`-token i template.
- **[S09 F-3.2] No "preview team-page innan publish" (S)** — TL ser sin team-shop som besökare innan delning.
- **[S10 F-3.1] Seller-onboarding saknar 1-pager "Så här lyckas du" (S)** — checklist + tips.
- **[S10 F-3.2] No "Sätt upp ditt mål" som första-action efter signup (S)** — modal "Hur många paket vill du sälja?".

## C — Roll-handoffs & navigation

### Marketing / public

- **[S01 F-3.1] No "Hur funkar det" video/animation på homepage (M)** — Lottie eller embedded video.
- **[S01 F-3.2] No customer-logos / testimonials med riktiga föreningar (M)** — efter pilot, hämta tillstånd + lägg in.
- **[S01 F-3.3] No FAQ-sektion under hero för signup-hesitancy (S)** — accordion med 5-7 common questions.
- **[S01 F-3.4] No cookie-banner trots tracking-cookies på sajten (S-M)** — minimal banner med tre options.
- **[S02 F-3.1] No prislista på public marketing (M)** — `/priser`-sida med transparent fee-structure.
- **[S02 F-3.2] No "boka samtal"-kalender-embed (M)** — Cal.com på `/foreningsliv`.
- **[S02 F-3.3] No blog/case-studies-sektion (L)** — `/inspiration`-route med MDX-posts.
- **[S03 F-3.1] No ingredient-list / certifikat per produkt (S)** — utöka `products`-schema med `ingredients`, `certifications`.
- **[S03 F-3.2] No "produktöversikt"-video på PDP (S)** — embed YouTube eller `.mp4`.
- **[S05 F-3.1] Hair-analysis saknar "Spara resultatet"-PDF (S)** — print-version + download.
- **[S05 F-3.2] No "Skicka resultatet till vän"-share (S)** — share-link med tokenized retrieval.
- **[S06 F-3.1] Chat-widget öppnas inte automatiskt — låg discovery (S)** — efter 30s idle, subtle pulse på FAB.

### Portal handoffs

- **[S12 F-3.1] No "Senast inloggad"-stamp på portal-dashboard (S)** — visa "Senast inne: 2 dagar sedan".
- **[S12 F-3.2] Portal-search global saknas (M)** — `Cmd+K`-palette för snabbnavigering.
- **[S12 F-3.3] Sidebar-active-state har låg kontrast (S)** — `bg-primary/10` + tjockare border.
- **[S12 F-3.4] No breadcrumbs i deep portal-pages (S)** — auto-derivera från `pathname`.
- **[S13 F-3.1] No exportera-tabell-CSV-action på sales-statistics (S)** — knapp "Ladda ner CSV" generates client-side.
- **[S13 F-3.2] No favorites/pinned-views (M)** — spara filter-presets per användare.

## D — Commerce / Seller / Club

- **[S21 F-3.1] No "andra sellers i samma lag"-link på shop (S)** — sidebar "Stöd hela laget" länkar till team-aggregat.
- **[S21 F-3.2] No product-recommendation cross-sell (M)** — efter add-to-cart, visa "Köps ofta tillsammans".
- **[S21 F-3.3] No leverans-tracking-link i bekräftelse (M)** — om courier-API finns, embed tracking-URL.
- **[S17 F-3.1] Seller-dashboard saknar "Senaste 5 köpare med tack-knapp" (S)** — modal med one-click thank-you-text.
- **[S17 F-3.2] No "Dela framgång på sociala medier"-quick-actions (S)** — pre-formaterade posts med team-grafik.
- **[S17 F-3.3] Seller-leaderboard saknar "Ditt månads-personliga-record" (S)** — gamification-touch.
- **[S18 F-3.1] CLUB_ADMIN saknar "Snabb-beställ samma som förra månaden" (S)** — knapp på dashboard.
- **[S18 F-3.2] No "Sätt budget" / "Larma vid 80%" för CLUB-org (M)** — `org_budgets`-tabell + email-trigger.
- **[S18 F-3.3] CLUB invoice-history saknar PDF-download per invoice (S)** — embed Fortnox-PDF-URL.

## E — AI guardrails & content

- **[S29 F-3.1] No "Var noga med..."-warnings i AI-output (S)** — när AI-response innehåller key-decision-area, append-disclaimer.
- **[S29 F-3.2] No AI-feedback-thumbs på portal-AI (S)** — `thumbs_up/down` + optional comment, lagra i `ai_feedback`.
- **[S29 F-3.3] No "Show source"-länk när AI refererar till portalfunktion (M)** — länka till relevanta `/portal/help/...` artiklar.
- **[S19 F-3.1] No "Spara svar"-knapp på portal-AI (S)** — copy-to-clipboard + save-to-notes.
- **[S19 F-3.2] No AI suggested-prompts on first-open (S)** — visa 3-5 role-relevanta starters under empty-state.
- **[S19 F-3.3] AI-history saknas mellan sessions (M)** — store conversations i `ai_conversations`-tabell.

## F — Data architecture & analytics

- **[S13 F-3.3] No "Jämför med förra månaden" delta på KPIs (S)** — sub-text "+12% jmf föregående".
- **[S13 F-3.4] Chart saknar interaktivitet (hover-tooltips) (S)** — använd Recharts `Tooltip`-komponent.
- **[S13 F-3.5] No annotations på charts (campaigns, events) (M)** — overlay markers vid kampanjstart/slut.
- **[S20 F-3.1] No "Top 10 produkter"-tabell (S)** — `/v1/portal/statistics/products`-aggregate.
- **[S20 F-3.2] No "Geografisk fördelning"-karta (M)** — `<MapView>` med postnummer-aggregate.
- **[S20 F-3.3] No A/B-test-mätning för produkt-positions (L)** — defer post-MVP.

## G — Mobil & A11y polish

- **[S33 F-3.1] Header-search-icon-button saknar `aria-label` (S)** — `aria-label="Sök på sidan"`.
- **[S33 F-3.2] Hair-analysis wizard-buttons saknar focus-visible (S)** — `focus-visible:ring-2`.
- **[S33 F-3.3] Footer-länkar för tätt packade på mobil (S)** — `gap-3` istället för `gap-2`.
- **[S33 F-3.4] Portal-table sortera-knappar saknar `aria-sort` (S)** — `aria-sort="ascending"` på active column.
- **[S33 F-3.5] Date-picker inte mobile-friendly (M)** — `<input type="date">` med `inputMode="numeric"`.
- **[S33 F-3.6] Image carousel saknar swipe-indicators (S)** — dots under carousel.
- **[S33 F-3.7] Search-input saknar clear-X-knapp (S)** — `<button>` rensa när value !== "".
- **[S33 F-3.8] Toasts staplar inte korrekt på små screens (S)** — `bottom-[env(safe-area-inset-bottom)]` + max-width.
- **[S34 F-3.1] No skip-link på portal-pages (S)** — `<a href="#main">Hoppa till innehåll</a>`.
- **[S34 F-3.2] Color-only state-indicators på offerter-badges (S)** — lägg ikon eller text bredvid color.
- **[S34 F-3.3] No "page heading announce" för SPA-route-changes (S)** — `aria-live`-region som uppdateras vid pathname-change.
- **[S34 F-3.4] No high-contrast-mode test (M)** — Windows High Contrast-test, justera CSS.
- **[S34 F-3.5] Image alt-texts ofta empty eller "decorative" felaktigt (S)** — audit alla `<img alt="...">`.
- **[S34 F-3.6] Modal close-buttons saknar focus-trap (M)** — radix Dialog gör det, men custom modals i `pipeline/page.tsx` saknar.
- **[S32 F-3.1] No "show password"-toggle på password-fält (S)** — `<button>` eye-icon växlar `type="password|text"`.
- **[S32 F-3.2] No "Spara som utkast" i offert-create (S)** — `status: DRAFT` på save.
- **[S32 F-3.3] No autosave i pipeline-deal-form (M)** — debounce 1s, PATCH partial-update.
- **[S32 F-3.4] Date-fält saknar localized placeholder (S)** — `placeholder="åååå-mm-dd"`.
- **[S32 F-3.5] Phone-fält saknar Swedish-formatting (S)** — `inputMode="tel"` + auto-format `+46`.

## H — API contracts & schema

- **[S31 F-3.1] No OpenAPI/Swagger-spec — frontend-devs läser kod (L)** — `@hono/zod-openapi` eller manuell `/docs`.
- **[S31 F-3.2] No `X-Request-ID` på outgoing-requests för tracing (S)** — UUID på client, propagera, logga.
- **[S31 F-3.3] No API-versioning-strategi (S — doc)** — dokumentera "additive-only inom v1, v2 vid breaking".
- **[S31 F-3.4] No API-deprecation-headers (S)** — `Deprecation: true` + `Sunset: <date>` när routes flyttas.
- **[S31 F-3.5] No rate-limit-headers på 200-responses (S)** — `X-RateLimit-Remaining` + `X-RateLimit-Reset`.
- **[S30 F-3.1] Schema-comments saknas helt — kodbase-onboarding lider (M)** — Drizzle `.comment("...")` på sensitive cols.
- **[S30 F-3.2] No ENUM för crm_status, campaign_status etc (S)** — Drizzle `pgEnum` istället för varchar+check.
- **[S30 F-3.3] No db-level-CHECK på amounts >= 0 (S)** — Drizzle `check("price_positive", sql\`price_ore >= 0\`)`.
- **[S30 F-3.4] No partial-indexes för soft-delete-future-proofing (S)** — `WHERE deleted_at IS NULL` på frequent-queried cols.

## I — Communications & notiser

- **[S28 F-3.1] No in-app notification-inbox (M)** — `notifications`-tabell + bell-icon i portal-header.
- **[S28 F-3.2] No browser-push-notifications opt-in (L)** — Web Push API + service-worker.
- **[S28 F-3.3] No "daily digest"-email (M)** — opt-in mail med team-progress.
- **[S28 F-3.4] No "Sammanställning veckans toppsäljare"-mail (S)** — TL/admin opt-in.
- **[S28 F-3.5] No SMS-fallback när email-bouncar (M)** — track bounces; trigga SMS.

## J — Trust, legal & SEO

- **[S04 F-3.1] No SiteJSON-LD WebSite + SearchAction (S)** — strukturerad data för Google sitelink-search.
- **[S04 F-3.2] No BreadcrumbList JSON-LD på subsidor (S)** — auto-generera per route.
- **[S04 F-3.3] No `<link rel="alternate" hreflang>` för i18n (S — doc)** — om engelska kommer, dokumentera process.
- **[S04 F-3.4] No structured FAQPage-JSON-LD på FAQ-sektion (S)** — när FAQ-sida byggs.
- **[S04 F-3.5] No "Recension"-CTA efter levererad order (M)** — email 10 dagar efter delivery med trustpilot/google-länk.
- **[S04 F-3.6] No "Bli partner"-page för marketing-/PR-bureaus (M)** — `/partner` med kontaktformulär.

## S35 cross-cutting P3

- **[S35 F-3.1] No global "what's new" / changelog för portal-users (S)** — `/portal/nyheter`-route eller modal vid version-bump.
- **[S35 F-3.2] No onboarding-tour för förstagångsanvändare (M)** — tooltip-tour via `react-joyride` på dashboards.
- **[S35 F-3.3] No "Glöm inte att..."-nudges på dashboards (S)** — context-aware tips från `tips`-table.

### S14 Pipeline polish

- **[S14 F-3.1] No quote-template-library (M)** — common-quote-templates per produkt-mix.
- **[S14 F-3.2] No "schemalägg follow-up"-action på leads (M)** — `lead_followups`-tabell med email/reminder.
- **[S14 F-3.3] No commission-prognos för rep (M)** — beräkna från pipeline `expectedValue * stage_probability`.
- **[S14 F-3.4] No "Mina kunder"-page för SALES_REP (S)** — filter på `klubbar?assignedTo=me`.

### S15 Association polish

- **[S15 F-3.1] No campaign-templates ("Höstkampanj 2026") (M)** — pre-fylld settings från template.
- **[S15 F-3.2] No "Bjud in annan admin"-flow (M)** — email-invite till org-admin-rolle.
- **[S15 F-3.3] No "Pre-launch checklist" innan campaign aktiveras (S)** — modal "Bekräfta: produkter ✓, leadership ✓, deadlines ✓".

### S16 TL polish

- **[S16 F-3.1] No "Skicka lagets gemensamma uppdatering"-broadcast (M)** — TL skickar email till alla sellers.
- **[S16 F-3.2] No team-chat / kommentar-tråd (L)** — defer post-MVP.
- **[S16 F-3.3] No "Belöna toppsäljaren"-mall (S)** — pre-skriven mail-mall.

---

# DEL 2 — P4 (87 fynd, Polish / v1.1 backlog)

*Kompakt format: en rad per fynd, grupperat tematiskt.*

## A — Pengaflöde polish (8)

- **[S25 F-4.1]** Stöd för betalningsplaner / delbetalning (M).
- **[S25 F-4.2]** Wallet-integration (Swish, Apple Pay) (M).
- **[S26 F-4.1]** Settlement-PDF med signatur-fält (M).
- **[S26 F-4.2]** Multi-currency-rapporter när expansion sker (L).
- **[S27 F-4.1]** Bokio-/Visma-integration som alternativ till Fortnox (L).
- **[S27 F-4.2]** Auto-bokföring av Klarna-fees som separata rader (S).
- **[S22 F-4.1]** "Spara cart till email"-link (S).
- **[S23 F-4.1]** Gift-message-fält på checkout (S).

## B — Auth polish (7)

- **[S11 F-4.1]** Biometric WebAuthn / Passkey-support (L).
- **[S11 F-4.2]** Social login (Google/Apple) (M).
- **[S11 F-4.3]** Magic-link-login utöver password (M).
- **[S07 F-4.1]** "Login via QR från telefon"-flow (M).
- **[S08 F-4.1]** Auto-fill org-data via Bolagsverkets API (M).
- **[S09 F-4.1]** Team-leader kan importera sellers via CSV (M).
- **[S10 F-4.1]** Seller-profil-import från LinkedIn (L).

## C — Marketing polish (10)

- **[S01 F-4.1]** Animated illustrations istället för static (M).
- **[S01 F-4.2]** Multilingual support (engelska) (L).
- **[S02 F-4.1]** "Beräkna vad ni kan tjäna"-kalkulator-widget (M).
- **[S02 F-4.2]** Newsletter-signup på flera pages (S).
- **[S03 F-4.1]** AR-preview för produkter (L).
- **[S03 F-4.2]** Customer-photo-gallery per produkt (M).
- **[S05 F-4.1]** Hair-analysis quiz-mode utan foto (M).
- **[S05 F-4.2]** Multi-language hair-analysis (L).
- **[S06 F-4.1]** Voice-input på chat-widget (L).
- **[S06 F-4.2]** Chat-handoff till human support agent (L).

## D — Commerce polish (10)

- **[S21 F-4.1]** "Skapa egen mix"-bundle-builder (L).
- **[S21 F-4.2]** Loyalty/streak-mekanik för supporters (L).
- **[S17 F-4.1]** Seller-achievement-badges visuella (M).
- **[S17 F-4.2]** Seller-storyboard "min resa" (M).
- **[S18 F-4.1]** B2B-marketplace med flera leverantörer (XL).
- **[S18 F-4.2]** Bulk-quote-request för stora orders (M).
- **[S18 F-4.3]** Subscription-management UI (M).
- **[S12 F-4.1]** Portal-themes / dark mode-toggle (S).
- **[S13 F-4.1]** "Embed dashboard"-widget för external sites (L).
- **[S20 F-4.1]** Custom-dashboard-builder (L).

## E — AI polish (5)

- **[S29 F-4.1]** AI-generated weekly-insight för dashboard (M).
- **[S29 F-4.2]** Multi-modal input (foto + text) i chat (M).
- **[S19 F-4.1]** AI-genererade sammanfattningar av offerter (M).
- **[S19 F-4.2]** AI-skriv-hjälp för säljmeddelanden (M).
- **[S19 F-4.3]** AI-baserad sentiment-analys av kundkommunikation (L).

## F — Analytics polish (5)

- **[S13 F-4.2]** Predictive analytics (forecast) (L).
- **[S13 F-4.3]** Cohort-analys av säljare (M).
- **[S20 F-4.2]** Real-time-dashboard med WebSocket (M).
- **[S20 F-4.3]** Export till Google Sheets / Excel-online (M).
- **[S20 F-4.4]** Custom report-builder UI (L).

## G — Mobil & A11y polish (12)

- **[S33 F-4.1]** PWA-installation prompt + offline-shell (M).
- **[S33 F-4.2]** Native app via Capacitor eller React Native (XL).
- **[S33 F-4.3]** Haptics på touch-actions (S).
- **[S33 F-4.4]** iOS-specific share-sheet-extension (L).
- **[S33 F-4.5]** Pull-to-refresh på portal-lists (S).
- **[S34 F-4.1]** Reduced-motion-helt-igenom audit (M).
- **[S34 F-4.2]** Voice-over / TalkBack manual-QA-pass (M).
- **[S34 F-4.3]** RTL-language-support (M).
- **[S34 F-4.4]** Font-size-controls i settings (S).
- **[S32 F-4.1]** Conditional-fields baserat på tidigare svar (M).
- **[S32 F-4.2]** Multi-step-forms med progress-bar (S).
- **[S32 F-4.3]** Drag-to-reorder för list-items (M).

## H — API & schema polish (8)

- **[S31 F-4.1]** GraphQL-layer ovanpå REST (XL).
- **[S31 F-4.2]** WebSocket-API för realtime-features (L).
- **[S31 F-4.3]** API-rate-limit-tier per kund-segment (M).
- **[S31 F-4.4]** API-key-management för 3rd-party-integrations (M).
- **[S30 F-4.1]** Time-series-tabell för KPI-history (M).
- **[S30 F-4.2]** Materialized views för stora aggregates (M).
- **[S30 F-4.3]** Read-replica-läs-routing (L).
- **[S30 F-4.4]** Partitioning av audit_logs efter datum (M).

## I — Communications polish (7)

- **[S28 F-4.1]** Custom email-template-editor i portal (L).
- **[S28 F-4.2]** Email A/B-testning (M).
- **[S28 F-4.3]** Slack/Teams-integration för notifications (M).
- **[S28 F-4.4]** Push till Apple Watch / WearOS (L).
- **[S28 F-4.5]** Scheduled emails (queue + cron) (M).
- **[S28 F-4.6]** AI-generated subject-lines med open-rate-optimering (M).
- **[S28 F-4.7]** Localized templates per språk/region (M).

## J — Trust, legal & SEO polish (8)

- **[S04 F-4.1]** Trustpilot/Reco-integration (S).
- **[S04 F-4.2]** Bevis-arkivering (signerade orders som blockchain-hash) (L).
- **[S04 F-4.3]** Public-status-page (status.roots.se) (M).
- **[S04 F-4.4]** Annual-report-PDF för transparency (M).
- **[S04 F-4.5]** Press-kit-page med assets (S).
- **[S04 F-4.6]** SOC2 / ISO27001-certificering (XL — ops/legal).
- **[S04 F-4.7]** Sitemap.xml auto-genererad från CMS (S).
- **[S04 F-4.8]** Hreflang för engelska när lokaliserad (S).

## S35 cross-cutting polish (7)

- **[S35 F-4.1]** White-label för andra organisationer (XL).
- **[S35 F-4.2]** API-marketplace för 3rd-party-developers (XL).
- **[S35 F-4.3]** Mobile-first onboarding-redesign (L).
- **[S35 F-4.4]** AI-baserad seller-matchning (TL får förslag på sellers att rekrytera) (L).
- **[S35 F-4.5]** Influencer-/affiliate-marketing-program (M).
- **[S35 F-4.6]** Gamifierad "förenings-liga" cross-org (M).
- **[S35 F-4.7]** Carbon-footprint-tracking per order (M).

---

## Totalsumma

| Fil | Antal | Beskrivning |
|-----|------:|-------------|
| MASTER_01_CRITICAL.md | 164 | P1 — blockerar MVP |
| MASTER_02_NECESSARY.md | 292 | P2 — måste fixas före launch |
| MASTER_03_IMPROVEMENT.md (P3) | 194 | Soft-launch / inom 30 dagar |
| MASTER_03_IMPROVEMENT.md (P4) | 87 | v1.1 backlog |
| **TOTALT** | **737** | |

---

## Rekommendation — i vilken ordning

1. **Vecka 1–4:** Hela MASTER_01 (164 P1). Inget annat. Inga features.
2. **Vecka 5–8:** Tema A (Pengaflöde) + B (Auth) + D (Commerce) från MASTER_02. Det är ~150 fynd som tillsammans gör att första 1000 supporters kan handla utan friktion.
3. **Vecka 9–12:** Resterande MASTER_02 (~142 fynd). Cleanup + polish + role-handoffs.
4. **Soft-launch (vecka 13–16):** Plocka P3 efter användarfeedback-prioritering. Mät vad som faktiskt klagas på.
5. **v1.1 / Q3 2026:** P4 enligt business-prioritering (white-label, native app, etc.).

> Den största risken är att man försöker fixa allt parallellt. Disciplinen är att stänga MASTER_01 helt innan MASTER_02 öppnas, och MASTER_02 helt innan P3 körs igång.
