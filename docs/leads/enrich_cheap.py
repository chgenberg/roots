#!/usr/bin/env python3
"""Billig berikning: läs föreningens egna sidor själv i stället för betald sökning.

Usage: python3 docs/leads/enrich_cheap.py LEADS.xlsx OUT.jsonl --rows 12,57,... [--model gpt-5.4-nano]

1. Webbplats: Sajt i listan, annars domänen i föreningens e-post (inte gmail o.d.).
2. Hämtar startsidan och upp till åtta undersidor (om oss, kontakt, styrelse,
   medlem, verksamhetsberättelse) plus högst två PDF:er.
3. Plockar gratis ut e-post, sociala medier, webbshop, grundår och
   meningar med medlemsantal.
4. Med OPENAI_API_KEY: en billig modell läser bara de utplockade raderna och
   ger medlemmar (totalt och aktiva), år, kontaktperson och kort beskrivning.
"""

from __future__ import annotations

import argparse
import html as htmlmod
import json
import os
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import openpyxl

C_NAME, C_KOMMUN, C_SPORT, C_SITE = 0, 2, 4, 9
C_EMAILS = (14, 15, 16, 17)
FREEMAIL = re.compile(
    r"@(gmail|hotmail|outlook|live|yahoo|icloud|me|telia|bredband|spray|msn|"
    r"comhem|bahnhof|tele2|passagen|swipnet|glocalnet)\.", re.I)
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "sv-SE,sv;q=0.9",
}
LINK_HINT = re.compile(
    r"om[-_ ]?(oss|klubben|foreningen|föreningen)|kontakt|styrelse|medlem|verksamhet|"
    r"arsberattelse|årsberättelse|arsmote|årsmöte|historia|about|contact|klubbfakta|"
    r"foreningsfakta|föreningsfakta", re.I)
PDF_HINT = re.compile(r"verksamhet|arsberattelse|årsberättelse|arsmote|årsmöte|bokslut", re.I)
EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.I)
SOCIAL_RE = re.compile(
    r"https?://(?:www\.)?(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|x\.com|"
    r"twitter\.com|linkedin\.com)/[^\s\"'<>]+", re.I)
SHOP_RE = re.compile(
    r"https?://[^\s\"'<>]*(shop|klubbkollektion|teamshop|klubbshop|webshop)[^\s\"'<>]*", re.I)
MEMBER_RE = re.compile(
    r"[^.!?\n]{0,120}\b\d{1,3}(?:[ \u00a0.]?\d{3})?\s*(?:st\.?\s*)?(?:aktiva\s+|betalande\s+|"
    r"registrerade\s+)?(?:medlemmar|aktiva|utövare|spelare|licenser|licensierade)[^.!?\n]{0,120}",
    re.I)
MEMBER_RE2 = re.compile(r"[^.!?\n]{0,80}(?:medlemsantal|antal medlemmar)[^.!?\n]{0,80}", re.I)
FOUNDED_RE = re.compile(r"(?:grundad|grundades|bildad|bildades|startade|startades|founded)"
                        r"\D{0,25}((?:18|19|20)\d{2})", re.I)

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def get(url: str, limit: int = 2_000_000) -> tuple[str, bytes, str]:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15, context=_ctx) as r:
        return r.geturl(), r.read(limit), r.headers.get("Content-Type", "")


def html_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h\d|tr)>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", html)
    text = htmlmod.unescape(text).replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", text)


