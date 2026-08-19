"""Offline räknesnurra — 2–3 slides som speglar den enkla Excel-upplevelsen.

    python3 docs/presentations/deck_raknesnurra.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from slide_model import Deck, Slide  # noqa: E402

FILENAME = "Roots_Raknesnurra.pptx"
DECK_NAME = "Roots · Räknesnurra"


def _n():
    i = 0
    while True:
        i += 1
        yield i


def build() -> Deck:
    n = _n()
    slides: list[Slide] = []

    slides.append(Slide(
        number=next(n), layout="impact", kicker="RÄKNESNURRA",
        title="Er förening tjänar",
        subtitle="Medlemmar × snitt × 35 % — samma modell som på roots.nu",
        items=[
            "Två siffror att fylla i.",
            "Resultatet syns direkt.",
            "35 % låst till föreningen.",
        ],
        caption="Öppna Roots_Raknesnurra.xlsx — gula fält, grön huvudssiffra.",
        notes="Visa Excel live hellre än den här slidern.",
    ))

    slides.append(Slide(
        number=next(n), layout="kpi", kicker="SÅ RÄKNAR NI",
        title="Två frågor. En siffra.",
        items=[
            "Hur många säljer? | 1–1 000 (20, 50, 100, 300, 500 …)",
            "Hur mycket säljer var och en? | Max 5 000 kr per person",
            "Er andel | 35 % — låst, ingen förhandling",
            "Exempel | 50 × 1 500 kr × 35 % = 26 250 kr till er",
        ],
        caption="Premiumpaket 399 kr ≈ 140 kr till föreningen per paket.",
    ))

    slides.append(Slide(
        number=next(n), layout="table", kicker="JÄMFÖR",
        title="Exempel ni kan spegla er i",
        columns=["Scenario", "Medlemmar · snitt · ni får"],
        items=[
            "Litet lag | 20 · 1 000 kr · 7 000 kr",
            "Vanlig förening | 50 · 1 500 kr · 26 250 kr",
            "Stark kampanj | 100 · 2 500 kr · 87 500 kr",
            "Högt snitt | 50 · 5 000 kr · 87 500 kr",
        ],
        caption="Excel-filen räknar live. PPTX:en är backup utan dator.",
    ))

    return Deck(title=DECK_NAME, slides=slides)


if __name__ == "__main__":
    from build_decks import HERE, render

    deck = build()
    out = HERE / FILENAME
    render(deck, out, DECK_NAME)
    desktop = Path.home() / "Desktop" / FILENAME
    desktop.write_bytes(out.read_bytes())
    for s in deck.slides:
        print(f"  {s.number:02d} {s.layout:10} {s.title[:58]}")
    print(f"\nWrote {out}")
    print(f"Wrote {desktop}")
