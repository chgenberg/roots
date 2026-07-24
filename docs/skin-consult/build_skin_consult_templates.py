#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Roots — underlag till Skin Consult (en ifyllbar mall-PDF per produkt).

Sammanställer allt som krävs per produkt för säkerhetsbedömning (CPSR),
produktinformationsdokument (PIF/PID) och CPNP-anmälan enligt EU-förordning
1223/2009. Avbockningsbar checklista + ifyllnadsfält, i Roots design.

Kör:  .venv/bin/python docs/skin-consult/build_skin_consult_templates.py
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
TOP = 1004          # översta content-y på innehållssidor
BOTTOM = 96         # nedersta gräns innan sidbrytning

# ── Företag / ansvarig person ────────────────────────────────────────
RP = [
    "Cafrelin AB",
    "c/o Fredrik Lindqvist",
    "Hallängsvägen 8, 439 55 Åsa",
    "Org.nr 559355-7126",
]

# ── Produkter ────────────────────────────────────────────────────────
PRODUCTS = [
    {
        "name": "Roots Schampoo", "code": "P2026110", "cat": "Shampoo",
        "vol": "250 ml", "img": "images/p1.jpg", "accent": FOREST,
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
        "inci": ("Aqua, Cocamidopropyl Betaine, Sodium Lauroyl Sarcosinate, Sodium "
                 "Chloride, Citric Acid, Sodium Benzoate, Panthenyl Hydroxypropyl "
                 "Steardimonium Chloride, PEG-150 Pentaerythrityl Tetrastearate, "
                 "Parfum, Potassium Sorbate, PPG-2 Hydroxyethyl Cocamide, Panthenol, "
                 "Sodium Citrate, Phragmites Communis Extract, Poria Cocos Extract."),
    },
]

# ── Checklist content ────────────────────────────────────────────────
# Row types:  ("check", title, helptext)   ("field", label)   ("note", text)
SECTIONS = [
    ("A", "Formula & raw material documentation", [
        ("check", "Full formula in % w/w with INCI and function per ingredient",
         "Quantitative composition – basis for the exposure calculation."),
        ("check", "CoA (Certificate of Analysis) for each raw material", None),
        ("check", "SDS/MSDS for each raw material", None),
        ("check", "Fragrance: IFRA certificate + full allergen list",
         "Incl. allergens to be declared (rinse-off ≥ 0.01%) per the 2023 Omnibus."),
        ("check", "Statement on any nanomaterials (yes/no)", None),
        ("check", "Confirmation that no prohibited/CMR substances are used (Annex II–VI)", None),
    ]),
    ("B", "Testing (performed by an accredited lab)", [
        ("check", "Stability test – accelerated + real-time",
         "Sets shelf life/PAO. ISO/TR 18811 as guidance."),
        ("check", "Compatibility test – formula against primary packaging",
         "White bottle + transparent flip-top. Mandatory, no exceptions."),
        ("check", "Challenge test / preservative efficacy (PET, ISO 11930)",
         "Required for water-based rinse-off products."),
        ("check", "Microbiological quality – initial microbial count", None),
        ("field", "pH value"),
        ("field", "Viscosity"),
    ]),
    ("C", "Manufacturing & packaging", [
        ("check", "Manufacturing method (process description)", None),
        ("check", "GMP certificate per ISO 22716 (from the manufacturer)", None),
        ("check", "Packaging specification (materials)", None),
        ("field", "Manufacturer"),
        ("field", "Batch / lot numbering system"),
    ]),
    ("D", "Labelling & claims", [
        ("check", "Label / artwork (proof)", None),
        ("check", "INCI list on the label", None),
        ("check", "Shelf life / PAO symbol", None),
        ("check", "Responsible person name + address (Cafrelin AB)", None),
        ("check", "Warnings & directions for use in the market language",
         "Swedish is required for sale on the Swedish market (LVFS 2013:10)."),
        ("check", "Net quantity + batch", None),
        ("check", "Evidence for all claims (claim support, Regulation 655/2013)", None),
    ]),
    ("E", "To be completed by Skin Consult", [
        ("field", "Additional documentation still required"),
        ("field", "Recommended tests"),
        ("field", "Safety assessor (name / qualifications)"),
        ("field", "Date / signature"),
    ]),
]


# ── Primitiver ───────────────────────────────────────────────────────
def new_page(bg=OFFWHITE):
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, XMAX); ax.set_ylim(0, YMAX); ax.axis("off")
    fig.patch.set_facecolor(bg)
    return fig, ax


def rounded(ax, x, y, w, h, fc, ec=None, lw=1.2, r=12, z=2):
    p = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                       fc=fc, ec=ec or fc, lw=lw, zorder=z)
    ax.add_patch(p)


def wrap(text, width):
    return textwrap.wrap(text, width=width)


def logo(ax, y_top, h=28):
    im = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-black.png"))
    lw = h * im.shape[1] / im.shape[0]
    ax.imshow(im, extent=(MX, MX + lw, y_top - h, y_top), aspect="auto", zorder=6)


