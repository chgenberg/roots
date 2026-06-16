#!/usr/bin/env python3
"""
Genererar on-brand grafik för Roots säljmaterial.
Minimalistiskt, Roots-färger, Alan Sans (display) + Inter (body).
Output: docs/sales-material/assets/*.png
"""
import os
import math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.patches import FancyBboxPatch, Circle, Wedge, FancyArrowPatch
from matplotlib.lines import Line2D
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(ASSETS, exist_ok=True)

# ── Brand palette ───────────────────────────────────────────
INK        = "#1D1D1B"
SAND_DARK  = "#7F715B"
SAND_MED   = "#B2A491"
SAND_LIGHT = "#D5CABF"
OFFWHITE   = "#FAF6EF"
SAND_100   = "#F1EBE2"
SAND_200   = "#E5DDD2"
WHITE      = "#FFFFFF"
FOREST     = "#6B794F"
OLIVE      = "#C1BF99"
SKY        = "#A7BBC5"
SUN        = "#ECD488"
ROSE       = "#E3A1A0"
TERRA      = "#E18754"

# ── Fonts ───────────────────────────────────────────────────
ALAN_DIR = os.path.join(WEB, "fonts", "alan-sans")
INTER_DIR = os.path.join(WEB, "fonts", "inter")
for f in os.listdir(ALAN_DIR):
    if f.endswith(".ttf"):
        fm.fontManager.addfont(os.path.join(ALAN_DIR, f))
for f in os.listdir(INTER_DIR):
    if f.endswith(".ttf"):
        fm.fontManager.addfont(os.path.join(INTER_DIR, f))

DISPLAY = "Alan Sans"
BODY = "Inter 18pt"
for cand_attr, cand in (("DISPLAY", DISPLAY), ("BODY", BODY)):
    try:
        fm.findfont(cand, fallback_to_default=False)
    except Exception:
        if cand_attr == "DISPLAY":
            DISPLAY = "DejaVu Sans"
        else:
            BODY = "DejaVu Sans"
plt.rcParams["font.family"] = BODY
plt.rcParams["axes.unicode_minus"] = False


def save(fig, name, dpi=300, transparent=False, facecolor=OFFWHITE):
    path = os.path.join(ASSETS, name)
    fig.savefig(path, dpi=dpi, bbox_inches="tight", pad_inches=0.18,
                transparent=transparent, facecolor=facecolor)
    plt.close(fig)
    print("wrote", os.path.relpath(path, ROOT))


# ════════════════════════════════════════════════════════════
# 1. Science diagram — "Hårbotten i balans" (tre lager)
# ════════════════════════════════════════════════════════════
def science_balance():
    fig, ax = plt.subplots(figsize=(9.5, 6.4))
    ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    fig.patch.set_facecolor(OFFWHITE)

    cx, cy = 33, 50
    # Concentric "scalp ecosystem" rings
    rings = [
        (30, SAND_200, "Mikrobiom"),
        (23, OLIVE,    "Talg & barriär"),
        (16, FOREST,   "Hårbotten"),
    ]
    for r, col, _ in rings:
        ax.add_patch(Circle((cx, cy), r, facecolor=col, edgecolor="none", zorder=1, alpha=0.9))
    # Follicle (a simple sprout from centre) — echoes the Roots symbol
    ax.add_patch(Circle((cx, cy), 16, facecolor=FOREST, edgecolor="none", zorder=2))
    # sprout
    ax.add_patch(Wedge((cx, cy), 11, 60, 120, facecolor=OFFWHITE, edgecolor="none", zorder=3))
    stem = Line2D([cx, cx], [cy-2, cy+12], color=OFFWHITE, lw=3.2, zorder=4, solid_capstyle="round")
    ax.add_line(stem)
    ax.text(cx, cy-9, "hårstrå", ha="center", va="center", color=OFFWHITE,
            fontsize=10, fontfamily=BODY, zorder=5)

    # Ring labels
    label_pts = [(cx, cy+30, "MIKROBIOM", SAND_DARK),
                 (cx-22, cy+18, "BARRIÄR", SAND_DARK)]
    ax.text(cx, cy+31.3, "MIKROBIOM", ha="center", va="bottom", color=INK,
            fontsize=10.5, fontfamily=DISPLAY, fontweight="bold")

    # Three callouts on the right, each a pillar
    pillars = [
        (78, "LUGN", FOREST,
         "SyriCalm™ lugnar och\nstärker hudbarriären.",),
        (50, "FUKT + MIKROBIOM", SAND_DARK,
         "MultiMoist™ binder fukt och\nger prebiotisk näring.",),
        (22, "SKYDD", TERRA,
         "Antioxidanter värnar\nhårets keratin & lipider.",),
    ]
    for y, title, col, body in pillars:
        ax.add_patch(Circle((60, y), 1.5, facecolor=col, edgecolor="none", zorder=5))
        ax.plot([60, 64], [y, y], color=col, lw=1.6, zorder=4)
        ax.text(67, y+3.0, title, ha="left", va="center", color=INK,
                fontsize=12.5, fontfamily=DISPLAY, fontweight="bold")
        ax.text(67, y-2.4, body, ha="left", va="center", color=SAND_DARK,
                fontsize=10.5, fontfamily=BODY, linespacing=1.35)

    save(fig, "science_balance.png")


