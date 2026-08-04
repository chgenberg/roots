"""Läser Master Source-dokumenten och gör varje MS-specifikation åtkomlig.

Kollegans underlag är inte bakgrundsmaterial att sammanfatta — varje MS-ID är en
färdig slide-specifikation med titel, undertitel, slide-innehåll, talarmanus och
layoutanvisning. Modulinstruktionen är uttrycklig:

    "Den svenska texten ska användas exakt enligt respektive Slide Specification
    och får inte översättas eller omformuleras av designagenten."

Därför hämtar presentationerna sin text härifrån i stället för att den skrivs av
för hand. Två dokumentformat förekommer:

MODULFORMAT (Modul 1–3 samt MS-017–020)
    # MS-001 – Rubrik
    ### Titel
    ...
    ### Slide-innehåll
    ...

NUMRERAT FORMAT (MS-114 och MS-115, 35-punktsmallen)
    7. Titel
    ...
    21. Five-Year Business Roadmap
    År 1 – Foundation & Proof
    Huvudmål
    ...

Kör filen direkt för att se vad som hittades:

    python3 docs/knowledge-os/ms_source.py
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

EXTRACT = Path(__file__).parent / "_extract"

MODULE_FILES = [
    "roots-master-source-modul-1-vision-v1-0.md",
    "roots-master-source-modul-2-affaren-v1-0.md",
    "roots-master-source-modul-3-plattform-v1-0.md",
    "roots-master-source-fran-modul-4-till-slutet-av-chatten.md",
]
NUMBERED_FILES = {"MS-114": "ms-114.md", "MS-115": "ms-115.md"}

# Word-exporten har kvar fetmarkeringar och citattecken i vissa rubriker.
_STRIP = str.maketrans({"*": None})


def _clean(text: str) -> str:
    return " ".join(text.translate(_STRIP).split()).strip('"').strip()


@dataclass
class Spec:
    """En MS-specifikation med sina fält i dokumentordning."""

    ms_id: str
    source_file: str
    fields: dict[str, str] = field(default_factory=dict)

    # ── enskilda fält ────────────────────────────────────────────────
    def text(self, name: str) -> str:
        """Fältet som en rad. Tomt om fältet saknas."""
        return _clean(self.fields.get(name, ""))

    def paras(self, name: str) -> list[str]:
        """Fältets stycken, tomma rader borttagna."""
        raw = self.fields.get(name, "")
        return [_clean(p) for p in raw.split("\n") if _clean(p)]

    def bullets(self, name: str) -> list[str]:
        """Bara punktlistans rader, utan bindestreck."""
        return [p[2:].strip() for p in self.paras(name) if p.startswith("- ")]

    def lines(self, name: str) -> list[str]:
        """Stycken utan punkter, citattecken eller pilar."""
        out = []
        for p in self.paras(name):
            p = p[2:].strip() if p.startswith("- ") else p
            p = p.lstrip("> ").strip()
            if p and p not in {"↓", "→", ">"}:
                out.append(p)
        return out

    # ── struktur inuti ett fält ──────────────────────────────────────
    def under(self, name: str, label: str) -> list[str]:
        """Stycken under en inline-etikett, till nästa etikett.

        Slide-innehåll är skrivet med etiketter i löpande text:

            Tre bärande delar:
            Premiumprodukter
            Produkter människor vill köpa.
            Nederst:
            Mer tid till verksamheten.
        """
        items = self.paras(name)
        starts = [i for i, p in enumerate(items) if p.rstrip(":").strip() == label]
        if not starts:
            return []
        start = starts[0] + 1
        end = len(items)
        for i in range(start, len(items)):
            if items[i].endswith(":") and len(items[i]) < 40:
                end = i
                break
        out = []
        for p in items[start:end]:
            p = p[2:].strip() if p.startswith("- ") else p
            if p and p != "↓":
                out.append(p)
        return out

    def pairs(self, name: str, label: str) -> list[tuple[str, str]]:
        """Etikett/beskrivning-par: varannat stycke är rubrik, varannat text."""
        items = self.under(name, label)
        return [(items[i], items[i + 1] if i + 1 < len(items) else "")
                for i in range(0, len(items), 2)]

    def flow(self, name: str) -> list[str]:
        """Stegen i ett pilflöde, oavsett om pilarna är ↓ eller →."""
        steps: list[str] = []
        for p in self.paras(name):
            if p.endswith(":") and len(p) < 40:
                continue
            for part in re.split(r"[→↓]", p):
                part = _clean(part).lstrip("- ")
                if part and part not in steps:
                    steps.append(part)
        return steps


@dataclass
class Doc:
    """MS-114/MS-115: 35-punktsmallen med underrubriker per sektion."""

    ms_id: str
    source_file: str
    sections: dict[str, list[str]] = field(default_factory=dict)

    def _match(self, name: str) -> list[str]:
        for key, body in self.sections.items():
            if key.lower() == name.lower():
                return body
        raise KeyError(f"{self.ms_id}: saknar sektion {name!r}")

    def paras(self, section: str) -> list[str]:
        return [p for p in (_clean(x) for x in self._match(section)) if p]

    def first(self, section: str) -> str:
        paras = self.paras(section)
        return paras[0] if paras else ""

    def sub(self, section: str, label: str, stop: set[str] | None = None) -> list[str]:
        """Styckena under en underrubrik i en sektion.

        Underrubrikerna är vanliga stycken i Word-exporten ("Fokus",
        "Prioriteringar", "Leverans"), så avgränsningen görs mot nästa känd
        underrubrik i stop.
        """
        paras = self.paras(section)
        if label not in paras:
            return []
        start = paras.index(label) + 1
        stop = stop or set()
        out = []
        for p in paras[start:]:
            if p in stop:
                break
            out.append(p)
        return out

    def table(self, section: str) -> list[tuple[str, str]]:
        """Tvåkolumnstabell ur markdown-tabellen i sektionen."""
        rows = []
        for p in self.paras(section):
            if not p.startswith("|") or set(p) <= set("|-— "):
                continue
            cells = [c.strip() for c in p.strip("|").split("|")]
            if len(cells) >= 2:
                rows.append((cells[0], cells[1]))
        return rows[1:] if rows else []


def _parse_module(path: Path) -> dict[str, Spec]:
    text = path.read_text(encoding="utf-8")
    specs: dict[str, Spec] = {}
    blocks = re.split(r"^# (MS-\d+[^\n]*)$", text, flags=re.M)
    for i in range(1, len(blocks), 2):
        ms_id = blocks[i].split("–")[0].split("-")[0].strip()
        ms_id = re.match(r"MS-\d+", blocks[i]).group(0)
        body = blocks[i + 1]
        fields: dict[str, str] = {}
        for m in re.finditer(r"^### ([^\n]+?)\s*$\n(.*?)(?=^### |^# |\Z)",
                             body, re.M | re.S):
            fields[_clean(m.group(1))] = m.group(2)
        # Bara block med Titel är faktiska slide-specifikationer; övriga
        # MS-poster i den stora filen är arbetsanteckningar.
        if "Titel" in fields:
            specs[ms_id] = Spec(ms_id, path.name, fields)
    return specs


def _parse_numbered(path: Path, ms_id: str) -> Doc:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    # Toppnivårubrikerna är "1. Slide ID" … "35. Versionsstatus & Sign-off".
    heads = [(i, m.group(2)) for i, line in enumerate(lines)
             if (m := re.match(r"^(\d{1,2})\.\s+([A-ZÅÄÖ][^\n]*)$", line))
             and 1 <= int(m.group(1)) <= 35]
    # Underlistor som "1. Fokus" inne i en sektion ska inte bli egna sektioner:
    # behåll bara rubriker vars nummer växer monotont.
    kept, expected = [], 1
    for idx, name in heads:
        number = int(re.match(r"^(\d{1,2})\.", lines[idx]).group(1))
        if number >= expected:
            kept.append((idx, name))
            expected = number + 1
    sections: dict[str, list[str]] = {}
    for n, (idx, name) in enumerate(kept):
        end = kept[n + 1][0] if n + 1 < len(kept) else len(lines)
        sections[_clean(name)] = lines[idx + 1:end]
    return Doc(ms_id, path.name, sections)


def load() -> tuple[dict[str, Spec], dict[str, Doc]]:
    specs: dict[str, Spec] = {}
    for name in MODULE_FILES:
        path = EXTRACT / name
        if not path.exists():
            raise SystemExit(f"Saknar {path}. Kör extract_sources.py först.")
        for ms_id, spec in _parse_module(path).items():
            specs.setdefault(ms_id, spec)

    docs = {ms_id: _parse_numbered(EXTRACT / name, ms_id)
            for ms_id, name in NUMBERED_FILES.items()}
    return specs, docs


def source_corpus() -> str:
    """All källtext i en sträng — används för ordagrannhetskontrollen."""
    parts = [(EXTRACT / n).read_text(encoding="utf-8") for n in MODULE_FILES]
    parts += [(EXTRACT / n).read_text(encoding="utf-8")
              for n in NUMBERED_FILES.values()]
    return "\n".join(parts)


if __name__ == "__main__":
    specs, docs = load()
    print(f"{len(specs)} slide-specifikationer:\n")
    for ms_id, spec in sorted(specs.items()):
        print(f"  {ms_id}  {spec.text('Titel')[:62]:62} {spec.source_file[:28]}")
    print()
    for ms_id, doc in docs.items():
        print(f"  {ms_id}  {len(doc.sections)} sektioner  {doc.source_file}")
        print(f"        titel: {doc.first('Titel')}")
