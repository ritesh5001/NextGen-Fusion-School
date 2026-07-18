#!/usr/bin/env bash
# NextGen Fusion School — Postgres backup helper.
# Reads DATABASE_URL from the environment and writes a timestamped
# gzip'd pg_dump to ./backups/.
#
# Usage:
#   ./scripts/backup.sh
#   DATABASE_URL=postgres://... ./scripts/backup.sh
set -euo pipefail

if [[ -f .env ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs -0 2>/dev/null || grep -v '^#' .env | xargs) || true
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

mkdir -p backups
ts="$(date +%Y%m%d_%H%M%S)"
out="backups/nextgen_${ts}.sql.gz"

echo "→ Dumping database to ${out}"
pg_dump --no-owner --no-privileges "${DATABASE_URL}" | gzip -9 > "${out}"
echo "✓ Backup complete: ${out}"

# Keep the 14 most recent, delete older ones.
ls -1t backups/nextgen_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