# ════════════════════════════════════════════════════════════
# 2. ECS / microbiome — "den tysta balansvakten"
# ════════════════════════════════════════════════════════════
def ecs_microbiome():
    fig, ax = plt.subplots(figsize=(9.5, 4.3))
    ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    fig.patch.set_facecolor(OFFWHITE)

    cards = [
        (4,  "Endocannabinoid-\nsystemet (ECS)", FOREST,
         "Hudens egna balanssystem.\nReceptorer i hårfolliklar och\ntalgkörtlar reglerar lugn, talg\noch barriär. Forskningen kallar\ndet hudens \u201dc(ut)annabinoid\u201d-\nsystem.",),
        (52, "Hårbottnens\nmikrobiom", SAND_DARK,
         "Ett levande ekosystem av\nbakterier och jäst. När balansen\nrubbas (hård tvätt, stress) blir\ndet klåda, mjäll och torrhet.\nPrebiotika hjälper de goda\nmikroberna att trivas.",),
    ]
    for x, title, col, body in cards:
        ax.add_patch(FancyBboxPatch((x, 8), 44, 84,
                     boxstyle="round,pad=0.6,rounding_size=3",
                     facecolor=WHITE, edgecolor=SAND_200, lw=1.2))
        ax.add_patch(FancyBboxPatch((x, 78), 44, 14,
                     boxstyle="round,pad=0.6,rounding_size=3",
                     facecolor=col, edgecolor="none"))
        ax.text(x+3, 84.5, title, ha="left", va="center", color=WHITE,
                fontsize=13, fontfamily=DISPLAY, fontweight="bold", linespacing=1.0)
        ax.text(x+3, 44, body, ha="left", va="center", color=INK,
                fontsize=10.0, fontfamily=BODY, linespacing=1.5)
    save(fig, "ecs_microbiome.png")


# ════════════════════════════════════════════════════════════
# 3. Ingredient hero cards (4)
# ════════════════════════════════════════════════════════════
def ingredient_cards():
    data = [
        ("SyriCalm™", "Vass + Poria cocos", FOREST,
         "Lugnar klåda och känslig\nhårbotten. Återställer\nbarriären. NATRUE/COSMOS."),
        ("MultiMoist™", "Rödbeta + prebiotika", SAND_DARK,
         "Binder fukt i hårstrået.\nMindre brott, frizz & statik.\nNärar mikrobiomet."),
        ("Panthenol", "Provitamin B5", OLIVE,
         "Fukt och spänst.\nGör håret mjukt,\nlättkammat och starkare."),
        ("Mentol", "Svalkande botanik", SKY,
         "Pigg, sval känsla i\nhårbotten. Doseras efter\ntycke (0,25 %)."),
    ]
    fig, axes = plt.subplots(1, 4, figsize=(13.5, 4.0))
    fig.patch.set_facecolor(OFFWHITE)
    for ax, (name, sub, col, body) in zip(axes, data):
        ax.set_xlim(0, 10); ax.set_ylim(0, 12); ax.axis("off")
        ax.add_patch(FancyBboxPatch((0.3, 0.3), 9.4, 11.4,
                     boxstyle="round,pad=0.1,rounding_size=0.5",
                     facecolor=WHITE, edgecolor=SAND_200, lw=1.2))
        ax.add_patch(Circle((5, 9.0), 1.25, facecolor=col, edgecolor="none"))
        ax.text(5, 6.7, name, ha="center", va="center", color=INK,
                fontsize=15, fontfamily=DISPLAY, fontweight="bold")
        ax.text(5, 5.7, sub.upper(), ha="center", va="center", color=col,
                fontsize=8.5, fontfamily=BODY, fontweight="bold")
        ax.text(5, 3.4, body, ha="center", va="center", color=SAND_DARK,
                fontsize=9.3, fontfamily=BODY, linespacing=1.5)
    fig.subplots_adjust(wspace=0.18)
    save(fig, "ingredient_cards.png")


