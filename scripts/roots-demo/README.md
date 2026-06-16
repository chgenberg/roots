# Roots demofilmer — Playwright + ffmpeg

Reproducerbara instruktions-/reklamfilmer som visar hur enkelt en förening
tjänar pengar med Roots. Inget spelas in manuellt: vi kör de **riktiga**
flödena i Playwright (mobilkontext), loggar tidsmarkörer vid varje "beat",
renderar telefonramen som egna bilder och låter ffmpeg klippa ihop allt med
hastighets-rampning. Resultatet ser ut som en proffsig iPhone-skärminspelning.

Manus för de tre filmerna: [`docs/demo-films/MANUS.md`](../../docs/demo-films/MANUS.md).

| Film | role-argument | Konto |
|------|---------------|-------|
| Säljare / medlem | `seller` | `felicia.assoc@demo-if.se` |
| Förening | `forening` | `forening@demo-if.se` |
| Lagledare / klubbledare | `lag` | `lag@demo-if.se` |

## Tre steg, tre filer

```
record.js   → out/<role>/<locale>/raw.webm + marks.json
frames.js   → out/<role>/<locale>/<variant>/bg.png, frame.png, intro.png, outro.png
compose.js  → out/<role>/<locale>/<variant>/<role>-demo.mp4 (+ poster.jpg)
```

Geometrin (telefonens position/storlek) ligger på ETT ställe — `geom()` i
`config.js` — och delas av `frames.js` och `compose.js`.

## Förutsättningar

- **Playwright + Chromium** — finns i repo-roten (`playwright@^1.59`). Vid behov:
  `npx playwright install chromium`
- **ffmpeg** i PATH (`ffmpeg -version`).
- **`pg`** (valfritt) för automatisk DB-rensning mellan tagningar.
- **Roots-stacken igång** för `record.js` (web `:3004`, api `:4000`, seedad DB):

```bash
# i repo-roten
docker compose up -d postgres redis
cp .env.example .env      # sätt PREVIEW_GATE_DISABLED=true + FEATURE_EMAIL_DISABLED=true
pnpm db:migrate && pnpm db:seed && pnpm db:seed:demo
pnpm dev                  # web 3004, api 4000
```

> **Viktigt:** sätt `PREVIEW_GATE_DISABLED=true` i `.env` så en ren browser når
> sidorna utan förhandsvisningslösenord. Utan det fastnar inloggningen.

## Körordning

```bash
cd scripts/roots-demo

# Film 1 — säljare
node record.js  seller        # → out/seller/sv/raw.webm + marks.json
node frames.js  seller        # → out/seller/sv/desktop/*.png
node compose.js seller        # → out/seller/sv/desktop/seller-demo.mp4 + poster.jpg

# mobil-variant (1080×1920)
node frames.js  seller sv mobile && node compose.js seller sv mobile

# Film 2 + 3
node record.js forening && node frames.js forening && node compose.js forening
node record.js lag      && node frames.js lag      && node compose.js lag
```

`frames.js` behöver **ingen** backend — den renderar bara ram-assets och kan
köras direkt för att granska look & feel.

## Konfiguration via env

| Variabel | Default | Notis |
|----------|---------|-------|
| `BASE_URL` | `http://localhost:3004` | Webbappen |
| `API_URL` | `http://localhost:4000` | API:t |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/roots` | För rensning |

## Reproducerbarhet

`record.js` kör en best-effort DB-rensning (`cleanup.js`) före varje tagning som
tar bort förra körningens demo-data: lag-broadcast, manuell order
(`Demofilm-kund`) och demofilm-kampanjen. Därför kan samma konton spelas in om
och om igen utan att data ackumuleras. Rensningen hoppas tyst över om `pg`
saknas eller DB inte är nåbar.

## Felsökning

- **Innehållet hamnar som ett frimärke i hörnet** → `recordVideo.size` matchar
  inte `viewport`. De är låsta till `SCREEN.w` × `PAGE_H` i `config.js` — ändra
  bara på ett ställe.
- **Videon ligger snett under ramen** → geometrin skiljer mellan frames/compose.
  Båda använder `geom()`; ändra aldrig värden lokalt.
- **Titelkort renderas med serif-fallback** → fonten hann inte ladda. `frames.js`
  väntar in `document.fonts.ready`; kräver internet för Google Fonts.
- **Inloggning fastnar** → `PREVIEW_GATE_DISABLED=true` saknas, eller fel
  `BASE_URL`.
- **En beat hoppas över i loggen** → elementet hittades inte (UI-text ändrad).
  Markören sätts ändå; uppdatera selektorn i `flows.js`.
