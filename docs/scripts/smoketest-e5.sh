#!/usr/bin/env bash
# Sprint E5 — role-by-role API smoketest against local API on :4099.
# See docs/SMOKETEST_E5.md for the full report this generates.
# Writes per-role response bodies + a run.log under $OUT.

set -u
API=${API:-http://localhost:4099}
PASS=${PASS:-"Demo1234!"}
OUT=${OUT:-/tmp/roots-smoketest}
mkdir -p "$OUT"

# ── helpers ─────────────────────────────────────────────────────────
hdr() { printf "\n=== %s ===\n" "$*"; }

probe() {
  local label="$1" method="$2" path="$3" cookie="$4"
  local body="${5:-}"
  local args=(-s -o "$OUT/.body" -w "%{http_code}")
  if [[ -n "$cookie" ]]; then args+=(-b "$cookie"); fi
  if [[ "$method" == "POST" ]]; then
    args+=(-X POST -H "content-type: application/json")
    if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  fi
  local code
  code=$(curl "${args[@]}" "$API$path")
  local size; size=$(wc -c < "$OUT/.body" | tr -d ' ')
  printf "%-40s %s  %4s  %sB\n" "$label" "$method $path" "$code" "$size"
  if [[ "$code" =~ ^[45] ]]; then
    printf "  body: %s\n" "$(head -c 400 "$OUT/.body")"
  fi
}

login() {
  local email="$1" jar="$2"
  rm -f "$jar"
  local resp
  resp=$(curl -s -c "$jar" -X POST -H "content-type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}" "$API/v1/auth/login")
  local role; role=$(echo "$resp" | sed -n 's/.*"role":"\([^"]*\)".*/\1/p')
  printf "login %-30s role=%-20s cookie=%s\n" "$email" "${role:-FAIL}" \
    "$([[ -s "$jar" ]] && echo present || echo MISSING)"
  [[ -n "$role" ]]
}

# ── 0. health probes ───────────────────────────────────────────────
hdr "0. Health probes"
probe "GET /healthz" GET /healthz ""
probe "GET /readyz" GET /readyz ""
probe "GET /v1/csrf-token" GET /v1/csrf-token ""

# ── 1. PUBLIC (no auth) ────────────────────────────────────────────
hdr "1. PUBLIC visitor surfaces"
probe "GET /v1/shop/products" GET /v1/shop/products ""
probe "GET /v1/shop/by-slug/demo-alma" GET "/v1/shop/by-slug/demo-alma" ""
# trpc auth.me with no cookie should be unauthenticated
probe "GET /trpc/auth.me (no cookie)" GET /trpc/auth.me ""

# ── 2. CLUB_ADMIN ──────────────────────────────────────────────────
hdr "2. CLUB_ADMIN — klubb@demo.se"
login "klubb@demo.se" "$OUT/club.cookies" || true
probe "GET /v1/portal/dashboard" GET /v1/portal/dashboard "$OUT/club.cookies"
cp "$OUT/.body" "$OUT/club-dashboard.json"
probe "GET /v1/portal/statistics" GET /v1/portal/statistics "$OUT/club.cookies"
cp "$OUT/.body" "$OUT/club-statistics.json"
probe "GET /v1/portal/income" GET /v1/portal/income "$OUT/club.cookies"
probe "GET /v1/portal/orders" GET /v1/portal/orders "$OUT/club.cookies"
probe "GET /v1/portal/members" GET /v1/portal/members "$OUT/club.cookies"
probe "GET /v1/portal/quotes" GET /v1/portal/quotes "$OUT/club.cookies"
probe "GET /trpc/auth.me" GET /trpc/auth.me "$OUT/club.cookies"

# ── 3. SALES_REP ───────────────────────────────────────────────────
hdr "3. SALES_REP — salj@roots.se"
login "salj@roots.se" "$OUT/sales.cookies" || true
probe "GET /v1/portal/dashboard" GET /v1/portal/dashboard "$OUT/sales.cookies"
cp "$OUT/.body" "$OUT/sales-dashboard.json"
probe "GET /v1/portal/pipeline" GET /v1/portal/pipeline "$OUT/sales.cookies"
cp "$OUT/.body" "$OUT/sales-pipeline.json"
probe "GET /v1/portal/quotes" GET /v1/portal/quotes "$OUT/sales.cookies"
probe "GET /v1/portal/statistics (expect 403)" GET /v1/portal/statistics "$OUT/sales.cookies"
probe "GET /trpc/auth.me" GET /trpc/auth.me "$OUT/sales.cookies"

# ── 4. INTERNAL_ADMIN ──────────────────────────────────────────────
hdr "4. INTERNAL_ADMIN — admin@roots.se"
login "admin@roots.se" "$OUT/admin.cookies" || true
probe "GET /v1/portal/dashboard" GET /v1/portal/dashboard "$OUT/admin.cookies"
cp "$OUT/.body" "$OUT/admin-dashboard.json"
probe "GET /v1/portal/statistics" GET /v1/portal/statistics "$OUT/admin.cookies"
cp "$OUT/.body" "$OUT/admin-statistics.json"
probe "GET /v1/portal/pipeline" GET /v1/portal/pipeline "$OUT/admin.cookies"
probe "GET /trpc/auth.me" GET /trpc/auth.me "$OUT/admin.cookies"

# ── 5. ASSOCIATION_ADMIN ───────────────────────────────────────────
hdr "5. ASSOCIATION_ADMIN — forening@demo-if.se"
login "forening@demo-if.se" "$OUT/assoc.cookies" || true
probe "GET /trpc/auth.me" GET /trpc/auth.me "$OUT/assoc.cookies"
probe "GET /v1/portal/dashboard (expect 403)" GET /v1/portal/dashboard "$OUT/assoc.cookies"
probe "GET /v1/association/dashboard" GET /v1/association/dashboard "$OUT/assoc.cookies"
probe "GET /v1/association/teams" GET /v1/association/teams "$OUT/assoc.cookies"
probe "GET /v1/association/campaigns" GET /v1/association/campaigns "$OUT/assoc.cookies"
cp "$OUT/.body" "$OUT/assoc-last.json"

# ── 6. TEAM_LEADER ─────────────────────────────────────────────────
hdr "6. TEAM_LEADER — lag@demo-if.se"
login "lag@demo-if.se" "$OUT/team.cookies" || true
probe "GET /trpc/auth.me" GET /trpc/auth.me "$OUT/team.cookies"
probe "GET /v1/team/dashboard" GET /v1/team/dashboard "$OUT/team.cookies"
probe "GET /v1/team/sellers" GET /v1/team/sellers "$OUT/team.cookies"
probe "GET /v1/team/orders" GET /v1/team/orders "$OUT/team.cookies"
cp "$OUT/.body" "$OUT/team-last.json"

# ── 7. SELLER ──────────────────────────────────────────────────────
hdr "7. SELLER — felicia.assoc@demo-if.se"
login "felicia.assoc@demo-if.se" "$OUT/seller.cookies" || true
probe "GET /trpc/auth.me" GET /trpc/auth.me "$OUT/seller.cookies"
probe "GET /v1/seller/me" GET /v1/seller/me "$OUT/seller.cookies"
probe "GET /v1/seller/orders" GET /v1/seller/orders "$OUT/seller.cookies"
probe "GET /v1/seller/dashboard" GET /v1/seller/dashboard "$OUT/seller.cookies"
cp "$OUT/.body" "$OUT/seller-last.json"

hdr "Done — see $OUT/*.json for response bodies"