# ════════════════════════════════════════════════════════════
# 4. Positioning map (2x2) — Roots vs marknaden
# ════════════════════════════════════════════════════════════
def positioning_map():
    fig, ax = plt.subplots(figsize=(9.0, 7.4))
    fig.patch.set_facecolor(OFFWHITE)
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis("off")

    # quadrant backdrop
    ax.add_patch(FancyBboxPatch((0.6, 0.6), 8.8, 8.8,
                 boxstyle="round,pad=0.02,rounding_size=0.15",
                 facecolor=WHITE, edgecolor=SAND_200, lw=1.2, zorder=0))
    ax.axvline(5.0, 1.0/10, 9.0/10, color=SAND_LIGHT, lw=1.2, zorder=1)
    ax.axhline(5.0, 1.0/10, 9.0/10, color=SAND_LIGHT, lw=1.2, zorder=1)

    # axis labels
    ax.text(5.0, 0.05, "ENGÅNGSKÖP  ·  KATALOG", ha="center", va="bottom",
            color=SAND_DARK, fontsize=9, fontfamily=BODY)
    ax.text(5.0, 9.95, "ÅTERKÖP  ·  EGEN HUDVÅRDSRUTIN", ha="center", va="top",
            color=SAND_DARK, fontsize=9, fontfamily=BODY)
    ax.text(0.18, 5.0, "COMMODITY", ha="center", va="center", rotation=90,
            color=SAND_DARK, fontsize=9, fontfamily=BODY)
    ax.text(9.82, 5.0, "PREMIUM · FORSKNING", ha="center", va="center", rotation=90,
            color=SAND_DARK, fontsize=9, fontfamily=BODY)

    competitors = [
        (2.4, 2.2, "Newbody", "strumpor"),
        (3.4, 2.0, "Godio", "godis"),
        (2.0, 3.4, "Toapapper", "Serla/Lambi"),
        (3.0, 6.4, "Föreningshäftet", "rabatter"),
    ]
    for x, y, name, sub in competitors:
        ax.add_patch(Circle((x, y), 0.16, facecolor=SAND_MED, edgecolor="none", zorder=3))
        ax.text(x+0.3, y, f"{name}", ha="left", va="center", color=INK,
                fontsize=10, fontfamily=BODY)
    # Roots — hero
    ax.add_patch(Circle((7.6, 7.8), 0.55, facecolor=FOREST, edgecolor="none", zorder=4, alpha=0.18))
    ax.add_patch(Circle((7.6, 7.8), 0.30, facecolor=FOREST, edgecolor="none", zorder=5))
    ax.text(7.6, 7.0, "ROOTS", ha="center", va="center", color=FOREST,
            fontsize=15, fontfamily=DISPLAY, fontweight="bold", zorder=6)
    ax.text(7.6, 6.55, "premium hårvård · nordiskt", ha="center", va="center",
            color=SAND_DARK, fontsize=9, fontfamily=BODY, zorder=6)
    save(fig, "positioning_map.png")


# ════════════════════════════════════════════════════════════
# 5. Värdejämförelse — varför premium ger mer i kassan
# ════════════════════════════════════════════════════════════
def value_compare():
    fig, ax = plt.subplots(figsize=(9.5, 4.8))
    fig.patch.set_facecolor(OFFWHITE)
    cats = ["Rabatthäfte", "Godis/kaffe", "Strumpor", "Roots hårvård"]
    # Illustrativt: snittordervärde (kr) — pedagogiskt, ej hård statistik
    order_value = [250, 350, 450, 590]
    cols = [SAND_MED, SAND_MED, SAND_MED, FOREST]
    bars = ax.bar(cats, order_value, color=cols, width=0.6, zorder=3)
    for b, v in zip(bars, order_value):
        ax.text(b.get_x()+b.get_width()/2, v+12, f"~{v} kr", ha="center",
                color=INK, fontsize=11, fontfamily=DISPLAY, fontweight="bold")
    ax.set_ylim(0, 700)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(axis="y", left=False, labelleft=False)
    ax.tick_params(axis="x", bottom=False, labelsize=11)
    for lbl in ax.get_xticklabels():
        lbl.set_fontfamily(BODY); lbl.set_color(INK)
    ax.set_title("Illustrativt snittordervärde + naturligt återköp",
                 fontfamily=BODY, fontsize=10.5, color=SAND_DARK, loc="left", pad=14)
    ax.set_facecolor(OFFWHITE)
    save(fig, "value_compare.png")


