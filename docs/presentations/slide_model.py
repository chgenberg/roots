"""Datamodellen som renderarna arbetar mot.

En Slide är en färdig beskrivning av vad som ska ritas: rubriker, punkter,
bilder och talarmanus. Innehållet kommer alltid ur Master Source via decks.py —
den här modulen känner inte till några källdokument.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Column:
    """En spalt i en tvåspaltslayout."""
    heading: str = ""
    items: list[str] = field(default_factory=list)


@dataclass
class Slide:
    number: int
    layout: str
    kicker: str = ""
    title: str = ""
    subtitle: str = ""
    items: list[str] = field(default_factory=list)
    images: list[str] = field(default_factory=list)
    notes: str = ""
    source: str = ""
    # Master Source avslutar många slides med ett "Nederst:"-fält — en rad under
    # innehållet som sammanfattar sliden.
    caption: str = ""
    left: Column | None = None
    right: Column | None = None
    # Används både för tabellhuvuden och för navtexten i hjullayouten.
    columns: list[str] = field(default_factory=list)

    def cells(self, expected: int) -> list[list[str]]:
        """Punkter på formen "a | b | c" delade i kolumner.

        Rader med för få delar fylls ut med tomma strängar så att renderarna
        aldrig behöver indexskydda.
        """
        rows = []
        for item in self.items:
            parts = [p.strip() for p in item.split("|")]
            parts += [""] * (expected - len(parts))
            rows.append(parts[:expected])
        return rows


@dataclass
class Deck:
    title: str
    slides: list[Slide]
