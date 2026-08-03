#!/usr/bin/env bash
#
# Tar en off-site-dump av produktionsdatabasen.
#
# Se docs/runbooks/backup-restore.md för hela rutinen, inklusive hur man
# återställer och den kvartalsvisa övningen.
#
# Skriptet vägrar skriva en dump som ser tom ut. En fil som heter backup men
# inte innehåller något är farligare än ingen fil, för den ser ut som skydd.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL saknas. Hämta den från Railway → Postgres → Connect." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump saknas. Installera med: brew install libpq" >&2
  exit 1
fi

# Namnge efter miljö så prod- och stagingdumpar aldrig blandas ihop.
ENVIRONMENT="${BACKUP_ENV:-prod}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/roots-$ENVIRONMENT-$STAMP.dump"

mkdir -p "$OUT_DIR"

echo "Dumpar $ENVIRONMENT till $OUT_FILE ..."

# -Fc = custom format: komprimerat och möjligt att återställa selektivt.
# --no-owner/--no-privileges gör dumpen återställningsbar till en databas
# med andra roller, vilket är fallet vid restore till en ny Railway-instans.
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$OUT_FILE" \
  "$DATABASE_URL"

# Sanity-tröskel: ett tomt schema blir några kilobyte. En riktig databas med
# ordrar och användare är väsentligt större. 100 kB är lågt satt med flit —
# det ska fånga "dumpen misslyckades tyst", inte gissa databasens storlek.
MIN_BYTES=${BACKUP_MIN_BYTES:-102400}
ACTUAL_BYTES=$(wc -c < "$OUT_FILE" | tr -d ' ')

if [[ "$ACTUAL_BYTES" -lt "$MIN_BYTES" ]]; then
  echo "Dumpen är bara $ACTUAL_BYTES byte (tröskel $MIN_BYTES). Något gick fel." >&2
  echo "Filen sparas som $OUT_FILE.suspekt för felsökning — använd den INTE som backup." >&2
  mv "$OUT_FILE" "$OUT_FILE.suspekt"
  exit 1
fi

# Verifiera att dumpen går att läsa. pg_restore --list rör inte databasen,
# den läser bara innehållsförteckningen — men den upptäcker en trunkerad
# eller korrupt fil, vilket är hela poängen med steget.
if ! pg_restore --list "$OUT_FILE" >/dev/null 2>&1; then
  echo "Dumpen går inte att läsa med pg_restore --list. Behandla den som trasig." >&2
  mv "$OUT_FILE" "$OUT_FILE.suspekt"
  exit 1
fi

TABLE_COUNT=$(pg_restore --list "$OUT_FILE" | grep -c "TABLE DATA" || true)

echo "Klart: $OUT_FILE"
echo "  Storlek:  $((ACTUAL_BYTES / 1024)) kB"
echo "  Tabeller: $TABLE_COUNT med data"
echo
echo "Nästa steg: kryptera filen och flytta den UTANFÖR Railway."
echo "  En kopia hos samma leverantör som driver databasen skyddar mot"
echo "  diskfel, men inte mot ett borttaget projekt eller kapat konto."
