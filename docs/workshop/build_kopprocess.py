#!/usr/bin/env python3
"""Bygger Roots_Kopprocess_Workshop.pdf - underlag for workshop om
foreningslivets kopprocess: nulage, hur det funkar och vad vi kan vrida pa."""
import glob
import os
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Circle

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public"))
OUT = os.path.join(ROOT, "Roots_Kopprocess_Workshop.pdf")
import matplotlib.image as mpimg

# Brand
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
SKY_DARK = "#6E8694"
CLAY = "#B25B43"

for f in (glob.glob(os.path.expanduser("~/Library/Fonts/AlanSans*.ttf"))
          + glob.glob(os.path.expanduser("~/Library/Fonts/Inter_18pt*.ttf"))):
    fm.fontManager.addfont(f)
HEAD = "Alan Sans"
BODY = "Inter 18pt"
plt.rcParams["pdf.fonttype"] = 42

# A4 liggande
PAGE_W, PAGE_H = 11.69, 8.27
XMAX, YMAX = 1169, 827


def new_page(color=OFFWHITE):
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, XMAX)
    ax.set_ylim(0, YMAX)
    ax.axis("off")
    fig.patch.set_facecolor(color)
    return fig, ax


def rounded(ax, x, y, w, h, fc, ec=None, lw=1.2, r=12, z=2):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
                 boxstyle=f"round,pad=0,rounding_size={r}",
                 fc=fc, ec=ec or fc, lw=lw, zorder=z))


def topbar(ax, x, y, w, color, h=6, r=3, z=3):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
                 boxstyle=f"round,pad=0,rounding_size={r}",
                 fc=color, ec=color, zorder=z))


def chip(ax, x, y, text, fc, tc=WHITE, size=7.6, z=4, pad=10, h=22):
    w = pad * 2 + len(text) * size * 0.74
    rounded(ax, x, y, w, h, fc, r=h / 2, z=z)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontfamily=BODY, fontsize=size, fontweight="bold", color=tc, zorder=z + 1)
    return w


def text(ax, x, y, s, size=9.5, color=INK, weight="normal", family=BODY,
         va="top", ha="left", z=4):
    ax.text(x, y, s, fontfamily=family, fontsize=size, fontweight=weight,
            color=color, va=va, ha=ha, zorder=z)


def para(ax, x, y, s, width=78, size=9.3, color=SAND_DARK, lead=15, z=4):
    lines = []
    for block in s.split("\n"):
        lines += textwrap.wrap(block, width) or [""]
    for i, ln in enumerate(lines):
        ax.text(x, y - i * lead, ln, fontfamily=BODY, fontsize=size,
                color=color, va="top", zorder=z)
    return y - len(lines) * lead


def bullet(ax, x, y, s, width=70, size=9.0, color=SAND_DARK, dot=FOREST,
           lead=14, z=4):
    ax.add_patch(Circle((x + 3, y - 5), 2.4, fc=dot, ec="none", zorder=z))
    lines = textwrap.wrap(s, width) or [""]
    for i, ln in enumerate(lines):
        ax.text(x + 16, y - i * lead, ln, fontfamily=BODY, fontsize=size,
                color=color, va="top", zorder=z)
    return y - len(lines) * lead


def header(ax, kicker, title, n):
    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-black.png"))
    lh = 30
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(60, 60 + lw, YMAX - 78, YMAX - 78 + lh),
              aspect="auto", zorder=5)
    text(ax, XMAX - 60, YMAX - 60, kicker.upper(), size=8, color=SAND_MED,
         weight="bold", ha="right")
    text(ax, 60, YMAX - 108, title, size=22, color=INK, weight="bold", family=HEAD)
    ax.plot([60, XMAX - 60], [YMAX - 128, YMAX - 128], color=SAND_LIGHT, lw=1.1, zorder=3)
    text(ax, XMAX - 60, 26, f"Roots \u00b7 Workshop: köpprocessen \u00b7 {n}",
         size=8, color=SAND_MED, ha="right")


def arrow(ax, p1, p2, color=SAND_DARK, lw=2.0, rad=0.0, z=6, ms=15, dashed=False):
    ax.add_patch(FancyArrowPatch(p1, p2, connectionstyle=f"arc3,rad={rad}",
                 arrowstyle="-|>", mutation_scale=ms, lw=lw, color=color, zorder=z,
                 linestyle=(0, (5, 4)) if dashed else "solid", shrinkA=3, shrinkB=5))


