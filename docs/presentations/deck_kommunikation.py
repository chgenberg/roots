"""Kommunikationskit — kort konceptpresentation (augusti 2026).

Utgår från Enkelhet-briefen (aug 2026):
Föreningsförsäljning. Fast enkelt.
Starta → Kommunicera → Sälja → Administrera.

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
        title="Föreningsförsäljning.\nFast enkelt.",
        subtitle="Föreningen bestämmer sig, sätter målet och engagerar "
                 "medlemmarna. Roots hjälper till med resten.",
        images=["images/sport-pres-cover.jpg"],
        notes="Öppna med enkelheten — inte kitet. Efter ett ja ska ledaren "
              "känna: det här skapar inte mer administration för mig.",
    ))

    # ── 02 · Den enkla modellen (brief: Roots = enkelhet) ─────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="ENKELHETEN",
        title="Fyra steg. Resten tar vi.",
        items=[
            "Starta | Vi bestämmer oss — sedan är vi igång.",
            "Kommunicera | Inget tomt dokument att börja i.",
            "Sälja | Dela. Sälj. Klart. Kunden betalar själv.",
            "Administrera | Roots håller ihop listor, pengar och resultat.",
        ],
        caption="Ni fokuserar på föreningen. Roots tar hand om försäljningen.",
        notes="Huvudslide ur Enkelhet-briefen. Ett andetag per block. "
              "Inte en featurelista — känslan: var är vi, vad händer nu, "
              "behöver jag göra något? Svaret ska oftast vara nej.",
    ))

    # ── 03 · Det Roots tar bort ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="columns", kicker="DET NI SLÄPPER",
        title="Vi tar bort jobbet runt omkring",
        left=Column(
            heading="Borta",
            items=[
                "Kataloger och fysiskt säljmaterial",
                "Skriva mail, SMS och SOME själv",
                "Excel, orderlistor och sammanställningar",
                "Swish, kontanter och fakturor till varje kund",
            ],
        ),
        right=Column(
            heading="Kvar hos er",
            items=[
                "Beslutet att köra",
                "Målet och ändamålet",
                "Att engagera medlemmarna",
                "Att följa resultatet — inte jaga det",
            ],
        ),
        caption="Var är vi? → Vad händer nu? → Behöver jag göra något? "
                "Svaret ska så ofta som möjligt vara: nej.",
        notes="Visuell kontrast till de fyra stegen. Sedan in i kitet.",
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
    desktop = Path.home() / "Desktop"
    desktop_pptx = desktop / FILENAME
    desktop_pptx.write_bytes(out.read_bytes())
    print(f"Wrote {out}")
    print(f"Wrote {desktop_pptx}")
