# Sprint E13 — Brandbook refresh

Implementerar marknadsbyråns brandbook (`public/Roots_lev/`, Maj 2026)
över hela sajten utan att tappa den minimalism vi har byggt upp.
Genomförandet är **additivt** — istället för att döpa om hundratals
komponentklasser remappas befintliga `--color-brand-*`-tokens
in-place. Allt UI som redan använder dem (knappar, badges, grader,
milstolpar, dashboards) plockar automatiskt upp de nya färgerna.

## Källmaterial

| Mapp | Innehåll | Användning |
|------|----------|------------|
| `public/Roots_lev/Fonts/Inter/` | 5 TTF (Light/Regular/Italic/Medium/Bold) | Body |
| `public/Roots_lev/Fonts/AlanSans/` | 6 TTF (Light–Black) | Rubrik & accent |
| `public/Roots_lev/Logo/` | PNG + EPS (black/dark/light/white) | Brandmärken |
| `public/Roots_lev/Symbol/` | PNG + EPS (4 varianter) | Favicon + dekoration |
| `public/Roots_lev/Element/` | PNG + EPS (dark/light/neutral) | Subtle hero-dekor |
| `_Roots_identitet_0521.pdf` | 8-sidors PDF | Färg + typografi-spec |

Brandbookens färgspec (HEX, hämtade från PDF s. 3):

**Basfärger**
- Sand light `#D5CABF` · Sand med `#B2A491` · Sand dark `#7F715B`
- Ink `#1D1D1B` · White `#FFFFFF`

**Sekundärfärger**
- Forest `#6B794F` · Olive `#C1BF99`
- Sky `#A7BBC5` · Sun `#ECD488`
- Rose `#E3A1A0` · Terracotta `#E18754`

## Mappning till befintlig token-skala

Den gamla paletten var en kall mocka-brun ramp `#1C1410 → #F5F3F1`
som upplevdes som "kontor". Den nya rampen är varm sand som kröns av
Forest som primär accent — exakt den signalfärg brandbooken vilar på.

| Token | Före | Efter | Roll |
|-------|------|-------|------|
| `--color-brand-900` | `#1C1410` | `#1D1D1B` | Ink (text + primary) |
| `--color-brand-800` | `#2A1F18` | `#7F715B` | Sand-dark |
| `--color-brand-700` | `#3B2D22` | **`#6B794F`** | **Forest** — primär accent |
| `--color-brand-600` | `#4A372C` | `#8B7E69` | Mid sand |
| `--color-brand-500` | `#6B5344` | `#B2A491` | Sand-medium |
| `--color-brand-400` | `#8C7466` | `#C1BF99` | Olive |
| `--color-brand-300` | `#B5A89E` | `#D5CABF` | Sand-light |
| `--color-brand-200` | `#D4CCC4` | `#E5DDD2` | Sand tint |
| `--color-brand-100` | `#E8E4E0` | `#F1EBE2` | Light sand |
| `--color-brand-50`  | `#F5F3F1` | `#FAF6EF` | Warm off-white |
| `--color-success`   | `#2F4A3C` | `#6B794F` | Forest (matchar brand-700) |
| `--color-destructive` | `#8C2F2F` | `#C76A50` | Mörk terracotta |
| `--color-muted-foreground` | `#6B5344` | `#7F715B` | Sand-dark |
| `--color-border` | `#E8E4E0` | `#E5DDD2` | Sand tint |

### Nya additiva tokens

Sekundärfärgerna får egna namn så framtida komponenter slipper
hitta-på dem själva:

```css
--color-accent-forest:     #6B794F;
--color-accent-olive:      #C1BF99;
--color-accent-sky:        #A7BBC5;
--color-accent-sun:        #ECD488;
--color-accent-rose:       #E3A1A0;
--color-accent-terracotta: #E18754;
```

Använd via `bg-accent-sky`, `text-accent-terracotta`, etc.

