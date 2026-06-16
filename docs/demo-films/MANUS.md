# Roots demofilmer — manus

Tre korta, vertikala filmer (iPhone-format, ~30–40 s) som visar hur enkelt det
är att tjäna pengar till föreningen med Roots. De spelas **inte** in manuellt —
de körs som riktiga flöden i Playwright (mobilkontext), med tidsmarkörer vid
varje "beat" och hastighets-rampning i ffmpeg så väntetider komprimeras medan
de fina ögonblicken går i realtid (se `scripts/roots-demo/`).

Gemensam ton: varm, mänsklig, peppig — aldrig säljig. Textremsor är korta
(max ~5 ord) och ligger som overlay nedtill. Allt sker i demomiljön med
seedad data (`pnpm db:seed && pnpm db:seed:demo`).

| Film | Roll | Konto | Landar på |
|------|------|-------|-----------|
| A | Säljare / medlem | `felicia.assoc@demo-if.se` | `/min-shop` |
| B | Förening | `forening@demo-if.se` | `/forening` |
| C | Lagledare (klubbledare) | `lag@demo-if.se` | `/lag` |

Lösenord för alla: `Demo1234!`

Kolumnen **mark** är namnet på tidsmarkören som loggas i `flows.js` och styr
klippningen i `compose.js`. Kolumnen **takt** anger hur segmentet rampas
(realtid = 1×, "komp." = komprimeras till en målängd).

---

## Film A — "Så enkelt säljer du" (säljare/medlem)

**Mål:** Visa att en ungdom/medlem kommer igång på sekunder: egen shop, en
länk att dela, och att även en försäljning öga-mot-öga registreras på två tap.

**Intro-kort:** "Din egen shop. På 30 sekunder."
**Outro-kort:** "Du säljer. Föreningen tjänar."

| # | På skärmen | mark | Textremsa | Takt |
|---|------------|------|-----------|------|
| 1 | Intro-kort tonar in | — | — | realtid |
| 2 | Inloggning: e-post + lösenord skrivs, tap "Logga in" | `loginSubmit` | "Logga in" | skrivande lätt snabbat |
| 3 | Min shop laddar — hjälte-siffror: Sålt, Beställningar, Förtjänst, Mål | `dashboardShown` | "Allt på ett ställe" | komp. → realtid |
| 4 | Scrolla mjukt till "Dela din shop" — QR-kod + länk | `shareShown` | "Din egen länk + QR" | realtid |
| 5 | Tap "Dela via SMS/sociala medier" (faller tillbaka till kopiera) | `shareTapped` | "Dela på en sekund" | realtid |
| 6 | Öppna "Registrera order" — öka antal, välj Swish, tap "Registrera order" | `orderRegistered` | "Sålt på dörren? Två tap." | komp. |
| 7 | Gå till Statistik — försäljningskurva + mot målet | `statsShown` | "Se din kurva växa" | komp. → realtid |
| 8 | Outro-kort | — | — | realtid |

**Voiceover/caption-förslag (om speaker läggs på):**
"Du får en egen shop med en länk och QR-kod. Dela till familj och vänner — eller
registrera en försäljning på plats. Varje köp går rakt in i föreningens kassa."

---

## Film B — "Starta en kampanj på minuter" (förening)

**Mål:** Visa föreningsansvarig hur snabbt en kampanj startas, hur lag bjuds in,
och att intäkterna syns i realtid med automatisk avräkning.

**Intro-kort:** "Hela föreningen. Ett verktyg."
**Outro-kort:** "Allt i realtid. Pengar till kassan."

| # | På skärmen | mark | Textremsa | Takt |
|---|------------|------|-----------|------|
| 1 | Intro-kort tonar in | — | — | realtid |
| 2 | Inloggning skrivs, tap "Logga in" | `loginSubmit` | "Logga in" | skrivande lätt snabbat |
| 3 | Förenings-dashboard: Total försäljning, Beställningar, Lag, Säljare + lag-ranking | `dashboardShown` | "Översikt direkt" | komp. → realtid |
| 4 | Tap "Starta kampanj" — fyll Kampanjnamn, Mål, Marginal | `campaignFormFilled` | "Ny kampanj på minuter" | skrivande snabbat |
| 5 | Tap "Starta kampanj" (skicka) — kampanjen blir aktiv | `campaignCreated` | "Aktiv direkt" | komp. |
| 6 | Gå till Lag — visa lag-ranking + "Inbjudningslänk för säljare" | `teamsShown` | "Bjud in lagen" | realtid |
| 7 | Gå till Avräkning — Total försäljning, Föreningens intjänat, Roots andel | `settlementShown` | "Pengarna räknas åt er" | komp. → realtid |
| 8 | Outro-kort | — | — | realtid |

**Voiceover/caption-förslag:**
"Starta en kampanj på minuter, bjud in lagen med en länk, och följ försäljningen
i realtid. Avräkningen sköter sig själv — ni ser exakt vad föreningen tjänar."

---

## Film C — "Coacha laget på ett ställe" (lagledare / klubbledare)

**Mål:** Visa lagledaren hur enkelt det är att få igång spelarna (import eller
länk), peppa via chatt, och följa topplistan.

**Intro-kort:** "Led laget. Mindre krångel."
**Outro-kort:** "Mindre admin. Mer försäljning."

| # | På skärmen | mark | Textremsa | Takt |
|---|------------|------|-----------|------|
| 1 | Intro-kort tonar in | — | — | realtid |
| 2 | Inloggning skrivs, tap "Logga in" | `loginSubmit` | "Logga in" | skrivande lätt snabbat |
| 3 | Lag-dashboard: Total försäljning, Lagets förtjänst, Beställningar + säljar-ranking (🥇🥈🥉) | `dashboardShown` | "Lagets läge direkt" | komp. → realtid |
| 4 | Visa "Skicka denna länk till dina spelare" (kopiera) | `inviteShown` | "En länk till spelarna" | realtid |
| 5 | Gå till Säljare → tap "Importera" — importdialog | `importShown` | "Importera hela laget" | komp. |
| 6 | Gå till Chatt → "Meddela hela laget" → skriv → "Skicka till alla" | `broadcastSent` | "Peppa hela laget" | skrivande snabbat |
| 7 | Gå till Statistik — topplista säljare | `statsShown` | "Följ topplistan" | komp. → realtid |
| 8 | Outro-kort | — | — | realtid |

**Voiceover/caption-förslag:**
"Få igång spelarna med en länk eller importera hela listan. Peppa laget i
chatten och följ topplistan live. Du coachar — Roots sköter resten."

---

## Produktionsanteckningar

- **Format:** vertikal iPhone-look, telefonen renderas som egna bild-lager
  (bezel, statusbar 09:41, Dynamic Island). Desktop-variant (1920×1080) och
  mobil-variant (1080×1920) byggs från samma flöde.
- **Mänsklig känsla:** tap-ripples vid varje tryck, äkta skrivande
  (`pressSequentially`), mjuk scroll i många små steg.
- **Reproducerbart:** `record.js` rensar förra tagningens demo-data (manuella
  ordrar, chatt-meddelanden, kalkyl-leads, nya kampanjer) före varje körning så
  samma konton kan användas om och om igen.
- **Språk:** all UI-text som flödet tappar på ligger i `l10n.js` per språk —
  byt locale-argument för att spela in fler språk.
- **Längd:** sikta på 28–38 s per film efter rampning.
