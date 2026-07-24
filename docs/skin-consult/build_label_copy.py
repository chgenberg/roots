#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Roots — full label copy for Skin Consult review (one PDF per product).

Contains all the text that will appear on the label so Skin Consult can review
it against EU Regulation 1223/2009, Art. 19 (mandatory particulars):
responsible person, country of origin, net content, durability/PAO, warnings,
batch, function, ingredient list (INCI), directions for use and marketing
claims. Placeholders marked [ ] are to be confirmed before print.

Run:  .venv/bin/python docs/skin-consult/build_label_copy.py
"""
import glob
import os
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch, Rectangle
import matplotlib.image as mpimg

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))

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
SKY = "#A7BBC5"

for f in glob.glob(os.path.expanduser("~/Library/Fonts/AlanSans*.ttf")) + \
         glob.glob(os.path.expanduser("~/Library/Fonts/Inter_18pt*.ttf")):
    fm.fontManager.addfont(f)
HEAD = "Alan Sans"
BODY = "Inter 18pt"
plt.rcParams["pdf.fonttype"] = 42

PAGE_W, PAGE_H = 8.27, 11.69
XMAX, YMAX = 827, 1169
MX = 62
TOP = 1004
BOTTOM = 96

RP = ["Cafrelin AB", "c/o Fredrik Lindqvist",
      "Hallängsvägen 8, 439 55 Åsa, Sweden", "Org.nr 559355-7126"]

WARNINGS = ("For external use only. Avoid contact with the eyes; if contact "
            "occurs, rinse thoroughly with water. Keep out of reach of "
            "children. Discontinue use if irritation occurs.")

ALLERGEN_NOTE = ("Parfum is present. Any fragrance allergens present at "
                 "≥ 0.01% (rinse-off) must be listed here by their INCI name. "
                 "Insert the declared allergens from the supplier's "
                 "IFRA/allergen certificate before print "
                 "(e.g. Linalool, Limonene, Citronellol).")

# ── Products + full label copy ───────────────────────────────────────
PRODUCTS = [
    {
        "name": "Roots Schampoo", "code": "P2026110", "cat": "Shampoo",
        "vol": "250 ml", "img": "images/p1.jpg", "accent": FOREST,
        "function": "Shampoo — rinse-off hair cleanser.",
        "descriptor": "Gentle daily shampoo",
        "claim": ("Gentle, sulfate-low cleansing that respects the scalp. "
                  "With SyriCalm® to soothe and Panthenol (B5) for softness "
                  "and natural shine."),
        "directions": ("Massage into wet hair and scalp, work into a lather, "
                       "then rinse thoroughly. Follow with Roots Conditioner."),
        "pao": "30M (30 months after opening)",
        "inci": ("Aqua, Coco-Glucoside, Cocamidopropyl Betaine, Disodium Lauryl "
                 "Sulfosuccinate, Glycerin, Sodium Chloride, PEG-4 Rapeseedamide, "
                 "Sodium Benzoate, Citric Acid, Potassium Sorbate, Parfum, "
                 "Polyquaternium-10, Polyquaternium-7, Sodium Citrate, Phragmites "
                 "Communis Extract, Poria Cocos Extract, Octadecyl "
                 "Di-t-Butyl-4-Hydroxyhydrocinnamate, Sodium Hydroxide."),
    },
    {
        "name": "Roots Conditioner", "code": "P2026106", "cat": "Conditioner",
        "vol": "200 ml", "img": "images/p5.jpg", "accent": SAND_DARK,
        "function": "Conditioner — rinse-off hair conditioner.",
        "descriptor": "Nourishing conditioner",
        "claim": ("Lightweight conditioning that detangles and smooths without "
                  "weighing hair down. With SyriCalm® and Panthenol (B5) for "
                  "lasting softness."),
        "directions": ("After shampooing, apply to the lengths and ends of wet "
                       "hair. Leave for 1–2 minutes, then rinse thoroughly."),
        "pao": "30M (30 months after opening)",
        "inci": ("Aqua, Cetearyl Alcohol, Caprylic/Capric Triglyceride, "
                 "Distearoylethyl Hydroxyethylmonium Methosulfate, Stearamidopropyl "
                 "Dimethylamine, Phenoxyethanol, Panthenol, Hydrolyzed Corn Starch, "
                 "Beta Vulgaris Root Extract, Butylene Glycol, Parfum, Citric Acid, "
                 "Benzoic Acid, Sodium Lauroyl Lactylate, Sodium Caproyl Lactylate, "
                 "Dehydroacetic Acid, Lactic Acid, Ethylhexylglycerin, Sodium "
                 "Citrate, Piper Nigrum Fruit Extract, Phragmites Communis Extract, "
                 "Poria Cocos Extract, Sodium Benzoate, Pentaerythrityl "
                 "Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Inga Alba Bark Extract, "
                 "Tocopherol."),
    },
    {
        "name": "Roots Body Wash", "code": "P2026109", "cat": "Body Wash",
        "vol": "250 ml", "img": "images/p6.jpg", "accent": SKY,
        "function": "Body wash — rinse-off skin cleanser.",
        "descriptor": "Gentle body wash",
        "claim": ("A mild, creamy body wash that cleanses without drying. "
                  "With SyriCalm® and Panthenol (B5) to leave skin soft and "
                  "comfortable."),
        "directions": ("Apply to wet skin, work into a lather and rinse. "
                       "Suitable for daily use."),
        "pao": "30M (30 months after opening)",
        "inci": ("Aqua, Cocamidopropyl Betaine, Sodium Lauroyl Sarcosinate, Sodium "
                 "Chloride, Citric Acid, Sodium Benzoate, Panthenyl Hydroxypropyl "
                 "Steardimonium Chloride, PEG-150 Pentaerythrityl Tetrastearate, "
                 "Parfum, Potassium Sorbate, PPG-2 Hydroxyethyl Cocamide, Panthenol, "
                 "Sodium Citrate, Phragmites Communis Extract, Poria Cocos Extract."),
    },
]


# ── Primitives ───────────────────────────────────────────────────────
def new_page(bg=OFFWHITE):
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, XMAX); ax.set_ylim(0, YMAX); ax.axis("off")
    fig.patch.set_facecolor(bg)
    return fig, ax


def rounded(ax, x, y, w, h, fc, ec=None, lw=1.2, r=12, z=2):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
                 boxstyle=f"round,pad=0,rounding_size={r}",
                 fc=fc, ec=ec or fc, lw=lw, zorder=z))


def wrap(t, w):
    return textwrap.wrap(t, width=w)


def logo(ax, y_top, h=28):
    im = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-black.png"))
    lw = h * im.shape[1] / im.shape[0]
    ax.imshow(im, extent=(MX, MX + lw, y_top - h, y_top), aspect="auto", zorder=6)


def footer(ax, product, n):
    ax.plot([MX, XMAX - MX], [64, 64], color=SAND_LIGHT, lw=1, zorder=3)
    ax.text(MX, 46, f"Roots · Label copy for review · {product['code']}",
            fontfamily=BODY, fontsize=7.4, color=SAND_MED, va="center")
    ax.text(XMAX - MX, 46, str(n), ha="right", fontfamily=BODY,
            fontsize=7.4, color=SAND_MED, va="center")


def running_header(ax, product):
    logo(ax, YMAX - 44, h=22)
    ax.text(XMAX - MX, YMAX - 60, f"{product['name']}  ·  {product['code']}",
            ha="right", fontfamily=HEAD, fontsize=11, color=INK, va="center")
    ax.plot([MX, XMAX - MX], [YMAX - 76, YMAX - 76], color=SAND_LIGHT, lw=1)


def _img(ax, name, x, y, w, h):
    path = os.path.join(WEB, name)
    if not os.path.exists(path):
        rounded(ax, x, y, w, h, SAND_100, r=14, z=2)
        return
    im = mpimg.imread(path)
    ih, iw = im.shape[0], im.shape[1]
    target = w / h
    if iw / ih > target:
        nw = int(ih * target); x0 = (iw - nw) // 2; im = im[:, x0:x0 + nw]
    else:
        nh = int(iw / target); y0 = (ih - nh) // 2; im = im[y0:y0 + nh, :]
    ax.imshow(im, extent=(x, x + w, y, y + h), aspect="auto", zorder=2)
    rounded(ax, x, y, w, h, "none", ec=SAND_LIGHT, lw=1.2, r=14, z=3)


# ── Flow with auto page-break ────────────────────────────────────────
class Flow:
    def __init__(self, pdf, product):
        self.pdf, self.product, self.page = pdf, product, 1
        self.fig = self.ax = None
        self.y = 0

    def _open(self):
        self.page += 1
        self.fig, self.ax = new_page()
        running_header(self.ax, self.product)
        footer(self.ax, self.product, self.page)
        self.y = TOP - 44

    def _save(self):
        if self.fig is not None:
            self.pdf.savefig(self.fig, facecolor=self.fig.get_facecolor())
            plt.close(self.fig)
            self.fig = None

    def ensure(self, need):
        if self.fig is None or self.y - need < BOTTOM:
            self._save(); self._open()

    def section(self, title):
        self.ensure(70)
        ax, y, ac = self.ax, self.y, self.product["accent"]
        rounded(ax, MX, y - 26, 6, 26, ac, r=3, z=4)
        ax.text(MX + 18, y - 13, title, va="center", fontfamily=HEAD,
                fontsize=14, color=INK)
        ax.plot([MX, XMAX - MX], [y - 36, y - 36], color=SAND_LIGHT, lw=1)
        self.y = y - 54

    def field(self, label, value, wrapw=94, mono=False):
        lines = wrap(value, wrapw)
        need = 16 + len(lines) * 14 + 12
        self.ensure(need)
        ax, y = self.ax, self.y
        ax.text(MX, y - 10, label.upper(), va="center", fontfamily=BODY,
                fontsize=7.6, fontweight="bold", color=self.product["accent"])
        yy = y - 26
        for ln in lines:
            ax.text(MX, yy, ln, va="center", fontfamily=BODY, fontsize=9.6,
                    color=INK)
            yy -= 14
        self.y = yy - 8

    def note(self, text, wrapw=100):
        lines = wrap(text, wrapw)
        need = 16 + len(lines) * 12
        self.ensure(need)
        ax, y = self.ax, self.y
        rounded(ax, MX, y - (len(lines) * 12 + 16), XMAX - 2 * MX,
                len(lines) * 12 + 16, SAND_100, r=8, z=1)
        yy = y - 12
        for ln in lines:
            ax.text(MX + 14, yy, ln, va="center", fontfamily=BODY, fontsize=8.4,
                    color=SAND_DARK)
            yy -= 12
        self.y = yy - 10

    def inci_block(self, inci):
        lines = wrap(inci, 96)
        need = 30 + len(lines) * 12
        self.ensure(need + 20)
        ax, y = self.ax, self.y
        h = 30 + len(lines) * 12
        rounded(ax, MX, y - h, XMAX - 2 * MX, h, FOREST_SOFT, r=10, z=1)
        ax.text(MX + 16, y - 16, "Ingredients", fontfamily=BODY, fontsize=10,
                fontweight="bold", color=FOREST)
        yy = y - 32
        for ln in lines:
            ax.text(MX + 16, yy, ln, fontfamily=BODY, fontsize=8.4, color=INK,
                    va="center")
            yy -= 12
        self.y = yy - 10

    def render(self):
        p = self.product
        self.section("Front of pack")
        self.field("Brand", "Roots")
        self.field("Product name", p["name"])
        self.field("Descriptor", p["descriptor"])
        self.field("Lead claim", p["claim"])
        self.field("Net content", p["vol"] + "  (℮-mark to be confirmed)")

        self.section("Back of pack — mandatory particulars")
        self.field("Function", p["function"])
        self.field("Directions for use", p["directions"])
        self.field("Warnings / precautions", WARNINGS)
        self.field("Period after opening (PAO)", p["pao"])
        self.field("Best-before date", "Not required — PAO is used (durability > 30 months).")
        self.field("Batch / lot number", "Printed on the bottle at filling — [to be assigned per batch].")
        self.field("Net content (repeat on back)", p["vol"])
        self.field("Responsible person (EU/EEA)", "  ·  ".join(RP), wrapw=98)
        self.field("Country of origin", "Made in [country to confirm].")

        self.section("Ingredient list (INCI)")
        self.inci_block(p["inci"])
        self.note(ALLERGEN_NOTE)
        self._save()


# ── Cover ────────────────────────────────────────────────────────────
def cover(pdf, p):
    fig, ax = new_page(OFFWHITE)
    ac = p["accent"]
    ax.add_patch(Rectangle((0, 0), 10, YMAX, fc=ac, ec="none", zorder=3))
    logo(ax, YMAX - 60, h=30)
    ax.text(MX, YMAX - 108, "LABEL COPY FOR REVIEW",
            fontfamily=BODY, fontsize=9.5, fontweight="bold", color=SAND_DARK)
    ax.text(MX, YMAX - 152, p["name"], fontfamily=HEAD, fontsize=32,
            fontweight="bold", color=INK, va="top")
    ax.text(MX, YMAX - 214, p["cat"], fontfamily=HEAD, fontsize=14, color=ac, va="top")

    def chip(x, label, value):
        rounded(ax, x, YMAX - 268, 150, 30, WHITE, ec=SAND_LIGHT, lw=1, r=8, z=4)
        ax.text(x + 12, YMAX - 246, label, fontfamily=BODY, fontsize=7,
                color=SAND_MED, va="center", zorder=5)
        ax.text(x + 12, YMAX - 260, value, fontfamily=BODY, fontsize=9.4,
                fontweight="bold", color=INK, va="center", zorder=5)
    chip(MX, "PRODUCT CODE", p["code"])
    chip(MX + 164, "VOLUME", p["vol"])
    _img(ax, p["img"], XMAX - MX - 170, YMAX - 258, 170, 190)

    y = YMAX - 320
    intro = ("Below is the full proposed label text for this product, so Skin "
             "Consult can review it against EU Regulation 1223/2009 (Art. 19 – "
             "mandatory particulars) together with the safety assessment. Text in "
             "square brackets [ ] is a placeholder to be confirmed before print. "
             "Please flag any wording, claim or ordering that must change.")
    for ln in wrap(intro, 96):
        ax.text(MX, y, ln, fontfamily=BODY, fontsize=9.4, color=INK, va="top")
        y -= 15

    footer(ax, p, 1)
    pdf.savefig(fig, facecolor=fig.get_facecolor())
    plt.close(fig)


def build_one(p):
    safe = p["name"].replace(" ", "_")
    out = os.path.join(ROOT, f"Roots_LabelCopy_{safe}.pdf")
    with PdfPages(out) as pdf:
        cover(pdf, p)
        Flow(pdf, p).render()
    print("Saved", os.path.relpath(out, ROOT))
    return out


if __name__ == "__main__":
    for prod in PRODUCTS:
        build_one(prod)