## Typografi

Brandbookens uppdelning: **Alan Sans** för rubriker, **Inter** för
brödtext. Inga ändringar i Google Font-laddning — båda körs nu via
`next/font/local` så filerna lever i repon (GDPR-säkert, snabbare
första-renderad, immun mot Google-uppdateringar).

### Wiring

1. `apps/web/src/lib/fonts.ts` exponerar `inter` och `alanSans`
   med variabel-namnen `--font-inter` och `--font-alan-sans`.
2. `apps/web/src/app/layout.tsx` sätter båda variablerna på `<html>`.
3. `apps/web/src/app/globals.css` definierar:
   ```css
   --font-sans:    var(--font-inter), ui-sans-serif, system-ui, …;
   --font-display: var(--font-alan-sans), var(--font-inter), …;
   ```
4. `<body>` får `font-sans` så all löpande text går till Inter.
5. Global CSS-regel sätter `h1–h6` + `.font-display` → Alan Sans
   med `letter-spacing: -0.015em`.

### Vikter exponerade

| Familj | Vikter |
|--------|--------|
| Inter | 300 / 400 / 400-italic / 500 / 700 |
| Alan Sans | 300 / 500 / 600 / 700 / 800 / 900 |

## Logo

Vi behåller **text-logotype** i header (minimalism > bitmap) men nu i
**Alan Sans Bold UPPERCASE** med wide tracking (`0.18em`). Lokala
heuristic: Alan Sans display-letters strammar åt optiskt vid större
storlek, så positiv tracking läses som ett varumärkesmärke snarare
än ett vanligt ord.

PNG-versionerna ligger i `apps/web/public/brand/` för framtida
användning (footer-watermark, packlistor, e-postmallar, OG-overlays):

```
apps/web/public/brand/
├─ roots-logo-{black,dark,white}.png
├─ roots-symbol-{black,dark,white}.png   ← använd för favicon
└─ roots-element-{dark,light,neutral}.png ← subtle hero-dekoration
```

## Favicon + ikoner

`apps/web/src/app/layout.tsx` `metadata.icons` pekar nu på
`/brand/roots-symbol-dark.png` (4000×4000 källa). Next.js resizar
automatiskt för varje slot:

- `icon` → browser tab
- `apple` → iOS home screen
- `shortcut` → äldre Windows

## Dark mode

Brandbookens basläge är ljust. Vi behåller mörkt läge men håller det
i samma färgvärld:

- Bakgrunder: `#1A1815` → `#221F1B` → `#2D2823` (varma ink-toner,
  inte kall grå)
- Text: `#F1EBE2` (warm cream, inte ren vit)
- Brand-700 lyfts till `#8FA065` så Forest fortfarande är läsbar mot
  mörk yta (AA-kontrast)
- Sand-300 blir text-accent (`#7F715B`) som funkar både som CTA-ram
  och som muted text i mörker

## Vad som INTE ändrades

- **Bilderna** på sajten (hero, produkter, lifestyle) — användaren
  bad explicit att behålla dem.
- **Layout, spacing, motion** — alla animations- och spacing-tokens
  rörs inte. Endast färg + typografi.
- **Komponentkoden** — eftersom vi remappar `brand-*` in-place fick
  vi en zero-touch refresh för dashboards, formulär, badges,
  milestone-grader, shop-kort osv.

## Verifiering

```
pnpm -r build      # apps/web kompilerar med nya local fonts
pnpm -r typecheck  # (pre-existing bankid-typing kvar från E11)
pnpm -r test       # 102/102 API + 20/20 DB
```

Manuell visuell verifiering rekommenderas på:
- `/` (hero — h1 ska vara Alan Sans, kropp Inter)
- `/portal/dashboard` (grön accent ska kännas naturlig, inte brun)
- `/min-shop` (sellergrade-badges använder Forest istället för Mocha)
- Dark mode toggle (warm ink, inte cold grey)
