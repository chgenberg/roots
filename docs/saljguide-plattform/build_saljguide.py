#!/usr/bin/env python3
"""Bygger Roots_Saljguide_Plattform.pdf — en säljguide som förklarar hela
plattformen och vad säljkåren kan sälja. A4 stående, brand-anpassad."""
import glob
import os
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
import matplotlib.image as mpimg

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))
OUT = os.path.join(ROOT, "Roots_Saljguide_Plattform.pdf")

# ── Brand (E13-tokens) ───────────────────────────────────────────────
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
SUN = "#ECD488"
SUN_SOFT = "#FBF4DC"
OLIVE = "#C1BF99"

for f in glob.glob(os.path.expanduser("~/Library/Fonts/AlanSans*.ttf")) + \
         glob.glob(os.path.expanduser("~/Library/Fonts/Inter_18pt*.ttf")):
    fm.fontManager.addfont(f)

HEAD = "Alan Sans"
BODY = "Inter 18pt"
plt.rcParams["pdf.fonttype"] = 42

PAGE_W, PAGE_H = 8.27, 11.69            # A4 stående
XMAX, YMAX = 827, 1169
MX = 60                                  # sidmarginal


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


def chip(ax, x, y, text, fc, tc=WHITE, size=7.6, z=4, pad_x=9, h=22):
    w = pad_x * 2 + len(text) * size * 0.74
    rounded(ax, x, y, w, h, fc, r=h / 2, z=z)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontfamily=BODY, fontsize=size, fontweight="bold", color=tc, zorder=z + 1)
    return w


def badge(ax, x, y, n, color, r=15):
    ax.add_patch(plt.Circle((x, y), r, fc=color, ec=WHITE, lw=2.2, zorder=9))
    ax.text(x, y, str(n), ha="center", va="center", fontfamily=HEAD,
            fontsize=11, fontweight="bold", color=WHITE, zorder=10)


def wrap(text, width):
    return textwrap.wrap(text, width=width)