STATUS = {"klart": (FOREST, "Klart"), "delvis": (TERRA, "Delvis"),
          "saknas": (SAND_DARK, "Saknas / planerat")}


def status_dot(ax, x, y, kind, label=True, size=8.2):
    c, lbl = STATUS[kind]
    ax.add_patch(Circle((x, y), 5, fc=c, ec="none", zorder=6))
    if label:
        text(ax, x + 12, y, lbl, size=size, color=c, weight="bold", va="center")


def legend(ax, x, y):
    text(ax, x, y, "STATUS IDAG", size=7.6, color=SAND_MED, weight="bold", va="center")
    gx = x + 78
    for k in ("klart", "delvis", "saknas"):
        c, lbl = STATUS[k]
        ax.add_patch(Circle((gx, y), 4.5, fc=c, ec="none", zorder=6))
        text(ax, gx + 10, y, lbl, size=8, color=c, weight="bold", va="center")
        gx += 28 + len(lbl) * 5.4


PAGES = []


def page_cover():
    fig, ax = new_page(INK)
    ax.add_patch(FancyBboxPatch((0, 0), 14, YMAX, boxstyle="square,pad=0",
                 fc=FOREST, ec=FOREST, zorder=2))
    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-white.png"))
    lh = 40
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(70, 70 + lw, YMAX - 110, YMAX - 110 + lh),
              aspect="auto", zorder=5)
    text(ax, 70, 560, "Köpprocessen i", size=46, color=WHITE, weight="bold", family=HEAD)
    text(ax, 70, 500, "föreningslivet", size=46, color="#C1BF99", weight="bold", family=HEAD)
    text(ax, 72, 422, "Workshop-underlag: så ser flödet ut idag, hur det funkar",
         size=13, color=SAND_LIGHT)
    text(ax, 72, 400, "i praktiken — och var vi skulle kunna vrida och förändra.",
         size=13, color=SAND_LIGHT)

    rounded(ax, 70, 150, 470, 210, "#262624", ec="#3A3A37", lw=1, r=14)
    text(ax, 92, 330, "DET HÄR ÄR ETT DISKUSSIONSUNDERLAG", size=8, color="#C1BF99", weight="bold")
    y = 300
    for s in ["Nuläget är ärligt beskrivet — vad som är byggt, delvis byggt och inte byggt än.",
              "Tänkt att läsas tillsammans och kladdas i. Inga svar är huggna i sten.",
              "Målet: enas om vad vi vrider på först i kund- och köpresan."]:
        y = bullet(ax, 92, y, s, width=58, size=9.6, color=SAND_LIGHT, dot="#C1BF99", lead=14) - 8

    text(ax, 70, 60, "Internt \u00b7 för workshop med föreningsexpertis \u00b7 2026",
         size=9, color=SAND_MED)
    PAGES.append(fig)