def footer(ax, product, n):
    ax.plot([MX, XMAX - MX], [64, 64], color=SAND_LIGHT, lw=1, zorder=3)
    ax.text(MX, 46, f"Roots · Skin Consult submission · {product['code']}",
            fontfamily=BODY, fontsize=7.4, color=SAND_MED, va="center")
    ax.text(XMAX - MX, 46, str(n), ha="right", fontfamily=BODY,
            fontsize=7.4, color=SAND_MED, va="center")


def running_header(ax, product):
    logo(ax, YMAX - 44, h=22)
    ax.text(XMAX - MX, YMAX - 60, f"{product['name']}  ·  {product['code']}",
            ha="right", fontfamily=HEAD, fontsize=11, color=INK, va="center")
    ax.plot([MX, XMAX - MX], [YMAX - 76, YMAX - 76], color=SAND_LIGHT, lw=1)


def checkbox(ax, x, y, s=15):
    ax.add_patch(Rectangle((x, y), s, s, fc=WHITE, ec=SAND_MED, lw=1.3, zorder=4))


# ── Flödesmotor med automatisk sidbrytning ───────────────────────────
class Flow:
    def __init__(self, pdf, product):
        self.pdf = pdf
        self.product = product
        self.page = 1  # sida 1 är omslaget (byggs separat)
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
            self._save()
            self._open()

    def section(self, letter, title, accent):
        self.ensure(96)
        ax, y = self.ax, self.y
        rounded(ax, MX, y - 30, 30, 30, accent, r=8, z=4)
        ax.text(MX + 15, y - 15, letter, ha="center", va="center",
                fontfamily=HEAD, fontsize=14, fontweight="bold", color=WHITE, zorder=5)
        ax.text(MX + 44, y - 15, title, va="center", fontfamily=HEAD,
                fontsize=15, color=INK)
        ax.plot([MX, XMAX - MX], [y - 42, y - 42], color=accent, lw=1.4)
        self.y = y - 60

    def check_row(self, title, sub):
        title_lines = wrap(title, 70)
        sub_lines = wrap(sub, 84) if sub else []
        need = 16 + len(title_lines) * 15 + (len(sub_lines) * 12 + 4 if sub_lines else 0) + 24
        self.ensure(need)
        ax, y = self.ax, self.y
        checkbox(ax, MX, y - 15)
        tx = MX + 28
        ty = y
        for ln in title_lines:
            ax.text(tx, ty - 12, ln, va="center", fontfamily=BODY,
                    fontsize=9.6, fontweight="bold", color=INK)
            ty -= 15
        for ln in sub_lines:
            ax.text(tx, ty - 11, ln, va="center", fontfamily=BODY,
                    fontsize=8.2, color=SAND_DARK)
            ty -= 12
        # kommentar/referens-linje
        ty -= 6
        ax.text(tx, ty - 8, "Ref./comment:", va="center", fontfamily=BODY,
                fontsize=7.6, color=SAND_MED)
        ax.plot([tx + 78, XMAX - MX], [ty - 10, ty - 10], color=SAND_LIGHT, lw=0.9,
                linestyle=(0, (1, 2)))
        self.y = ty - 26

    def field_row(self, label, lines=1):
        need = 20 + lines * 26
        self.ensure(need)
        ax, y = self.ax, self.y
        ax.text(MX, y - 12, label, va="center", fontfamily=BODY,
                fontsize=9.4, fontweight="bold", color=INK)
        yy = y - 26
        for _ in range(lines):
            ax.plot([MX, XMAX - MX], [yy, yy], color=SAND_LIGHT, lw=0.9,
                    linestyle=(0, (1, 2)))
            yy -= 24
        self.y = yy - 6

    def render(self):
        for letter, title, items in SECTIONS:
            self.section(letter, title, self.product["accent"])
            for it in items:
                if it[0] == "check":
                    self.check_row(it[1], it[2])
                elif it[0] == "field":
                    self.field_row(it[1], lines=2 if letter == "E" else 1)
        self._save()


