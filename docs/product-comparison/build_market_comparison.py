#!/usr/bin/env python3
"""Bygger Roots_Prisjamforelse_Marknaden.pdf — hur Roots Schampoo, Conditioner
och Body Wash prissätts mot nio konkurrerande produkter på den svenska
marknaden. A4 stående, samma brandspråk som docs/comparison-newbody.

Källor (hämtade 2026-08-06, ordinarie/rekommenderat pris exkl. kampanjrabatt,
så jämförelsen inte bygger på en tillfällig rea):

  Roots        Rekommenderad prisstrategi — Schampo 199 / Conditioner 199 /
               Body Wash 179 kr (250 ml). Paket: Basic 299 / Premium 399 /
               Exclusive 499. Produktbilder: apps/web/public/images/sport-*.
  Maria Nila   marianila.se — True Soft Shampoo/Conditioner 319 kr, 350 ml.
  Sachajuan    kicks.se, parfym.se — Moisturizing Shampoo 329 kr (250 ml),
               Moisturizing Conditioner rek. pris 345 kr (250 ml).
  Davines      lyko.com — Essential Minu Shampoo 329 kr / Conditioner 349 kr,
               250 ml (styckpriser ur samma paketlistning).
  Estelle&Thild ecco-verde.se, apotekhjartat.se — Citrus Menthe Body Wash
               207 kr, 200 ml. Svenskt, COSMOS Organic-certifierat.
  L'Occitane   lyko.com — Verbena Shower Gel 219 kr, 250 ml.
  Verso        kicks.se, hudoteket.se, cowparfymeri.se — Body Oil Cleanser
               600 kr, 300 ml (tre oberoende återförsäljare, samstämmigt).

Maria Nila, Sachajuan och Davines är de tre märken FORMULATIONS.md själv pekar
ut som jämförelsenorm ("ledande naturliga märken") för schampo/balsam — så
det är inte en jämförelse mot ett halmgubbe-billigt märke, utan mot den nivå
Roots är formulerad för att mäta sig med.

Alla kronor/100 ml är uträknade härifrån, inte kopierade från någon butik —
se _per100 nedan. Körs med:

    python3 docs/product-comparison/build_market_comparison.py
"""
import glob
import os
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch
import matplotlib.image as mpimg

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))
IMG = os.path.join(WEB, "images")
OUT = os.path.join(ROOT, "Roots_Prisjamforelse_Marknaden.pdf")

# ── Brand (samma tokens som docs/comparison-newbody) ────────────────────
INK = "#1D1D1B"
FOREST = "#6B794F"
FOREST_SOFT = "#EDF1E9"
SAND_DARK = "#7F715B"
SAND_MED = "#B2A491"
SAND_LIGHT = "#D5CABF"
SAND_100 = "#F1EBE2"
OFFWHITE = "#FAF6EF"
WHITE = "#FFFFFF"
TERRA = "#E18754"
TERRA_SOFT = "#FBEFE9"
SUN = "#ECD488"
OLIVE = "#C1BF99"

for f in glob.glob(os.path.expanduser("~/Library/Fonts/AlanSans*.ttf")) + \
         glob.glob(os.path.expanduser("~/Library/Fonts/Inter_18pt*.ttf")):
    fm.fontManager.addfont(f)

HEAD = "Alan Sans"
BODY = "Inter 18pt"
plt.rcParams["pdf.fonttype"] = 42

PAGE_W, PAGE_H = 8.27, 11.69
XMAX, YMAX = 827, 1169
MX = 60
TOTAL = 7

# ═══════════════════════════════ Data ══════════════════════════════════
# pris = ordinarie/rekommenderat pris (inte kampanjpris), så jämförelsen
# håller även den dag konkurrentens rea tar slut.
ROOTS = {
    "schampo": {"namn": "Roots Schampoo", "ml": 250, "pris": 199,
                "funktion": "Sulfatsnålt · SyriCalm®",
                "bild": "sport-schampoo.jpg"},
    "balsam": {"namn": "Roots Conditioner", "ml": 250, "pris": 199,
               "funktion": "Panthenol · SyriCalm®",
               "bild": "sport-conditioner.jpg"},
    "body_wash": {"namn": "Roots Body Wash", "ml": 250, "pris": 179,
                  "funktion": "Sulfatsnålt · SyriCalm®",
                  "bild": "sport-body-wash.jpg"},
}

PAKET = [
    {"namn": "Basic", "pris": 299, "beskrivning": "Ingång — två produkter"},
    {"namn": "Premium", "pris": 399, "beskrivning": "Hela rutinen"},
    {"namn": "Exclusive", "pris": 499, "beskrivning": "Utökat erbjudande"},
]