def page_two_tracks():
    fig, ax = new_page()
    header(ax, "Börja här", "Två affärsspår — blanda inte ihop dem", "1")
    para(ax, 60, YMAX - 150,
         "Roots har två separata commerce-flöden i koden. De känns lika men fungerar helt olika. "
         "Workshopen handlar om det första — insamlingsflödet — men det är viktigt att vi inte råkar "
         "prata om klubb-B2B när vi menar supporterköp.", width=132, size=10, color=INK)

    # Två kort
    cards = [
        (FOREST, FOREST_SOFT, "INSAMLING (B2B2C)", "Supporter köper på en säljares shop",
         [("Vem köper", "Förälder, granne, kollega — privatperson via personlig länk"),
          ("Betalning", "Klarna Checkout (Swish saknas idag)"),
          ("Tabell", "customer_orders + customer_order_lines"),
          ("Pengar", "Marginal till föreningen, Roots tar en andel"),
          ("Detta är", "Workshopens fokus — den stora volymen")]),
        (SKY_DARK, SKY_SOFT, "KLUBB (B2B)", "Inloggad klubb lägger grossistorder",
         [("Vem köper", "Klubbhus/kansli med eget konto i portalen"),
          ("Betalning", "Fortnox-faktura (ingen Klarna)"),
          ("Tabell", "orders + order_lines"),
          ("Pengar", "Vanlig B2B-försäljning, faktureras"),
          ("Detta är", "Ett eget spår — inte supporterresan")]),
    ]
    cw, ch = 525, 350
    for i, (ac, soft, tag, title, rows) in enumerate(cards):
        x = 60 + i * (cw + 30)
        y = 240
        rounded(ax, x, y, cw, ch, WHITE, ec=SAND_LIGHT, lw=1.3, r=16)
        topbar(ax, x, y + ch - 6, cw, ac)
        chip(ax, x + 24, y + ch - 48, tag, soft, tc=ac, size=8)
        text(ax, x + 24, y + ch - 72, title, size=14.5, color=INK, weight="bold", family=HEAD)
        ry = y + ch - 116
        for k, v in rows:
            text(ax, x + 24, ry, k.upper(), size=7.6, color=SAND_MED, weight="bold")
            yy = para(ax, x + 150, ry + 4, v, width=46, size=9.4, color=INK, lead=14)
            ry = min(ry - 34, yy - 12)

    rounded(ax, 60, 90, XMAX - 120, 120, FOREST_SOFT, ec="none", r=14)
    text(ax, 84, 178, "VARFÖR DET SPELAR ROLL FÖR WORKSHOPEN", size=8, color=FOREST, weight="bold")
    para(ax, 84, 152,
         "Den största hävstången ligger i insamlingsspåret: många små supporterköp som ska bli "
         "enkla, trygga och återkommande. Klubb-B2B är en stabil men separat intäkt. När vi pratar "
         "\u201ekonvertering\u201d, \u201ebetalsätt\u201d och \u201epengar till föreningen\u201d nedan menar vi alltid insamlingsspåret.",
         width=150, size=9.6, color=INK, lead=15)
    PAGES.append(fig)



def page_flow():
    fig, ax = new_page()
    header(ax, "Nuläget", "Insamlingsflödet i sex steg", "2")
    legend(ax, 60, YMAX - 152)

    stages = [
        (TERRA, "1", "Onboarding", "Föreningen registrerar sig själv eller skapas av säljrep. Kampanj startas.",
         [("Självregistrering på roots.se", "klart"),
          ("Kampanj skapas (startar ACTIVE)", "klart"),
          ("Org.nr-steg pekar på sida som saknas", "delvis")]),
        (FOREST, "2", "Bygg laget", "Föreningsadmin bjuder in lagledare, som i sin tur bjuder in säljare.",
         [("Lagledar-invite (token, 14 dgr)", "klart"),
          ("Säljar-invite + personlig shop", "klart"),
          ("Shop-slug genereras automatiskt", "klart")]),
        (FOREST, "3", "Dela shop", "Säljaren delar sin personliga länk och QR till familj, vänner och nätverk.",
         [("Personlig shop /shop/{slug}", "klart"),
          ("Länk + QR att dela", "klart"),
          ("AI-coach ger säljtips", "klart")]),
        (FOREST, "4", "Köp & betala", "Supportern lägger i varukorg, fyller i uppgifter och betalar med Klarna.",
         [("Varukorg + kassa", "klart"),
          ("Klarna Checkout + webhook", "klart"),
          ("Swish som alternativ", "saknas")]),
        (SKY_DARK, "5", "Leverans", "Order märks som betald. Leveranstyp (bulk/hem) sparas, men inget logistikflöde körs.",
         [("Bulk vs hemleverans väljs", "klart"),
          ("Betald-status + bekräftelsemejl", "klart"),
          ("Skickad/levererad-flöde", "saknas")]),
        (SAND_DARK, "6", "Pengar hem", "Kampanjen avslutas, avräknas och föreningen får sin andel.",
         [("Avräkningsvy (visar split)", "delvis"),
          ("Avsluta kampanj + settlement", "delvis"),
          ("Utbetalning till förening", "saknas")]),
    ]
    n = len(stages)
    gap = 16
    cw = (XMAX - 120 - gap * (n - 1)) / n
    ch = 300
    y = 250
    for i, (ac, num, title, desc, items) in enumerate(stages):
        x = 60 + i * (cw + gap)
        rounded(ax, x, y, cw, ch, WHITE, ec=SAND_LIGHT, lw=1.2, r=12)
        topbar(ax, x, y + ch - 5, cw, ac)
        ax.add_patch(Circle((x + 28, y + ch - 40), 15, fc=ac, ec="none", zorder=5))
        text(ax, x + 28, y + ch - 40, num, size=12, color=WHITE, weight="bold",
             family=HEAD, va="center", ha="center", z=6)
        text(ax, x + 52, y + ch - 47, title, size=11.5, color=INK, weight="bold", family=HEAD)
        yy = para(ax, x + 16, y + ch - 78, desc, width=24, size=8.4, color=SAND_DARK, lead=12)
        ly = yy - 14
        for label, st in items:
            status_dot(ax, x + 22, ly, st, label=False)
            for j, ln in enumerate(textwrap.wrap(label, 24) or [""]):
                text(ax, x + 36, ly + 4 - j * 11, ln, size=7.8, color=INK, va="top")
            ly -= 11 * (len(textwrap.wrap(label, 24)) or 1) + 12
        if i < n - 1:
            arrow(ax, (x + cw + 2, y + ch / 2), (x + cw + gap - 2, y + ch / 2),
                  color=SAND_MED, lw=1.6, ms=11)

    rounded(ax, 60, 70, XMAX - 120, 90, INK, r=14)
    text(ax, 84, 138, "KORT SAGT", size=8, color="#C1BF99", weight="bold")
    para(ax, 84, 116,
         "Steg 1–4 (fram till betald order, knuten till rätt säljare) är på riktigt och produktionshårdat. "
         "Steg 5–6 (leverans, avsluta kampanj, betala ut till föreningen) finns till stor del i backend "
         "men saknar UI och drivs manuellt. Det är här mycket av samtalet bör ligga.",
         width=150, size=9.4, color=SAND_LIGHT, lead=15)
    PAGES.append(fig)


