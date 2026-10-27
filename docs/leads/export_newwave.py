#!/usr/bin/env python3
"""Plockar ut Newwaves klubbregister per rad i Leadsbas (för build_utskick.py --newwave).

    python3 docs/leads/export_newwave.py LEADS.xlsx UT.json [--newwave ~/Desktop/Newwave/content-machine]

Matchar på föreningsnamn + kommun. Namn som finns två gånger i samma kommun hoppas över.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import openpyxl

FIELDS = ("url", "confidence", "emails", "phones", "socials", "shop", "founded", "description", "platform", "logo")


def fold(s: str | None) -> str:
    s = (s or "").lower().replace("å", "a").replace("ä", "a").replace("ö", "o")
    return re.sub(r"[^a-z0-9]", "", s)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("leads"); ap.add_argument("out")
    ap.add_argument("--newwave", default=str(Path.home() / "Desktop/Newwave/content-machine"))
    a = ap.parse_args()
    root = Path(a.newwave) / ".data/newwave/clubs"
    by_key = defaultdict(list)
    for c in json.loads((root / "clubs.json").read_text()):
        by_key[(fold(c["name"]), fold(c["municipality"]))].append(c)
    ws = openpyxl.load_workbook(a.leads, read_only=True)["Leadsbas"]
    out = {}
    for i, r in enumerate(ws.iter_rows(values_only=True, min_row=2), start=2):
        hits = by_key.get((fold(r[0]), fold(r[2]))) if r[0] else None
        if not hits or len(hits) > 1:
            continue
        site = root / "sites" / f"{hits[0]['id']}.json"
        if not site.exists():
            continue
        d = json.loads(site.read_text())
        if d.get("status") == "found":
            out[i] = {k: d.get(k) for k in FIELDS}
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False))
    print(f"{len(out)} rader med Newwave-data")


if __name__ == "__main__":
    main()
