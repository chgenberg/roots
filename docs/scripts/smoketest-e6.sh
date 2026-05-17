#!/usr/bin/env bash
# Sprint E6 — verify the fundraising-role endpoints actually work
# under their REAL paths (/v1/dashboard/*), correcting the E5 false-
# positive that claimed they didn't exist.
# See docs/SMOKETEST_E6.md for the report this generates.
set -u
API=${API:-http://localhost:4099}
PASS=${PASS:-"Demo1234!"}
OUT=${OUT:-/tmp/roots-smoketest}
mkdir -p "$OUT"

probe() {
  local label="$1" path="$2" cookie="$3"
  local args=(-s -o "$OUT/.body" -w "%{http_code}")
  if [[ -n "$cookie" ]]; then args+=(-b "$cookie"); fi
  local code; code=$(curl "${args[@]}" "$API$path")
  local size; size=$(wc -c < "$OUT/.body" | tr -d ' ')
  printf "%-45s %4s  %sB\n" "$label" "$code" "$size"
  if [[ "$code" =~ ^[45] ]]; then
    printf "  body: %s\n" "$(head -c 250 "$OUT/.body")"
  fi
}

login() {
  local email="$1" jar="$2"
  rm -f "$jar"
  curl -s -c "$jar" -X POST -H "content-type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}" "$API/v1/auth/login" \
    | head -c 200 > "$OUT/.loginbody"
  echo "login $email → $(cat $OUT/.loginbody | grep -o '"role":"[^"]*"')"
}

echo "=== ASSOCIATION_ADMIN — forening@demo-if.se ==="
login "forening@demo-if.se" "$OUT/assoc.cookies"
probe "GET /v1/dashboard/association" /v1/dashboard/association "$OUT/assoc.cookies"
cp "$OUT/.body" "$OUT/e6-assoc-dashboard.json"

echo
echo "=== TEAM_LEADER — lag@demo-if.se ==="
login "lag@demo-if.se" "$OUT/team.cookies"
probe "GET /v1/dashboard/my-team" /v1/dashboard/my-team "$OUT/team.cookies"
TEAM_ID=$(python3 -c "import json,sys; print(json.load(open('$OUT/.body'))['teamId'])" 2>/dev/null || echo "")
echo "  resolved teamId=$TEAM_ID"
if [[ -n "$TEAM_ID" ]]; then
  probe "GET /v1/dashboard/team/$TEAM_ID" "/v1/dashboard/team/$TEAM_ID" "$OUT/team.cookies"
  cp "$OUT/.body" "$OUT/e6-team-dashboard.json"
fi

echo
echo "=== SELLER — felicia.assoc@demo-if.se ==="
login "felicia.assoc@demo-if.se" "$OUT/seller.cookies"
probe "GET /v1/dashboard/seller" /v1/dashboard/seller "$OUT/seller.cookies"
cp "$OUT/.body" "$OUT/e6-seller-dashboard.json"

echo
echo "=== Tenancy isolation: ASSOCIATION_ADMIN cannot read TEAM data outside their org ==="
# We don't have a cross-org team in seed, but verify TEAM_LEADER cannot read an
# *unrelated* team-id (use the association's own team-id from above as a noop
# check, then a fake uuid that should 404 or 403).
probe "GET /v1/dashboard/team/00000000-0000-0000-0000-000000000000 (TEAM_LEADER)" \
  "/v1/dashboard/team/00000000-0000-0000-0000-000000000000" "$OUT/team.cookies"

echo
echo "=== Cross-role isolation: SELLER cannot read team or association ==="
probe "GET /v1/dashboard/association (SELLER, expect 403)" /v1/dashboard/association "$OUT/seller.cookies"
if [[ -n "$TEAM_ID" ]]; then
  probe "GET /v1/dashboard/team/$TEAM_ID (SELLER, expect 403)" "/v1/dashboard/team/$TEAM_ID" "$OUT/seller.cookies"
fi