def footer(ax, page_no):
    ax.plot([MX, XMAX - MX], [56, 56], color=SAND_LIGHT, lw=1)
    ax.text(MX, 38, "Roots Nordic · Säljguide", fontfamily=BODY,
            fontsize=7.6, color=SAND_MED, va="center")
    ax.text(XMAX - MX, 38, f"{page_no} / 6", ha="right", fontfamily=BODY,
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


# ═════════════════════════ SIDA 1 — OMSLAG ═══════════════════════════
def page_cover(pdf):
    fig, ax = new_page(FOREST)

    # mjuk symbol-vattenstämpel nere till höger
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

    ax.text(MX, 760, "SÄLJGUIDE", fontfamily=BODY, fontsize=12,
            fontweight="bold", color=SUN, va="top", zorder=5)
    ax.text(MX, 720, "Roots-plattformen", fontfamily=HEAD, fontsize=46,
            fontweight="bold", color=WHITE, va="top", zorder=5)
    ax.text(MX, 648, "Så funkar flödet — och vad du säljer", fontfamily=HEAD,
            fontsize=22, fontweight="bold", color=OLIVE, va="top", zorder=5)

    for i, ln in enumerate(wrap(
        "Den här guiden ger dig hela bilden: vad Roots är, vilka produkter och "
        "affärsmodeller du erbjuder, hur plattformen knyter ihop förening, lag, "
        "säljare och köpare — och hur du tar en förening från första samtal till "
        "pengar i kassan.", 64)):
        ax.text(MX, 560 - i * 22, ln, fontfamily=BODY, fontsize=11.5,
                color="#E7EAE0", va="top", zorder=5)

    # tre snabb-chips
    cx = MX
    for label in ["Föreningsförsäljning", "Klubb & grossist", "AI-stöd hela vägen"]:
        w = chip(ax, cx, 360, label, "#5A6743", tc=WHITE, size=9, h=28, pad_x=14)
        cx += w + 12

    ax.text(MX, 150, "Internt säljmaterial", fontfamily=BODY, fontsize=9,
            color="#C7CFBA", va="center", zorder=5)
    ax.text(XMAX - MX, 150, "roots-nordic.se", ha="right", fontfamily=BODY,
            fontsize=9, color="#C7CFBA", va="center", zorder=5)
    ax.plot([MX, XMAX - MX], [128, 128], color="#5A6743", lw=1, zorder=4)

    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 2 — OM ROOTS ═════════════════════════
def page_about(pdf):
    fig, ax = new_page()
    y = header(ax, "Det här säljer du in",
               "Roots i korthet",
               "Premiumvård för hår och kropp, utvecklad i Norden — såld på ett "
               "sätt som låter föreningar tjäna pengar utan kakförsäljning eller "
               "lotter. Du säljer både en bättre produkt och en smartare modell.")

    intro = ("Roots är ett nordiskt vård-varumärke och en digital plattform i ett. "
             "Föreningar och klubbar säljer schampo, balsam och kroppstvätt av hög "
             "kvalitet till sina medlemmar och supportrar — och behåller en tydlig "
             "marginal. Allt sker digitalt: personliga shoppar, Klarna/Swish, "
             "realtidsstatistik och automatisk avräkning.")
    for ln in wrap(intro, 92):
        ax.text(MX, y, ln, fontfamily=BODY, fontsize=10, color=INK, va="top")
        y -= 16
    y -= 24

    ax.text(MX, y, "Två sätt att tjäna pengar med Roots", fontfamily=HEAD,
            fontsize=15, fontweight="bold", color=INK, va="top")
    y -= 34

    CW = (XMAX - 2 * MX - 24) / 2
    CH = 372
    cy = y - CH

    def model_card(x, accent, soft, tag, title, lead, bullets, who):
        rounded(ax, x, cy, CW, CH, WHITE, ec=SAND_LIGHT, lw=1.3, r=18)
        ax.add_patch(FancyBboxPatch((x, cy + CH - 8), CW, 8,
                                    boxstyle="round,pad=0,rounding_size=4",
                                    fc=accent, ec=accent, zorder=3))
        chip(ax, x + 22, cy + CH - 52, tag, soft, tc=accent, size=7.6)
        ax.text(x + 22, cy + CH - 76, title, fontfamily=HEAD, fontsize=16,
                fontweight="bold", color=INK, va="top")
        ty = cy + CH - 106
        for ln in wrap(lead, 44):
            ax.text(x + 22, ty, ln, fontfamily=BODY, fontsize=9, color=SAND_DARK, va="top")
            ty -= 14
        ty -= 10
        for b in bullets:
            ax.plot([x + 27, x + 27], [ty - 4, ty - 4], marker="o", ms=3, color=accent)
            for k, ln in enumerate(wrap(b, 40)):
                ax.text(x + 42, ty, ln, fontfamily=BODY, fontsize=8.8,
                        color=INK, va="top")
                ty -= 14
            ty -= 5
        chip(ax, x + 22, cy + 20, who, SAND_100, tc=SAND_DARK, size=7.4)

    model_card(MX, FOREST, FOREST_SOFT, "B2B2C", "Föreningsförsäljning",
               "Klassisk lagförsäljning — fast digital. Laget säljer via personliga "
               "shoppar och föreningen behåller marginalen.",
               ["Förening startar kampanj med mål och säljperiod",
                "Lagledare bjuder in spelare/medlemmar som säljare",
                "Säljaren delar länk + QR; supportrar köper online",
                "Föreningen behåller ~25 % marginal, utbetalas automatiskt"],
               "Föreningar · lag · idrott")

    model_card(MX + CW + 24, SKY, SKY_SOFT, "B2B", "Klubb & grossist",
               "För klubbhus och kanslier som vill köpa återkommande i bulk till "
               "avtalspris — utan kampanj.",
               ["Klubben handlar i grossistportalen på avtal",
                "Återkommande ordrar och fakturahantering",
                "Fast pris, orderhistorik och leveransspårning",
                "Passar caféer, kanslier och butiker"],
               "Klubbhus · kanslier")

    footer(ax, 2)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 3 — PRODUKTERNA ══════════════════════
def page_products(pdf):
    fig, ax = new_page()
    y = header(ax, "Vad du säljer",
               "Tre produkter, ett komplett sortiment",
               "Skonsamma, nordiska formuleringar för hela familjen — samma pris-"
               "klass som vanliga märken, men bättre för hår och hårbotten.")

    products = [
        (FOREST, FOREST_SOFT, "Roots Shampoo", "149 kr",
         "Naturligt schampo med nordiska botaniska extrakt. Rengör skonsamt — "
         "för alla hårtyper."),
        (TERRA, TERRA_SOFT, "Roots Conditioner", "149 kr",
         "Balsam med växtbaserade oljor som ger mjukt, hanterbart hår utan att "
         "tynga ner."),
        (SKY, SKY_SOFT, "Roots Body Wash", "129 kr",
         "Mild kroppstvätt med fräscha nordiska botanicals. Skonsam mot huden, "
         "dag efter dag."),
    ]

    gap = 20
    CW = (XMAX - 2 * MX - 2 * gap) / 3
    CH = 250
    cy = y - CH
    for i, (accent, soft, name, price, desc) in enumerate(products):
        x = MX + i * (CW + gap)
        rounded(ax, x, cy, CW, CH, WHITE, ec=SAND_LIGHT, lw=1.3, r=16)
        rounded(ax, x, cy + CH - 72, CW, 72, soft, ec=soft, r=16, z=1)
        ax.add_patch(plt.Rectangle((x, cy + CH - 72), CW, 30, fc=soft, ec="none", zorder=1))
        ax.text(x + 20, cy + CH - 34, name, fontfamily=HEAD, fontsize=13.5,
                fontweight="bold", color=INK, va="center")
        ax.text(x + 20, cy + CH - 110, price, fontfamily=HEAD, fontsize=20,
                fontweight="bold", color=accent, va="center")
        ty = cy + CH - 142
        for ln in wrap(desc, 34):
            ax.text(x + 20, ty, ln, fontfamily=BODY, fontsize=8.8,
                    color=SAND_DARK, va="top")
            ty -= 14
        chip(ax, x + 20, cy + 18, "Styckevis eller i kit", SAND_100,
             tc=SAND_DARK, size=7)

    # Complete Kit-banner
    by = cy - 96
    rounded(ax, MX, by, XMAX - 2 * MX, 78, INK, r=16)
    ax.text(MX + 26, by + 50, "Roots Complete Kit", fontfamily=HEAD,
            fontsize=15, fontweight="bold", color=WHITE, va="center")
    ax.text(MX + 26, by + 26, "Schampo + balsam + kroppstvätt i ett paket — den enkla merförsäljningen.",
            fontfamily=BODY, fontsize=9, color=SAND_LIGHT, va="center")
    chip(ax, XMAX - MX - 120, by + 28, "399 kr", SUN, tc=INK, size=12, h=34, pad_x=16)

    # Nyckelingredienser
    iy = by - 50
    ax.text(MX, iy, "Nyckelingredienser att lyfta i pitchen", fontfamily=HEAD,
            fontsize=14, fontweight="bold", color=INK, va="top")
    iy -= 34
    ings = [
        (FOREST, "SyriCalm", "Lugnar känslig hårbotten och stöttar hudens balans."),
        (TERRA, "MultiMoist", "Långvarig återfuktning för hår och hud."),
        (SKY, "Menthol", "Svalkande känsla och en pigg, ren upplevelse."),
        (SAND_DARK, "Panthenol (B5)", "Stärker och ger lyster åt håret."),
    ]
    icw = (XMAX - 2 * MX - 3 * 16) / 4
    for i, (accent, name, desc) in enumerate(ings):
        x = MX + i * (icw + 16)
        rounded(ax, x, iy - 120, icw, 120, OFFWHITE, ec=SAND_LIGHT, lw=1.1, r=14)
        ax.add_patch(plt.Circle((x + 24, iy - 26), 7, fc=accent, ec="none", zorder=4))
        ax.text(x + 40, iy - 26, name, fontfamily=HEAD, fontsize=11,
                fontweight="bold", color=INK, va="center")
        ty = iy - 52
        for ln in wrap(desc, 26):
            ax.text(x + 16, ty, ln, fontfamily=BODY, fontsize=8.2,
                    color=SAND_DARK, va="top")
            ty -= 13

    # vetenskaps-notis
    ny = iy - 120 - 30
    rounded(ax, MX, ny - 56, XMAX - 2 * MX, 56, FOREST_SOFT, ec=FOREST_SOFT, r=14)
    note = ("Berätta historien: Roots är formulerat med omtanke om hårbottnens "
            "mikrobiom och hudens egna balanssystem — inte bara doft och skum. "
            "Det är vinkeln som skiljer oss från hyllan i mataffären.")
    ty = ny - 16
    for ln in wrap(note, 96):
        ax.text(MX + 22, ty, ln, fontfamily=BODY, fontsize=8.8, color=INK, va="top")
        ty -= 14

    footer(ax, 3)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 4 — FLÖDET ═══════════════════════════
def page_flow(pdf):
    fig, ax = new_page()
    y = header(ax, "Så funkar plattformen",
               "Från första samtal till pengar i kassan",
               "Sex steg som tar en förening hela vägen. Allt sker digitalt och "
               "uppdateras i realtid — du behöver inte lova något som kräver papper.")

    steps = [
        (FOREST, "Kampanjen startas",
         "Föreningen registrerar sig (eller onboardas av dig) och startar en "
         "kampanj med mål, säljperiod och leveransdatum."),
        (FOREST, "Lag & säljare bjuds in",
         "Föreningsadmin bjuder in lagledare, som i sin tur bjuder in spelare och "
         "medlemmar som säljare — via länk eller Excel-import."),
        (TERRA, "Personlig shop delas",
         "Varje säljare får en egen shopsida med unik länk + QR-kod att dela med "
         "familj, vänner och i sociala medier."),
        (TERRA, "Supportern köper",
         "Köpet sker online och betalas med Klarna eller Swish. Varje order "
         "krediteras automatiskt rätt säljare och lag."),
        (SKY, "Allt syns live",
         "Förening, lag och säljare följer försäljning, mål och topplistor i "
         "realtid. AI-coachen ger säljtips på vägen."),
        (FOREST, "Leverans & avräkning",
         "Produkterna levereras (samlat till klubben eller direkt till köparen) "
         "och föreningens marginal betalas ut automatiskt."),
    ]

    line_x = MX + 26
    top = y - 6
    bottom = 96
    ax.plot([line_x, line_x], [bottom, top], color=SAND_LIGHT, lw=2.4, zorder=1)

    n = len(steps)
    span = top - bottom
    for i, (accent, title, desc) in enumerate(steps):
        cy = top - 30 - i * (span / n)
        badge(ax, line_x, cy, i + 1, accent, r=17)
        cardx = line_x + 44
        cardw = XMAX - MX - cardx
        ax.text(cardx, cy + 16, title, fontfamily=HEAD, fontsize=13.5,
                fontweight="bold", color=INK, va="center")
        ty = cy - 2
        for ln in wrap(desc, 74):
            ax.text(cardx, ty, ln, fontfamily=BODY, fontsize=9.2,
                    color=SAND_DARK, va="top")
            ty -= 14

    footer(ax, 4)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 5 — ROLLERNA ═════════════════════════
def page_roles(pdf):
    fig, ax = new_page()
    y = header(ax, "Vem är vem",
               "Rollerna i plattformen",
               "Sex roller knyter ihop hela kedjan. Lär dig dem — då kan du svara "
               "på vem som gör vad och var pengarna landar.")

    roles = [
        (FOREST, FOREST_SOFT, "FÖRENING", "Föreningsadmin",
         "Äger kontot och kampanjerna. Bjuder in lagledare, sätter mål och "
         "säljperioder och följer intäkter och utbetalningar."),
        (FOREST, FOREST_SOFT, "LAG", "Lagledare",
         "Tränaren eller föräldern med ett konto per lag. Bjuder in säljare, "
         "peppar laget och följer försäljning, mål och topplista."),
        (TERRA, TERRA_SOFT, "SÄLJARE", "Säljaren",
         "Spelaren eller medlemmen med en personlig shop, egen länk och QR. "
         "Lägger även egna ordrar (kontant/Swish) och får AI-coachning."),
        (TERRA, TERRA_SOFT, "KÖPARE", "Supportern",
         "Förälder, granne eller farmor som handlar via säljarens sida och "
         "betalar med Klarna eller Swish. Varje köp krediteras rätt säljare."),
        (SKY, SKY_SOFT, "B2B", "Klubben",
         "Klubbhus eller kansli som köper i bulk till avtalspris. Lägger "
         "återkommande grossistordrar och ser fakturor och leveranser."),
        (INK, SAND_100, "DU", "Säljrepresentant",
         "Roots säljkår mot föreningslivet — det är du. Prospekterar, skickar "
         "offert, onboardar och följer pipeline och provision i portalen."),
    ]

    gap = 22
    CW = (XMAX - 2 * MX - gap) / 2
    CH = 178
    rows = 3
    top = y - 6
    for i, (accent, soft, tag, title, desc) in enumerate(roles):
        col, row = i % 2, i // 2
        x = MX + col * (CW + gap)
        cy = top - CH - row * (CH + 22)
        rounded(ax, x, cy, CW, CH, WHITE, ec=SAND_LIGHT, lw=1.3, r=16)
        ax.add_patch(FancyBboxPatch((x, cy), 8, CH,
                                    boxstyle="round,pad=0,rounding_size=4",
                                    fc=accent, ec=accent, zorder=3))
        chip(ax, x + 24, cy + CH - 44, tag, soft,
             tc=accent if accent != INK else SAND_DARK, size=7.4)
        ax.text(x + 24, cy + CH - 66, title, fontfamily=HEAD, fontsize=15,
                fontweight="bold", color=INK, va="top")
        ty = cy + CH - 94
        for ln in wrap(desc, 50):
            ax.text(x + 24, ty, ln, fontfamily=BODY, fontsize=9, color=SAND_DARK, va="top")
            ty -= 15

    footer(ax, 5)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 6 — SÄLJ & SVAR ══════════════════════
def page_pitch(pdf):
    fig, ax = new_page()
    y = header(ax, "Så stänger du affären",
               "Varför Roots — och din säljprocess",
               "Argumenten som biter, stegen som tar dig från lead till påskrift, "
               "och färdiga svar på de vanligaste invändningarna.")

    # — Varför Roots (4 små kort) —
    ax.text(MX, y, "Fyra argument som biter", fontfamily=HEAD, fontsize=14,
            fontweight="bold", color=INK, va="top")
    y -= 30
    props = [
        (FOREST, "Bättre produkt", "Premiumvård i samma prisklass som hyllan — något medlemmarna faktiskt vill ha."),
        (TERRA, "Riskfritt", "Ingen lagerinvestering. Föreningen behåller marginalen, betalas ut automatiskt."),
        (SKY, "Digitalt & enkelt", "Inga papperslistor eller kontanthantering. Länk, QR och Klarna/Swish."),
        (SAND_DARK, "Allt i realtid", "Mål, topplistor och statistik live — håller engagemanget uppe hela perioden."),
    ]
    gap = 18
    CW = (XMAX - 2 * MX - gap) / 2
    CH = 92
    for i, (accent, title, desc) in enumerate(props):
        col, row = i % 2, i // 2
        x = MX + col * (CW + gap)
        cy = y - CH - row * (CH + gap)
        rounded(ax, x, cy, CW, CH, OFFWHITE, ec=SAND_LIGHT, lw=1.1, r=14)
        ax.add_patch(plt.Circle((x + 26, cy + CH - 26), 7, fc=accent, ec="none", zorder=4))
        ax.text(x + 42, cy + CH - 26, title, fontfamily=HEAD, fontsize=12,
                fontweight="bold", color=INK, va="center")
        ty = cy + CH - 50
        for ln in wrap(desc, 52):
            ax.text(x + 22, ty, ln, fontfamily=BODY, fontsize=8.6,
                    color=SAND_DARK, va="top")
            ty -= 13
    y = y - 2 * CH - gap - 34

    # — Säljprocessen (4 steg) —
    ax.text(MX, y, "Din säljprocess i fyra steg", fontfamily=HEAD, fontsize=14,
            fontweight="bold", color=INK, va="top")
    y -= 30
    proc = [
        ("Prospektera", "Hitta föreningar och klubbar i portalens pipeline."),
        ("Boka & visa", "Boka möte, visa plattformen och skicka offert."),
        ("Onboarda", "Skapa kampanj, bjud in lagledare, kom igång."),
        ("Följ upp", "Stötta under perioden och säkra nästa kampanj."),
    ]
    sgap = 14
    SW = (XMAX - 2 * MX - 3 * sgap) / 4
    SH = 104
    sy = y - SH
    for i, (title, desc) in enumerate(proc):
        x = MX + i * (SW + sgap)
        rounded(ax, x, sy, SW, SH, WHITE, ec=SAND_LIGHT, lw=1.2, r=14)
        badge(ax, x + 24, sy + SH - 24, i + 1, FOREST, r=13)
        ax.text(x + 16, sy + SH - 52, title, fontfamily=HEAD, fontsize=11,
                fontweight="bold", color=INK, va="top")
        ty = sy + SH - 70
        for ln in wrap(desc, 24):
            ax.text(x + 16, ty, ln, fontfamily=BODY, fontsize=8,
                    color=SAND_DARK, va="top")
            ty -= 12
    y = sy - 34

    # — Invändningar —
    ax.text(MX, y, "Snabba svar på vanliga invändningar", fontfamily=HEAD,
            fontsize=14, fontweight="bold", color=INK, va="top")
    y -= 28
    qas = [
        ("\u201dVi säljer redan kakor/strumpor.\u201d",
         "Roots kräver inget lager och ingen kontanthantering — och marginalen "
         "syns i realtid. Ofta enklare och mer lönsamt än det ni gör idag."),
        ("\u201dVåra medlemmar orkar inte sälja.\u201d",
         "Det är därför allt är digitalt: en länk och en QR-kod att dela. "
         "AI-coachen och topplistorna gör det lekfullt och peppande."),
        ("\u201dÄr det inte krångligt att komma igång?\u201d",
         "Du onboardar föreningen på minuter. Excel-import av medlemmar eller en "
         "registreringslänk — sen rullar det av sig självt."),
    ]
    for q, a in qas:
        rounded(ax, MX, y - 58, XMAX - 2 * MX, 58, SAND_100, ec=SAND_LIGHT, lw=1, r=12)
        ax.text(MX + 18, y - 16, q, fontfamily=HEAD, fontsize=10,
                fontweight="bold", color=FOREST, va="top")
        ty = y - 34
        for ln in wrap(a, 96):
            ax.text(MX + 18, ty, ln, fontfamily=BODY, fontsize=8.6, color=INK, va="top")
            ty -= 13
        y -= 70

    footer(ax, 6)
    pdf.savefig(fig)
    plt.close(fig)


with PdfPages(OUT) as pdf:
    page_cover(pdf)
    page_about(pdf)
    page_products(pdf)
    page_flow(pdf)
    page_roles(pdf)
    page_pitch(pdf)
print("Saved", os.path.relpath(OUT, ROOT))
