#!/usr/bin/env python3
"""Bygger Roots_Rollkarta.pdf — en visuell karta över rollerna och flödena på Roots-plattformen."""
import glob
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
import matplotlib.image as mpimg

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))
OUT = os.path.join(ROOT, "Roots_Rollkarta.pdf")

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
TERRA_SOFT = "#FBEFE9"
SKY = "#A7BBC5"
SKY_SOFT = "#EDF2F5"

for f in glob.glob(os.path.expanduser("~/Library/Fonts/AlanSans*.ttf")) + \
         glob.glob(os.path.expanduser("~/Library/Fonts/Inter_18pt*.ttf")):
    fm.fontManager.addfont(f)

HEAD = "Alan Sans"
BODY = "Inter 18pt"
plt.rcParams["pdf.fonttype"] = 42

PAGE_W, PAGE_H = 16.54, 11.69          # A3 liggande
XMAX, YMAX = 1654, 1169


def new_page(pdf_color=OFFWHITE):
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, XMAX)
    ax.set_ylim(0, YMAX)
    ax.axis("off")
    fig.patch.set_facecolor(pdf_color)
    return fig, ax


def rounded(ax, x, y, w, h, fc, ec=None, lw=1.2, r=14, z=2):
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad=0,rounding_size={r}",
                       fc=fc, ec=ec or fc, lw=lw, zorder=z)
    ax.add_patch(p)
    return p


def chip(ax, x, y, text, fc, tc=WHITE, size=8.2, z=4, pad_x=10):
    w = pad_x * 2 + len(text) * size * 0.78
    rounded(ax, x, y, w, 24, fc, r=12, z=z)
    ax.text(x + w / 2, y + 12, text, ha="center", va="center",
            fontfamily=BODY, fontsize=size, fontweight="bold", color=tc, zorder=z + 1)
    return w


def header(ax, title, subtitle):
    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-black.png"))
    lh = 46
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(60, 60 + lw, YMAX - 110, YMAX - 110 + lh),
              aspect="auto", zorder=5)
    ax.text(60, YMAX - 165, title, fontfamily=HEAD, fontsize=27,
            fontweight="bold", color=INK, va="top")
    ax.text(60, YMAX - 212, subtitle, fontfamily=BODY, fontsize=11.5,
            color=SAND_DARK, va="top")
    ax.plot([60, XMAX - 60], [YMAX - 235, YMAX - 235], color=SAND_LIGHT, lw=1.2)


def role_card(ax, x, y, w, h, accent, soft, tag, title, lines, route=None):
    rounded(ax, x, y, w, h, WHITE, ec=SAND_LIGHT, lw=1.3, r=16, z=2)
    ax.add_patch(FancyBboxPatch((x, y + h - 8), w, 8,
                                boxstyle="round,pad=0,rounding_size=4",
                                fc=accent, ec=accent, zorder=3))
    chip(ax, x + 18, y + h - 48, tag, soft, tc=accent, size=7.6)
    ax.text(x + 18, y + h - 66, title, fontfamily=HEAD, fontsize=14.5,
            fontweight="bold", color=INK, va="top", zorder=4)
    ty = y + h - 94
    for line in lines:
        ax.text(x + 18, ty, line, fontfamily=BODY, fontsize=8.6,
                color=SAND_DARK, va="top", zorder=4)
        ty -= 17
    if route:
        chip(ax, x + 18, y + 14, route, SAND_100, tc=SAND_DARK, size=7.4)


def arrow(ax, p1, p2, label=None, color=SAND_DARK, lw=2.0, rad=0.0,
          dashed=False, label_dy=14, label_pos=0.5, fs=8.6, lc=None, z=6):
    a = FancyArrowPatch(p1, p2, connectionstyle=f"arc3,rad={rad}",
                        arrowstyle="-|>", mutation_scale=17, lw=lw,
                        color=color, zorder=z,
                        linestyle=(0, (5, 4)) if dashed else "solid",
                        shrinkA=4, shrinkB=6)
    ax.add_patch(a)
    if label:
        mx = p1[0] + (p2[0] - p1[0]) * label_pos
        my = p1[1] + (p2[1] - p1[1]) * label_pos
        # arc-offset: flytta etiketten mot bågens utsida
        my += -rad * 1.45 * abs(p2[0] - p1[0]) * 0.5 + label_dy
        ax.text(mx, my, label, ha="center", va="center", fontfamily=BODY,
                fontsize=fs, fontweight="bold", color=lc or color, zorder=7,
                bbox=dict(boxstyle="round,pad=0.38", fc=OFFWHITE, ec="none"))


