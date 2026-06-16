# Metodik: reproducerbara produkt-/reklamfilmer med Playwright + ffmpeg

En generell, projekt-oberoende beskrivning av hur filmerna i `scripts/roots-demo/`
byggs. Inget spelas in manuellt med skärminspelare — istället kör vi de **riktiga**
användarflödena i en headless browser, loggar tidsmarkörer, ritar telefonramen som
egna bilder och låter ffmpeg klippa ihop allt med hastighets-rampning. Resultatet
ser ut som en proffsig iPhone-skärminspelning men är 100 % reproducerbart.

Kopiera mappstrukturen och anpassa selektorer/geometri, så fungerar samma upplägg
i vilket webbprojekt som helst.

---

## 1. Grundidén

> **Spela in produkten, inte en mockup.** Kör de verkliga sidorna i Playwright i
> mobilkontext → få en rå video. Lägg sedan på telefonram, intro/outro och
> hastighets-rampning i efterproduktion. Allt deklarativt och idempotent.

Tre fördelar:
- **Sanning** — filmen visar exakt det som finns i produkten (inga photoshoppade skärmar).
- **Reproducerbarhet** — kör om när UI ändras, identiskt resultat.
- **Skalbarhet** — en roll/flöde = ett kommando. Lägg till fler utan nytt verktyg.

---

## 2. Arkitektur — tre steg, tre filer + en delad config

```
config.js   → ALL geometri, miljö, konton, varianter (en sanningskälla)
flows.js    → de faktiska klick-/scroll-sekvenserna per roll ("beats")
record.js   → kör flödet i Playwright → out/<role>/raw.webm + marks.json
frames.js   → renderar bg.png, frame.png, intro.png, outro.png (HTML→screenshot)
compose.js  → ffmpeg: trimma+rampa+klistra ihop → <role>-demo.mp4 + poster.jpg
```

Pipelinen är **fasad**: `record` (browser) → `frames` (assets) → `compose` (ffmpeg).
Varje fas skriver filer till disk, så du kan köra om bara den fas du ändrat. T.ex.
ändrar du bara geometri eller hastighet behöver du **inte** spela in browsern igen —
bara `compose` om.

---

## 3. Den kritiska regeln: EN geometrikälla

Telefonens position/storlek och – viktigast – **skärm-rektangeln** (där videon läggs
in) definieras på ett enda ställe och delas av både `frames.js` och `compose.js`.
Om de glider isär hamnar videon snett under ramen.

```js
// config.js — höjden låses till den inspelade sidans bildkvot → ingen stretch
const SCREEN_RATIO = PAGE_H / SCREEN.w;

export function geom(variant) {
  // ...skala upp telefonen för mobil-canvas (1080×1920)...
  const screenW = phoneW - 2 * bezel;            // sido-inset = bezel
  const screenH = Math.round(screenW * SCREEN_RATIO); // lås kvot, sträck aldrig
  return {
    canvas, x, y, w, h, status, bezel, radius,
    screenX: x + bezel,      // videon möter ramens innerkant
    screenY: y + status,     // statusbaren ligger ovanför videon
    screenW, screenH,
  };
}
```

### Hörn-fällan (orsakade en synlig bugg)
En video är alltid en **rektangel**. En telefon har **rundade hörn**. Om skärm-
rektangeln fyller hela telefonhöjden sticker videons fyrkantiga hörn ut nedanför
den rundade konturen. Lösning:
- **Sido-inset = bezel** (videons kant göms under ramen).
- **Topp-inset = statusbar**, plus en **balanserad "haka" nedtill** (lås höjden till
  bildkvoten istället för att fylla ut).

Då ligger alla fyra hörn garanterat innanför den rundade plattan.

---

## 4. Inspelningen (`record.js`)

### Mobilkontext — `recordVideo.size` MÅSTE matcha `viewport`
```js
const ctx = await browser.newContext({
  viewport:    { width: SCREEN.w, height: PAGE_H },
  recordVideo: { dir: OUT, size: { width: SCREEN.w, height: PAGE_H } }, // identiskt!
  deviceScaleFactor: 3,        // skarp text/retina
  isMobile: true, hasTouch: true,
  userAgent: "...iPhone...Safari...",
});
```
Matchar de inte letterboxar Playwright videon (innehållet blir ett frimärke i hörnet)
istället för att fylla ramen.

