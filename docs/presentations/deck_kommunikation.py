"""Kommunikationskit — kort konceptpresentation (augusti 2026).

Utgår från kreativ brief / konceptunderlag:
Kärnan: Föreningen fattar beslutet. Roots hjälper dem med resten.

Syfte: 5–8 min för säljare, styrelse eller intern synk — inte byråpitch
i full längd. Visar USP, resa och vad föreningen slipper göra.

    python3 docs/presentations/deck_kommunikation.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from slide_model import Column, Deck, Slide  # noqa: E402

FILENAME = "Roots_Kommunikationskit.pptx"
PDF_NAME = "Roots_Kommunikationskit.pdf"
DECK_NAME = "Roots · Kommunikationskit"


def _n():
    i = 0
    while True:
        i += 1
        yield i


def build() -> Deck:
    n = _n()
    slides: list[Slide] = []

    # ── 01 · Omslag ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cover", kicker="ROOTS · KOMMUNIKATIONSKIT",
        title="Föreningen fattar beslutet.\nRoots hjälper er med resten.",
        subtitle="Färdig kommunikation för hela säljresan — mail, SMS, "
                 "SOME och resultat. Granska → anpassa → skicka.",
        images=["images/sport-pres-cover.jpg"],
        notes="Öppna med känslan: efter ett ja ska ledaren känna "
              "»det här skapar inte mer administration för mig«.",
    ))

    # ── 02 · Problemet ────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="columns", kicker="TRÖSKELN",
        title="Det är inte produkten som stoppar — det är jobbet runt omkring",
        left=Column(
            heading="Utan Roots",
            items=[
                "Skriva mail och SMS själv",
                "Hitta på SOME-inlägg",
                "Jaga aktivering och påminnelser",
                "Samla resultat i efterhand",
            ],
        ),
        right=Column(
            heading="Med Roots",
            items=[
                "Färdiga texter, klubbanpassade",
                "Rätt budskap vid rätt tid",
                "Påminnelse bara till dem som saknas",
                "Resultat och tack — automatiskt",
            ],
        ),
        caption="Vi har inte bara gjort det enkelt att sälja. "
                "Vi har gjort det enkelt att vara den som ansvarar.",
        notes="Låt styrelsen/ledaren känna igen sig till vänster.",
    ))

    # ── 03 · USP-punch ────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="impact", kicker="POSITIONERING",
        title="Enkelt att vara ansvarig",
        subtitle="Föreningen fattar beslutet. Roots hjälper er med resten.",
        items=[
            "Inga tomma dokument att börja i.",
            "Inga egna Excel-listor eller Swish-jakter.",
            "Kommunikation förberedd från första info till tack.",
        ],
        caption="Premiumprodukt + digital shop + färdigt kommunikationskit.",
        notes="Stanna. Det här är USP:n — inte bara plattformen.",
    ))

    # ── 04 · Vad ni får ───────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="LEVERANSEN",
        title="Ett klubbanpassat kit för hela säljresan",
        items=[
            "Mail & SMS | Färdiga, tydliga texter — granska, anpassa, skicka",
            "SOME & grafik | Feed/story-mallar + starka sifferbilder",
            "Säljtips & delning | Copy varje medlem klistrar in med sin länk",
            "Resultat & tack | Total intäkt, vinnare, leverans — och shoppen lever vidare",
        ],
        caption="Föreningen anger några få uppgifter vid uppstart. "
                "Resten återanvänds genom hela resan.",
        notes="Personalisering: klubb, datum, mål, ändamål, länkar, resultat.",
    ))

    # ── 05 · Resan ────────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="timeline", kicker="KOMMUNIKATIONSRESAN",
        title="Sex steg — från beslut till eftermarknad",
        items=[
            "Nu kör vi!",
            "Snart är det dags",
            "Din shop saknas",
            "Säljstart",
            "Vilken insats!",
            "Tack — fortsätt",
        ],
        caption="Mail · SMS · SOME · Säljtips · Påminnelser · Resultat. "
                "Webshopen lever vidare efter kampanjen.",
        notes="Steg 1 efter beslut · 2: 3–4 v före · 3: riktad påminnelse · "
              "4: säljstart · 5: efter stopp · 6: tack + recurring.",
    ))

    # ── 06 · UX i plattformen ─────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="kpi", kicker="I PLATTFORMEN",
        title="Granska → Anpassa → Skicka",
        items=[
            "Kalender | Kommande och genomförda utskick",
            "Status | T.ex. 87 % aktiverade · 13 % att påminna",
            "Segment | Bara dem som ännu inte agerat",
            "Data | Klubbens siffror ifyllda i varje mall",
        ],
        caption="Först manuellt kit. Sedan inbyggt i Roots Admin — "
                "inte en mapp med Word-filer.",
        notes="Vision: tidslinje där rätt kommunikation dyker upp i rätt läge.",
    ))

    # ── 07 · Framgång ─────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="close", kicker="MÅTTSTOCK",
        title="»Perfekt — det här behöver jag inte lägga tid på.«",
        items=[
            "Reaktion efter ett ja: mindre administration, inte mer",
            "Kommunikationen känns som föreningens — inte generisk",
            "Skalbart system, inte sex lösa kampanjbilder",
            "Kontakt: info@roots.nu · Ourroots AB",
        ],
        notes="Avsluta med frågan: vill ni se kit + snurra live med era tal?",
    ))

    return Deck(title=DECK_NAME, slides=slides)


if __name__ == "__main__":
    from build_decks import HERE, render

    deck = build()
    out = HERE / FILENAME
    render(deck, out, DECK_NAME)
    for s in deck.slides:
        print(f"  {s.number:02d} {s.layout:10} {s.title[:58]}")
    print(f"\nWrote {out}")
