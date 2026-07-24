#!/usr/bin/env python3
"""Roots produktblad — fördelar & nyckelingredienser (A4, brand-anpassad).

Namn matchar sajten: Roots Schampoo (schampo), Roots Conditioner (balsam),
Roots Body Wash (body wash). Fördelar & ingredienser bygger på de verkliga
Syricalm-formuleringarna (P2026110 / P2026106 / P2026109).

Kör:  .venv/bin/python docs/product-benefits/build_product_benefits.py
"""
import glob
import os
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch
import matplotlib.image as mpimg

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))
OUT = os.path.join(ROOT, "Roots_Produktblad.pdf")

# ── Brand ────────────────────────────────────────────────────────────
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
SKY = "#A7BBC5"
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


def new_page(bg=OFFWHITE):
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, XMAX); ax.set_ylim(0, YMAX); ax.axis("off")
    fig.patch.set_facecolor(bg)
    return fig, ax


def rounded(ax, x, y, w, h, fc, ec=None, lw=1.2, r=14, z=2):
    p = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                       fc=fc, ec=ec or fc, lw=lw, zorder=z)
    ax.add_patch(p)
    return p


def chip(ax, x, y, text, fc, tc=WHITE, size=7.6, z=4, pad_x=9, h=22):
    w = pad_x * 2 + len(text) * size * 0.74
    rounded(ax, x, y, w, h, fc, r=h / 2, z=z)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontfamily=BODY, fontsize=size, fontweight="bold", color=tc, zorder=z + 1)
    return w


def wrap(text, width):
    return textwrap.wrap(text, width=width)


def img_box(ax, name, x, y, w, h, r=18, z=2):
    """Center-crop an image to the box aspect and draw it with rounded look."""
    path = os.path.join(WEB, name)
    if not os.path.exists(path):
        rounded(ax, x, y, w, h, SAND_100, r=r, z=z)
        return
    im = mpimg.imread(path)
    ih, iw = im.shape[0], im.shape[1]
    target = w / h
    if iw / ih > target:                       # too wide -> crop sides
        nw = int(ih * target)
        x0 = (iw - nw) // 2
        im = im[:, x0:x0 + nw]
    else:                                       # too tall -> crop top/bottom
        nh = int(iw / target)
        y0 = (ih - nh) // 2
        im = im[y0:y0 + nh, :]
    ax.imshow(im, extent=(x, x + w, y, y + h), aspect="auto", zorder=z)
    # subtle frame
    rounded(ax, x, y, w, h, "none", ec=SAND_LIGHT, lw=1.2, r=r, z=z + 1)


def footer(ax, n):
    ax.plot([MX, XMAX - MX], [56, 56], color=SAND_LIGHT, lw=1)
    ax.text(MX, 38, "Roots Nordic · Produktblad", fontfamily=BODY,
            fontsize=7.6, color=SAND_MED, va="center")
    ax.text(XMAX - MX, 38, f"{n} / {TOTAL}", ha="right", fontfamily=BODY,
            fontsize=7.6, color=SAND_MED, va="center")


def head_logo(ax, white=False):
    fn = "roots-logo-white.png" if white else "roots-logo-black.png"
    logo = mpimg.imread(os.path.join(WEB, "brand", fn))
    lh = 30
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(MX, MX + lw, YMAX - 86, YMAX - 86 + lh),
              aspect="auto", zorder=6)