KATEGORIER = [
    ("schampo", "SCHAMPO", [
        {"varumarke": "Maria Nila", "namn": "True Soft Shampoo", "ml": 350,
         "pris": 319, "land": "Sverige", "kalla": "marianila.se",
         "funktion": "Sulfatfritt · torrt hår"},
        {"varumarke": "Sachajuan", "namn": "Moisturizing Shampoo", "ml": 250,
         "pris": 329, "land": "Sverige", "kalla": "kicks.se",
         "funktion": "Ocean Silk"},
        {"varumarke": "Davines", "namn": "Essential Minu Shampoo", "ml": 250,
         "pris": 329, "land": "Italien", "kalla": "lyko.com",
         "funktion": "Färgskydd"},
    ]),
    ("balsam", "BALSAM", [
        {"varumarke": "Maria Nila", "namn": "True Soft Conditioner", "ml": 350,
         "pris": 319, "land": "Sverige", "kalla": "marianila.se",
         "funktion": "Sulfatfritt · torrt hår"},
        {"varumarke": "Sachajuan", "namn": "Moisturizing Conditioner", "ml": 250,
         "pris": 345, "land": "Sverige", "kalla": "parfym.se",
         "funktion": "Återfuktning"},
        {"varumarke": "Davines", "namn": "Essential Minu Conditioner", "ml": 250,
         "pris": 349, "land": "Italien", "kalla": "lyko.com",
         "funktion": "Färgskydd"},
    ]),
    ("body_wash", "BODY WASH", [
        {"varumarke": "Estelle & Thild", "namn": "Citrus Menthe Body Wash",
         "ml": 200, "pris": 207, "land": "Sverige", "kalla": "ecco-verde.se",
         "funktion": "COSMOS Organic"},
        {"varumarke": "L'Occitane", "namn": "Verbena Shower Gel", "ml": 250,
         "pris": 219, "land": "Frankrike", "kalla": "lyko.com",
         "funktion": "Verbena · citrus"},
        {"varumarke": "Verso", "namn": "Body Oil Cleanser", "ml": 300,
         "pris": 600, "land": "Sverige", "kalla": "kicks.se, hudoteket.se",
         "funktion": "BHA · exfolierande"},
    ]),
]

KAT_LABEL = {"schampo": "Schampo", "balsam": "Balsam", "body_wash": "Body wash"}


def per100(pris, ml):
    return pris / ml * 100


def pct_lower(dyr, billig):
    return (dyr - billig) / dyr * 100


def sv_num(v, decimals=1):
    return f"{v:.{decimals}f}".replace(".", ",")


# Förberäknat: pris/100 ml och snitt per kategori.
for _, _, konk in KATEGORIER:
    for k in konk:
        k["per100"] = per100(k["pris"], k["ml"])
for key in ROOTS:
    ROOTS[key]["per100"] = per100(ROOTS[key]["pris"], ROOTS[key]["ml"])

SNITT = {}
DYRAST = {}
BILLIGAST = {}
for key, _, konk in KATEGORIER:
    vals = [k["per100"] for k in konk]
    SNITT[key] = sum(vals) / len(vals)
    DYRAST[key] = max(konk, key=lambda k: k["per100"])
    BILLIGAST[key] = min(konk, key=lambda k: k["per100"])

# Hela rutinen: 3 × 250 ml till snittkonkurrenternas pris/100 ml.
RUTIN_KONKURRENT = sum(SNITT[k] * 2.5 for k in SNITT)
RUTIN_ROOTS_LOS = sum(ROOTS[k]["pris"] for k in ROOTS)
RUTIN_ROOTS_PAKET = 399  # Premiumpaketet — rekommenderad huvudprodukt
PAKET_SPARNAD = RUTIN_ROOTS_LOS - RUTIN_ROOTS_PAKET


# ═══════════════════════════════ Hjälpare ══════════════════════════════
def new_page(bg=OFFWHITE):
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, XMAX)
    ax.set_ylim(0, YMAX)
    ax.axis("off")
    fig.patch.set_facecolor(bg)
    return fig, ax


def rounded(ax, x, y, w, h, fc, ec=None, lw=1.2, r=14, z=2):
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad=0,rounding_size={r}",
                       fc=fc, ec=ec or fc, lw=lw, zorder=z)
    ax.add_patch(p)
    return p


def chip_width(text, size=7.6, pad_x=9):
    # 0.82 täcker svenska tecken (å/ä/ö) bättre än snävare uppskattning.
    return pad_x * 2 + len(text) * size * 0.82


def chip(ax, x, y, text, fc, tc=WHITE, size=7.6, z=4, pad_x=9, h=22):
    w = chip_width(text, size=size, pad_x=pad_x)
    rounded(ax, x, y, w, h, fc, r=h / 2, z=z)
    # Lite nedåt: matplotlibs va="center" sitter oftast en aning högt i runda chips.
    ax.text(x + w / 2, y + h / 2 - 0.8, text, ha="center", va="center",
            fontfamily=BODY, fontsize=size, fontweight="bold", color=tc, zorder=z + 1)
    return w


def chip_centered(ax, cx, y, text, fc, tc=WHITE, size=7.6, z=4, pad_x=9, h=22):
    w = chip_width(text, size=size, pad_x=pad_x)
    return chip(ax, cx - w / 2, y, text, fc, tc=tc, size=size, z=z, pad_x=pad_x, h=h)


def wrap(text, width):
    return textwrap.wrap(text, width=width)


def footer(ax, page_no):
    ax.plot([MX, XMAX - MX], [56, 56], color=SAND_LIGHT, lw=1)
    ax.text(MX, 38, "Roots Nordic · Prisjämförelse mot den svenska marknaden",
            fontfamily=BODY, fontsize=7.6, color=SAND_MED, va="center")
    ax.text(XMAX - MX, 38, f"{page_no} / {TOTAL}", ha="right", fontfamily=BODY,
            fontsize=7.6, color=SAND_MED, va="center")