### `addInitScript` — körs före varje sidladdning
Injicera saker som ska gälla hela filmen:
- **Tap-ripples**: en liten cirkel-animation vid varje `pointerdown` → känns mänskligt, inte robot.
- **Göm scrollbars**: `*::-webkit-scrollbar { width:0 }`.
- **Förkonfigurera state**: t.ex. `localStorage.setItem("cookie_consent","all")` så ingen banner dyker upp.

### Göm "dev chrome" — efter navigering, inte i init
Ramverks-overlays (t.ex. Next.js dev-indikatorn, flytande chatt-bubblor) ligger ofta
i shadow-DOM som injiceras sent. Stylesheet-regler i init-scriptet är opålitliga.
Det som fungerar pålitligt:
```js
const hideChrome = () => page.addStyleTag({
  content: "nextjs-portal,[data-next-badge-root]{display:none!important}"
         + "button.fixed.bottom-6.right-6{display:none!important}",
});
// anropa EFTER login/navigering (style:n överlever client-side routing)
```
Använd **klass-/attribut-selektorer**, inte text med specialtecken (unicode-
normalisering kan annars mismatcha, t.ex. svenska "Ö").

### Tidsmarkörer = klippnings-"beats"
Logga en tidsstämpel vid varje meningsfull punkt i flödet:
```js
const t0 = Date.now();
const mark = (name) => marks.push({ name, t: (Date.now()-t0)/1000 });
// ...
await mark("dashboardShown");
```
`compose.js` använder dessa för att rampa hastigheten mellan punkterna. Sparas som
`marks.json` bredvid videon.

### Defensiva flöden (`flows.js`)
- Linda varje beat i en `safe(label, fn)` som loggar varning och **hoppar vidare**
  vid fel istället för att krascha hela tagningen.
- **Aldrig** `waitForLoadState("networkidle")` på sidor med live-polling (chatt,
  dashboards) — de blir aldrig "idle" → 30 s-hängningar. Vänta in **specifika element**.
- **Cappade timeouts** (t.ex. `waitFor({ timeout: 6000 })`) så ett saknat element
  inte hänger i Playwrights default-30 s.

### Mata in värden pålitligt
För React-**kontrollerade** number/text-inputs: använd `fill()` (atomiskt, dispatchar
ett input-event React fångar) — **inte** `pressSequentially`/`type` som kan racea mot
controlled value och timeout:a (gav garbled "402!" i vårt fall). Vill du ha "skriv-
animation" gör det bara på okontrollerade fält. JS-fallback om fill nekas:
```js
await field.fill(String(value), { timeout: 5000 }).catch(() =>
  field.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value)));
```

### Mänsklig scroll
Animera scroll i ~40 små steg mot ett element (inte ett hopp) → ser naturligt ut:
```js
for (let i=1;i<=45;i++){ await page.evaluate(y=>scrollTo(0,y), from+(to-from)*i/45);
                         await page.waitForTimeout(16); }
```

---

## 5. Ram-assets (`frames.js`)

Telefonramen ritas som **HTML + CSS och screenshot:as** av Playwright — ingen extern
mockup-bild behövs, och allt skalar med geometrin.

- `bg.png` — bakgrund (gradient i brandfärger) + telefonens vita "glasplatta" (rundad,
  med skugga). På desktop-varianten även en titel-kolumn bredvid.
- `frame.png` — **transparent** overlay (`omitBackground: true`): bezel-ring (en
  `border` med `border-radius` som täcker videons hörn), statusbar (09:41 + wifi/batteri-
  SVG), Dynamic Island, home-indikator.
- `intro.png` / `outro.png` — brandade titelkort.

Tips:
- Vänta in fonten: `await page.evaluate(() => document.fonts.ready)` innan screenshot,
  annars renderas titelkort med serif-fallback.
- `frames.js` behöver **ingen backend** — kör den fristående för att granska looken.
- Bezel-ringen är bara dekor (täcker hörn) — den **definierar inte** var videon hamnar;
  det gör `screen*` i `geom()`.

---

## 6. Komposition (`compose.js`) — ett enda ffmpeg `filter_complex`

Kärnan: trimma råvideon i segment (ett per beat), sätt hastighet per segment, concat:a,
skala till skärmstorleken, lägg på bakgrund + ram, korsfada in intro/outro.