# ════════════════════════════════════════════════════════════
# 6. Product line — tre formuleringar (clean labels)
# ════════════════════════════════════════════════════════════
def product_line():
    fig, axes = plt.subplots(1, 3, figsize=(13.5, 5.0))
    fig.patch.set_facecolor(OFFWHITE)
    prods = [
        ("01", "PURE\nSHAMPOO", "Syricalm", FOREST,
         "Mild, sulfatsnäll tvätt\nsom lugnar hårbotten."),
        ("02", "PURE\nCONDITIONER", "Less perfume · Syricalm", SAND_DARK,
         "Återfuktar och reder ut.\nMinimal parfym."),
        ("03", "BODY\nWASH", "More perfume · Syricalm", TERRA,
         "Krämig, doftande tvätt\nsom värnar huden."),
    ]
    for ax, (num, name, sub, col, body) in zip(axes, prods):
        ax.set_xlim(0, 10); ax.set_ylim(0, 14); ax.axis("off")
        # bottle silhouette
        ax.add_patch(FancyBboxPatch((3.3, 1.4), 3.4, 7.2,
                     boxstyle="round,pad=0.1,rounding_size=0.7",
                     facecolor=SAND_100, edgecolor=SAND_200, lw=1.3))
        ax.add_patch(FancyBboxPatch((4.4, 8.5), 1.2, 1.5,
                     boxstyle="round,pad=0.05,rounding_size=0.25",
                     facecolor=SAND_LIGHT, edgecolor="none"))
        ax.add_patch(Circle((5.0, 6.2), 0.42, facecolor=col, edgecolor="none"))
        ax.text(5.0, 5.0, f"ROOTS / {num}", ha="center", va="center",
                color=SAND_DARK, fontsize=8, fontfamily=BODY)
        ax.text(5.0, 3.9, name, ha="center", va="center", color=INK,
                fontsize=11.5, fontfamily=DISPLAY, fontweight="bold", linespacing=1.0)
        ax.text(5.0, 0.7, body, ha="center", va="center", color=SAND_DARK,
                fontsize=9.2, fontfamily=BODY, linespacing=1.4)
        ax.text(5.0, 11.0, sub.upper(), ha="center", va="center", color=col,
                fontsize=8.5, fontfamily=BODY, fontweight="bold")
    fig.subplots_adjust(wspace=0.1)
    save(fig, "product_line.png")


# ════════════════════════════════════════════════════════════
# 7. Säljresa — 4 steg
# ════════════════════════════════════════════════════════════
def sales_journey():
    fig, ax = plt.subplots(figsize=(13.5, 3.0))
    fig.patch.set_facecolor(OFFWHITE)
    ax.set_xlim(0, 100); ax.set_ylim(0, 30); ax.axis("off")
    steps = [
        ("1", "Dela din länk", "QR + personlig\nwebbshop"),
        ("2", "Berätta varför", "Nordiskt, snällt\nmot håret"),
        ("3", "Kunden köper", "Klarna / Swish\ni mobilen"),
        ("4", "Kassan växer", "Realtid i\nföreningens panel"),
    ]
    x0, gap = 8, 23
    for i, (num, title, body) in enumerate(steps):
        x = x0 + i*gap
        ax.add_patch(Circle((x, 20), 3.2, facecolor=FOREST, edgecolor="none", zorder=3))
        ax.text(x, 20, num, ha="center", va="center", color=WHITE,
                fontsize=15, fontfamily=DISPLAY, fontweight="bold", zorder=4)
        ax.text(x, 13, title, ha="center", va="center", color=INK,
                fontsize=12, fontfamily=DISPLAY, fontweight="bold")
        ax.text(x, 7.5, body, ha="center", va="center", color=SAND_DARK,
                fontsize=9.5, fontfamily=BODY, linespacing=1.4)
        if i < 3:
            ax.add_patch(FancyArrowPatch((x+4, 20), (x+gap-4, 20),
                         arrowstyle="-|>", mutation_scale=14,
                         color=SAND_LIGHT, lw=1.6, zorder=2))
    save(fig, "sales_journey.png")


if __name__ == "__main__":
    science_balance()
    ecs_microbiome()
    ingredient_cards()
    positioning_map()
    value_compare()
    product_line()
    sales_journey()
    print("\nAll graphics generated.")
