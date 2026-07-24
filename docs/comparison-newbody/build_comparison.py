#!/usr/bin/env python3
"""Bygger Roots_vs_Newbody.pdf — en jämförelse + säljbattlecard mellan
Roots-plattformen och Newbody Family. A4 stående, brand-anpassad.

Källor (Newbody, hämtade 2026-06): ~25 % förtjänst, produkter 115–250 kr,
snittvinst ~46 kr/paket, säljperiod 3–4 v + 4 v efterbeställning, personlig
säljcoach, digital portal + tryckta kataloger, färdigsorterade leveranser med
100 % leveransgaranti, betalning kund→säljare→admin→faktura (20–30 dgr).
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
OUT = os.path.join(ROOT, "Roots_vs_Newbody.pdf")

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
TOTAL = 5


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
    ax.text(MX, 38, "Roots Nordic · Roots vs Newbody Family", fontfamily=BODY,
            fontsize=7.6, color=SAND_MED, va="center")
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


# ═════════════════════════ SIDA 1 — OMSLAG ═══════════════════════════
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

    ax.text(MX, 770, "JÄMFÖRELSE & SÄLJBATTLECARD", fontfamily=BODY, fontsize=12,
            fontweight="bold", color=SUN, va="top", zorder=5)
    ax.text(MX, 730, "Roots vs Newbody", fontfamily=HEAD, fontsize=46,
            fontweight="bold", color=WHITE, va="top", zorder=5)
    ax.text(MX, 656, "Var vi vinner — och var vi måste möta dem", fontfamily=HEAD,
            fontsize=21, fontweight="bold", color=OLIVE, va="top", zorder=5)

    for i, ln in enumerate(wrap(
        "En rak jämförelse mellan Roots-plattformen och marknadens mest etablerade "
        "föreningsförsäljning. Vad vi gör bättre, var de är starkare, och de "
        "argument som stänger affären när en förening jämför oss med Newbody.", 64)):
        ax.text(MX, 568 - i * 22, ln, fontfamily=BODY, fontsize=11.5,
                color="#E7EAE0", va="top", zorder=5)

    cx = MX
    for label in ["35 % förtjänst", "Swish/kort direkt", "Recurring"]:
        w = chip(ax, cx, 360, label, "#5A6743", tc=WHITE, size=9, h=28, pad_x=14)
        cx += w + 12

    ax.text(MX, 150, "Internt säljmaterial", fontfamily=BODY, fontsize=9,
            color="#C7CFBA", va="center", zorder=5)
    ax.text(XMAX - MX, 150, "roots-nordic.se", ha="right", fontfamily=BODY,
            fontsize=9, color="#C7CFBA", va="center", zorder=5)
    ax.plot([MX, XMAX - MX], [128, 128], color="#5A6743", lw=1, zorder=4)

    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 2 — MODELLERNA ═══════════════════════
def page_models(pdf):
    fig, ax = new_page()
    y = header(ax, "Två modeller sida vid sida",
               "Hur vi tjänar pengar åt föreningen",
               "Samma grundidé — laget säljer, föreningen behåller en marginal — "
               "men två olika sätt att ta betalt, leverera och driva försäljningen.")

    CW = (XMAX - 2 * MX - 24) / 2
    CH = 348
    cy = y - CH

    def model_card(x, accent, soft, tag, title, lead, bullets):
        rounded(ax, x, cy, CW, CH, WHITE, ec=SAND_LIGHT, lw=1.3, r=18)
        ax.add_patch(FancyBboxPatch((x, cy + CH - 8), CW, 8,
                                    boxstyle="round,pad=0,rounding_size=4",
                                    fc=accent, ec=accent, zorder=3))
        chip(ax, x + 22, cy + CH - 52, tag, soft, tc=accent, size=7.8)
        ax.text(x + 22, cy + CH - 78, title, fontfamily=HEAD, fontsize=17,
                fontweight="bold", color=INK, va="top")
        ty = cy + CH - 110
        for ln in wrap(lead, 46):
            ax.text(x + 22, ty, ln, fontfamily=BODY, fontsize=9, color=SAND_DARK, va="top")
            ty -= 14
        ty -= 12
        for b in bullets:
            ax.add_patch(plt.Circle((x + 28, ty - 4), 3, fc=accent, ec="none", zorder=4))
            for k, ln in enumerate(wrap(b, 42)):
                ax.text(x + 42, ty, ln, fontfamily=BODY, fontsize=8.8,
                        color=INK, va="top")
                ty -= 13.5
            ty -= 7

    model_card(MX, FOREST, FOREST_SOFT, "ROOTS", "Digital-först, 35 %",
               "Personliga shoppar, betalning direkt i mobilen och en plattform "
               "som binder ihop allt i realtid.",
               ["Föreningen behåller 35 % — låst och tydligt",
                "Swish/kort via Klarna direkt i kassan — noll kontanter",
                "Pengar in löpande, ingen faktura att jaga",
                "Live dashboard, chatt, topplistor, AI-coach",
                "Förbrukningsvara → återköp & prenumeration",
                "Publik räknesnurra + håranalys drar leads"])

    model_card(MX + CW + 24, SAND_DARK, SAND_100, "NEWBODY", "Katalog + coach, ~25 %",
               "Beprövad lagförsäljning med tryckt katalog, webbshop och en "
               "personlig säljcoach genom hela perioden.",
               ["Föreningen behåller ca 25 % av priset",
                "Kund betalar säljare → admin → faktura (20–30 dgr)",
                "Färdigsorterade paket + 100 % leveransgaranti",
                "Brett sortiment: kläder, kryddor, hudvård",
                "Personlig säljcoach från dag 1",
                "Tryckt katalog når även offline-kunder"])

    footer(ax, 2)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 3 — JÄMFÖRELSETABELL ═════════════════
def page_table(pdf):
    fig, ax = new_page()
    y = header(ax, "Punkt för punkt",
               "Jämförelsetabell",
               "Grönt = Roots. Sand = Newbody. Där vår ruta är grön har vi "
               "övertaget; där den är sand behöver vi möta dem.")

    rows = [
        ("Förtjänst", "35 % (låst)", True, "~25 % av priset", False),
        ("Betalning", "Swish/kort direkt (Klarna)", True,
         "Kund → säljare → admin → faktura", False),
        ("Kassaflöde", "In löpande, ingen fakturajakt", True,
         "Faktura 20–30 dgr efter slut", False),
        ("Sortiment", "3 fokus-premium hårvård", False,
         "Brett: kläder, kryddor, hudvård", True),
        ("Återköp", "Förbrukningsvara → recurring", True,
         "Mest engångskampanj", False),
        ("Plattform", "Live dashboard, chatt, AI, B2B, CRM", True,
         "Portal + tryckt katalog", False),
        ("Lead-gen", "Räknesnurra + håranalys (self-serve)", True,
         "Intresseanmälan + coach ringer", False),
        ("Logistik", "Byggs upp", False,
         "Färdigsorterat, 100 % leveransgaranti", True),
        ("Säljcoach", "AI-coach (människa byggs)", False,
         "Dedikerad personlig coach", True),
        ("Track record", "Nytt varumärke", False,
         "Beprövat, case (260k kr)", True),
        ("Offline", "Digital-först", False,
         "Tryckt katalog → bred räckvidd", True),
    ]

    labelW = 96
    gap = 12
    colW = (XMAX - 2 * MX - labelW - gap * 2) / 2
    xLabel = MX
    xRoots = MX + labelW + gap
    xNew = xRoots + colW + gap

    top = y - 2
    # kolumnrubriker
    chip(ax, xRoots + colW / 2 - 26, top - 22, "ROOTS", FOREST, tc=WHITE, size=8.4, h=24, pad_x=12)
    chip(ax, xNew + colW / 2 - 52, top - 22, "NEWBODY FAMILY", SAND_DARK, tc=WHITE, size=8.4, h=24, pad_x=12)

    rh = 60
    ry = top - 40
    for i, (label, rtxt, rwin, ntxt, nwin) in enumerate(rows):
        cy = ry - rh
        if i % 2 == 0:
            ax.add_patch(plt.Rectangle((MX, cy), XMAX - 2 * MX, rh,
                                       fc="#F6F1E8", ec="none", zorder=1))
        ax.text(xLabel + 2, cy + rh / 2, label, fontfamily=HEAD, fontsize=9.6,
                fontweight="bold", color=INK, va="center", zorder=3)

        def cell(x, txt, win, accent_soft, accent):
            rounded(ax, x, cy + 7, colW, rh - 14,
                    accent_soft if win else WHITE,
                    ec=accent if win else SAND_LIGHT, lw=1.4 if win else 1, r=10, z=2)
            tlines = wrap(txt, 34)
            tystart = cy + rh / 2 + (len(tlines) - 1) * 7
            for k, ln in enumerate(tlines):
                ax.text(x + 14, tystart - k * 13.5, ln, fontfamily=BODY,
                        fontsize=8.8, color=INK, va="center", zorder=3)
            if win:
                ax.text(x + colW - 16, cy + rh - 16, "✓", fontfamily=BODY,
                        fontsize=11, fontweight="bold", color=accent,
                        ha="center", va="center", zorder=4)

        cell(xRoots, rtxt, rwin, FOREST_SOFT, FOREST)
        cell(xNew, ntxt, nwin, SAND_100, SAND_DARK)
        ry -= rh

    footer(ax, 3)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 4 — FÖRDELAR / LUCKOR ════════════════
def page_pros_cons(pdf):
    fig, ax = new_page()
    y = header(ax, "Styrkor och luckor",
               "Där vi vinner — och var de är starkare",
               "Använd vänsterspalten offensivt. Var beredd på högerspalten — det "
               "är Newbodys vassaste motargument.")

    colgap = 24
    CW = (XMAX - 2 * MX - colgap) / 2
    xL = MX
    xR = MX + CW + colgap

    def column(x, title, accent, soft, items):
        chip(ax, x, y, title, accent, tc=WHITE, size=9, h=26, pad_x=14)
        cy = y - 40
        for head, desc in items:
            box_h = 14 + 13.5 * len(wrap(desc, 44)) + 18
            rounded(ax, x, cy - box_h, CW, box_h, soft, ec=SAND_LIGHT, lw=1, r=12)
            ax.add_patch(plt.Circle((x + 20, cy - 18), 5, fc=accent, ec="none", zorder=4))
            ax.text(x + 36, cy - 18, head, fontfamily=HEAD, fontsize=10.4,
                    fontweight="bold", color=INK, va="center")
            ty = cy - 38
            for ln in wrap(desc, 44):
                ax.text(x + 18, ty, ln, fontfamily=BODY, fontsize=8.6,
                        color=SAND_DARK, va="top")
                ty -= 13.5
            cy -= box_h + 14

    column(xL, "Roots fördelar", FOREST, FOREST_SOFT, [
        ("Högre marginal", "35 % vs ~25 %. Mer i kassan per krona — och vi kan kontra deras volym-argument med återköp."),
        ("Pengar direkt via Swish/kort", "Noll kontanter, inga fakturor att jaga, bättre kassaflöde och långt mindre admin för lagledaren."),
        ("Fokuserad premium-story", "Nordiskt, hårets mikrobiom och balanssystem — ett tydligt varumärke, inte ett spretigt katalogsortiment."),
        ("Recurring intäkter", "Hudvård tar slut → prenumeration och återköp, plus B2B-klubbportal för återkommande order."),
        ("Egen plattform + AI + lead-magnets", "Räknesnurra och håranalys drar leads självständigt; allt styrs i realtid i en portal."),
    ])

    column(xR, "Där Newbody är starkare", SAND_DARK, SAND_100, [
        ("Brett, lättsålt sortiment", "Kända varumärken och 115–250 kr-prislappar sänker tröskeln och höjer volymen."),
        ("Fulfilment i världsklass", "Färdigsorterade paket per säljare, 100 % leveransgaranti och hemleverans direkt till kund."),
        ("Personlig säljcoach", "En dedikerad coach driver planering och uppföljning genom hela perioden."),
        ("Track record & förtroende", "Etablerat varumärke, referenscase och mogen kundtjänst skapar trygghet."),
        ("Offline-räckvidd", "Tryckt katalog når dörrknackning, jobbet och äldre släkt som inte handlar via länk."),
    ])

    footer(ax, 4)
    pdf.savefig(fig)
    plt.close(fig)


# ═════════════════════════ SIDA 5 — STRATEGI & SVAR ══════════════════
def page_strategy(pdf):
    fig, ax = new_page()
    y = header(ax, "Så vinner vi jämförelsen",
               "Strategi & invändningshantering",
               "Spetsa budskapet, stäng luckorna — och ha färdiga svar när "
               "föreningen säger att de redan kollat på Newbody.")

    ax.text(MX, y, "Fem drag som avgör", fontfamily=HEAD, fontsize=14,
            fontweight="bold", color=INK, va="top")
    y -= 30
    moves = [
        ("Spetsa pitchen", "\u201d35 % i kassan + pengarna direkt via Swish — noll kontanter, noll fakturajakt.\u201d"),
        ("Bemöt volym-argumentet", "Lyft livstidsvärde: en nöjd hudvårdskund handlar igen. Återköp slår engångsmarginal."),
        ("Stäng logistik-gapet", "Samlad leverans till klubben eller hem till köparen — matcha tryggheten."),
        ("Komplettera digitalt med fysiskt", "Provkit/flyer för dem som inte handlar via länk — täck offline-demografin."),
        ("Människa ovanpå AI", "Lägg en uppstarts- och uppföljningskontakt ovanpå AI-coachen i de större affärerna."),
    ]
    sgap = 14
    SW = (XMAX - 2 * MX - 4 * sgap) / 5
    SH = 150
    sy = y - SH
    for i, (title, desc) in enumerate(moves):
        x = MX + i * (SW + sgap)
        rounded(ax, x, sy, SW, SH, WHITE, ec=SAND_LIGHT, lw=1.2, r=13)
        badge(ax, x + 22, sy + SH - 22, i + 1, FOREST, r=12)
        ty = sy + SH - 48
        for ln in wrap(title, 14):
            ax.text(x + 14, ty, ln, fontfamily=HEAD, fontsize=9.6,
                    fontweight="bold", color=INK, va="top")
            ty -= 13
        ty -= 4
        for ln in wrap(desc, 22):
            ax.text(x + 14, ty, ln, fontfamily=BODY, fontsize=7.6,
                    color=SAND_DARK, va="top")
            ty -= 11
    y = sy - 36

    ax.text(MX, y, "Färdiga svar när de jämför med Newbody", fontfamily=HEAD,
            fontsize=14, fontweight="bold", color=INK, va="top")
    y -= 28
    qas = [
        ("\u201dNewbody ger ju ungefär lika mycket fast lägre procent — produkterna är lättsålda.\u201d",
         "Vi ger 35 % mot deras 25 %, och vår produkt är förbrukningsvara: kunden handlar igen. "
         "Högre livstidsvärde — plus att pengarna kommer in direkt via Swish, ingen fakturajakt."),
        ("\u201dNewbody sköter all logistik och har leveransgaranti.\u201d",
         "Vi levererar samlat till klubben eller direkt till köparen, och den digitala betalningen "
         "tar bort hela kontant- och fakturakedjan som lagledaren annars måste hålla i."),
        ("\u201dNewbody är etablerat — ni är nya.\u201d",
         "Just därför är vi vassare på modell och marginal: ett fokuserat premium-varumärke, "
         "högre förtjänst och en modern plattform. Kör en pilotkampanj och jämför resultatet."),
    ]
    for q, a in qas:
        box_h = 30 + 13 * len(wrap(a, 100))
        rounded(ax, MX, y - box_h, XMAX - 2 * MX, box_h, SAND_100, ec=SAND_LIGHT, lw=1, r=12)
        ax.text(MX + 18, y - 16, q, fontfamily=HEAD, fontsize=9.8,
                fontweight="bold", color=FOREST, va="top")
        ty = y - 34
        for ln in wrap(a, 100):
            ax.text(MX + 18, ty, ln, fontfamily=BODY, fontsize=8.6, color=INK, va="top")
            ty -= 13
        y -= box_h + 14

    footer(ax, 5)
    pdf.savefig(fig)
    plt.close(fig)


with PdfPages(OUT) as pdf:
    page_cover(pdf)
    page_models(pdf)
    page_table(pdf)
    page_pros_cons(pdf)
    page_strategy(pdf)
print("Saved", os.path.relpath(OUT, ROOT))