def badge(ax, x, y, n, color, r=14):
    ax.add_patch(plt.Circle((x, y), r, fc=color, ec=WHITE, lw=2, zorder=9))
    ax.text(x, y, str(n), ha="center", va="center", fontfamily=HEAD,
            fontsize=10, fontweight="bold", color=WHITE, zorder=10)


# ═════════════════════════ SIDA 1 — KARTAN ═══════════════════════════
def page_map(pdf):
    fig, ax = new_page()
    header(ax, "Så hänger Roots ihop",
           "Rollerna på plattformen och hur de kopplas till varandra — från första säljsamtal till pengar i föreningskassan. "
           "Siffrorna på pilarna förklaras längst ner.")

    SKY_DARK = "#6E8694"
    CW, CH = 230, 184
    CY = 540
    mid = CY + CH / 2
    X = {"roots": 67, "forening": 400, "lagledare": 730, "saljare": 1060, "supporter": 1390}

    # — Roots internt (grupp till vänster) —
    rounded(ax, 47, 180, CW + 40, 600, SAND_100, ec=SAND_LIGHT, lw=1.2, r=18, z=1)
    ax.text(67, 762, "ROOTS INTERNT", fontfamily=BODY, fontsize=8.4,
            fontweight="bold", color=SAND_DARK, va="top", zorder=3)

    role_card(ax, X["roots"], CY, CW, CH, INK, SAND_100, "SALES_REP",
              "Säljrepresentant",
              ["Prospekterar föreningar och",
               "klubbar. Pipeline, offerter och",
               "provision i portalen."],
              route="/portal/pipeline")

    role_card(ax, X["roots"], 230, CW, CH, INK, SAND_100, "INTERNAL_ADMIN",
              "Intern admin",
              ["Systemhälsa, organisationer,",
               "support, audit-log och",
               "Fortnox-koppling."],
              route="/portal/system")

    # — Publik besökare (ovanför föreningen) —
    role_card(ax, X["forening"], 780, CW, 150, TERRA, TERRA_SOFT, "PUBLIC",
              "Publik besökare",
              ["Landar på roots.se, läser om",
               "modellen och gör håranalysen."])

    # — Huvudkedjan —
    role_card(ax, X["forening"], CY, CW, CH, FOREST, FOREST_SOFT, "ASSOCIATION_ADMIN",
              "Föreningsadmin",
              ["Startar kampanjer, bjuder in",
               "lagledare och följer intäkterna",
               "i realtid."],
              route="/forening")

    role_card(ax, X["lagledare"], CY, CW, CH, FOREST, FOREST_SOFT, "TEAM_LEADER",
              "Lagledare",
              ["Skapar laget, bjuder in säljare",
               "och följer lagets försäljning",
               "och mål."],
              route="/lag")

    role_card(ax, X["saljare"], CY, CW, CH, FOREST, FOREST_SOFT, "SELLER",
              "Säljare",
              ["Ungdom/medlem med personlig",
               "shop. Delar länk + QR och får",
               "AI-coachning."],
              route="/min-shop")

    role_card(ax, X["supporter"], CY, CW, CH, TERRA, TERRA_SOFT, "PUBLIC (köpare)",
              "Supporter",
              ["Förälder, granne eller farmor",
               "som handlar via säljarens länk",
               "och betalar med Klarna/Swish."],
              route="/shop/[säljare]")

    # — Klubb B2B (nedre spåret) —
    role_card(ax, 480, 230, CW, CH, SKY, SKY_SOFT, "CLUB_ADMIN / CLUB_MEMBER",
              "Klubb (B2B)",
              ["Klubbhus/kansli som lägger",
               "återkommande grossistordrar",
               "och ser fakturor."],
              route="/portal/bestallningar")

    # — Pilar med numrerade steg —
    arrow(ax, (X["roots"] + CW, mid), (X["forening"], mid), color=INK)
    badge(ax, 348, mid, 1, INK)

    arrow(ax, (X["forening"] + CW / 2, 780), (X["forening"] + CW / 2, CY + CH), color=TERRA)
    badge(ax, X["forening"] + CW / 2, 752, 2, TERRA)

    arrow(ax, (X["forening"] + CW, mid), (X["lagledare"], mid), color=FOREST)
    badge(ax, 680, mid, 3, FOREST)

    arrow(ax, (X["lagledare"] + CW, mid), (X["saljare"], mid), color=FOREST)
    badge(ax, 1010, mid, 4, FOREST)

    arrow(ax, (X["saljare"] + CW, mid), (X["supporter"], mid), color=FOREST)
    badge(ax, 1340, mid, 5, FOREST)

    # Pengaflödet tillbaka — båge under kedjan
    arrow(ax, (X["supporter"] + CW / 2, CY), (X["forening"] + CW / 2 + 40, CY),
          color=FOREST, lw=3.2, rad=-0.30)
    badge(ax, 1030, 412, 6, FOREST)

    # Klubbspåret
    arrow(ax, (X["roots"] + CW, 565), (480, 350), color=SKY_DARK, rad=0.15)
    badge(ax, 400, 470, 7, SKY_DARK)
    arrow(ax, (480, 280), (337, 280), color=SKY_DARK)
    badge(ax, 408, 280, 8, SKY_DARK)

    # — AI-lagret (notis till höger om klubben) —
    rounded(ax, 1170, 250, 450, 120, INK, r=16, z=2)
    ax.text(1196, 340, "OPEN CLAW · AI-LAGRET", fontfamily=BODY, fontsize=8.4,
            fontweight="bold", color="#C1BF99", va="center", zorder=4)
    for j, line in enumerate(["Stöttar tvärs över rollerna: säljtips till säljare,",
                              "pipelinehjälp för säljrep, assistent i portalen",
                              "och chattwidget för publika besökare."]):
        ax.text(1196, 308 - j * 21, line, fontfamily=BODY, fontsize=8.8,
                color=SAND_LIGHT, va="center", zorder=4)

    # — Förklaringspanel —
    rounded(ax, 47, 40, XMAX - 94, 150, WHITE, ec=SAND_LIGHT, lw=1.3, r=16, z=2)
    steps = [
        (1, INK, "Säljrep prospekterar, skickar offert och onboardar föreningen"),
        (2, TERRA, "…eller föreningen registrerar sig själv direkt på roots.se"),
        (3, FOREST, "Föreningsadmin bjuder in lagledare via team-invites"),
        (4, FOREST, "Lagledaren bjuder in sina säljare — spelare och medlemmar"),
        (5, FOREST, "Säljaren delar personlig shoplänk + QR till familj och vänner"),
        (6, FOREST, "Supportern köper via Klarna/Swish — pengarna går till föreningskassan"),
        (7, SKY_DARK, "Säljrep tecknar även B2B-avtal med klubbar och kanslier"),
        (8, SKY_DARK, "Klubben lägger återkommande grossistordrar hos Roots"),
    ]
    for i, (n, c, t) in enumerate(steps):
        col, row = i // 4, i % 4
        bx = 100 + col * 790
        by = 160 - row * 33
        badge(ax, bx, by, n, c, r=11)
        ax.text(bx + 24, by, t, fontfamily=BODY, fontsize=8.8, color=INK,
                va="center", zorder=4)

    ax.text(XMAX - 60, 16, "Roots · Rollkarta · sida 1 av 2", ha="right",
            fontfamily=BODY, fontsize=8, color=SAND_MED)
    pdf.savefig(fig)
    plt.close(fig)