def col_card(ax, x, y, w, h, accent, title, items, item_w=34, lead=13, size=8.8):
    rounded(ax, x, y, w, h, WHITE, ec=SAND_LIGHT, lw=1.2, r=12)
    topbar(ax, x, y + h - 5, w, accent)
    text(ax, x + 18, y + h - 40, title, size=11, color=INK, weight="bold", family=HEAD)
    ly = y + h - 66
    for it in items:
        ly = bullet(ax, x + 18, ly, it, width=item_w, size=size, color=INK,
                    dot=accent, lead=lead) - 9
    return ly


def page_checkout():
    fig, ax = new_page()
    header(ax, "Hjärtat i flödet", "Köpresan i detalj — från shop till betald order", "3")

    steps = ["Shop\n/shop/{slug}", "Varukorg\nsession", "Kassa\nuppgifter",
             "checkout/\ncreate", "Klarna\nCheckout", "Webhook\n+ polling",
             "Order\nPAID", "Bekräftelse\nmejl"]
    n = len(steps)
    bw, bh = 108, 56
    gap = (XMAX - 120 - bw * n) / (n - 1)
    yb = YMAX - 230
    for i, s in enumerate(steps):
        x = 60 + i * (bw + gap)
        ac = FOREST if i >= 6 else (TERRA if i == 4 else INK)
        rounded(ax, x, yb, bw, bh, FOREST_SOFT if i >= 6 else SAND_100, ec="none", r=10)
        for j, ln in enumerate(s.split("\n")):
            text(ax, x + bw / 2, yb + bh - 18 - j * 15,
                 ln, size=8.4 if j == 0 else 7.6,
                 color=INK if j == 0 else SAND_DARK,
                 weight="bold" if j == 0 else "normal", ha="center", va="center")
        if i < n - 1:
            arrow(ax, (x + bw, yb + bh / 2), (x + bw + gap, yb + bh / 2),
                  color=SAND_MED, lw=1.5, ms=10)
    text(ax, 60, yb - 16, "Allt det här är byggt och produktionshårdat (med Klarna-nycklar i prod). "
         "Utan nycklar körs en tydligt märkt simulering i test.", size=9, color=FOREST, weight="bold")

    w3 = (XMAX - 120 - 2 * 24) / 3
    hh = 370
    yc = 110
    col_card(ax, 60, yc, w3, hh, FOREST, "Det här knyts till ordern",
             ["Säljare, lag, kampanj och förening — varje köp krediteras rätt",
              "Kunduppgifter: namn, e-post, telefon, ev. adress",
              "Leveranstyp (bulk eller hem) och fraktavgift",
              "Belopp i öre, radnivå och klarnaOrderId",
              "idempotencyKey så dubbelklick inte ger dubbla ordrar"], item_w=40, lead=18, size=9.4)
    col_card(ax, 60 + w3 + 24, yc, w3, hh, SKY_DARK, "Trygghet som redan finns",
             ["Webhook verifieras med HMAC och IP-spärr",
              "Beloppet kontrolleras mot Klarna innan PAID sätts",
              "Orderstatus-sidan är PII-skyddad med signerad token",
              "Demokonton blockeras från att lägga skarpa ordrar",
              "Bekräftelsemejl med säker vy-länk"], item_w=40, lead=18, size=9.4)
    col_card(ax, 60 + 2 * (w3 + 24), yc, w3, hh, TERRA, "Öppna frågor här",
             ["Swish finns inte — bara Klarna idag",
              "\u201eBetala till lagledaren\u201d finns i schemat men används aldrig",
              "Statusar CONFIRMED/SHIPPED/DELIVERED finns men sätts aldrig",
              "Ingen gästretur/avbokning i UI",
              "Vad händer vid delbetalning eller återköp?"], item_w=40, lead=18, size=9.4)
    PAGES.append(fig)