# ═══════════════════════ SIDA 1 — OMSLAG ════════════════════════════
def page_cover(pdf):
    fig, ax = new_page(FOREST)
    try:
        sym = mpimg.imread(os.path.join(WEB, "brand", "roots-symbol-white.png"))
        sh = 560; sw = sh * sym.shape[1] / sym.shape[0]
        ax.imshow(sym, extent=(XMAX - sw + 170, XMAX + 170, -150, -150 + sh),
                  aspect="auto", alpha=0.10, zorder=1)
    except Exception:
        pass

    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-white.png"))
    lh = 44; lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(MX, MX + lw, YMAX - 130, YMAX - 130 + lh),
              aspect="auto", zorder=5)

    ax.text(MX, 905, "REN · LUGN · NORDISK HUDVÅRD", fontfamily=BODY, fontsize=12,
            fontweight="bold", color=SUN, va="top", zorder=5)
    ax.text(MX, 858, "Snäll mot håret.", fontfamily=HEAD, fontsize=44,
            fontweight="bold", color=WHITE, va="top", zorder=5)
    ax.text(MX, 800, "Lugn för huden.", fontfamily=HEAD, fontsize=44,
            fontweight="bold", color=OLIVE, va="top", zorder=5)

    for i, ln in enumerate(wrap(
        "Tre vardagsprodukter, en filosofi: rengör mjukt, lugna hudbotten och "
        "lämna hår och hud i balans. Forskningsförankrade aktiver, ren formel "
        "och en känsla som får dig att vilja komma tillbaka.", 60)):
        ax.text(MX, 715 - i * 22, ln, fontfamily=BODY, fontsize=11.5,
                color="#E7EAE0", va="top", zorder=5)

    # produktbild-panel
    img_box(ax, "images/p4.jpg", MX, 250, XMAX - 2 * MX, 300, r=20, z=3)

    cx = MX
    for label in ["Roots Schampoo", "Roots Conditioner", "Roots Body Wash"]:
        w = chip(ax, cx, 195, label, "#5A6743", tc=WHITE, size=9.5, h=30, pad_x=15)
        cx += w + 12

    ax.text(MX, 130, "roots.se", fontfamily=BODY, fontsize=9.5, color="#C7CFBA",
            va="center", zorder=5)
    ax.text(XMAX - MX, 130, "Produkter folk faktiskt vill ha igen", ha="right",
            fontfamily=BODY, fontsize=9.5, color="#C7CFBA", va="center", zorder=5)
    ax.plot([MX, XMAX - MX], [108, 108], color="#5A6743", lw=1, zorder=4)

    pdf.savefig(fig); plt.close(fig)


# ═══════════════════════ SIDA 2 — FILOSOFI + SYRICALM ═══════════════
def page_philosophy(pdf):
    fig, ax = new_page()
    head_logo(ax)
    ax.text(MX, YMAX - 122, "DET SOM GÖR OSS ANNORLUNDA", fontfamily=BODY,
            fontsize=8.4, fontweight="bold", color=FOREST, va="top")
    ax.text(MX, YMAX - 142, "Vi jobbar med hudbotten — inte emot den",
            fontfamily=HEAD, fontsize=23, fontweight="bold", color=INK, va="top")
    ax.plot([MX, XMAX - MX], [YMAX - 178, YMAX - 178], color=SAND_LIGHT, lw=1)

    # vänster: bild
    img_box(ax, "images/m2.jpg", MX, 470, 330, 480, r=18)
    # höger: text
    rx = 420; rw = XMAX - MX - rx
    y = 940
    for ln in wrap("Håret växer ur en levande hudbotten. Hålls den i balans mår "
                   "håret bra — blir den irriterad blir håret det också. Varje Roots-"
                   "produkt är gjord för att stötta hudens naturliga balans, inte "
                   "rubba den.", 52):
        ax.text(rx, y, ln, fontfamily=BODY, fontsize=11, color=SAND_DARK, va="top")
        y -= 17
    y -= 18

    heroes = [
        ("SyriCalm®", "Phragmites Communis + Poria Cocos Extract",
         "Forskningsförankrad nordisk aktiv som lugnar, minskar rodnad och "
         "stärker hudens skyddsbarriär. Finns i alla tre produkterna."),
        ("Panthenol (Pro-Vitamin B5)",
         "Fukt & styrka",
         "Binder fukt, gör håret mjukare och starkare och håller huden "
         "återfuktad — i samtliga produkter."),
        ("Ren, fokuserad formel",
         "Få ingredienser — de som finns gör jobbet",
         "Sulfatsnål rengöring, biologiskt nedbrytbara tensider och inga "
         "onödiga tillsatser."),
    ]
    for title, sub, body in heroes:
        ax.add_patch(plt.Circle((rx + 6, y - 6), 5, fc=FOREST, ec="none", zorder=4))
        ax.text(rx + 22, y, title, fontfamily=HEAD, fontsize=13.5,
                fontweight="bold", color=INK, va="top")
        ax.text(rx + 22, y - 19, sub, fontfamily=BODY, fontsize=8.6,
                fontweight="bold", color=FOREST, va="top")
        yy = y - 36
        for ln in wrap(body, 50):
            ax.text(rx + 22, yy, ln, fontfamily=BODY, fontsize=9.4,
                    color=SAND_DARK, va="top")
            yy -= 13.5
        y = yy - 16

    # promise-chips längst ned
    cx = MX
    for label, c in [("Sulfatsnålt", FOREST), ("Snällt mot huden", SAND_DARK),
                     ("Forskningsförankrat", SKY), ("Daglig rutin", TERRA)]:
        w = chip(ax, cx, 120, label, c, tc=WHITE, size=8.5, h=26, pad_x=13)
        cx += w + 12

    footer(ax, 2); pdf.savefig(fig); plt.close(fig)