def pdf_text(data: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(data)
        f.flush()
        out = subprocess.run(["pdftotext", "-l", "15", "-layout", f.name, "-"],
                             capture_output=True, text=True, timeout=30)
    return out.stdout


def candidate_site(row) -> str:
    site = str(row[C_SITE] or "").strip()
    if re.match(r"^(https?://|www\.)", site, re.I):
        return site if site.startswith("http") else f"https://{site}"
    for i in C_EMAILS:
        m = EMAIL_RE.search(str(row[i] or ""))
        if m and not FREEMAIL.search(m.group(0)):
            return f"https://{m.group(0).split('@', 1)[1].lower()}"
    return ""


def crawl(site: str) -> dict:
    pages: list[tuple[str, str]] = []
    raw_html = ""
    try:
        final, body, ctype = get(site)
    except Exception:
        try:
            final, body, ctype = get(site.replace("https://", "https://www.", 1))
        except Exception:
            return {"site": "", "pages": [], "html": ""}
    home = body.decode("utf-8", "ignore")
    raw_html += home
    pages.append((final, html_text(home)))
    host = urllib.parse.urlparse(final).netloc
    links: list[str] = []
    pdfs: list[str] = []
    for href, label in re.findall(r'(?is)<a[^>]+href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', home):
        url = urllib.parse.urljoin(final, href.strip())
        if urllib.parse.urlparse(url).netloc not in (host, host.removeprefix("www.")):
            continue
        hint = f"{href} {re.sub('<[^>]+>', '', label)}"
        if url.lower().endswith(".pdf"):
            if PDF_HINT.search(hint) and url not in pdfs:
                pdfs.append(url)
        elif LINK_HINT.search(hint) and url not in links and url != final:
            links.append(url)
    for url in links[:8]:
        try:
            u, b, ct = get(url)
        except Exception:
            continue
        if "pdf" in ct:
            pages.append((u, pdf_text(b)))
            continue
        h = b.decode("utf-8", "ignore")
        raw_html += h
        pages.append((u, html_text(h)))
        for href in re.findall(r'href=["\']([^"\'#]+\.pdf)["\']', h, re.I):
            p = urllib.parse.urljoin(u, href)
            if PDF_HINT.search(href) and p not in pdfs:
                pdfs.append(p)
    for url in pdfs[:2]:
        try:
            u, b, _ = get(url, 8_000_000)
            pages.append((u, pdf_text(b)))
        except Exception:
            continue
    return {"site": final, "pages": pages, "html": raw_html}


def extract_free(crawled: dict) -> dict:
    html = crawled["html"]
    emails, member_lines, founded = [], [], []
    for url, text in crawled["pages"]:
        for e in EMAIL_RE.findall(text) + re.findall(r"mailto:([^\"'?]+)", text):
            e = e.lower().strip(".")
            if e not in emails and not e.endswith((".png", ".jpg", ".webp")):
                emails.append(e)
        for m in list(MEMBER_RE.finditer(text)) + list(MEMBER_RE2.finditer(text)):
            line = " ".join(m.group(0).split())
            if not any(line == x["text"] for x in member_lines):
                member_lines.append({"url": url, "text": line})
        founded += FOUNDED_RE.findall(text)
    for e in re.findall(r"mailto:([^\"'?>\s]+)", html):
        e = urllib.parse.unquote(e).lower()
        if EMAIL_RE.fullmatch(e) and e not in emails:
            emails.append(e)
    socials = sorted({m.group(0).rstrip("/").split("?")[0] for m in SOCIAL_RE.finditer(html)
                      if not re.search(r"sharer|share\?|/plugins/|intent/", m.group(0))})
    shops = sorted({m.group(0).split("?")[0] for m in SHOP_RE.finditer(html)})[:5]
    return {
        "site": crawled["site"],
        "pages_read": len(crawled["pages"]),
        "emails": emails[:8],
        "socials": socials[:8],
        "shops": shops,
        "founded": founded[0] if founded else None,
        "member_lines": member_lines[:25],
    }


SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "members_total": {"type": ["integer", "null"]},
        "members_active": {"type": ["integer", "null"]},
        "members_year": {"type": ["integer", "null"]},
        "members_quote": {"type": ["string", "null"]},
        "members_source": {"type": ["string", "null"]},
        "contact_name": {"type": ["string", "null"]},
        "contact_role": {"type": ["string", "null"]},
        "description": {"type": ["string", "null"]},
    },
    "required": ["members_total", "members_active", "members_year", "members_quote",
                 "members_source", "contact_name", "contact_role", "description"],
}