def page_money():
    fig, ax = new_page()
    header(ax, "Nuläget", "Baksidan: så går pengarna hem — och var det skaver", "4")
    legend(ax, 60, YMAX - 152)

    steps = [
        ("Betalda ordrar", "Alla PAID customer_orders summeras per lag och förening.", "klart"),
        ("Avräkning visar split", "marginPercent (default 25 %) → andel till föreningen, resten till Roots.", "delvis"),
        ("Avsluta kampanj", "Kampanj måste sättas ENDED. Finns bara via tRPC/DB — inget i förenings-UI.", "delvis"),
        ("Settlement körs", "Genererar payout-poster per lag, sätter kampanj SETTLED.", "delvis"),
        ("Fortnox-faktura", "Faktura skapas för Roots andel (kräver org.nr).", "delvis"),
        ("Utbetalning till förening", "Markeras PAID manuellt av intern admin. Ingen automatik mot bankkonto.", "saknas"),
    ]
    y = YMAX - 200
    bh = 60
    for i, (t, d, st) in enumerate(steps):
        rounded(ax, 60, y - bh, 560, bh, WHITE, ec=SAND_LIGHT, lw=1.2, r=10)
        c = STATUS[st][0]
        topbar(ax, 60, y - 5, 560, c, h=4, r=2) if False else None
        ax.add_patch(FancyBboxPatch((60, y - bh), 6, bh, boxstyle="square,pad=0", fc=c, ec=c, zorder=3))
        status_dot(ax, 88, y - bh / 2, st, label=False)
        text(ax, 108, y - 20, t, size=10.5, color=INK, weight="bold", family=HEAD)
        para(ax, 108, y - 36, d, width=72, size=8.6, color=SAND_DARK, lead=12)
        if i < len(steps) - 1:
            arrow(ax, (340, y - bh), (340, y - bh - 8), color=SAND_MED, lw=1.5, ms=9)
        y -= bh + 18

    rx = 650
    rw = XMAX - 60 - rx
    rounded(ax, rx, 430, rw, YMAX - 200 - 430 + 60, TERRA_SOFT, ec="none", r=14)
    text(ax, rx + 22, YMAX - 215, "GAPEN ATT PRATA OM", size=8, color=CLAY, weight="bold")
    ly = YMAX - 240
    for s in ["Ingen knapp i förenings-UI för att avsluta kampanj eller köra avräkning.",
              "Sidan /forening/utbetalningar länkas i mejl men finns inte.",
              "Ingen automatisk utbetalning till föreningens konto — manuellt steg.",
              "/portal/intakter visar klubb-B2B, inte insamlingen — lätt att förväxla."]:
        ly = bullet(ax, rx + 22, ly, s, width=58, size=9.0, color=INK, dot=CLAY, lead=13) - 8

    rounded(ax, rx, 90, rw, 310, FOREST_SOFT, ec="none", r=14)
    text(ax, rx + 22, 372, "VAD FÖRENINGEN FAKTISKT SER IDAG", size=8, color=FOREST, weight="bold")
    ly = 348
    for s in ["En avräkningsvy som visar total försäljning och uppskattad andel.",
              "Realtidssiffror per lag och säljare under kampanjen.",
              "Men: ingen tydlig \u201eså mycket får ni, så här betalas det ut, när\u201d.",
              "Förtroendet i sista steget byggs idag mest utanför plattformen."]:
        ly = bullet(ax, rx + 22, ly, s, width=58, size=9.0, color=INK, dot=FOREST, lead=13) - 8
    PAGES.append(fig)


