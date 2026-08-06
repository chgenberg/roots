#!/usr/bin/env python3
"""Bygger Roots_Prisjamforelse_Marknaden.pdf — hur Roots Schampoo, Conditioner
och Body Wash prissätts mot nio konkurrerande produkter på den svenska
marknaden. A4 stående, samma brandspråk som docs/comparison-newbody.

Källor (hämtade 2026-08-06, ordinarie/rekommenderat pris exkl. kampanjrabatt,
så jämförelsen inte bygger på en tillfällig rea):

  Roots        roots.nu/produkter — 149 / 149 / 129 kr, 250 ml, priceOre i
               apps/web/.../produkter/[slug]/page.tsx.
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
TOTAL = 6

# ═══════════════════════════════ Data ══════════════════════════════════
# pris = ordinarie/rekommenderat pris (inte kampanjpris), så jämförelsen
# håller även den dag konkurrentens rea tar slut.
ROOTS = {
    "schampo": {"namn": "Roots Schampoo", "ml": 250, "pris": 149,
                "funktion": "Sulfatsnålt · SyriCalm®"},
    "balsam": {"namn": "Roots Conditioner", "ml": 250, "pris": 149,
               "funktion": "Panthenol · SyriCalm®"},
    "body_wash": {"namn": "Roots Body Wash", "ml": 250, "pris": 129,
                  "funktion": "Sulfatsnålt · SyriCalm®"},
}

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


# Förberäknat: pris/100 ml och snitt per kategori.
for _, _, konk in KATEGORIER:
    for k in konk:
        k["per100"] = per100(k["pris"], k["ml"])
for key in ROOTS:
    ROOTS[key]["per100"] = per100(ROOTS[key]["pris"], ROOTS[key]["ml"])

SNITT = {}
for key, _, konk in KATEGORIER:
    SNITT[key] = sum(k["per100"] for k in konk) / len(konk)

# Hela rutinen: 3 × 250 ml till snittkonkurrenternas pris/100 ml.
RUTIN_KONKURRENT = sum(SNITT[k] * 2.5 for k in SNITT)
RUTIN_ROOTS_LOS = sum(ROOTS[k]["pris"] for k in ROOTS)
RUTIN_ROOTS_PAKET = 399


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


def header(ax, kicker, title, subtitle=None):
    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-black.png"))
    lh = 34
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(MX, MX + lw, YMAX - 92, YMAX - 92 + lh),
              aspect="auto", zorder=5)
    ax.text(MX, YMAX - 132, kicker.upper(), fontfamily=BODY, fontsize=8.4,
            fontweight="bold", color=FOREST, va="top")
    ax.text(MX, YMAX - 152, title, fontfamily=HEAD, fontsize=23,
            fontweight="bold", color=INK, va="top")
    y = YMAX - 192
    if subtitle:
        for ln in wrap(subtitle, 78):
            ax.text(MX, y, ln, fontfamily=BODY, fontsize=10, color=SAND_DARK, va="top")
            y -= 16
    ax.plot([MX, XMAX - MX], [y - 6, y - 6], color=SAND_LIGHT, lw=1)
    return y - 30


def kr(v):
    return f"{v:,.0f}".replace(",", " ") + " kr"


def kr1(v):
    s = f"{v:.2f}".replace(".", ",")
    return s + " kr"


# ═════════════════════════ SIDA 1 — OMSLAG ═════════════════════════════
def page_cover(pdf):
    fig, ax = new_page(FOREST)
    try:
        sym = mpimg.imread(os.path.join(WEB, "brand", "roots-symbol-white.png"))
        sh = 520
        sw = sh * sym.shape[1] / sym.shape[0]
        ax.imshow(sym, extent=(XMAX - sw + 150, XMAX + 150, -120, -120 + sh),
                  aspect="auto", alpha=0.10, zorder=1)
    except Exception:
        pass

    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-white.png"))
    lh = 44
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(MX, MX + lw, YMAX - 130, YMAX - 130 + lh),
              aspect="auto", zorder=5)

    ax.text(MX, 800, "PRISJÄMFÖRELSE · SVENSKA MARKNADEN", fontfamily=BODY,
            fontsize=12, fontweight="bold", color=SUN, va="top", zorder=5)
    ax.text(MX, 758, "Roots vs marknaden", fontfamily=HEAD, fontsize=46,
            fontweight="bold", color=WHITE, va="top", zorder=5)
    ax.text(MX, 684, "Schampo, balsam & body wash — krona för krona",
            fontfamily=HEAD, fontsize=20, fontweight="bold", color=OLIVE,
            va="top", zorder=5)

    for i, ln in enumerate(wrap(
        "Roots Schampoo, Conditioner och Body Wash jämförda mot nio konkurrerande "
        "produkter som säljs i Sverige idag — tre per kategori. Samma formulanivå "
        "(sulfatsnålt, nordiskt, premiumaktiver), en helt annan prislapp.", 62)):
        ax.text(MX, 600 - i * 22, ln, fontfamily=BODY, fontsize=11.5,
                color="#E7EAE0", va="top", zorder=5)

    # Headline-siffra
    by = 280
    box_h = 200
    rounded(ax, MX, by, XMAX - 2 * MX, box_h, "#5A6743", ec="#5A6743", r=18, z=4)
    ty = by + box_h - 30
    ax.text(MX + 30, ty, "HELA RUTINEN, 3 × 250 ML", fontfamily=BODY,
            fontsize=9.5, fontweight="bold", color=SUN, va="top", zorder=5)
    ty -= 40
    ax.text(MX + 30, ty, f"upp till {pct_lower(RUTIN_KONKURRENT, RUTIN_ROOTS_PAKET):.0f} % billigare",
            fontfamily=HEAD, fontsize=27, fontweight="bold", color=WHITE,
            va="top", zorder=5)
    ty -= 46
    ax.text(MX + 30, ty,
            f"Roots paket {kr(RUTIN_ROOTS_PAKET)} vs snittet {kr(RUTIN_KONKURRENT)} "
            "för samma volym hos tre ledande naturliga märken.",
            fontfamily=BODY, fontsize=9.6, color="#E7EAE0", va="top", zorder=5)
    ty -= 34
    ax.text(MX + 30, ty,
            "Jämförelsemärken: Maria Nila, Sachajuan, Davines, Estelle & Thild, "
            "L'Occitane, Verso — ordinarie pris, ingen kampanjrabatt.",
            fontfamily=BODY, fontsize=8.4, color="#C7CFBA", va="top", zorder=5)

    ax.text(MX, 150, "Internt säljmaterial", fontfamily=BODY, fontsize=9,
            color="#C7CFBA", va="center", zorder=5)
    ax.text(XMAX - MX, 150, "roots-nordic.se", ha="right", fontfamily=BODY,
            fontsize=9, color="#C7CFBA", va="center", zorder=5)
    ax.plot([MX, XMAX - MX], [128, 128], color="#5A6743", lw=1, zorder=4)

    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 2 — MATRIS ═════════════════════════════
def page_overview(pdf):
    fig, ax = new_page()
    y = header(ax, "Våra produkter mot marknaden",
               "Hela jämförelsen i en bild",
               "Våra tre produkter i raderna, konkurrenterna i kolumnerna. "
               "Samma mått i varje ruta: pris per 100 ml, flaska och funktion.")

    y -= 6  # Luft under rubriklinjen innan första raden
    gap = 10
    ncols = 4
    CW = (XMAX - 2 * MX - (ncols - 1) * gap) / ncols
    # Fasta zoner i varje kort — så priserna ligger på samma höjd i hela raden.
    CH = 208
    row_gap = 12
    label_h = 18

    def card(x, cy, w, h, is_roots, brand, product, ml, pris, per100_val,
              funktion, andel=None):
        fc = FOREST_SOFT if is_roots else WHITE
        ec = FOREST if is_roots else SAND_LIGHT
        rounded(ax, x, cy, w, h, fc, ec=ec, lw=1.5 if is_roots else 1, r=12)

        cx = x + w / 2
        top = cy + h

        ax.text(cx, top - 18, brand, fontfamily=HEAD, fontsize=10,
                fontweight="bold", color=FOREST if is_roots else INK,
                va="top", ha="center")

        prod_lines = wrap(product, 18)[:2]
        py = top - 36
        for ln in prod_lines:
            ax.text(cx, py, ln, fontfamily=BODY, fontsize=7.4,
                    color=SAND_DARK, va="top", ha="center")
            py -= 11

        ax.text(cx, top - 72, kr1(per100_val), fontfamily=HEAD, fontsize=15,
                fontweight="bold", color=FOREST if is_roots else INK,
                va="top", ha="center")
        ax.text(cx, top - 98, f"{kr(pris)} / {ml} ml",
                fontfamily=BODY, fontsize=7.2, color=SAND_MED,
                va="top", ha="center")

        badge_txt = "Vårt pris" if is_roots else f"−{andel:.0f} %"
        chip_centered(ax, cx, top - 136, badge_txt, FOREST, tc=WHITE,
                      size=7.0, h=20, pad_x=11)

        ax.text(cx, top - 170, funktion, fontfamily=BODY, fontsize=7.4,
                color=INK, va="top", ha="center")

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
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════ SIDA 3–5 — KATEGORIDETALJER ═════════════════════
def page_category(pdf, page_no, key, label, konk, claims, note):
    fig, ax = new_page()
    y = header(ax, f"Kategori · {label.lower()}",
               f"{ROOTS[key]['namn']} mot marknaden",
               note)

    rows = [{"varumarke": "Roots", "namn": ROOTS[key]["namn"], "ml": ROOTS[key]["ml"],
             "pris": ROOTS[key]["pris"], "per100": ROOTS[key]["per100"],
             "land": "Sverige", "kalla": "roots.nu", "roots": True}]
    rows += [dict(k, roots=False) for k in konk]

    colX = [MX + 14, MX + 182, MX + 182 + 92, MX + 182 + 92 + 80,
            MX + 182 + 92 + 80 + 100]
    headers = ["Varumärke & produkt", "Storlek", "Pris", "Pris/100 ml", "Vs Roots"]
    top = y - 4
    for cx, htxt in zip(colX, headers):
        ax.text(cx, top, htxt, fontfamily=BODY, fontsize=8.2, fontweight="bold",
                color=SAND_DARK, va="top")
    top -= 22
    ax.plot([MX, XMAX - MX], [top + 6, top + 6], color=SAND_LIGHT, lw=1)

    rh = 50
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

        namn_col = f"{r['varumarke']}"
        ax.text(colX[0], cy + rh / 2 + 8, namn_col, fontfamily=HEAD, fontsize=9.8,
                fontweight="bold", color=FOREST if is_roots else INK, va="center", zorder=3)
        ax.text(colX[0], cy + rh / 2 - 8, r["namn"], fontfamily=BODY, fontsize=8,
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

    y = ry - 26

    # Stort stapeldiagram — samma jämförelse, men visuellt.
    ax.text(MX, y, "Pris per 100 ml, i bild", fontfamily=HEAD, fontsize=12,
            fontweight="bold", color=INK, va="top")
    y -= 30
    bar_rows = [("Roots", ROOTS[key]["per100"], FOREST)] + \
                [(r["varumarke"], r["per100"], SAND_MED) for r in rows[1:]]
    maxval = max(v for _, v, _ in bar_rows)
    bar_x0 = MX + 130
    label_x = XMAX - MX
    bar_w_max = label_x - bar_x0 - 90
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

    y -= 14
    ax.plot([MX, XMAX - MX], [y, y], color=SAND_LIGHT, lw=1)
    y -= 30

    # Två kolumner: Roots vinner på / Källor
    colgap = 24
    CW = (XMAX - 2 * MX - colgap) / 2
    xL, xR = MX, MX + CW + colgap

    chip(ax, xL, y, "ROOTS VINNER PÅ", FOREST, tc=WHITE, size=8.6, h=24, pad_x=12)
    cy = y - 36
    for c in claims:
        ax.add_patch(plt.Circle((xL + 6, cy - 4), 3.4, fc=FOREST, ec="none", zorder=4))
        for ln in wrap(c, 52):
            ax.text(xL + 20, cy, ln, fontfamily=BODY, fontsize=8.8, color=INK, va="top")
            cy -= 13.5
        cy -= 6

    chip(ax, xR, y, "KÄLLOR (ORD. PRIS, EJ KAMPANJ)", SAND_DARK, tc=WHITE, size=8.6,
         h=24, pad_x=12)
    cy = y - 36
    for r in rows[1:]:
        line = f"{r['varumarke']} {r['namn']} — {r['kalla']}"
        for ln in wrap(line, 56):
            ax.text(xR, cy, ln, fontfamily=BODY, fontsize=8.4, color=SAND_DARK, va="top")
            cy -= 13
        cy -= 6

    footer(ax, page_no)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════ SIDA 6 — METOD & SÄLJARGUMENT ═══════════════════
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
        "tre märken FORMULATIONS.md redan pekar ut som jämförelsenorm för "
        "Roots-formlerna.",
        "\u201dHela rutinen\u201d räknar snittet av de tre konkurrenternas pris/100 ml "
        "per kategori, skalat till 3 × 250 ml — samma volym som Roots-paketet.",
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
    lines = [
        ("Prata pris per 100 ml, aldrig pris per flaska.",
         "Konkurrenterna säljer 200–350 ml-flaskor i olika storlekar — jämför "
         "alltid normerat, annars låter en dyrare flaska billig."),
        ("Vi mäter oss mot rätt märken, inte mot ICA:s hyllvärmare.",
         "Maria Nila, Sachajuan och Davines är branschens egen måttstock för "
         "\u201dnaturligt, sulfatsnålt, premium\u201d — och där ligger vi ca 50–57 % "
         "under på pris/100 ml."),
        ("Body wash är där skillnaden är störst.",
         "Mot ett premiummärke som Verso är Roots Body Wash upp till 74 % "
         "billigare per 100 ml, med samma sulfatsnåla, parabenfria profil."),
        ("Hela rutinen, inte bara en flaska.",
         f"Roots-paketet ({kr(RUTIN_ROOTS_PAKET)}) kostar mindre än hälften "
         f"av vad snittet av tre ledande naturliga märken tar för samma 3 × 250 ml "
         f"({kr(RUTIN_KONKURRENT)})."),
        ("Priset är inte en rabatt på kvalitet.",
         "Alla tre Roots-produkter är sulfatsnåla, silikon- och parabenfria med "
         "SyriCalm® — samma kravnivå som märkena vi jämför mot, till en bråkdel "
         "av priset."),
    ]
    # Rita texten först, sedan rutan runt. Sista radens höjd (inte radavstånd)
    # avgör botten — annars blir bottenpad större än toppad.
    PAD = 18
    for title, desc in lines:
        desc_lines = wrap(desc, 90)
        ty = y - PAD
        ax.text(MX + 22, ty, title, fontfamily=HEAD, fontsize=10,
                fontweight="bold", color=FOREST, va="top", zorder=5)
        ty -= 14  # titelns visuella höjd
        ty -= 6   # gap till brödtext
        for i, ln in enumerate(desc_lines):
            ax.text(MX + 22, ty, ln, fontfamily=BODY, fontsize=8.8,
                    color=INK, va="top", zorder=5)
            if i < len(desc_lines) - 1:
                ty -= 12.5
            else:
                ty -= 11  # sista radens bokstavshöjd, inte radavstånd
        box_bottom = ty - PAD
        box_h = y - box_bottom
        rounded(ax, MX, box_bottom, XMAX - 2 * MX, box_h, WHITE,
                ec=SAND_LIGHT, lw=1.2, r=12, z=2)
        y = box_bottom - 10

    footer(ax, TOTAL)
    pdf.savefig(fig)
    plt.close(fig)


with PdfPages(OUT) as pdf:
    page_cover(pdf)
    page_overview(pdf)
    page_category(pdf, 3, "schampo", "Schampo", KATEGORIER[0][2], claims=[
        "59,60 kr/100 ml mot ett snitt på 118,11 kr — 49,5 % billigare än "
        "snittet av Maria Nila, Sachajuan och Davines.",
        "54,7 % billigare per 100 ml än den dyraste (Davines Essential Minu).",
        "Sulfatsnålt, silikon- och parabenfritt med SyriCalm® — samma "
        "kravnivå som de tre jämförelsemärkena.",
    ], note="Roots Schampoo mot de tre märken FORMULATIONS.md själv pekar ut "
            "som naturlig jämförelsenorm.")
    page_category(pdf, 4, "balsam", "Balsam", KATEGORIER[1][2], claims=[
        "59,60 kr/100 ml mot ett snitt på 122,91 kr — 51,5 % billigare än "
        "snittet.",
        "57,3 % billigare per 100 ml än den dyraste (Davines Essential Minu "
        "Conditioner).",
        "Pro-Vitamin B5, E-vitamin och SyriCalm® — närande utan att tynga, "
        "till mindre än halva priset.",
    ], note="Roots Conditioner mot samma tre märken som schampokategorin, "
            "för en rak jämförelse av hela rutinen.")
    page_category(pdf, 5, "body_wash", "Body wash", KATEGORIER[2][2], claims=[
        "51,60 kr/100 ml mot ett snitt på 130,37 kr — 60,4 % billigare än "
        "snittet.",
        "74,2 % billigare per 100 ml än det dyraste alternativet (Verso "
        "Body Oil Cleanser).",
        "41,1 % billigare än till och med det billigaste alternativet "
        "(L'Occitane Verbena Shower Gel).",
    ], note="Body wash är kategorin med störst spridning — från svenskt "
            "ekocertifierat till franskt parfymhus till svensk nischhudvård.")
    page_method(pdf)
print("Saved", os.path.relpath(OUT, ROOT))
print(f"Snitt schampo:    {SNITT['schampo']:.2f} kr/100ml, Roots {ROOTS['schampo']['per100']:.2f}")
print(f"Snitt balsam:     {SNITT['balsam']:.2f} kr/100ml, Roots {ROOTS['balsam']['per100']:.2f}")
print(f"Snitt body wash:  {SNITT['body_wash']:.2f} kr/100ml, Roots {ROOTS['body_wash']['per100']:.2f}")
print(f"Rutin snitt: {RUTIN_KONKURRENT:.2f} kr, Roots paket {RUTIN_ROOTS_PAKET} kr, "
      f"Roots lös {RUTIN_ROOTS_LOS} kr")
