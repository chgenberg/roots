"""Bygger föreningspitchen (index.html) till ~/Desktop/Roots-Foreningspitch.

Källor: docs/presentations/foreningspitch/{index.html,css,js}.
Typsnitt subsettas till woff2 (kräver fonttools+brotli, ange python via FT_PY).
Paketeras med Brandbook-agentens verktyg/paketera.sh till en enkelfil + zip.

    python3 docs/presentations/build_foreningspitch.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/presentations/foreningspitch"
PUB = ROOT / "apps/web/public"
SKARM = ROOT / "docs/presentations/_assets/skarm"
OUT = Path.home() / "Desktop/Roots-Foreningspitch"
AGENT = Path.home() / (
    "Library/Mobile Documents/com~apple~CloudDocs/GENBERG kodning 2025/"
    "Agent skript/Brandbook-agent"
)
FT_PY = os.environ.get("FT_PY", "/tmp/ftenv/bin/python")

INK = (29, 29, 27)
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+2009,U+2013-2014,U+2018-201D,U+2026,"
    "U+202F,U+2190-2193,U+2212,U+2248"
)
FONTS = {
    "AlanSans-SemiBold": PUB / "fonts/alan-sans/AlanSans-SemiBold.ttf",
    "AlanSans-Medium": PUB / "fonts/alan-sans/AlanSans-Medium.ttf",
    "Inter-Regular": PUB / "fonts/inter/Inter_18pt-Regular.ttf",
    "Inter-Medium": PUB / "fonts/inter/Inter_18pt-Medium.ttf",
    "Inter-Italic": PUB / "fonts/inter/Inter_18pt-Italic.ttf",
}


def fonts(dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for name, src in FONTS.items():
        subprocess.run(
            [FT_PY, "-m", "fontTools.subset", str(src),
             f"--unicodes={UNICODES}", "--flavor=woff2",
             "--layout-features=kern,liga,calt,tnum,case",
             f"--output-file={dst / (name + '.woff2')}"],
            check=True,
        )


def ink_on_alpha(alpha: Image.Image) -> Image.Image:
    im = Image.new("RGBA", alpha.size, INK + (0,))
    im.putalpha(alpha)
    return im.crop(alpha.getbbox())


def logo(dst: Path) -> None:
    alpha = Image.open(PUB / "brand/roots-logo-black.png").convert("RGBA").getchannel("A")
    ink = ink_on_alpha(alpha)
    ink.thumbnail((440, 440), Image.LANCZOS)
    ink.save(dst / "logo.png", optimize=True)


def symbol(dst: Path) -> None:
    """Skottet är urtaget ur symbolens svarta cirkel; det blir en egen mask."""
    src = Image.open(PUB / "brand/roots-symbol-black.png").convert("RGBA")
    alpha = src.getchannel("A")
    x0, y0, x1, y1 = alpha.getbbox()
    disc = Image.new("L", src.size, 0)
    inset = (x1 - x0) * 0.02
    ImageDraw.Draw(disc).ellipse((x0 + inset, y0 + inset, x1 - inset, y1 - inset), fill=255)
    sprout = ink_on_alpha(ImageChops.subtract(disc, alpha))
    sprout.thumbnail((240, 240), Image.LANCZOS)
    sprout.save(dst / "skott.png", optimize=True)

    fav = src.crop((x0, y0, x1, y1))
    fav.thumbnail((128, 128), Image.LANCZOS)
    fav.save(dst / "symbol.png", optimize=True)


def crop_ratio(im: Image.Image, ratio: float, cx: float = .5, cy: float = .5, zoom: float = 1.0) -> Image.Image:
    w, h = im.size
    cw = min(w, h * ratio) / zoom
    ch = cw / ratio
    left = min(max(0, w * cx - cw / 2), w - cw)
    top = min(max(0, h * cy - ch / 2), h - ch)
    return im.crop((round(left), round(top), round(left + cw), round(top + ch)))


def extend_to_portrait(im: Image.Image) -> Image.Image:
    """3:4 utan att skära flaskor: studiobakgrunden förlängs uppåt och nedåt."""
    w, h = im.size
    th = round(w * 4 / 3)
    top = (th - h) // 2
    out = Image.new("RGB", (w, th))
    out.paste(im.crop((0, 0, w, 1)).resize((w, top)), (0, 0))
    out.paste(im, (0, top))
    out.paste(im.crop((0, h - 1, w, h)).resize((w, th - h - top)), (0, top + h))
    return out


def jpg(im: Image.Image, path: Path, max_w: int) -> None:
    im = im.convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=84, optimize=True, progressive=True)


def images(dst: Path) -> None:
    img = PUB / "images"
    jpg(crop_ratio(Image.open(img / "roots-home-hero-s.jpg"), 2.0, cy=.56), dst / "fig1-paket.jpg", 1600)
    jpg(crop_ratio(Image.open(img / "club-youth-selling.png"), 2.0, cy=.42), dst / "fig2-lag.jpg", 1600)

    # Bara toppen: produktkorten längre ned visar inaktuella priser.
    shop = Image.open(SKARM / "shop-start.png")
    jpg(shop.crop((0, 0, shop.width, 770)), dst / "fig3-shop.jpg", 828)
    jpg(Image.open(SKARM / "lag-saljare.png"), dst / "fig4-lag.jpg", 1400)
    jpg(Image.open(SKARM / "forening-oversikt.png"), dst / "fig5-forening.jpg", 1400)

    for name, src in [
        ("p-schampo", "roots-shampoo-studio-s.jpg"),
        ("p-conditioner", "roots-conditioner-studio-w.jpg"),
        ("p-bodywash", "roots-body-wash-studio-w.jpg"),
    ]:
        jpg(crop_ratio(Image.open(img / src), .75, cy=.52, zoom=1.12), dst / f"{name}.jpg", 720)
    jpg(extend_to_portrait(Image.open(img / "roots-collection-studio-s.jpg").convert("RGB")), dst / "p-paket.jpg", 720)


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns(".DS_Store"))
    fonts(OUT / "fonts")
    (OUT / "images").mkdir(exist_ok=True)
    logo(OUT / "images")
    symbol(OUT / "images")
    images(OUT / "images")
    subprocess.run(["zsh", str(AGENT / "verktyg/paketera.sh"), str(OUT)], check=True)


if __name__ == "__main__":
    main()