# ═══════════════════════ PRODUKTSIDOR ═══════════════════════════════
def page_product(pdf, n, idx_label, name, ptype, volume, img, tagline,
                 emo, keys, feeling, inci, accent=FOREST, soft=FOREST_SOFT):
    fig, ax = new_page()
    head_logo(ax)
    ax.text(XMAX - MX, YMAX - 72, idx_label, ha="right", fontfamily=BODY,
            fontsize=8.4, fontweight="bold", color=accent, va="top")

    # vänster bild
    img_box(ax, img, MX, 470, 320, 500, r=18)
    ax.text(MX, 448, ptype.upper() + "  ·  " + volume, fontfamily=BODY,
            fontsize=8.6, fontweight="bold", color=SAND_MED, va="top")

    # höger text
    rx = 410; rw = XMAX - MX - rx
    ax.text(rx, YMAX - 150, name, fontfamily=HEAD, fontsize=30,
            fontweight="bold", color=INK, va="top")
    y = YMAX - 200
    for ln in wrap(tagline, 44):
        ax.text(rx, y, ln, fontfamily=HEAD, fontsize=13, fontweight="bold",
                color=accent, va="top")
        y -= 19
    y -= 10
    for ln in wrap(emo, 50):
        ax.text(rx, y, ln, fontfamily=BODY, fontsize=10, color=SAND_DARK, va="top")
        y -= 15
    y -= 14

    ax.text(rx, y, "NYCKELINGREDIENSER", fontfamily=BODY, fontsize=8.2,
            fontweight="bold", color=accent, va="top")
    y -= 24
    for ing, ben in keys:
        ax.add_patch(plt.Circle((rx + 5, y - 5), 4, fc=accent, ec="none", zorder=4))
        ing_lines = wrap(ing, 44)
        for k, ln in enumerate(ing_lines):
            ax.text(rx + 20, y, ln, fontfamily=HEAD, fontsize=10.5,
                    fontweight="bold", color=INK, va="top")
            y -= 15
        for ln in wrap(ben, 50):
            ax.text(rx + 20, y, ln, fontfamily=BODY, fontsize=9.2,
                    color=SAND_DARK, va="top")
            y -= 13.5
        y -= 9

    # feeling-rad (under bilden, vänster) som highlight
    rounded(ax, MX, 350, 320, 96, soft, r=14)
    ax.text(MX + 18, 430, "KÄNSLAN", fontfamily=BODY, fontsize=7.8,
            fontweight="bold", color=accent, va="top")
    fy = 408
    for ln in wrap(feeling, 36):
        ax.text(MX + 18, fy, ln, fontfamily=HEAD, fontsize=12,
                fontweight="bold", color=INK, va="top")
        fy -= 17

    # full INCI box (helbredd nederst)
    rounded(ax, MX, 96, XMAX - 2 * MX, 196, WHITE, ec=SAND_LIGHT, lw=1.2, r=14)
    ax.text(MX + 22, 270, "FULLSTÄNDIG INNEHÅLLSFÖRTECKNING (INCI)",
            fontfamily=BODY, fontsize=8, fontweight="bold", color=SAND_MED, va="top")
    iy = 248
    for ln in wrap(inci, 96):
        ax.text(MX + 22, iy, ln, fontfamily=BODY, fontsize=8.6, color=INK, va="top")
        iy -= 13.5

    footer(ax, n); pdf.savefig(fig); plt.close(fig)


