#!/usr/bin/env bash
# NextGen Fusion School — Postgres backup helper.
#
# Writes a timestamped, gzip'd pg_dump to ./backups/. Optionally encrypts the
# dump (recommended for student PII) and uploads it offsite.
#
# Usage:
#   ./scripts/backup.sh
#   DATABASE_URL=postgres://... ./scripts/backup.sh
#
# Encryption (recommended — set ONE of):
#   BACKUP_PASSPHRASE=...            # gpg symmetric (AES256)
#   BACKUP_GPG_RECIPIENT=key-id      # gpg public-key encryption
#
# Offsite (optional):
#   BACKUP_RCLONE_REMOTE=remote:bucket/path   # requires `rclone`
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

# --- Encrypt at rest (recommended: backups contain student PII) -------------
if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "→ Encrypting (symmetric AES256)"
  gpg --batch --yes --pinentry-mode loopback --passphrase "${BACKUP_PASSPHRASE}" \
      --symmetric --cipher-algo AES256 -o "${out}.gpg" "${out}"
  rm -f "${out}"
  out="${out}.gpg"
elif [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  echo "→ Encrypting for ${BACKUP_GPG_RECIPIENT}"
  gpg --batch --yes --encrypt --recipient "${BACKUP_GPG_RECIPIENT}" -o "${out}.gpg" "${out}"
  rm -f "${out}"
  out="${out}.gpg"
else
  echo "⚠ Backup is NOT encrypted. Set BACKUP_PASSPHRASE or BACKUP_GPG_RECIPIENT."
fi

echo "✓ Backup complete: ${out}"

# --- Offsite copy (optional) ------------------------------------------------
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  echo "→ Uploading offsite to ${BACKUP_RCLONE_REMOTE}"
  rclone copy "${out}" "${BACKUP_RCLONE_REMOTE}" && echo "✓ Offsite upload complete"
fi

# Keep the 14 most recent local backups (encrypted or not), delete older ones.
ls -1t backups/nextgen_* 2>/dev/null | tail -n +15 | xargs -r rm --

# Reminder: test your restores. A backup you've never restored is not a backup.