def header(ax, kicker, title, subtitle=None, wrap_width=78, thumb=None):
    """thumb = optional (path, size) drawn top-right; subtitle wraps shorter if set."""
    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-black.png"))
    lh = 34
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(MX, MX + lw, YMAX - 92, YMAX - 92 + lh),
              aspect="auto", zorder=5)

    tw = th = 0
    if thumb:
        tpath, tw = thumb if isinstance(thumb, tuple) else (thumb, 108)
        th = tw
        place_image(ax, tpath, XMAX - MX - tw, YMAX - 92 - th + 34, tw, th, z=5)

    ax.text(MX, YMAX - 132, kicker.upper(), fontfamily=BODY, fontsize=8.4,
            fontweight="bold", color=FOREST, va="top")
    ax.text(MX, YMAX - 152, title, fontfamily=HEAD, fontsize=22 if tw else 23,
            fontweight="bold", color=INK, va="top")
    y = YMAX - 188
    if subtitle:
        ww = wrap_width if not tw else min(wrap_width, 56)
        for ln in wrap(subtitle, ww):
            ax.text(MX, y, ln, fontfamily=BODY, fontsize=10, color=SAND_DARK, va="top")
            y -= 16
    # Innehållet startar under både text och tumme.
    if tw:
        thumb_bottom = YMAX - 92 - th + 34
        y = min(y, thumb_bottom - 12)
    ax.plot([MX, XMAX - MX], [y - 6, y - 6], color=SAND_LIGHT, lw=1)
    return y - 28


def kr(v):
    return f"{v:,.0f}".replace(",", " ") + " kr"


def kr1(v):
    s = f"{v:.2f}".replace(".", ",")
    return s + " kr"


# PDF-rasterisering: 100 dpi ger suddiga foton. 300 dpi + exakt
# 1:1-pixelmatch (interpolation=none) undviker dubbel nedsampling.
PDF_DPI = 300
# Matplotlib komprimerar inbäddade JPEG:er hårt som default.
plt.rcParams["pdf.compression"] = 3