def status_section(ax, x, y, w, title, rows):
    text(ax, x, y, title.upper(), size=8.4, color=SAND_DARK, weight="bold")
    ax.plot([x, x + w], [y - 8, y - 8], color=SAND_LIGHT, lw=1)
    yy = y - 26
    for label, st, note in rows:
        status_dot(ax, x + 6, yy - 3, st, label=False)
        text(ax, x + 22, yy, label, size=9.2, color=INK, weight="bold", va="top")
        para(ax, x + 22, yy - 13, note, width=int(w / 5.2), size=8.2,
             color=SAND_DARK, lead=11)
        yy -= 40
    return yy


def page_matrix():
    fig, ax = new_page()
    header(ax, "Nuläget", "Nuläget i klartext", "5")
    legend(ax, 60, YMAX - 152)

    colw = (XMAX - 120 - 50) / 2
    lx, rx = 60, 60 + colw + 50
    left = [
        ("Onboarding", [
            ("Självregistrering förening", "klart", "Fungerar self-serve via roots.se."),
            ("Kampanj skapas", "klart", "Startar direkt i ACTIVE (hoppar över DRAFT)."),
            ("Org.nr i onboarding", "delvis", "Checklistan pekar på en sida som inte finns."),
            ("Säljrep skapar förening", "delvis", "Blir lead i CRM, inte ett skarpt konto."),
        ]),
        ("Lag & säljare", [
            ("Lagledar-invite", "klart", "Token, 14 dagars giltighet, engångsbruk."),
            ("Säljar-invite + shop", "klart", "Automatisk shop-slug per säljare."),
            ("AI-coach för säljare", "klart", "Säljtips och svar i säljarens vy."),
        ]),
        ("Köp & betalning", [
            ("Varukorg + kassa", "klart", "Session-baserad korg, komplett kassa."),
            ("Klarna Checkout", "klart", "Webhook, IP/HMAC, beloppskontroll."),
            ("Orderattribuering", "klart", "Säljare/lag/kampanj/förening på varje köp."),
            ("Swish", "saknas", "Finns inte i koden idag."),
        ]),
    ]
    right = [
        ("Leverans", [
            ("Välj bulk/hemleverans", "klart", "Fraktregler och tröskel per kampanj."),
            ("Skickad/levererad", "saknas", "Statusar finns i enum men sätts aldrig."),
            ("Frakt & spårning", "saknas", "Ingen logistik- eller transportörskoppling."),
        ]),
        ("Pengar hem", [
            ("Avräkningsvy", "delvis", "Visar split men inga utbetalningsåtgärder."),
            ("Avsluta kampanj + settlement", "delvis", "Finns i backend, saknar UI."),
            ("Utbetalning till förening", "saknas", "Manuell PAID-flagga, ingen automatik."),
        ]),
        ("Översikt & intäkter", [
            ("Dashboards med realtid", "klart", "Förening, lag och säljare ser PAID-siffror."),
            ("/portal/intakter", "delvis", "Visar klubb-B2B, inte insamlingen."),
        ]),
    ]
    yl = YMAX - 195
    for t, rows in left:
        yl = status_section(ax, lx, yl, colw, t, rows) - 18
    yr = YMAX - 195
    for t, rows in right:
        yr = status_section(ax, rx, yr, colw, t, rows) - 18
    PAGES.append(fig)