# ── Omslagssida ──────────────────────────────────────────────────────
def cover(pdf, p):
    fig, ax = new_page(OFFWHITE)
    accent = p["accent"]
    # vänsterspine
    ax.add_patch(Rectangle((0, 0), 10, YMAX, fc=accent, ec="none", zorder=3))
    logo(ax, YMAX - 60, h=30)
    ax.text(MX, YMAX - 108, "DOCUMENTATION FOR SAFETY ASSESSMENT (CPSR) & PIF",
            fontfamily=BODY, fontsize=9.5, fontweight="bold", color=SAND_DARK)

    # produktnamn
    ax.text(MX, YMAX - 152, p["name"], fontfamily=HEAD, fontsize=32,
            fontweight="bold", color=INK, va="top")
    ax.text(MX, YMAX - 214, p["cat"], fontfamily=HEAD, fontsize=14,
            color=accent, va="top")

    # chips: kod + volym
    def chip(x, label, value):
        w = 150
        rounded(ax, x, YMAX - 268, w, 30, WHITE, ec=SAND_LIGHT, lw=1, r=8, z=4)
        ax.text(x + 12, YMAX - 246, label, fontfamily=BODY, fontsize=7,
                color=SAND_MED, va="center", zorder=5)
        ax.text(x + 12, YMAX - 260, value, fontfamily=BODY, fontsize=9.4,
                fontweight="bold", color=INK, va="center", zorder=5)
        return w
    chip(MX, "PRODUCT CODE", p["code"])
    chip(MX + 164, "VOLUME", p["vol"])

    # produktbild till höger
    _img(ax, p["img"], XMAX - MX - 170, YMAX - 258, 170, 190, accent)

    # intro
    y = YMAX - 320
    intro = ("This document summarises the information Roots (responsible person: "
             "Cafrelin AB) submits to Skin Consult for the safety assessment (CPSR), "
             "the Product Information File (PIF/PID) and the CPNP notification under "
             "EU Regulation 1223/2009. Tick each row, add a reference/filename and "
             "fill in values where indicated.")
    for ln in wrap(intro, 96):
        ax.text(MX, y, ln, fontfamily=BODY, fontsize=9.4, color=INK, va="top")
        y -= 15

    # Ansvarig person-box
    y -= 22
    box_h = 108
    rounded(ax, MX, y - box_h, XMAX - 2 * MX, box_h, WHITE, ec=SAND_LIGHT, lw=1, r=12, z=2)
    ax.text(MX + 20, y - 22, "RESPONSIBLE PERSON (EU/EEA)", fontfamily=BODY,
            fontsize=7.6, fontweight="bold", color=accent)
    ry = y - 42
    for ln in RP:
        ax.text(MX + 20, ry, ln, fontfamily=BODY, fontsize=9.6,
                color=INK, va="center")
        ry -= 17
    # kontaktfält i boxens högra del
    cx = MX + 300
    ax.text(cx, y - 22, "CONTACT (to complete)", fontfamily=BODY, fontsize=7.6,
            fontweight="bold", color=accent)
    for lab in ["Name", "Email", "Phone"]:
        ry2 = y - 42 - ["Name", "Email", "Phone"].index(lab) * 22
        ax.text(cx, ry2, lab + ":", fontfamily=BODY, fontsize=8.4, color=SAND_DARK,
                va="center")
        ax.plot([cx + 54, XMAX - MX - 20], [ry2 - 4, ry2 - 4], color=SAND_LIGHT,
                lw=0.9, linestyle=(0, (1, 2)))

    # metadata-fält
    y = y - box_h - 26
    ax.text(MX, y, "PROJECT DETAILS", fontfamily=BODY, fontsize=7.6,
            fontweight="bold", color=SAND_DARK)
    y -= 22
    for lab in ["Manufacturer / formulator", "Date for samples / bulk",
                "Target launch date"]:
        ax.text(MX, y, lab + ":", fontfamily=BODY, fontsize=9, color=INK, va="center")
        ax.plot([MX + 190, XMAX - MX], [y - 4, y - 4], color=SAND_LIGHT, lw=0.9,
                linestyle=(0, (1, 2)))
        y -= 26

    # full INCI-box
    y -= 10
    inci_lines = wrap(p["inci"], 104)
    box_h2 = 34 + len(inci_lines) * 12
    rounded(ax, MX, y - box_h2, XMAX - 2 * MX, box_h2, FOREST_SOFT, r=12, z=2)
    ax.text(MX + 20, y - 20, "FULL INGREDIENT LIST (INCI)",
            fontfamily=BODY, fontsize=7.6, fontweight="bold", color=FOREST)
    iy = y - 38
    for ln in inci_lines:
        ax.text(MX + 20, iy, ln, fontfamily=BODY, fontsize=8.2, color=INK, va="center")
        iy -= 12

    footer(ax, p, 1)
    pdf.savefig(fig, facecolor=fig.get_facecolor())
    plt.close(fig)


def _img(ax, name, x, y, w, h, accent):
    path = os.path.join(WEB, name)
    if not os.path.exists(path):
        rounded(ax, x, y, w, h, SAND_100, r=14, z=2)
        ax.text(x + w / 2, y + h / 2, "product image", ha="center", va="center",
                fontfamily=BODY, fontsize=8, color=SAND_MED, zorder=3)
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


# ── Bygg en PDF per produkt ──────────────────────────────────────────
def build_one(p):
    safe = p["name"].replace(" ", "_")
    out = os.path.join(ROOT, f"Roots_SkinConsult_{safe}.pdf")
    with PdfPages(out) as pdf:
        cover(pdf, p)
        Flow(pdf, p).render()
    print("Saved", os.path.relpath(out, ROOT))
    return out


if __name__ == "__main__":
    for prod in PRODUCTS:
        build_one(prod)