def place_image(ax, path, x, y, w, h, z=3):
    """Center-crop + Lanczos till exakt PDF-pixelstorlek (ingen ominterpolering)."""
    if not os.path.exists(path):
        return False
    try:
        from PIL import Image as PILImage, ImageFilter
        import numpy as np
        with PILImage.open(path) as im:
            im = im.convert("RGB")
            iw, ih = im.size
            box_ratio = w / h
            img_ratio = iw / ih
            if img_ratio > box_ratio:
                new_w = max(int(round(ih * box_ratio)), 1)
                x0 = max((iw - new_w) // 2, 0)
                im = im.crop((x0, 0, x0 + new_w, ih))
            else:
                new_h = max(int(round(iw / box_ratio)), 1)
                y0 = max((ih - new_h) // 2, 0)
                im = im.crop((0, y0, iw, y0 + new_h))
            # 100 coord-enheter = 1 tum → målresolusion = (w/100)*DPI
            target_w = max(int(round(w / 100 * PDF_DPI)), 64)
            target_h = max(int(round(h / 100 * PDF_DPI)), 64)
            im = im.resize((target_w, target_h), PILImage.Resampling.LANCZOS)
            # Web-JPEG:er (~150 KB) är mjuka — lätt unsharp hjälper i tryck/PDF.
            im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
            arr = np.asarray(im)
    except Exception:
        arr = mpimg.imread(path)
    # "none" = ingen andra resampling i matplotlib (vi har redan rätt pixelstorlek).
    ax.imshow(arr, extent=(x, x + w, y, y + h), aspect="auto",
              interpolation="none", zorder=z)
    return True


def save_page(pdf, fig):
    pdf.savefig(fig, dpi=PDF_DPI)
    plt.close(fig)


# ═════════════════════════ SIDA 1 — OMSLAG ═════════════════════════════
def page_cover(pdf):
    fig, ax = new_page(FOREST)
    try:
        sym = mpimg.imread(os.path.join(WEB, "brand", "roots-symbol-white.png"))
        sh = 520
        sw = sh * sym.shape[1] / sym.shape[0]
        ax.imshow(sym, extent=(XMAX - sw + 150, XMAX + 150, -120, -120 + sh),
                  aspect="auto", alpha=0.10, zorder=1, interpolation="bilinear")
    except Exception:
        pass

    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-white.png"))
    lh = 44
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(MX, MX + lw, YMAX - 130, YMAX - 130 + lh),
              aspect="auto", zorder=5, interpolation="bilinear")

    ax.text(MX, 1020, "PRISJÄMFÖRELSE · SVENSKA MARKNADEN", fontfamily=BODY,
            fontsize=11, fontweight="bold", color=SUN, va="top", zorder=5)
    ax.text(MX, 978, "Roots vs marknaden", fontfamily=HEAD, fontsize=42,
            fontweight="bold", color=WHITE, va="top", zorder=5)
    ax.text(MX, 918, "Schampo, balsam & body wash — krona för krona",
            fontfamily=HEAD, fontsize=17, fontweight="bold", color=OLIVE,
            va="top", zorder=5)

    # Kort intro — avslutas tydligt ovanför bildraden.
    intro_lines = wrap(
        "Jämfört mot nio premiumprodukter i Sverige — tre per kategori. "
        "Samma ambitionsnivå (sulfatsnålt, nordiskt, premiumaktiver), "
        "tydligt lägre prislapp.", 70)
    intro_y = 868
    for i, ln in enumerate(intro_lines[:3]):
        ax.text(MX, intro_y - i * 20, ln, fontfamily=BODY, fontsize=11,
                color="#E7EAE0", va="top", zorder=5)
    intro_bottom = intro_y - len(intro_lines[:3]) * 20 - 16

    # Produktbilder: porträtt (matchar 2:3-källorna), egen zon under texten.
    thumbs = [
        ("sport-schampoo.jpg", "Schampo", "199 kr"),
        ("sport-conditioner.jpg", "Conditioner", "199 kr"),
        ("sport-body-wash.jpg", "Body Wash", "179 kr"),
    ]
    tw, th, gap = 200, 280, 24
    row_w = 3 * tw + 2 * gap
    tx0 = MX + ((XMAX - 2 * MX) - row_w) / 2
    label_h = 28
    # Statsruta under bilderna — beräkna baklänges så inget överlappar.
    by, box_h = 128, 168
    ty0 = by + box_h + 36 + label_h  # bildens underkant
    # Om intro går för långt ner, krymp inte bilderna — flytta dem nedåt
    # bara om det finns luft (annars kortar vi intro, redan max 3 rader).
    img_top = ty0 + th
    if img_top > intro_bottom - 8:
        # Skjut bildraden nedåt inom tillgängligt spann ovanför statsrutan.
        overflow = img_top - (intro_bottom - 8)
        ty0 -= overflow
        th = max(th - overflow, 220)
        tw = int(th * 200 / 280)
        gap = 24
        row_w = 3 * tw + 2 * gap
        tx0 = MX + ((XMAX - 2 * MX) - row_w) / 2

    for i, (fname, label, pris) in enumerate(thumbs):
        x = tx0 + i * (tw + gap)
        rounded(ax, x - 3, ty0 - 3, tw + 6, th + 6, "#5A6743", r=14, z=3)
        place_image(ax, os.path.join(IMG, fname), x, ty0, tw, th, z=4)
        ax.text(x + tw / 2, ty0 - 14, f"{label} · {pris}",
                fontfamily=BODY, fontsize=10, fontweight="bold", color="#E7EAE0",
                ha="center", va="top", zorder=5)

    # Headline-siffra
    rounded(ax, MX, by, XMAX - 2 * MX, box_h, "#5A6743", ec="#5A6743", r=18, z=4)
    ty = by + box_h - 28
    ax.text(MX + 30, ty, "PREMIUMSEGMENTET — CIRKA 35–45 % LÄGRE STYCKPRIS",
            fontfamily=BODY, fontsize=9.0, fontweight="bold", color=SUN, va="top",
            zorder=5)
    ty -= 34
    ax.text(MX + 30, ty,
            f"upp till {pct_lower(RUTIN_KONKURRENT, RUTIN_ROOTS_PAKET):.0f} % lägre "
            "för hela rutinen",
            fontfamily=HEAD, fontsize=22, fontweight="bold", color=WHITE,
            va="top", zorder=5)
    ty -= 36
    for ln in wrap(
            f"Premiumpaket {kr(RUTIN_ROOTS_PAKET)} vs snittet {kr(RUTIN_KONKURRENT)} "
            "för samma volym hos tre ledande premiummärken.", 78):
        ax.text(MX + 30, ty, ln, fontfamily=BODY, fontsize=9.2,
                color="#E7EAE0", va="top", zorder=5)
        ty -= 15
    ty -= 6
    for ln in wrap(
            "Jämförelsemärken: Maria Nila, Sachajuan, Davines, Estelle & Thild, "
            "L'Occitane, Verso — ordinarie pris, ingen kampanjrabatt.", 82):
        ax.text(MX + 30, ty, ln, fontfamily=BODY, fontsize=8.0,
                color="#C7CFBA", va="top", zorder=5)
        ty -= 13

    ax.text(MX, 96, "Internt säljmaterial · uppdaterad prisstrategi",
            fontfamily=BODY, fontsize=9, color="#C7CFBA", va="center", zorder=5)
    ax.text(XMAX - MX, 96, "roots.nu", ha="right", fontfamily=BODY,
            fontsize=9, color="#C7CFBA", va="center", zorder=5)
    ax.plot([MX, XMAX - MX], [78, 78], color="#5A6743", lw=1, zorder=4)

    save_page(pdf, fig)


# ═════════════════════════ SIDA 2 — MATRIS ═════════════════════════════
def page_overview(pdf):
    fig, ax = new_page()
    y = header(ax, "Våra produkter mot marknaden",
               "Hela jämförelsen i en bild",
               "Våra tre produkter i raderna, konkurrenterna i kolumnerna. "
               "Samma mått i varje ruta: pris per 100 ml, flaska och funktion.")

    y -= 4
    gap = 10
    ncols = 4
    CW = (XMAX - 2 * MX - (ncols - 1) * gap) / ncols
    CH = 218
    row_gap = 14
    label_h = 18

    def card(x, cy, w, h, is_roots, brand, product, ml, pris, per100_val,
              funktion, andel=None):
        fc = FOREST_SOFT if is_roots else WHITE
        ec = FOREST if is_roots else SAND_LIGHT
        rounded(ax, x, cy, w, h, fc, ec=ec, lw=1.5 if is_roots else 1, r=12)

        cx = x + w / 2
        top = cy + h

        ax.text(cx, top - 22, brand, fontfamily=HEAD, fontsize=10,
                fontweight="bold", color=FOREST if is_roots else INK,
                va="top", ha="center")

        prod_lines = wrap(product, 18)[:2]
        py = top - 42
        for ln in prod_lines:
            ax.text(cx, py, ln, fontfamily=BODY, fontsize=7.4,
                    color=SAND_DARK, va="top", ha="center")
            py -= 11

        ax.text(cx, top - 78, kr1(per100_val), fontfamily=HEAD, fontsize=15,
                fontweight="bold", color=FOREST if is_roots else INK,
                va="top", ha="center")
        ax.text(cx, top - 104, f"{kr(pris)} / {ml} ml",
                fontfamily=BODY, fontsize=7.2, color=SAND_MED,
                va="top", ha="center")

        badge_txt = "Vårt pris" if is_roots else f"−{andel:.0f} %"
        chip_centered(ax, cx, top - 142, badge_txt, FOREST, tc=WHITE,
                      size=7.0, h=20, pad_x=11)

        ax.text(cx, cy + 22, funktion, fontfamily=BODY, fontsize=7.2,
                color=INK, va="bottom", ha="center")

    for key, _, konk in KATEGORIER:
        chip(ax, MX, y - label_h + 2, KAT_LABEL[key].upper(), SAND_DARK,
             tc=WHITE, size=7.6, h=16, pad_x=10)
        cy = y - label_h - 8 - CH

        card(MX, cy, CW, CH, True, "Roots", ROOTS[key]["namn"],
             ROOTS[key]["ml"], ROOTS[key]["pris"], ROOTS[key]["per100"],
             ROOTS[key]["funktion"])

        for i, k in enumerate(konk):
            x = MX + (i + 1) * (CW + gap)
            andel = pct_lower(k["per100"], ROOTS[key]["per100"])
            card(x, cy, CW, CH, False, k["varumarke"], k["namn"], k["ml"],
                 k["pris"], k["per100"], k["funktion"], andel=andel)

        y = cy - row_gap

    footer(ax, 2)
    save_page(pdf, fig)


# ═════════════════════ SIDA 3–5 — KATEGORIDETALJER ═════════════════════
def page_category(pdf, page_no, key, label, konk, claims, note):
    fig, ax = new_page()
    bild = os.path.join(IMG, ROOTS[key]["bild"])
    y = header(ax, f"Kategori · {label.lower()}",
               f"{ROOTS[key]['namn']} mot marknaden",
               note, thumb=(bild, 104))

    rows = [{"varumarke": "Roots", "namn": ROOTS[key]["namn"], "ml": ROOTS[key]["ml"],
             "pris": ROOTS[key]["pris"], "per100": ROOTS[key]["per100"],
             "land": "Sverige", "kalla": "roots.nu", "roots": True}]
    rows += [dict(k, roots=False) for k in konk]

    colX = [MX + 18, MX + 190, MX + 190 + 92, MX + 190 + 92 + 86,
            MX + 190 + 92 + 86 + 108]
    headers = ["Varumärke & produkt", "Storlek", "Pris", "Pris/100 ml", "Vs Roots"]
    top = y - 4
    for cx, htxt in zip(colX, headers):
        ax.text(cx, top, htxt, fontfamily=BODY, fontsize=8.2, fontweight="bold",
                color=SAND_DARK, va="top")
    top -= 22
    ax.plot([MX, XMAX - MX], [top + 6, top + 6], color=SAND_LIGHT, lw=1)

    rh = 54
    ry = top
    for i, r in enumerate(rows):
        cy = ry - rh
        is_roots = r["roots"]
        if is_roots:
            rounded(ax, MX, cy + 4, XMAX - 2 * MX, rh - 8, FOREST_SOFT,
                    ec=FOREST, lw=1.3, r=10, z=1)
        elif i % 2 == 0:
            ax.add_patch(plt.Rectangle((MX, cy + 4), XMAX - 2 * MX, rh - 8,
                                       fc="#F6F1E8", ec="none", zorder=1))

        ax.text(colX[0], cy + rh / 2 + 9, r["varumarke"], fontfamily=HEAD,
                fontsize=9.8, fontweight="bold",
                color=FOREST if is_roots else INK, va="center", zorder=3)
        ax.text(colX[0], cy + rh / 2 - 9, r["namn"], fontfamily=BODY, fontsize=8,
                color=SAND_DARK, va="center", zorder=3)

        ax.text(colX[1], cy + rh / 2, f"{r['ml']} ml", fontfamily=BODY, fontsize=9,
                color=INK, va="center", zorder=3)
        ax.text(colX[2], cy + rh / 2, kr(r["pris"]), fontfamily=BODY, fontsize=9,
                color=INK, va="center", zorder=3)
        ax.text(colX[3], cy + rh / 2, kr1(r["per100"]), fontfamily=BODY, fontsize=9,
                fontweight="bold" if is_roots else "normal",
                color=FOREST if is_roots else INK, va="center", zorder=3)

        if is_roots:
            ax.text(colX[4], cy + rh / 2, "—", fontfamily=BODY, fontsize=9,
                    color=SAND_MED, va="center", zorder=3)
        else:
            andel = pct_lower(r["per100"], ROOTS[key]["per100"])
            chip(ax, colX[4], cy + rh / 2 - 11, f"−{andel:.0f} %", FOREST,
                 tc=WHITE, size=8, h=22, pad_x=9)
        ry -= rh

    y = ry - 22

    ax.text(MX, y, "Pris per 100 ml, i bild", fontfamily=HEAD, fontsize=12,
            fontweight="bold", color=INK, va="top")
    y -= 28
    bar_rows = [("Roots", ROOTS[key]["per100"], FOREST)] + \
                [(r["varumarke"], r["per100"], SAND_MED) for r in rows[1:]]
    maxval = max(v for _, v, _ in bar_rows)
    bar_x0 = MX + 140
    label_x = XMAX - MX
    bar_w_max = label_x - bar_x0 - 110
    rh = 28
    for name, val, color in bar_rows:
        mid = y - rh / 2 - 2
        ax.text(MX, mid, name, fontfamily=BODY, fontsize=9.6,
                color=INK, va="center",
                fontweight="bold" if name == "Roots" else "normal")
        bw = bar_w_max * val / maxval
        rounded(ax, bar_x0, y - rh - 2, max(bw, 4), rh, color, r=7, z=3)
        ax.text(label_x, mid, kr1(val), fontfamily=BODY, fontsize=9.4,
                fontweight="bold" if name == "Roots" else "normal",
                color=FOREST if name == "Roots" else SAND_DARK,
                va="center", ha="right")
        y -= rh + 10

    y -= 12
    ax.plot([MX, XMAX - MX], [y, y], color=SAND_LIGHT, lw=1)
    y -= 26

    colgap = 28
    CW = (XMAX - 2 * MX - colgap) / 2
    xL, xR = MX, MX + CW + colgap

    chip(ax, xL, y, "ROOTS POSITION", FOREST, tc=WHITE, size=8.6, h=24, pad_x=12)
    cy = y - 34
    for c in claims:
        ax.add_patch(plt.Circle((xL + 8, cy - 4), 3.4, fc=FOREST, ec="none", zorder=4))
        for ln in wrap(c, 48):
            ax.text(xL + 22, cy, ln, fontfamily=BODY, fontsize=8.6, color=INK, va="top")
            cy -= 13
        cy -= 7

    chip(ax, xR, y, "KÄLLOR (ORD. PRIS, EJ KAMPANJ)", SAND_DARK, tc=WHITE, size=8.6,
         h=24, pad_x=12)
    cy = y - 34
    for r in rows[1:]:
        line = f"{r['varumarke']} — {r['kalla']}"
        for ln in wrap(line, 48):
            ax.text(xR + 4, cy, ln, fontfamily=BODY, fontsize=8.4, color=SAND_DARK,
                    va="top")
            cy -= 13
        ax.text(xR + 4, cy, r["namn"], fontfamily=BODY, fontsize=7.8,
                color=SAND_MED, va="top")
        cy -= 18

    footer(ax, page_no)
    save_page(pdf, fig)


# ═════════════════════ SIDA 6 — PAKETSTRATEGI ══════════════════════════
def page_packages(pdf):
    fig, ax = new_page()
    y = header(
        ax, "Paketstrategi",
        "Premiumpaketet är huvudprodukten",
        "Styckprodukterna finns främst för påfyllnad, testköp och presenter. "
        "Kommunikationen lyfter paketvärdet — inte styckpriset som huvuderbjudande.",
        thumb=(os.path.join(IMG, "sport-package.jpg"), 112),
    )

    ax.text(MX, y, "Tre paketnivåer", fontfamily=HEAD, fontsize=13,
            fontweight="bold", color=INK, va="top")
    y -= 26

    gap = 16
    CW = (XMAX - 2 * MX - 2 * gap) / 3
    CARD_H = 148
    for i, p in enumerate(PAKET):
        x = MX + i * (CW + gap)
        is_hero = p["namn"] == "Premium"
        fc = FOREST if is_hero else WHITE
        ec = FOREST if is_hero else SAND_LIGHT
        tc = WHITE if is_hero else INK
        sc = SUN if is_hero else SAND_DARK
        desc_c = "#E7EAE0" if is_hero else SAND_DARK
        bottom = y - CARD_H
        rounded(ax, x, bottom, CW, CARD_H, fc, ec=ec, lw=1.5 if is_hero else 1, r=14)

        ax.text(x + CW / 2, y - 20, p["namn"].upper(), fontfamily=BODY,
                fontsize=8.4, fontweight="bold", color=sc, ha="center", va="top")
        ax.text(x + CW / 2, y - 52, kr(p["pris"]), fontfamily=HEAD,
                fontsize=24, fontweight="bold", color=tc, ha="center", va="top")
        ax.text(x + CW / 2, y - 90, p["beskrivning"], fontfamily=BODY,
                fontsize=8.6, color=desc_c, ha="center", va="top")
        if is_hero:
            # Badge längst ner med egen luft — ingen överlapp mot beskrivningen.
            chip_centered(ax, x + CW / 2, bottom + 16, "Rekommenderad", SUN,
                          tc=FOREST, size=7.4, h=20, pad_x=12)

    y -= CARD_H + 22
    ax.plot([MX, XMAX - MX], [y, y], color=SAND_LIGHT, lw=1)
    y -= 22

    # Sparbox — höjd beräknas från innehåll så texten aldrig går utanför.
    pad_x, pad_y = 32, 28
    body = (
        "Styckpriserna (199 / 199 / 179) placerar Roots tydligt under "
        "premiumkonkurrenterna men långt över lågprissegmentet. Paketet "
        "skapar det mest attraktiva värdet — och lämnar utrymme för framtida "
        "prisjusteringar."
    )
    body_lines = wrap(body, 78)
    # ~1.4 coord-enheter per typografisk punkt — räkna luft generöst.
    box_h = pad_y + 18 + 10 + 18 + 8 + 18 + 10 + len(body_lines) * 15 + pad_y
    box_bottom = y - box_h
    rounded(ax, MX, box_bottom, XMAX - 2 * MX, box_h, FOREST_SOFT,
            ec=FOREST, lw=1.4, r=14)
    ty = y - pad_y
    ax.text(MX + pad_x, ty, "SÅ KOMMUNICERAR DU PREMIUMPAKETET",
            fontfamily=BODY, fontsize=8.8, fontweight="bold", color=FOREST, va="top")
    ty -= 28
    ax.text(MX + pad_x, ty,
            f"Köp separat: {kr(RUTIN_ROOTS_LOS)}",
            fontfamily=HEAD, fontsize=13, fontweight="bold", color=INK, va="top")
    ty -= 22
    ax.text(MX + pad_x, ty,
            f"Köp Premiumpaket: {kr(RUTIN_ROOTS_PAKET)}   ·   "
            f"Du sparar {kr(PAKET_SPARNAD)}",
            fontfamily=HEAD, fontsize=13, fontweight="bold", color=FOREST, va="top")
    ty -= 28
    for ln in body_lines:
        ax.text(MX + pad_x, ty, ln, fontfamily=BODY, fontsize=8.8,
                color=SAND_DARK, va="top")
        ty -= 15

    y = box_bottom - 20
    ax.text(MX, y, "Varför Roots kan hålla ett lägre pris", fontfamily=HEAD,
            fontsize=12.5, fontweight="bold", color=INK, va="top")
    y -= 22
    reasons = [
        "Färre mellanhänder — direktare väg från formulering till kund än "
        "traditionella premiumvarumärken med grossist- och retailkedjor.",
        "Lägre marknadsföringskostnader — ingen tung TV-/printbudget; "
        "föreningsförsäljning och rekommendationer bär mer av tillväxten.",
        "Samma ambitionsnivå i formuleringen — sulfatsnålt, silikon- och "
        "parabenfritt med SyriCalm® — utan att konkurrera på dagligvaruhandelns "
        "prisgolv.",
    ]
    for r in reasons:
        ax.add_patch(plt.Circle((MX + 6, y - 4), 3.4, fc=FOREST, ec="none", zorder=4))
        for ln in wrap(r, 90):
            ax.text(MX + 20, y, ln, fontfamily=BODY, fontsize=9.0, color=INK, va="top")
            y -= 13.5
        y -= 7

    y -= 4
    pos_lines = wrap(
        "Roots ska uppfattas som ett premiumvarumärke med exceptionellt hög "
        "prisvärdhet — inte som ett billigt alternativ.", 80)
    pos_h = 24 + 18 + 10 + len(pos_lines) * 15 + 22
    pos_bottom = y - pos_h
    rounded(ax, MX, pos_bottom, XMAX - 2 * MX, pos_h, WHITE,
            ec=SAND_LIGHT, lw=1.2, r=12)
    ty = y - 22
    ax.text(MX + 24, ty, "Positionering i en mening",
            fontfamily=HEAD, fontsize=10, fontweight="bold", color=FOREST, va="top")
    ty -= 26
    for ln in pos_lines:
        ax.text(MX + 24, ty, ln, fontfamily=BODY, fontsize=9.2, color=INK, va="top")
        ty -= 15

    footer(ax, 6)
    save_page(pdf, fig)


# ═════════════════════ SIDA 7 — METOD & SÄLJARGUMENT ═══════════════════
def page_method(pdf):
    fig, ax = new_page()
    y = header(ax, "Metod & säljargument",
               "Så räknar vi — och så säger du det",
               "Håll dig till pris per 100 ml och ordinarie pris. Det är den enda "
               "jämförelsen som håller när kunden googlar efter mötet.")

    ax.text(MX, y, "Så är siffrorna räknade", fontfamily=HEAD, fontsize=13,
            fontweight="bold", color=INK, va="top")
    y -= 26
    method = [
        "Pris/100 ml = butikens ordinarie eller rekommenderade pris, inte "
        "kampanj- eller medlemspris — annars faller jämförelsen samma dag "
        "rean tar slut.",
        "Alla nio konkurrentprodukter är hämtade från etablerade svenska "
        "återförsäljare (Lyko, Kicks, Apotea, Apotek Hjärtat, varumärkenas "
        "egna butiker) i augusti 2026.",
        "Maria Nila, Sachajuan och Davines är inte slumpvis valda — det är de "
        "tre märken vi redan pekar ut som jämförelsenorm för Roots-formlerna "
        "i premiumsegmentet.",
        "\u201dHela rutinen\u201d räknar snittet av de tre konkurrenternas pris/100 ml "
        "per kategori, skalat till 3 × 250 ml — samma volym som Roots Premiumpaket.",
    ]
    for m in method:
        ax.add_patch(plt.Circle((MX + 6, y - 4), 3.4, fc=FOREST, ec="none", zorder=4))
        for ln in wrap(m, 96):
            ax.text(MX + 20, y, ln, fontfamily=BODY, fontsize=9.2, color=INK, va="top")
            y -= 14.5
        y -= 8

    y -= 12
    ax.plot([MX, XMAX - MX], [y, y], color=SAND_LIGHT, lw=1)
    y -= 30

    ax.text(MX, y, "Fem meningar att använda i mötet", fontfamily=HEAD, fontsize=13,
            fontweight="bold", color=INK, va="top")
    y -= 28

    vs_snitt_s = pct_lower(SNITT["schampo"], ROOTS["schampo"]["per100"])
    vs_snitt_b = pct_lower(SNITT["balsam"], ROOTS["balsam"]["per100"])
    vs_snitt_w = pct_lower(SNITT["body_wash"], ROOTS["body_wash"]["per100"])
    vs_verso = pct_lower(DYRAST["body_wash"]["per100"], ROOTS["body_wash"]["per100"])
    rutin_pct = pct_lower(RUTIN_KONKURRENT, RUTIN_ROOTS_PAKET)

    lines = [
        ("Prata pris per 100 ml, aldrig pris per flaska.",
         "Konkurrenterna säljer 200–350 ml-flaskor i olika storlekar — jämför "
         "alltid normerat, annars låter en dyrare flaska billig."),
        ("Vi mäter oss mot premiumsegmentet — inte mot ICA:s hyllvärmare.",
         f"Maria Nila, Sachajuan och Davines är branschens egen måttstock för "
         f"nordiskt/naturligt premium — och där ligger vi cirka "
         f"{min(vs_snitt_s, vs_snitt_b):.0f}–{max(vs_snitt_s, vs_snitt_b):.0f} % "
         f"under på pris/100 ml."),
        ("Body wash är där skillnaden är störst.",
         f"Mot ett premiummärke som Verso är Roots Body Wash upp till "
         f"{vs_verso:.0f} % lägre per 100 ml, med samma sulfatsnåla, "
         f"parabenfria ambitionsnivå."),
        ("Hela rutinen, inte bara en flaska.",
         f"Premiumpaketet ({kr(RUTIN_ROOTS_PAKET)}) kostar cirka "
         f"{rutin_pct:.0f} % mindre än snittet av tre ledande premiummärken "
         f"för samma 3 × 250 ml ({kr(RUTIN_KONKURRENT)})."),
        ("Priset är inte en rabatt på ambitionsnivå.",
         "Premiumformuleringar till cirka 40 % lägre pris än ledande "
         "premiummärken — färre mellanhänder och lägre marknadsföringskostnader."),
    ]
    PAD = 15
    for title, desc in lines:
        desc_lines = wrap(desc, 82)
        content_h = 18 + 6 + len(desc_lines) * 12.5 + 4
        box_h = PAD + content_h + PAD
        box_bottom = y - box_h
        rounded(ax, MX, box_bottom, XMAX - 2 * MX, box_h, WHITE,
                ec=SAND_LIGHT, lw=1.2, r=12, z=2)
        ty = y - PAD
        ax.text(MX + 20, ty, title, fontfamily=HEAD, fontsize=9.4,
                fontweight="bold", color=FOREST, va="top", zorder=5)
        ty -= 18
        for ln in desc_lines:
            ax.text(MX + 20, ty, ln, fontfamily=BODY, fontsize=8.0,
                    color=INK, va="top", zorder=5)
            ty -= 12.5
        y = box_bottom - 5

    footer(ax, TOTAL)
    save_page(pdf, fig)


def claims_for(key):
    r = ROOTS[key]["per100"]
    snitt = SNITT[key]
    dyr = DYRAST[key]
    bill = BILLIGAST[key]
    vs_snitt = pct_lower(snitt, r)
    vs_dyr = pct_lower(dyr["per100"], r)
    vs_bill = pct_lower(bill["per100"], r)
    claims = [
        f"{sv_num(r)} kr/100 ml mot ett snitt på {sv_num(snitt)} kr — "
        f"{sv_num(vs_snitt)} % lägre än snittet i premiumjämförelsen.",
        f"{sv_num(vs_dyr)} % lägre per 100 ml än den dyraste "
        f"({dyr['varumarke']} {dyr['namn']}).",
    ]
    if key == "body_wash":
        claims.append(
            f"{sv_num(vs_bill)} % lägre än det mest prisvärda alternativet i "
            f"urvalet ({bill['varumarke']}) — fortfarande tydligt i "
            f"premiumsegmentet."
        )
    else:
        claims.append(
            "Sulfatsnålt, silikon- och parabenfritt med SyriCalm® — "
            "samma ambitionsnivå som jämförelsemärkena i premiumsegmentet."
        )
    return claims


with PdfPages(OUT) as pdf:
    page_cover(pdf)
    page_overview(pdf)
    page_category(pdf, 3, "schampo", "Schampo", KATEGORIER[0][2],
                  claims=claims_for("schampo"),
                  note="Roots Schampoo mot de tre märken vi själva pekar ut "
                       "som naturlig jämförelsenorm i premiumsegmentet.")
    page_category(pdf, 4, "balsam", "Balsam", KATEGORIER[1][2],
                  claims=claims_for("balsam"),
                  note="Roots Conditioner mot samma tre märken som schampokategorin, "
                       "för en rak jämförelse av hela rutinen.")
    page_category(pdf, 5, "body_wash", "Body wash", KATEGORIER[2][2],
                  claims=claims_for("body_wash"),
                  note="Body wash är kategorin med störst spridning — från svenskt "
                       "ekocertifierat till franskt parfymhus till svensk nischhudvård.")
    page_packages(pdf)
    page_method(pdf)

print("Saved", os.path.relpath(OUT, ROOT))
print(f"Snitt schampo:    {SNITT['schampo']:.2f} kr/100ml, Roots {ROOTS['schampo']['per100']:.2f}")
print(f"Snitt balsam:     {SNITT['balsam']:.2f} kr/100ml, Roots {ROOTS['balsam']['per100']:.2f}")
print(f"Snitt body wash:  {SNITT['body_wash']:.2f} kr/100ml, Roots {ROOTS['body_wash']['per100']:.2f}")
print(f"Rutin snitt: {RUTIN_KONKURRENT:.2f} kr, Roots paket {RUTIN_ROOTS_PAKET} kr, "
      f"Roots lös {RUTIN_ROOTS_LOS} kr (sparar {PAKET_SPARNAD} kr)")