def page_market():
    fig, ax = new_page()
    header(ax, "Sammanhang", "Så säljer föreningar idag — och var Roots skiljer sig", "6")
    para(ax, 60, YMAX - 150,
         "Underlag för dig som kan föreningslivet: stämmer den här bilden? Var har vi rätt, var "
         "förenklar vi? Siffror är publika/illustrativa och ska utmanas i rummet.",
         width=140, size=10, color=INK)

    cw = (XMAX - 120 - 30) / 2
    ch = 360
    y = 235
    col_card(ax, 60, y, cw, ch, SAND_DARK, "Traditionell föreningsförsäljning",
             ["Kataloger, strumpor, kakor, toapapper, rabatthäften",
              "Ofta engångsköp — sällan något man köper igen",
              "Lågt engagemang; svårt att känna stolthet i produkten",
              "Marginal till föreningen, men låg prislapp per sälj",
              "Newbody m.fl. — publikt ~1,7 mdr insamlat på ~40 år",
              "Förflyttning pågår mot digitala plattformar"], item_w=52, lead=14, size=9.2)
    col_card(ax, 60 + cw + 30, y, cw, ch, FOREST, "Så gör Roots",
             ["Premium dagligvara folk faktiskt vill använda",
              "Personlig digital shop per säljare — länk + QR",
              "Klarna i kassan, realtidsöversikt för alla roller",
              "Potential till återkommande köp och prenumeration",
              "Nordiskt, certifierat, en berättelse att vara stolt över",
              "AI-coach som peppar och svarar säljaren"], item_w=52, lead=14, size=9.2)

    rounded(ax, 60, 80, XMAX - 120, 130, SKY_SOFT, ec="none", r=14)
    text(ax, 84, 188, "DEN DIGITALA FÖRFLYTTNINGEN — DÄR VI SPELAR", size=8, color=SKY_DARK, weight="bold")
    para(ax, 84, 162,
         "Marknaden rör sig från pappersorderlappar till personliga säljlänkar, QR-koder och "
         "betalning via Klarna och Swish. Roots är byggt digitalt från start. Den stora frågan är inte "
         "om föreningar går digitalt, utan vad de säljer när de gör det — och hur enkelt och tryggt "
         "köpet känns för supportern.",
         width=150, size=9.6, color=INK, lead=15)
    PAGES.append(fig)


