# Sprint E14 — Brand asset wiring

Follow-up to **E13** (palette + typography). E13 swapped the colour
tokens and self-hosted Inter + Alan Sans. E14 wires the *actual*
brand-kit assets — the hand-drawn organic logotype, the seal symbol
and the grass/roots element — into the surfaces where they live.

> Why a separate sprint: the E13 review surfaced that the header was
> rendering "ROOTS" as Alan Sans text, but the brandbook's mark is a
> handwritten illustration, not a font setting. Same applied to the
> 404 page, the loading skeletons and the footer's plain wordmark.

---

## Scope delivered

| # | Item | Outcome |
|---|------|---------|
| A | Real logotype in header & footer | `<RootsLogo />` swapped in, text removed |
| B | Grass/roots element as decoration | `<RootsGrassDivider />` on hero + above footer |
| C | Brand symbol in 404 + loading-states | `<RootsSymbol />` + `<RootsLoader />` |
| E | Heading hierarchy per brandbook | `h1` ExtraBold 800, `h2` Bold 700, `h3` SemiBold 600, optical tracking per level |
| F | Auto-switch logo colour vs background | Header picks white/black based on `(onDarkHero && !scrolled)` |

---

## New surface area

### `apps/web/src/components/brand.tsx`

Single source of truth for brand-asset React components.

| Export | Use |
|--------|-----|
| `<RootsLogo variant="black"\|"white"\|"dark" />` | Wordmark — header, footer, emails |
| `<RootsSymbol variant=… />` | Square seal — favicons, avatars, 404, OG overlays |
| `<RootsGrassDivider variant="dark"\|"light"\|"neutral" />` | Decorative bottom band — heroes, footer eyebrow |
| `<RootsLoader />` | Branded loading-state replacing generic ring spinner |

All three components use `next/image` so the 4K PNG sources are
served as optimised webp/avif by Next at the right pixel ratio. No
component ever serves the raw PNG to the browser.

### Asset paths

```
apps/web/public/brand/
  roots-logo-{black,dark,white}.png      ← wordmark
  roots-symbol-{black,dark,white}.png    ← seal
  roots-element-{dark,light,neutral}.png ← grass element
```

The kit lives untouched in `public/Roots_lev/`. We copied only the
finished web exports into `apps/web/public/brand/` to keep the served
asset surface minimal.

---

## Behaviour notes

### Header logo colour-switch (item F)

```ts
const DARK_HERO_ROUTES = new Set(["/", "/foreningsliv", "/produkter", "/om-oss"]);
const onDarkHero = DARK_HERO_ROUTES.has(pathname) || pathname.startsWith("/produkter/");
const logoVariant = (menuOpen || (onDarkHero && !scrolled)) ? "white" : "black";
```

- **At top of `/`, `/foreningsliv`, `/produkter`, `/om-oss`, `/produkter/[slug]`** — header is transparent over a dark hero photo → white logo.
- **After scrolling** — header has the translucent light backdrop → black logo.
- **All other routes** (`/integritet`, `/kontakt`, `/portal/*`, `/shop/*`, …) — light surface from frame 1 → black logo always.
- **Mobile menu open** — full ink panel → white logo regardless of route.

### Grass element placement

| Where | Variant | Reasoning |
|-------|---------|-----------|
| Hero section, bottom edge | `neutral` @ `opacity-50` | Sits on the photo; opacity prevents heavy line against the headline |
| Above footer | `dark` | Sand-50 strip background; dark element reads as a horizon |

### Loading states

All three `loading.tsx` files (`(marketing)`, `(portal)`, `(shop)`)
now render `<RootsLoader />`, which is the symbol pulsing on the
existing `--animate-subtle-pulse` keyframe (already in `globals.css`).
Respects `prefers-reduced-motion` via the existing global rule.

### Heading hierarchy (item E)

```css
h1 { font-weight: 800; letter-spacing: -0.025em; line-height: 1.05; }
h2 { font-weight: 700; letter-spacing: -0.018em; line-height: 1.10; }
h3 { font-weight: 600; letter-spacing: -0.012em; line-height: 1.20; }
h4 { font-weight: 600; letter-spacing: -0.008em; line-height: 1.30; }
h5, h6 { font-weight: 600; letter-spacing: -0.005em; line-height: 1.35; }
.font-display { letter-spacing: -0.015em; }
```

Stepped tracking compensates for Alan Sans's optical widening at
larger sizes, matching the brandbook display examples.

---

## What we did **not** touch

- Existing imagery (`public/images/*`) — kept as the user explicitly
  asked.
- Component-level styling — by using semantic tokens (`bg-brand-50`,
  `text-foreground`, etc.) the E13 remap means E14 needed zero
  changes to individual UI components.
- Open Graph / metadata images — favicon was already updated to
  `roots-symbol-dark.png` in E13; OG image swap is a future sprint.

---

## Validation

- `pnpm -F @roots/web typecheck` — clean.
- `pnpm -F @roots/web build` — clean, all routes built.
- `pnpm test` — 102/102 green.