def extract_model(name: str, free: dict, crawled: dict, model: str) -> tuple[dict | None, dict]:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None, {}
    contact = ""
    for url, text in crawled["pages"]:
        if re.search(r"styrelse|kontakt|contact", url, re.I):
            contact += f"\n[{url}]\n{text[:2500]}"
    lines = "\n".join(f"[{l['url']}] {l['text']}" for l in free["member_lines"])
    about = crawled["pages"][0][1][:1500] if crawled["pages"] else ""
    prompt = (
        f"Förening: {name}\nNedan är utdrag från föreningens egna sidor. Svara bara utifrån dem, gissa aldrig.\n"
        "members_*: medlemsantal (totalt och aktiva/utövare om det särskiljs), år och ordagrant citat + URL.\n"
        "contact_*: ordförande eller kanslist. description: en mening om verksamheten.\n\n"
        f"MEDLEMSRADER:\n{lines or '(inga)'}\n\nKONTAKT/STYRELSE:\n{contact[:5000] or '(inget)'}\n\n"
        f"STARTSIDA:\n{about}"
    )
    body = {"model": model, "input": prompt,
            "text": {"format": {"type": "json_schema", "name": "f", "schema": SCHEMA, "strict": True}}}
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    text = next(c["text"] for o in data["output"] if o["type"] == "message"
                for c in o["content"] if c["type"] == "output_text")
    u = data.get("usage", {})
    return json.loads(text), {"in": u.get("input_tokens", 0), "out": u.get("output_tokens", 0)}


def load_env() -> None:
    env = Path(__file__).resolve().parents[2] / ".env"
    for line in env.read_text().splitlines() if env.exists() else []:
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m and m.group(1) not in os.environ and m.group(2).strip():
            os.environ[m.group(1)] = m.group(2).strip().strip('"')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("leads"); ap.add_argument("out")
    ap.add_argument("--rows", required=True, help="Radnummer i Leadsbas, kommaseparerade")
    ap.add_argument("--model", default="gpt-6-luna")
    ap.add_argument("--no-model", action="store_true")
    ap.add_argument("--fallback", action="store_true",
                    help="Betald webbsökning (enrich_members) bara när medlemsantal saknas")
    a = ap.parse_args()
    load_env()
    os.environ.setdefault("ENRICH_MODEL", a.model)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import enrich_members
    if a.no_model:
        os.environ.pop("OPENAI_API_KEY", None)
    wanted = {int(x) for x in a.rows.split(",")}
    ws = openpyxl.load_workbook(a.leads, read_only=True)["Leadsbas"]
    leads = [(i, r) for i, r in enumerate(ws.iter_rows(values_only=True, min_row=2), start=2) if i in wanted]

    def work(item):
        i, r = item
        site = candidate_site(r)
        crawled = crawl(site) if site else {"site": "", "pages": [], "html": ""}
        free = extract_free(crawled)
        found, usage = (None, {})
        if crawled["pages"]:
            try:
                found, usage = extract_model(r[C_NAME], free, crawled, a.model)
            except Exception as e:
                usage = {"error": str(e)[:200]}
        searched = None
        if a.fallback and not (found and (found["members_total"] or found["members_active"])):
            lead = {"row": i, "name": r[C_NAME].strip(), "kommun": r[C_KOMMUN] or "",
                    "lan": "", "sport": r[C_SPORT] or "okänd",
                    "email": next((str(r[c]) for c in C_EMAILS if r[c]), "saknas")}
            try:
                hit, su = enrich_members.ask(lead)
                searched = {"found": hit, "check": enrich_members.verify(hit), "usage": su}
            except Exception as e:
                searched = {"error": str(e)[:200]}
        return {"row": i, "name": r[C_NAME], "site_from": "lista" if r[C_SITE] else ("e-post" if site else ""),
                "free": free, "model": found, "usage": usage, "search": searched}

    with ThreadPoolExecutor(8) as pool, open(a.out, "w") as fh:
        for rec in pool.map(work, leads):
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f = rec["free"]
            print(f"{rec['name'][:32]:32} sajt={'ja' if f['site'] else '-':2} sidor={f['pages_read']:2} "
                  f"epost={len(f['emails'])} soc={len(f['socials'])} shop={len(f['shops'])} "
                  f"grund={f['founded'] or '-'} medlemsrader={len(f['member_lines'])}", flush=True)


if __name__ == "__main__":
    main()
