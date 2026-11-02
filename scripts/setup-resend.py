#!/usr/bin/env python3
"""Sätter upp Resend för roots.nu: domän i Resend, DNS-poster i Cloudflare, verifiering.

Nycklarna läses från filer utanför repot och skrivs aldrig ut:
    ~/.roots/resend_key        Resend API-nyckel (Full access)
    ~/.roots/cloudflare_token  Cloudflare API-token (Zone → DNS → Edit för roots.nu)

    python3 scripts/setup-resend.py            # domän + DNS + verifiera
    python3 scripts/setup-resend.py --railway  # dessutom: nyckel + avsändare + slå på mejl i prod

Idempotent: finns domänen eller posterna redan återanvänds de.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DOMAIN = "roots.nu"
REGION = "eu-west-1"
FROM_ADDRESS = "Roots <hej@roots.nu>"
RAILWAY_SERVICE = "roots"
DMARC = "v=DMARC1; p=none; rua=mailto:hej@roots.nu"
SECRETS = Path.home() / ".roots"


def secret(name: str) -> str:
    path = SECRETS / name
    if not path.exists():
        sys.exit(f"Saknar {path}. Lägg nyckeln där (en rad) och kör igen.")
    value = path.read_text().strip()
    if not value:
        sys.exit(f"{path} är tom.")
    return value


def call(url: str, token: str, method: str = "GET", body: dict | None = None) -> dict:
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                 "User-Agent": "roots-setup/1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")[:300]
        sys.exit(f"{method} {url.split('?')[0]} gav {err.code}: {detail}")


def resend_domain(key: str) -> dict:
    found = call("https://api.resend.com/domains", key).get("data", [])
    match = next((d for d in found if d["name"] == DOMAIN), None)
    if match:
        print(f"Resend: {DOMAIN} finns redan (status {match.get('status')}).")
        return call(f"https://api.resend.com/domains/{match['id']}", key)
    print(f"Resend: lägger till {DOMAIN} i {REGION}.")
    return call("https://api.resend.com/domains", key, "POST", {"name": DOMAIN, "region": REGION})


def cf_zone(token: str) -> str:
    zones = call(f"https://api.cloudflare.com/client/v4/zones?name={DOMAIN}", token).get("result", [])
    if not zones:
        sys.exit(f"Cloudflare-token ser inte zonen {DOMAIN}.")
    return zones[0]["id"]


def cf_upsert(token: str, zone: str, rtype: str, name: str, content: str, priority: int | None = None) -> None:
    fqdn = name if name.endswith(DOMAIN) else f"{name}.{DOMAIN}"
    base = f"https://api.cloudflare.com/client/v4/zones/{zone}/dns_records"
    existing = call(f"{base}?type={rtype}&name={fqdn}", token).get("result", [])
    if any(r["content"].strip('"') == content.strip('"') for r in existing):
        print(f"  DNS {rtype:<4} {fqdn}: finns redan")
        return
    if rtype == "TXT" and fqdn.startswith("_dmarc.") and existing:
        print(f"  DNS TXT  {fqdn}: annan DMARC finns, lämnas orörd")
        return
    body = {"type": rtype, "name": fqdn, "content": content, "ttl": 1, "proxied": False}
    if priority is not None:
        body["priority"] = priority
    call(base, token, "POST", body)
    print(f"  DNS {rtype:<4} {fqdn}: skapad")


def railway(key: str) -> None:
    def setvar(pair: str, skip: bool) -> None:
        cmd = ["railway", "variables", "--service", RAILWAY_SERVICE, "--set", pair]
        if skip:
            cmd.append("--skip-deploys")
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            sys.exit(f"railway variables misslyckades för {pair.split('=')[0]}.")
        print(f"Railway: {pair.split('=')[0]} satt")

    setvar(f"RESEND_API_KEY={key}", skip=True)
    setvar(f"RESEND_FROM_ADDRESS={FROM_ADDRESS}", skip=True)
    setvar("FEATURE_EMAIL_DISABLED=false", skip=False)
    print("Railway: tjänsten deployas om med mejl påslaget.")


def main() -> None:
    key = secret("resend_key")
    domain = resend_domain(key)

    if not (SECRETS / "cloudflare_token").exists():
        print("Ingen Cloudflare-token. Lägg in posterna för hand (Proxy: av):")
        for rec in domain.get("records", []):
            prio = f"  prioritet {rec['priority']}" if rec.get("priority") is not None else ""
            print(f"  {rec['type']:<4} {rec['name']:<22} {rec['value']}{prio}")
        print(f"  TXT  _dmarc                 {DMARC}")
        sys.exit(0)

    cf = secret("cloudflare_token")
    zone = cf_zone(cf)
    print("Cloudflare: lägger in Resends poster.")
    for rec in domain.get("records", []):
        cf_upsert(cf, zone, rec["type"], rec["name"], rec["value"], rec.get("priority"))
    cf_upsert(cf, zone, "TXT", "_dmarc", DMARC)

    if domain.get("status") != "verified":
        call(f"https://api.resend.com/domains/{domain['id']}/verify", key, "POST")
    for _ in range(40):
        status = call(f"https://api.resend.com/domains/{domain['id']}", key).get("status")
        print(f"Resend: status {status}")
        if status == "verified":
            break
        if status == "failed":
            sys.exit("Resend kunde inte verifiera. Kolla posterna i Cloudflare.")
        time.sleep(15)
    else:
        sys.exit("Inte verifierad än (DNS kan ta en stund). Kör skriptet igen om några minuter.")

    if "--railway" in sys.argv:
        railway(key)
    else:
        print("Klart i Resend och DNS. Kör med --railway för att slå på mejl i prod.")


if __name__ == "__main__":
    main()
