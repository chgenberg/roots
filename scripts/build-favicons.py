#!/usr/bin/env python3
"""
Generate favicon + app-icon files from the brandbook symbol.

    .venv/bin/python3 scripts/build-favicons.py

The brand source (`apps/web/public/brand/roots-symbol-dark.png`) is a
4000x4000 PNG. Pointing <link rel="icon"> straight at it technically works
but Safari often refuses to draw a 16-megapixel PNG as a tab icon, and it
makes every visitor download 130 kB for a 16px slot. So we pre-render the
sizes browsers actually ask for.

The source also carries ~14% transparent padding, which would shrink the
mark to illegibility at 16px. We trim to the content box and add back a
small, deliberate margin.

Apple wants its touch icon opaque — iOS composites transparency onto black,
which would turn the cream circle into a muddy ring — so that one gets the
brand off-white behind it.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "apps" / "web" / "public" / "brand" / "roots-symbol-dark.png"
PUBLIC = ROOT / "apps" / "web" / "public"
ICON_DIR = PUBLIC / "icons"

# Brandbook's warmest off-white (--color-brand-50 in globals.css).
APPLE_BG = (250, 246, 239, 255)

# Breathing room around the mark, as a share of the trimmed size. Small
# enough that the circle still reads as a circle at 16px, large enough that
# it doesn't look clipped against a tab's edge.
MARGIN_RATIO = 0.04

FAVICON_SIZES = [16, 32, 48]
PNG_SIZES = [32, 192, 512]
APPLE_SIZE = 180


def trimmed_symbol() -> Image.Image:
    """The symbol cropped to its content, with a small even margin."""
    im = Image.open(SOURCE).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit(f"{SOURCE} appears to be fully transparent")
    mark = im.crop(bbox)

    margin = round(max(mark.size) * MARGIN_RATIO)
    side = max(mark.size) + margin * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(
        mark,
        ((side - mark.width) // 2, (side - mark.height) // 2),
        mark,
    )
    return canvas


def resize(mark: Image.Image, size: int) -> Image.Image:
    return mark.resize((size, size), Image.LANCZOS)


def main() -> None:
    mark = trimmed_symbol()
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    ico = PUBLIC / "favicon.ico"
    resize(mark, max(FAVICON_SIZES)).save(
        ico, format="ICO", sizes=[(s, s) for s in FAVICON_SIZES]
    )
    print(f"✓ {ico.relative_to(ROOT)} ({', '.join(f'{s}x{s}' for s in FAVICON_SIZES)})")

    for size in PNG_SIZES:
        out = ICON_DIR / f"icon-{size}.png"
        resize(mark, size).save(out, format="PNG", optimize=True)
        print(f"✓ {out.relative_to(ROOT)}")

    apple = Image.new("RGBA", (APPLE_SIZE, APPLE_SIZE), APPLE_BG)
    inner = round(APPLE_SIZE * 0.78)
    scaled = resize(mark, inner)
    offset = (APPLE_SIZE - inner) // 2
    apple.paste(scaled, (offset, offset), scaled)
    apple_path = ICON_DIR / "apple-touch-icon.png"
    apple.convert("RGB").save(apple_path, format="PNG", optimize=True)
    print(f"✓ {apple_path.relative_to(ROOT)} ({APPLE_SIZE}x{APPLE_SIZE}, opaque)")


if __name__ == "__main__":
    main()