```
# per segment i: trimma + rampa hastighet
[0:v]trim=start=A:end=B,setpts=(PTS-STARTPTS)/SPEED[s_i]
# limma ihop alla segment
[s0][s1]...concat=n=N:v=1:a=0[cat]
# skala den klippta sidan till skärmrektangeln
[cat]fps=30,scale=screenW:screenH:flags=lanczos,setsar=1[body]
# bakgrund + ram (loopade stillbilder)
[1:v]scale=CANVAS[bg]; [2:v]scale=CANVAS[frm]
[bg][body]overlay=screenX:screenY[c1]      # klistra in sidan i ramens "hål"
[c1][frm]overlay=0:0,format=yuv420p[main]  # ram ovanpå (göm hörn)
# korsfada intro → main → outro
[intro][main]xfade=transition=fade:duration=0.5:offset=...[m1]
[m1][outro]xfade=transition=fade:duration=0.5:offset=...[vout]
```

Hastighets-rampning (`segments.js`): per beat anger du antingen en fast faktor
(`1.15`) eller en mål-längd (`{ dur: 3.2 }` → komprimera intervallet till 3,2 s).
Detta gör att tråkiga väntor klipps bort medan viktiga moment (formulär, grafer) får
andas — utan manuell klippning. En saknad markör hoppas tyst över utan att klippet spricker.

Encode: `libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart` (sista
för snabb webb-uppspelning). Plocka en **poster** en bit in i filmen
(`-ss INTRO+0.8 -frames:v 1`).

---

## 7. Reproducerbarhet

- **DB-rensning före varje tagning**: ta bort förra körningens demo-data (broadcast,
  manuell order, demo-kampanj) via markörnamn så samma konton kan spelas in om och om.
  Hoppa tyst över om DB inte är nåbar.
- **Rate-limits**: rensa t.ex. login-rate-limit-nycklar i Redis före inspelning
  (`redis-cli --scan --pattern 'rl:login:*' | xargs redis-cli del`) så upprepade
  test-logins inte blockeras.
- **Stäng av förhandsvisnings-gates / e-postutskick** via env i demo-miljön.

---

## 8. Output-varianter

- **Mobil (1080×1920, 9:16)** — för webb/sociala. Visas på sajten i en CSS-telefonram
  med `aspect-[9/16]` + `object-cover` (matchar exakt → ingen beskärning).
- **Desktop (1920×1080)** — telefon till höger + titel-kolumn till vänster, för
  presentationer/landningssidor.

Samma `geom(variant)` styr båda; lägg bara till fler varianter i configen.

---

## 9. Checklista — porta till ett nytt projekt

1. Kopiera `scripts/roots-demo/` (config, flows, record, frames, compose, segments, l10n, cleanup).
2. Sätt `BASE_URL`/`API_URL` och **konton/roller** i `config.js`.
3. Justera `SCREEN`/`MOBILE_SCALE` om du vill annan telefonstorlek — rör bara `geom()`.
4. Byt brandfärger/typsnitt i `config.js` + `frames.js`.
5. Skriv `flows.js` mot din produkts selektorer (en `*Flow` per roll, `mark()` vid varje beat).
6. Sätt hastighets-plan i `segments.js` (vilka beats, hur länge).
7. Starta din stack, kör `record → frames → compose` per roll.
8. Granska en bildruta per film (`ffmpeg -ss T -i film.mp4 -frames:v 1 ut.jpg`) innan publicering.

---

## 10. Vanliga fallgropar (och fix)

| Symptom | Orsak | Fix |
|---|---|---|
| Innehåll som frimärke i hörnet | `recordVideo.size` ≠ `viewport` | Lås båda till samma värden |
| Videon snett/utanför ramen | Geometri skiljer mellan frames/compose | Använd alltid `geom()` |
| Videons hörn sticker ut nedtill | Skärm-rekt fyller hela telefonhöjden | Sido-inset = bezel, lås höjd till bildkvot, haka nedtill |
| Garbled inmatning, timeouts | `pressSequentially` racar controlled input | Använd `fill()` + JS-fallback |
| 30 s-hängningar | `networkidle` på live-pollande sida | Vänta in specifika element, cappa timeouts |
| Dev-overlay/chatt syns | Shadow-DOM injiceras sent | `page.addStyleTag` efter navigering, klass-selektor |
| Serif-titelkort | Fonten ej laddad | `await document.fonts.ready` före screenshot |
| Data ackumuleras | Ingen rensning mellan tagningar | DB-cleanup + rate-limit-rensning före inspelning |