# ═══════════════════════ SIDA 6 — INGREDIENSLEXIKON + CTA ═══════════
def page_glossary(pdf):
    fig, ax = new_page()
    head_logo(ax)
    ax.text(MX, YMAX - 122, "BRA ATT KUNNA", fontfamily=BODY, fontsize=8.4,
            fontweight="bold", color=FOREST, va="top")
    ax.text(MX, YMAX - 142, "Ingredienslexikon", fontfamily=HEAD, fontsize=23,
            fontweight="bold", color=INK, va="top")
    ax.plot([MX, XMAX - MX], [YMAX - 178, YMAX - 178], color=SAND_LIGHT, lw=1)

    items = [
        ("SyriCalm® (Phragmites Communis + Poria Cocos)",
         "Lugnar och stärker hud & hårbotten — mindre irritation och rodnad."),
        ("Panthenol (Pro-Vitamin B5)",
         "Binder fukt, ger styrka och mjukhet åt hår och hud."),
        ("Coco-Glucoside & milda tensider",
         "Sockerbaserad, sulfatsnål rengöring som inte torkar ut."),
        ("Polyquaternium-10 & -7",
         "Reder ut, slätar och ger glans utan att tynga."),
        ("Beta Vulgaris (Betain) & Glycerin",
         "Naturliga fuktbindare för långvarig återfuktning."),
        ("Tocopherol (E-vitamin), Piper Nigrum, Inga Alba",
         "Antioxidanter som skyddar mot daglig miljöstress."),
    ]
    CW = (XMAX - 2 * MX - 24) / 2
    x0 = MX; y0 = YMAX - 210
    for i, (t, b) in enumerate(items):
        col = i % 2; row = i // 2
        x = x0 + col * (CW + 24)
        y = y0 - row * 150
        rounded(ax, x, y - 130, CW, 130, WHITE, ec=SAND_LIGHT, lw=1.1, r=14)
        ax.add_patch(plt.Circle((x + 24, y - 28), 5, fc=FOREST, ec="none", zorder=4))
        ty = y - 22
        for ln in wrap(t, 40):
            ax.text(x + 40, ty, ln, fontfamily=HEAD, fontsize=11,
                    fontweight="bold", color=INK, va="top")
            ty -= 15
        ty -= 4
        for ln in wrap(b, 46):
            ax.text(x + 24, ty, ln, fontfamily=BODY, fontsize=9.2,
                    color=SAND_DARK, va="top")
            ty -= 13.5

    # CTA-band
    rounded(ax, MX, 96, XMAX - 2 * MX, 150, FOREST, r=16)
    ax.text(MX + 28, 222, "Premium hår- & hudvård —", fontfamily=HEAD,
            fontsize=18, fontweight="bold", color=WHITE, va="top")
    ax.text(MX + 28, 196, "som stöttar föreningslivet.", fontfamily=HEAD,
            fontsize=18, fontweight="bold", color=OLIVE, va="top")
    for i, ln in enumerate(wrap("Roots Schampoo · Roots Conditioner · Roots Body Wash. "
                                "Beställ via din förening på roots.se.", 62)):
        ax.text(MX + 28, 158 - i * 18, ln, fontfamily=BODY, fontsize=10.5,
                color="#E7EAE0", va="top")

    footer(ax, 6); pdf.savefig(fig); plt.close(fig)