def page_tweaks():
    fig, ax = new_page()
    header(ax, "Framåt", "Vad vi skulle kunna vrida på", "7")
    para(ax, 60, YMAX - 150,
         "Hypoteser att debattera — inte en backlog. Varje ruta är en riktning, inte ett beslut. "
         "Lägg till, stryk och rangordna tillsammans.", width=140, size=10, color=INK)

    cards = [
        (FOREST, "Konvertering i kassan",
         ["Swish som betalsätt — sänker tröskeln för svenska köpare",
          "Gästköp utan onödiga fält; spara adress först vid hemleverans",
          "Förifylld korg via delningslänk (?item=...) i sociala kanaler"]),
        (TERRA, "Betalsätt & flexibilitet",
         ["Aktivera \u201ebetala till lagledaren\u201d (kontant/Swish) som redan finns i schemat",
          "Tydliggör Klarnas delbetalning för dyrare paket",
          "Hantera återköp/avbokning i UI, inte bara i databasen"]),
        (SKY_DARK, "Pengar hem & förtroende",
         ["Bygg /forening/utbetalningar — \u201eså mycket får ni, när, hur\u201d",
          "Knapp för att avsluta kampanj + köra avräkning i förenings-UI",
          "På sikt: automatisk utbetalning till föreningens konto"]),
        (FOREST, "Återkommande intäkter",
         ["\u201eKöp igen\u201d-flöde när flaskan tar slut",
          "Prenumeration/påfyllning för supportrar",
          "Shop som lever vidare efter kampanjen, inte stängs"]),
        (SAND_DARK, "Leverans & avslut",
         ["Aktivera skickad/levererad-statusarna som redan finns",
          "Packlistor per lag vid bulkleverans",
          "Enkel notis till supporter när varan är på väg"]),
        (INK, "Så prioriterar vi",
         ["Vad ökar antalet betalda ordrar mest, snabbast?",
          "Vad bygger förtroende i sista steget (pengar hem)?",
          "Vad kan vi testa i en enda kampanj utan stor ombyggnad?"]),
    ]
    cols, gap = 3, 20
    cw = (XMAX - 120 - gap * (cols - 1)) / cols
    ch = 245
    for i, (ac, title, items) in enumerate(cards):
        cx = 60 + (i % cols) * (cw + gap)
        cy = 350 - (i // cols) * (ch + 24)
        rounded(ax, cx, cy, cw, ch, WHITE, ec=SAND_LIGHT, lw=1.2, r=12)
        topbar(ax, cx, cy + ch - 5, cw, ac)
        text(ax, cx + 18, cy + ch - 38, title, size=11.5, color=INK, weight="bold", family=HEAD)
        ly = cy + ch - 66
        for it in items:
            ly = bullet(ax, cx + 18, ly, it, width=46, size=8.7, color=INK,
                        dot=ac if ac != INK else FOREST, lead=12) - 9
    PAGES.append(fig)


def page_workshop():
    fig, ax = new_page(INK)
    logo = mpimg.imread(os.path.join(WEB, "brand", "roots-logo-white.png"))
    lh = 30
    lw = lh * logo.shape[1] / logo.shape[0]
    ax.imshow(logo, extent=(60, 60 + lw, YMAX - 78, YMAX - 78 + lh), aspect="auto", zorder=5)
    text(ax, XMAX - 60, YMAX - 60, "AVSLUT", size=8, color="#8A8A86", weight="bold", ha="right")
    text(ax, 60, YMAX - 108, "Workshop: så kör vi", size=22, color=WHITE, weight="bold", family=HEAD)
    ax.plot([60, XMAX - 60], [YMAX - 128, YMAX - 128], color="#3A3A37", lw=1.1)

    def darkcard(x, w, title, ac):
        rounded(ax, x, 90, w, YMAX - 290, "#262624", ec="#3A3A37", lw=1, r=14)
        text(ax, x + 22, YMAX - 175, title.upper(), size=8.4, color=ac, weight="bold")
        return YMAX - 205

    w3 = (XMAX - 120 - 2 * 24) / 3
    x1 = 60
    y = darkcard(x1, w3, "Agenda (60 min)", "#C1BF99")
    for s in ["10 min — Gå igenom nuläget (s. 1–5)",
              "10 min — Stämmer marknadsbilden? (s. 6)",
              "20 min — Vrid på flödet: rangordna hypoteser (s. 7)",
              "15 min — Välj 1–2 att testa i nästa kampanj",
              "5 min — Nästa steg och ägare"]:
        y = bullet(ax, x1 + 22, y, s, width=46, size=9.4, color=SAND_LIGHT, dot="#C1BF99", lead=13) - 10

    x2 = 60 + w3 + 24
    y = darkcard(x2, w3, "Frågor till dig som kan föreningslivet", TERRA)
    for s in ["Var tappar föreningar engagemang i en försäljning idag?",
              "Vad gör att en supporter känner sig trygg att betala online?",
              "Hur viktigt är Swish kontra Klarna i praktiken?",
              "Vad förväntar sig föreningen kring utbetalning och tajming?",
              "Vad skulle få dem att välja Roots framför en katalog?"]:
        y = bullet(ax, x2 + 22, y, s, width=46, size=9.4, color=SAND_LIGHT, dot=TERRA, lead=13) - 10

    x3 = 60 + 2 * (w3 + 24)
    y = darkcard(x3, w3, "Beslut vi vill landa", SKY)
    for s in ["1–2 hypoteser att testa skarpt först",
              "Vilken kampanj/förening vi testar med",
              "Hur vi mäter att det funkade",
              "Vem som äger vad till nästa gång"]:
        y = bullet(ax, x3 + 22, y, s, width=46, size=9.6, color=SAND_LIGHT, dot=SKY, lead=14) - 12

    text(ax, 60, 56, "Roots \u00b7 Workshop: köpprocessen i föreningslivet \u00b7 2026",
         size=9, color="#8A8A86")
    PAGES.append(fig)


def render():
    with PdfPages(OUT) as pdf:
        for fig in PAGES:
            pdf.savefig(fig)
            plt.close(fig)
    print("Saved", os.path.relpath(OUT, ROOT), "-", len(PAGES), "sidor")


BUILDERS = [page_cover, page_two_tracks, page_flow, page_checkout, page_money,
            page_matrix, page_market, page_tweaks, page_workshop]
for b in BUILDERS:
    b()
render()