# ═══════════════════════ SIDA 2 — ROLLERNA I DETALJ ═══════════════════
def page_roles(pdf):
    fig, ax = new_page()
    header(ax, "Rollerna i detalj",
           "Vad varje roll gör, var de bor i produkten och vad som driver dem framåt.")

    roles = [
        (TERRA, TERRA_SOFT, "PUBLIC", "Publik besökare", "roots.se",
         ["Möter varumärket första gången.",
          "Gör håranalysen (lead magnet),",
          "läser om modellen och produkterna.",
          "Konverterar till förening eller köp."]),
        (FOREST, FOREST_SOFT, "ASSOCIATION_ADMIN", "Föreningsadmin", "/forening",
         ["Äger föreningens konto och kampanjer.",
          "Bjuder in lagledare via team-invites.",
          "Följer intäkter, ordrar och utbetalningar.",
          "Föreningens ansikte mot Roots."]),
        (FOREST, FOREST_SOFT, "TEAM_LEADER", "Lagledare", "/lag",
         ["Skapar och driver sitt lag i kampanjen.",
          "Bjuder in säljare (spelare/medlemmar).",
          "Ser lagets försäljning, mål och topplista.",
          "Peppar och påminner under kampanjen."]),
        (FOREST, FOREST_SOFT, "SELLER", "Säljare", "/min-shop",
         ["Ungdomen eller medlemmen som säljer.",
          "Personlig shopsida med egen länk + QR.",
          "Delar i sociala medier och till familjen.",
          "AI-coachen ger säljtips och svar."]),
        (TERRA, TERRA_SOFT, "PUBLIC (köpare)", "Supporter", "/shop/[säljare]",
         ["Köparen — förälder, granne, kollega.",
          "Handlar via säljarens personliga sida.",
          "Betalar med Klarna eller Swish.",
          "Varje köp krediteras rätt säljare."]),
        (SKY, SKY_SOFT, "CLUB_ADMIN / CLUB_MEMBER", "Klubb (B2B)", "/portal/bestallningar",
         ["Klubbhus eller kansli som handlar i bulk.",
          "Återkommande grossistordrar på avtal.",
          "Ser fakturor, priser och orderhistorik.",
          "Admin hanterar medlemmarnas behörighet."]),
        (INK, SAND_100, "SALES_REP / SALES_ADMIN", "Säljrepresentant", "/portal/pipeline",
         ["Roots interna säljkår mot föreningslivet.",
          "Pipeline, offerter och aktivitetslogg.",
          "Onboardar föreningar och klubbar.",
          "Sales admin ser hela teamets siffror."]),
        (INK, SAND_100, "INTERNAL_ADMIN", "Intern admin", "/portal/system",
         ["Drift och översikt av hela plattformen.",
          "Organisationer, kampanjer och support.",
          "Audit-log, systemhälsa och statistik.",
          "Fortnox-koppling för ekonomiflödet."]),
    ]

    CW2, CH2 = 370, 360
    gap = (XMAX - 4 * CW2 - 120) / 3
    for i, (accent, soft, tag, title, route, lines) in enumerate(roles):
        col, row = i % 4, i // 4
        x = 60 + col * (CW2 + gap)
        y = 480 - row * (CH2 + 50)
        rounded(ax, x, y, CW2, CH2, WHITE, ec=SAND_LIGHT, lw=1.3, r=16, z=2)
        ax.add_patch(FancyBboxPatch((x, y + CH2 - 8), CW2, 8,
                                    boxstyle="round,pad=0,rounding_size=4",
                                    fc=accent, ec=accent, zorder=3))
        chip(ax, x + 22, y + CH2 - 56, tag, soft, tc=accent if accent != INK else SAND_DARK, size=7.8)
        ax.text(x + 22, y + CH2 - 78, title, fontfamily=HEAD, fontsize=17,
                fontweight="bold", color=INK, va="top", zorder=4)
        ty = y + CH2 - 122
        for line in lines:
            ax.plot([x + 26, x + 26], [ty - 3.2, ty - 3.2], marker="o", ms=2.6,
                    color=accent, zorder=4)
            ax.text(x + 40, ty, line, fontfamily=BODY, fontsize=8.8,
                    color=SAND_DARK, va="center", zorder=4)
            ty -= 30
        chip(ax, x + 22, y + 22, route, SAND_100, tc=SAND_DARK, size=7.6)

    ax.text(XMAX - 60, 28, "Roots · Rollkarta · sida 2 av 2", ha="right",
            fontfamily=BODY, fontsize=8, color=SAND_MED)
    pdf.savefig(fig)
    plt.close(fig)


with PdfPages(OUT) as pdf:
    page_map(pdf)
    page_roles(pdf)
print("Saved", os.path.relpath(OUT, ROOT))