def build():
    with PdfPages(OUT) as pdf:
        page_cover(pdf)
        page_philosophy(pdf)
        page_product(
            pdf, 3, "PRODUKT 01 · SCHAMPO", "Roots Schampoo", "Schampo", "250 ml",
            "images/p1.jpg",
            "Rengör på riktigt — och lämnar hårbotten i ro",
            "Ett mjukt men effektivt schampo som löser smuts och fett utan att "
            "skala bort hårbottnens naturliga balans. Håret känns rent, lätt och "
            "levande — dag efter dag.",
            [
                ("SyriCalm® (Phragmites Communis + Poria Cocos)",
                 "Lugnar och stärker hårbotten — mindre irritation och klåda."),
                ("Coco-Glucoside & sockerbaserade tensider",
                 "Mild, sulfatsnål rengöring som inte torkar ut."),
                ("Polyquaternium-10 & -7",
                 "Reder ut, slätar och ger naturlig glans."),
                ("Panthenol (B5) & Glycerin",
                 "Fukt och styrka — håret tål vardagen bättre."),
            ],
            "Nytvättat hår som andas — utan att strama.",
            "Aqua, Coco-Glucoside, Cocamidopropyl Betaine, Disodium Lauryl "
            "Sulfosuccinate, Glycerin, Sodium Chloride, PEG-4 Rapeseedamide, "
            "Sodium Benzoate, Citric Acid, Potassium Sorbate, Parfum, "
            "Polyquaternium-10, Polyquaternium-7, Sodium Citrate, Phragmites "
            "Communis Extract, Poria Cocos Extract, Octadecyl "
            "Di-t-Butyl-4-Hydroxyhydrocinnamate, Sodium Hydroxide.",
            accent=FOREST, soft=FOREST_SOFT)
        page_product(
            pdf, 4, "PRODUKT 02 · BALSAM", "Roots Conditioner", "Balsam", "200 ml",
            "images/p5.jpg",
            "Ger håret exakt det det behöver — inget mer, inget mindre",
            "Ett närande balsam som gör håret mjukt, följsamt och lätt att reda "
            "ut utan att tynga ner. Det skyddar mot slitage och ger en lyster "
            "som håller hela dagen.",
            [
                ("Lätt emollient-komplex (Caprylic/Capric + Cetearyl Alcohol)",
                 "Närande mjukhet — utan att tynga håret."),
                ("Conditioning-komplex (Distearoylethyl- + Stearamidopropyl)",
                 "Reder ut och slätar varje slinga."),
                ("Beta Vulgaris (Betain) & Panthenol",
                 "Djup, långvarig återfuktning."),
                ("Tocopherol (E-vitamin), Piper Nigrum & Inga Alba",
                 "Antioxidanter som skyddar mot miljöstress."),
            ],
            "Silkeslent hår som glider genom fingrarna.",
            "Aqua, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Distearoylethyl "
            "Hydroxyethylmonium Methosulfate, Stearamidopropyl Dimethylamine, "
            "Phenoxyethanol, Panthenol, Hydrolyzed Corn Starch, Beta Vulgaris Root "
            "Extract, Butylene Glycol, Parfum, Citric Acid, Benzoic Acid, Sodium "
            "Lauroyl Lactylate, Sodium Caproyl Lactylate, Dehydroacetic Acid, "
            "Lactic Acid, Ethylhexylglycerin, Sodium Citrate, Piper Nigrum Fruit "
            "Extract, Phragmites Communis Extract, Poria Cocos Extract, Sodium "
            "Benzoate, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, "
            "Inga Alba Bark Extract, Tocopherol.",
            accent=SAND_DARK, soft=SAND_100)
        page_product(
            pdf, 5, "PRODUKT 03 · BODY WASH", "Roots Body Wash", "Body Wash", "250 ml",
            "images/p6.jpg",
            "Respekterar huden — istället för att störa den",
            "En skonsam kroppstvätt med krämigt lödder som rengör utan att torka "
            "ut. Huden känns ren, mjuk och återfuktad — redo för dagen, eller "
            "redo att varva ner.",
            [
                ("Mild tvättduo (Cocamidopropyl Betaine + Sodium Lauroyl Sarcosinate)",
                 "Rengör skonsamt och sulfatsnålt."),
                ("Panthenyl-derivat & Panthenol (B5)",
                 "Lämnar huden len, mjuk och återfuktad."),
                ("SyriCalm® (Phragmites Communis + Poria Cocos)",
                 "Lugnar och stärker hudens skyddsbarriär."),
            ],
            "Len hud som inte stramar efter duschen.",
            "Aqua, Cocamidopropyl Betaine, Sodium Lauroyl Sarcosinate, Sodium "
            "Chloride, Citric Acid, Sodium Benzoate, Panthenyl Hydroxypropyl "
            "Steardimonium Chloride, PEG-150 Pentaerythrityl Tetrastearate, Parfum, "
            "Potassium Sorbate, PPG-2 Hydroxyethyl Cocamide, Panthenol, Sodium "
            "Citrate, Phragmites Communis Extract, Poria Cocos Extract.",
            accent=SKY, soft="#EDF2F5")
        page_glossary(pdf)
    print("Saved", os.path.relpath(OUT, ROOT))


build()
