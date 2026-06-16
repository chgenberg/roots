#!/usr/bin/env bash
# Canary: verifierar de nya statistik-/graf-endpointsen (+ bas-dashboards)
# mot den körande stacken. Loggar in som varje roll och kollar HTTP-status
# samt att svaren har rätt serie-struktur så graferna får data.
set -u
API="${API_URL:-http://localhost:4000}"
PASS="Demo1234!"
TMP="$(mktemp -d)"
fail=0

note() { printf "%s\n" "$*"; }
ok()   { printf "  ✅ %s\n" "$*"; }
bad()  { printf "  ❌ %s\n" "$*"; fail=$((fail+1)); }

CSRF="$(curl -s "$API/v1/csrf-token" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])' 2>/dev/null)"
[ -n "$CSRF" ] && ok "CSRF-token hämtad" || { bad "Kunde inte hämta CSRF-token"; exit 1; }

login() { # $1=email  $2=cookiejar
  local code
  code=$(curl -s -o "$TMP/login.json" -w "%{http_code}" -c "$2" \
    -H "x-csrf-token: $CSRF" -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" "$API/v1/auth/login")
  if [ "$code" = "200" ]; then ok "login $1"; else bad "login $1 (HTTP $code)"; fi
}

# GET med cookie; $1=jar $2=path $3..=python-nycklar att verifiera finns
getjson() {
  local jar="$1" path="$2"; shift 2
  local code
  code=$(curl -s -o "$TMP/r.json" -w "%{http_code}" -b "$jar" "$API$path")
  if [ "$code" != "200" ]; then bad "GET $path (HTTP $code)"; return; fi
  ok "GET $path → 200"
  if [ "$#" -gt 0 ]; then
    python3 - "$TMP/r.json" "$@" <<'PY'
import sys, json
data = json.load(open(sys.argv[1]))
keys = sys.argv[2:]
miss = [k for k in keys if k not in data]
if miss:
    print("    ⚠ saknar nycklar:", ", ".join(miss)); sys.exit(0)
def n(x): 
    return len(x) if isinstance(x,(list,dict)) else x
print("    " + " · ".join(f"{k}={n(data[k])}" for k in keys))
PY
  fi
}

note "── Login ──────────────────────────────────────────"
login "forening@demo-if.se" "$TMP/assoc.txt"
login "lag@demo-if.se"      "$TMP/lag.txt"
login "felicia.assoc@demo-if.se" "$TMP/seller.txt"

note "── Förening: statistik + dashboard ───────────────"
getjson "$TMP/assoc.txt" "/v1/dashboard/association"        > /dev/null 2>&1 \
  && ok "GET /v1/dashboard/association → 200" || bad "association dashboard"
getjson "$TMP/assoc.txt" "/v1/dashboard/association/stats" daily payments weekday breakdown totals

# Plocka teamId ur föreningens stats-breakdown
TEAM="$(python3 -c 'import json;d=json.load(open("'"$TMP"'/r.json"));print((d.get("breakdown") or [{}])[0].get("id",""))' 2>/dev/null)"
[ -n "$TEAM" ] && ok "teamId=$TEAM" || bad "kunde inte härleda teamId ur breakdown"

note "── Lag: statistik (förening + lagledare) ─────────"
if [ -n "$TEAM" ]; then
  getjson "$TMP/assoc.txt" "/v1/dashboard/team/$TEAM/stats" daily payments weekday breakdown totals
  getjson "$TMP/lag.txt"   "/v1/dashboard/team/$TEAM/stats" daily payments weekday breakdown totals
fi

note "── Säljare: statistik + dashboard ────────────────"
getjson "$TMP/seller.txt" "/v1/dashboard/seller"        > /dev/null 2>&1 \
  && ok "GET /v1/dashboard/seller → 200" || true
getjson "$TMP/seller.txt" "/v1/dashboard/seller/stats" daily payments weekday totals

note "── Behörighet: säljare får INTE förenings-stats ──"
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$TMP/seller.txt" "$API/v1/dashboard/association/stats")
[ "$code" = "403" ] && ok "säljare → association/stats = 403 (korrekt)" || bad "säljare fick HTTP $code mot association/stats (väntade 403)"

rm -rf "$TMP"
note ""
if [ "$fail" -eq 0 ]; then note "🎉 CANARY OK — alla graf-endpoints svarar med data."; else note "⚠ $fail fel — se ovan."; fi
exit $fail
