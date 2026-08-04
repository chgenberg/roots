"""Plattar ut kollegans .docx-underlag till markdown så att det går att läsa,
söka och citera. Rubriknivåer, listor och tabeller bevaras — resten av
Word-formateringen är ointressant för vårt syfte.

    python3 docs/knowledge-os/extract_sources.py

Läser från ~/Desktop/ROOTS Knowledge Operating System och skriver till
docs/knowledge-os/_extract/. Katalogen är genererad och versionshanteras inte.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

SRC = Path.home() / "Desktop" / "ROOTS Knowledge Operating System"
OUT = Path(__file__).parent / "_extract"


def slug(name: str) -> str:
    # Filnamnen innehåller trasig latin-1-kodning (™verl„mning) från
    # exporten. Behåll bara det som är entydigt läsbart.
    name = name.replace("†", "a").replace("„", "a").replace("™", "O")
    name = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
    return re.sub(r"-+", "-", name)


def iter_blocks(doc: Document):
    """Paragrafer och tabeller i dokumentordning."""
    body = doc.element.body
    for child in body.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            yield Paragraph(child, doc)
        elif tag == "tbl":
            yield Table(child, doc)


def table_to_md(table: Table) -> list[str]:
    rows = [[" ".join(c.text.split()) for c in row.cells] for row in table.rows]
    rows = [r for r in rows if any(r)]
    if not rows:
        return []
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    out = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * width]
    for r in rows[1:]:
        out.append("| " + " | ".join(r) + " |")
    return out


def convert(path: Path) -> tuple[Path, int]:
    doc = Document(path)
    lines: list[str] = [f"<!-- källa: {path.name} -->", ""]

    for block in iter_blocks(doc):
        if isinstance(block, Table):
            md = table_to_md(block)
            if md:
                lines.extend(["", *md, ""])
            continue

        text = block.text.strip()
        if not text:
            continue

        style = (block.style.name or "").lower()
        if style.startswith("heading"):
            level = "".join(ch for ch in style if ch.isdigit()) or "1"
            lines.append("")
            lines.append("#" * min(int(level), 6) + " " + text)
            lines.append("")
        elif style.startswith("title"):
            lines.extend(["", "# " + text, ""])
        elif "list" in style:
            lines.append("- " + text)
        else:
            lines.append(text)
            lines.append("")

    md = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"
    dest = OUT / (slug(path.stem) + ".md")
    dest.write_text(md, encoding="utf-8")
    return dest, len(md)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for path in sorted(SRC.glob("*.docx")):
        dest, size = convert(path)
        total += size
        print(f"{size:>9,} tecken  {dest.name}")

    txt = SRC / "Hela_chatten.txt"
    if txt.exists():
        raw = txt.read_bytes().decode("utf-8", errors="replace")
        (OUT / "hela-chatten.md").write_text(raw, encoding="utf-8")
        print(f"{len(raw):>9,} tecken  hela-chatten.md (rå chattlogg)")

    print(f"\n{total:,} tecken i de kurerade dokumenten")
    print(f"Skrivet till {OUT}")


if __name__ == "__main__":
    main()
