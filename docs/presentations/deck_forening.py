"""Föreningspresentation — kort hook för styrelsemöte (5–10 min).

Mål: få föreningen intresserad nog att boka nästa möte med styrelserepresentanter.
Inte en full pitch. Inte byråkalkyler. Inte varje skärm.

Dramaturgi: problem → erbjudande → pengar → enkelheten → nästa steg.

    python3 docs/presentations/deck_forening.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from slide_model import Column, Deck, Slide  # noqa: E402

FILENAME = "Roots_Foreningspresentation.pptx"
PDF_NAME = "Roots_Foreningspresentation.pdf"
DECK_NAME = "Roots · Till föreningen"


def _n():
    i = 0
    while True:
        i += 1
        yield i


def build() -> Deck:
    n = _n()
    slides: list[Slide] = []

    # ── 01 · Omslag (~30 sek) ─────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cover", kicker="ROOTS · TILL FÖRENINGEN",
        title="Finansiering som medlemmarna\nvill sälja.",
        subtitle="Premium hårvård · 35 % till föreningen · klart på telefonen.",
        images=["images/sport-pres-cover.jpg"],
        notes="30 sek. Nämn deras mål (cup, hall, resa) — inte produkten först. "
              "Säg att ni tar 5–8 minuter och sedan föreslår ett kort styrelsemöte.",
    ))

    # ── 02 · Problemet (~1 min) ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="columns", kicker="KÄNNER NI IGEN ER?",
        title="Samma behov. Mindre friktion.",
        left=Column(
            heading="Så det brukar gå",
            items=[
                "Pärmar och kontanter",
                "Produkter få vill ha kvar",
                "Excel i efterhand",
            ],
        ),
        right=Column(
            heading="Med Roots",
            items=[
                "Länk i telefonen",
                "Premiumprodukt man behåller",
                "Pengar synliga samma dag",
            ],
        ),
        caption="Ni behåller föreningsandan. Vi tar bort administrationen.",
        notes="Max en minut. Låt dem nicka till vänsterkolumnen.",
    ))

    # ── 03 · Erbjudandet (~1–2 min) ───────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="kpi", kicker="ERBJUDANDET",
        title="Ett paket. En andel. Klart.",
        items=[
            "399 kr | Premiumpaket — schampo, balsam, body wash",
            "35 % | Till föreningen (~140 kr per paket)",
            "0 kr | Uppstartsavgift",
            "Telefon | Ungdomen säljer via egen länk",
        ],
        caption="Paketet är standard. Styck finns om någon frågar.",
        notes="35 % är låst — säg det som löfte. Stanna på den här sliden.",
    ))

    # ── 04 · Punch (~1 min) ───────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="impact", kicker="TILL FÖRENINGEN",
        title="35 %",
        subtitle="av varje såld krona — utan förhandling",
        items=[
            "Låst i avtalet från dag ett.",
            "Syns i dashboarden samma dag.",
            "Samma andel för varje lag.",
        ],
        caption="Det är därför medlemmarna säljer med stolthet.",
        notes="Låt siffran landa. Fråga vad 150–400 tkr skulle betyda för er.",
    ))

    # ── 05 · Räkneexempel (~1–2 min) ──────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="EXEMPEL",
        title="Vad det kan bli — mittläge",
        items=[
            "450 medlemmar | 6 paket per medlem under kampanjen",
            "≈ 1,08 Mkr | Omsättning (2 700 × 399 kr)",
            "≈ 377 tkr | Till föreningen (35 %)",
            "Era tal | Vi räknar om på nästa möte — med styrelsen",
        ],
        caption="Indikativt. Mindre lag funkar också — beloppet skalar med er.",
        notes="Poängen är inte exakt prognos — det är att visa storleksordning "
              "och bjuda in till ett möte där ni räknar deras siffror.",
    ))

    # ── 06 · Enkelheten (~1 min) ──────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="SÅ FUNKAR DET",
        title="Föreningsförsäljning. Fast enkelt.",
        items=[
            "Starta | Vi bestämmer oss — sedan är vi igång.",
            "Kommunicera | Inget tomt dokument att börja i.",
            "Sälja | Dela. Sälj. Klart. Kunden betalar själv.",
            "Administrera | Roots håller ihop listor, pengar och resultat.",
        ],
        caption="Ni fokuserar på föreningen. Roots tar hand om försäljningen.",
        notes="Ett andetag per block. Dashboard-demo sparar ni till "
              "styrelsemötet — här räcker modellen.",
    ))

    # ── 07 · Det Roots tar bort (~45 sek) ─────────────────────────────
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
        notes="Låt dem peka på vänsterkolumnen. Sedan CTA.",
    ))

    # ── 08 · Hook / CTA (~1 min) ──────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="close", kicker="NÄSTA STEG",
        title="Boka 30 minuter med styrelsen",
        items=[
            "Vi räknar med era egna tal",
            "Ni får se flödet live (shop + dashboard)",
            "Ni beslutar i lugn och ro efteråt",
            "info@roots.nu · ta med ordförande eller kassör",
        ],
        notes="Avsluta med datumförslag — inte »hör av er«. "
              "Lämna PDF:en. Målet är nästa möte, inte signatur i dag.",
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
