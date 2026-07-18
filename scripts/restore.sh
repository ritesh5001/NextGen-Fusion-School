#!/usr/bin/env bash
# NextGen Fusion School — restore a pg_dump backup into DATABASE_URL.
# WARNING: this will overwrite the current schema and data.
#
# Usage:
#   ./scripts/restore.sh backups/nextgen_20260718_120000.sql.gz
set -euo pipefail

if [[ -f .env ]]; then
  export $(grep -v '^#' .env | xargs 2>/dev/null) || true
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

file="${1:-}"
if [[ -z "${file}" || ! -f "${file}" ]]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

read -r -p "This will overwrite the current database. Type YES to continue: " ans
if [[ "${ans}" != "YES" ]]; then
  echo "Aborted."
  exit 1
fi

echo "→ Restoring ${file}"
gunzip -c "${file}" | psql "${DATABASE_URL}"
echo "✓ Restore complete."
