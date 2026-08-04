#!/usr/bin/env python3
"""Kontrollerar att all text på sliderna finns ordagrant i Master Source.

Modulinstruktionen i kollegans underlag säger att den svenska texten ska
användas exakt enligt respektive Slide Specification och inte får omformuleras.
Det här skriptet är kvittot på att vi håller oss till det: varje sträng som
renderas på en slide måste återfinnas i källdokumenten.

    python3 docs/presentations/verify_verbatim.py

Undantagen nedan är strukturell navigation — kickers, spaltrubriker och några
rubriker där källans egen inledning är ett helt stycke och inte fungerar som
rubrik. Allt annat måste matcha källan.
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "knowledge-os"))

import ms_source as ms  # noqa: E402
from decks import DECKS  # noqa: E402

# Rubriker och etiketter vi själva sätter för att navigera i presentationen.
# Varje post är strukturell — den beskriver vad sliden visar, aldrig ett
# sakpåstående om affären.
STRUCTURAL = {
    # Kickers
    "COMMERCIAL PLAYBOOK", "VISION", "AFFÄREN", "PLATTFORMEN", "NÄSTA STEG",
    "ÖVERGRIPANDE PRESENTATION", "MS-114 · MS-115", "MS-115", "ÅR 1",
    "EXECUTIVE NORTH STAR", "PROVE", "MÅLBILD", "VERKSAMHETSÅRETS ROADMAP",
    "PRIORITERINGAR", "OPERATING MODEL", "SUCCESS DEFINITION",
    "RISKS & MITIGATION", "EXECUTIVE DECISIONS", "TAKE-AWAY",
    "FIVE-YEAR BUSINESS ROADMAP", "UTVECKLINGSOMRÅDEN", "PRIORITERINGSMODELL",
    "STRATEGISKA PRINCIPER", "RIKTNING",
    # Rubriker som beskriver sliden
    "Budgetmål och säljmål", "Fyra faser med eget syfte och tydlig leverans",
    "Vad vi prioriterar i varje fas", "Risker och motåtgärder",
    "Fem områden som utvecklas parallellt", "Ett dominerande tema per år",
    # Tabellhuvuden och spaltrubriker ur källans egna tabeller
    "Risk", "Motåtgärd", "År", "Primärt fokus",
    # Navtexter i hjulen
    "ROOTS", "Flywheel", "Support", "Center", "Gemensam", "databas",
    "Commercial", "Playbook",
}


def normalise(text: str) -> str:
    """Jämförbar form: enhetliga bindestreck, citattecken och blanksteg."""
    text = unicodedata.normalize("NFC", text)
    for dash in "–—‑":
        text = text.replace(dash, "-")
    for quote in "\u201d\u201c\u201e\u2019\u2018":
        text = text.replace(quote, '"')
    text = text.replace("*", "")
    return re.sub(r"\s+", " ", text).strip().lower()


def fragments(value: str) -> list[str]:
    """Delar en sträng i de bitar som kan sökas var för sig.

    Flera slides sätter samman källans stycken till en rad — kvartalens
    prioriteringar, rollernas ansvarslistor. Då finns inte hela raden i källan,
    men varje del gör det.
    """
    parts = [value]
    for separator in (". ", "; ", ", "):
        expanded: list[str] = []
        for part in parts:
            expanded.extend(part.split(separator))
        parts = expanded
    return [p for p in (x.strip(" .,:;") for x in parts) if len(p) > 2]


def strings_on(slide) -> list[tuple[str, str]]:
    """(fältnamn, text) för allt som hamnar synligt på sliden."""
    out: list[tuple[str, str]] = []
    for field in ("kicker", "title", "subtitle", "caption"):
        value = getattr(slide, field, "")
        if value:
            out.append((field, value))
    for item in slide.items:
        for cell in item.split("|"):
            if cell.strip():
                out.append(("item", cell.strip()))
    for name in ("left", "right"):
        column = getattr(slide, name, None)
        if column is None:
            continue
        if column.heading:
            out.append((f"{name}.heading", column.heading))
        out.extend((f"{name}.item", i) for i in column.items)
    out.extend(("column", c) for c in slide.columns if c)
    return out


def main() -> int:
    corpus = normalise(ms.source_corpus())
    allowed = {normalise(s) for s in STRUCTURAL}

    checked = missing = 0
    problems: list[str] = []

    for filename, build in DECKS.items():
        deck = build()
        for slide in deck.slides:
            for field, value in strings_on(slide):
                checked += 1
                needle = normalise(value)
                if not needle or needle in allowed or needle in corpus:
                    continue
                unmatched = [f for f in fragments(value)
                             if normalise(f) not in corpus
                             and normalise(f) not in allowed]
                if not unmatched:
                    continue
                missing += 1
                problems.append(
                    f"{filename} slide {slide.number:02d} ({slide.source}) "
                    f"{field}: {unmatched[0][:88]!r}")

    print(f"Kontrollerade {checked} textsträngar mot Master Source.")
    if problems:
        print(f"\n{missing} strängar saknar täckning i källan:\n")
        for p in problems:
            print(f"  {p}")
        return 1

    print("Allt innehåll finns ordagrant i källdokumenten.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
