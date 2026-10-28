#!/usr/bin/env python3
"""Stavningskontroll av föreningsnamnen i leadslistan.

Usage: python3 docs/leads/spellcheck_names.py LEADS.xlsx OUT.json [--model gpt-5.4-mini] [--workers 6]
       python3 docs/leads/spellcheck_names.py LEADS.xlsx OUT.json --verify [--model gpt-5.4]

Läser namnen utan parenteser (samma regel som Korrigerat namn i build_utskick.py)
och låter en billig modell rätta tydliga stavfel. Resultatet är bara de namn
som ändrats: {"namn utan parentes": {"fixed": "...", "why": "..."}}. Körningen
fortsätter där den slutade om OUT.json redan finns.

--verify låter en starkare modell pröva varje förslag. Bara godkända förslag
(verified = true) används av build_utskick.py --stavning.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_utskick as bu  # noqa: E402
from enrich_cheap import load_env  # noqa: E402

BATCH = 60
PRICE = {"gpt-5.4-mini": (0.75, 4.50), "gpt-6-luna": (0.10, 0.50), "gpt-5.4-nano": (0.20, 1.25)}

RULES = """Du rättar stavning i svenska föreningsnamn (idrott, kultur, intresseföreningar) som ska stå i ett mejl.
Rätta bara det som tydligt är fel:
- stavfel i vanliga ord (Idrotsförening -> Idrottsförening, Fotbolsklubb -> Fotbollsklubb, Ishockeyklub -> Ishockeyklubb)
- å, ä, ö som saknas när ortnamnet är välkänt (Umea -> Umeå, Gavle -> Gävle)
- liten bokstav i början av ett ortnamn eller egennamn (härnösands -> Härnösands, hudik/björkbergs -> Hudik/Björkbergs)
- dubbla mellanslag, mellanslag före skiljetecken, mellanslag runt snedstreck och bindestreck som är fel
Ändra aldrig:
- förkortningar (IF, IK, BK, FF, IBK, HC, GIF, AIK, SK, FUB, DHR, PRO, KFUM) eller deras versaler
- gamla eller medvetna stavningar (Gefle, Wäsby, Kopparbergs, Hellas, Bois)
- ord som är rätt men ovanliga, namn på personer, engelska namn (United, Cheer, Allstars)
- förkortade ord med punkt (Skyttef., sekt.) - låt dem stå
Är du osäker: lämna namnet som det är. Hitta inte på, översätt inte, lägg inte till eller ta bort ord.
Svara bara med de namn du ändrar, med id, rättat namn och en kort förklaring på svenska."""

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["changes"],
    "properties": {
        "changes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "fixed", "why"],
                "properties": {"id": {"type": "integer"}, "fixed": {"type": "string"}, "why": {"type": "string"}},
            },
        }
    },
}


VERIFY_RULES = """Du granskar föreslagna rättningar av svenska föreningsnamn som ska stå i ett mejl till föreningen.
Godkänn bara om rättningen är säker och föreningen själv skulle hålla med:
- uppenbara stavfel och avklippta ord (Volleybollklub -> Volleybollklubb, Handikappidrottsförenin -> Handikappidrottsförening)
- versaler i förkortningar (Goif -> GoIF, If -> IF, Rsmh -> RSMH, Kfum -> KFUM)
- stor bokstav efter bindestreck eller snedstreck i ortnamn (Alfta-edsbyns -> Alfta-Edsbyns)
- prepositionen I -> i mitt i namnet, ord i VERSALER -> vanlig skrivning (HJO -> Hjo, OCH -> och)
Underkänn:
- gamla eller medvetna stavningar (Wäxjö, Wärnamo, Wårgårda, Jemtland, Finspong, Gefle, Upsala, Hufvudstaden)
- att ord skrivs ihop eller isär (Hockey Klubb -> Hockeyklubb): föreningens officiella namn skrivs ofta isär
- att förkortningar skrivs ut eller ändras (Sthlm, Hemb., Allm, BoIK -> BOIK), att ord läggs till, tas bort eller byts
- ändrad ort eller genitiv (Torp -> Torps, Näshulta -> Näshults), liten bokstav där originalet har stor
- allt du inte är helt säker på
Svara för varje id: ok true/false."""

VERIFY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["verdicts"],
    "properties": {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "ok"],
                "properties": {"id": {"type": "integer"}, "ok": {"type": "boolean"}},
            },
        }
    },
}


def plausible(before: str, after: str) -> bool:
    """Små ändringar: samma antal ord ±1 och nästan samma bokstäver."""
    if abs(len(before.split()) - len(after.split())) > 1:
        return False
    return difflib.SequenceMatcher(None, before.lower(), after.lower()).ratio() >= 0.85


def post(body: dict) -> tuple[dict, dict]:
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.load(r)
    text = next(c["text"] for o in data["output"] if o["type"] == "message"
                for c in o["content"] if c["type"] == "output_text")
    return data, json.loads(text)


def verify(state: dict, model: str) -> None:
    items = [(k, v) for k, v in sorted(state["changes"].items())]
    for k, v in items:
        v["verified"] = False
    candidates = [(k, v) for k, v in items if plausible(k, v["fixed"])]
    for i in range(0, len(candidates), 50):
        chunk = candidates[i:i + 50]
        listing = "\n".join(f"{n}: {k}  ->  {v['fixed']}" for n, (k, v) in enumerate(chunk))
        _, out = post({"model": model, "input": f"{VERIFY_RULES}\n\nFÖRSLAG:\n{listing}",
                    "text": {"format": {"type": "json_schema", "name": "granskning",
                                        "schema": VERIFY_SCHEMA, "strict": True}}})
        for verdict in out["verdicts"]:
            if 0 <= verdict["id"] < len(chunk):
                chunk[verdict["id"]][1]["verified"] = verdict["ok"]
    print(f"{len(items)} förslag, {len(candidates)} rimliga, "
          f"{sum(v['verified'] for _, v in items)} godkända", flush=True)


def ask(names: list[str], model: str) -> tuple[dict[str, dict], dict]:
    listing = "\n".join(f"{i}: {n}" for i, n in enumerate(names))
    data, result = post({"model": model, "input": f"{RULES}\n\nNAMN:\n{listing}",
                         "text": {"format": {"type": "json_schema", "name": "stavning",
                                             "schema": SCHEMA, "strict": True}}})
    out = {}
    for ch in result["changes"]:
        i, fixed = ch["id"], " ".join(ch["fixed"].split())
        if 0 <= i < len(names) and fixed and fixed != names[i]:
            out[names[i]] = {"fixed": fixed, "why": ch["why"].strip()}
    u = data.get("usage", {})
    return out, {"in": u.get("input_tokens", 0), "out": u.get("output_tokens", 0)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("leads")
    ap.add_argument("out")
    ap.add_argument("--model", default="gpt-5.4-mini")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--verify", action="store_true")
    a = ap.parse_args()
    load_env()
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY saknas i .env")
    if a.verify:
        out_path = Path(a.out)
        state = json.loads(out_path.read_text())
        verify(state, a.model if a.model != "gpt-5.4-mini" else "gpt-5.4")
        out_path.write_text(json.dumps(state, ensure_ascii=False, indent=1))
        return

    leads, _, _ = bu.collect(load_workbook(a.leads, read_only=True)["Leadsbas"])
    names = sorted({l["clean"] for s in leads for l in leads[s]})
    out_path = Path(a.out)
    state = json.loads(out_path.read_text()) if out_path.exists() else {"done": [], "changes": {}}
    done = set(state["done"])
    todo = [n for n in names if n not in done]
    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    print(f"{len(names)} namn, {len(todo)} kvar i {len(batches)} omgångar", flush=True)

    p_in, p_out = PRICE.get(a.model, (1.0, 5.0))
    tokens = {"in": 0, "out": 0}
    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        futures = {pool.submit(ask, b, a.model): b for b in batches}
        for n, f in enumerate(as_completed(futures), start=1):
            batch = futures[f]
            try:
                changes, used = f.result()
            except Exception as e:  # noqa: BLE001
                print("fel:", e, flush=True)
                continue
            state["changes"].update(changes)
            state["done"].extend(batch)
            tokens["in"] += used["in"]
            tokens["out"] += used["out"]
            out_path.write_text(json.dumps(state, ensure_ascii=False, indent=1))
            cost = tokens["in"] / 1e6 * p_in + tokens["out"] / 1e6 * p_out
            print(f"{n}/{len(batches)} ändrade {len(state['changes'])} kostnad ${cost:.3f}", flush=True)


if __name__ == "__main__":
    main()
