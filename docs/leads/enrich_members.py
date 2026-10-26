#!/usr/bin/env python3
"""Find member count, website and email for associations, with sources.

Usage: python3 docs/leads/enrich_members.py LEADS.xlsx OUT.jsonl [--limit N] [--seller Niclas] [--category A]

Every answer is checked afterwards: the member figure must appear on the
cited page, the email must appear on a fetched page and its domain must
have MX. Anything that fails is kept but flagged, never silently trusted.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import subprocess
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import openpyxl

MODEL = os.environ.get("ENRICH_MODEL", "gpt-5.4-mini")
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "sv-SE,sv;q=0.9",
}
C_NAME, C_LAN, C_KOMMUN, C_SPORT, C_SELLER = 0, 1, 2, 4, 5
C_SITE, C_MEMBERS, C_EMAIL, C_CATEGORY = 9, 10, 14, 20

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "website": {"type": ["string", "null"]},
        "members_total": {"type": ["integer", "null"]},
        "members_active": {"type": ["integer", "null"]},
        "members_year": {"type": ["integer", "null"]},
        "members_source": {"type": ["string", "null"]},
        "members_quote": {"type": ["string", "null"]},
        "email": {"type": ["string", "null"]},
        "email_source": {"type": ["string", "null"]},
        "note": {"type": ["string", "null"]},
    },
    "required": [
        "website", "members_total", "members_active", "members_year",
        "members_source", "members_quote", "email", "email_source", "note",
    ],
}

PROMPT = """Du researchar en svensk ideell förening.

Förening: {name}
Kommun: {kommun} ({lan})
Idrott: {sport}
Känd e-post: {email}

Hitta, med webbsökning:
1. Föreningens officiella webbplats (egen domän, laget.se, svenskalag.se, klubbenonline e.d.).
2. Antal medlemmar. Leta i verksamhetsberättelse, årsberättelse, "om oss", kommunens föreningsregister, förbundets sidor eller lokalpress. Ange totalt antal och, om källan skiljer på det, antal aktiva (utövare/spelare/aktiva medlemmar, inte stödmedlemmar). Ange år siffran gäller.
3. En e-postadress till föreningen (kansli, info, styrelse) som står på en sida du hittat.

Regler:
- Gissa aldrig. Saknas en uppgift, ge null.
- members_source och email_source ska vara exakt URL där uppgiften står.
- members_quote ska vara den korta textbit från källan som innehåller siffran, ordagrant.
- Se upp för föreningar med liknande namn i andra kommuner.
- note: kort på svenska om något är osäkert (t.ex. siffran inkluderar stödmedlemmar, gammal siffra).
"""


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip().strip('"')


def ask(lead: dict) -> tuple[dict, dict]:
    body = {
        "model": MODEL,
        "tools": [{"type": "web_search", "search_context_size": "low",
                   "user_location": {"type": "approximate", "country": "SE"}}],
        "input": PROMPT.format(**lead),
        "text": {"format": {"type": "json_schema", "name": "forening",
                            "schema": SCHEMA, "strict": True}},
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
                 "Content-Type": "application/json"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))
    text = next(
        c["text"] for o in data["output"] if o["type"] == "message"
        for c in o["content"] if c["type"] == "output_text"
    )
    searches = sum(1 for o in data["output"] if o["type"] == "web_search_call")
    usage = data.get("usage", {})
    return json.loads(text), {
        "in": usage.get("input_tokens", 0),
        "out": usage.get("output_tokens", 0),
        "searches": searches,
    }


_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def fetch(url: str | None) -> str:
    if not url or not url.startswith("http"):
        return ""
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20, context=_ctx) as r:
            raw = r.read(3_000_000)
        html = raw.decode("utf-8", "ignore")
    except Exception:
        return ""
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"[\s\u00a0]+", " ", text)


def number_on_page(n: int | None, page: str) -> bool:
    if not n or not page:
        return False
    s = str(n)
    variants = {s}
    if len(s) > 3:
        variants |= {f"{s[:-3]} {s[-3:]}", f"{s[:-3]}.{s[-3:]}", f"{s[:-3]},{s[-3:]}"}
    flat = page.replace("\u202f", " ")
    return any(re.search(rf"(?<![\d]){re.escape(v)}(?![\d])", flat) for v in variants)


_mx_cache: dict[str, bool] = {}
_mx_lock = threading.Lock()


def has_mx(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.split("@", 1)[1].lower()
    with _mx_lock:
        if domain in _mx_cache:
            return _mx_cache[domain]
    out = subprocess.run(["dig", "+short", "MX", domain],
                         capture_output=True, text=True, timeout=15).stdout.strip()
    with _mx_lock:
        _mx_cache[domain] = bool(out)
    return bool(out)


def verify(found: dict) -> dict:
    mpage = fetch(found.get("members_source"))
    n = found.get("members_active") or found.get("members_total")
    email = (found.get("email") or "").strip().lower() or None
    epage = mpage if found.get("email_source") == found.get("members_source") \
        else fetch(found.get("email_source"))
    return {
        "members_on_page": number_on_page(n, mpage),
        "members_page_ok": bool(mpage),
        "email_on_page": bool(email and email in epage.lower()),
        "email_mx": has_mx(email),
    }


def leads(path: str, seller: str | None, category: str | None) -> list[dict]:
    ws = openpyxl.load_workbook(path, read_only=True)["Leadsbas"]
    out = []
    for i, r in enumerate(ws.iter_rows(values_only=True, min_row=2), start=2):
        if not r[C_NAME]:
            continue
        if seller and r[C_SELLER] != seller:
            continue
        if category and (r[C_CATEGORY] or "").strip().upper() != category:
            continue
        out.append({
            "row": i, "name": r[C_NAME].strip(), "kommun": r[C_KOMMUN] or "",
            "lan": (r[C_LAN] or "").title(), "sport": r[C_SPORT] or "okänd",
            "email": r[C_EMAIL] or "saknas",
        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("leads"); ap.add_argument("out")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--seller"); ap.add_argument("--category")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()

    load_env(Path(__file__).resolve().parents[2] / ".env")
    out = Path(a.out)
    done = set()
    if out.exists():
        done = {json.loads(l)["row"] for l in out.read_text().splitlines() if l.strip()}
    todo = [l for l in leads(a.leads, a.seller, a.category) if l["row"] not in done]
    todo = todo[a.offset:a.offset + a.limit]
    print(f"{len(todo)} föreningar, modell {MODEL}", flush=True)

    lock = threading.Lock()

    def work(lead: dict) -> dict:
        found, usage = ask(lead)
        return {**lead, "found": found, "check": verify(found), "usage": usage}

    with ThreadPoolExecutor(a.workers) as pool, out.open("a") as fh:
        futures = {pool.submit(work, l): l for l in todo}
        for f in as_completed(futures):
            lead = futures[f]
            try:
                rec = f.result()
            except Exception as e:
                print(f"FEL {lead['name']}: {e}", file=sys.stderr, flush=True)
                continue
            with lock:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n"); fh.flush()
            fd, ck = rec["found"], rec["check"]
            print(f"{lead['name'][:34]:34} medl={fd['members_total']}/{fd['members_active']} "
                  f"år={fd['members_year']} påsida={ck['members_on_page']} "
                  f"epost={'ok' if ck['email_on_page'] and ck['email_mx'] else '-'}", flush=True)


if __name__ == "__main__":
    main()
