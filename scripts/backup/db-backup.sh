#!/bin/bash
# ============================================================
# AAWSA Billing Portal — Automated Database Backup Script
# Location: scripts/backup/db-backup.sh
#
# Schedule: Daily at 02:00 AM (add to crontab):
#   0 2 * * * source /opt/aawsa/.backup.env && /opt/aawsa/db-backup.sh >> /var/log/aawsa-backup.log 2>&1
#
# Retention: Keeps 30 days of daily backups, 12 monthly backups
#
# Enhancements over v1:
#   - Lock file prevents overlapping runs
#   - Pre-flight DB connectivity check
#   - Disk space guard (warns if < MIN_FREE_GB available)
#   - Integrity check BEFORE pruning old backups
#   - SHA-256 checksum saved alongside every backup
#   - Minimum backup size guard (alerts if dump is suspiciously small)
#   - Email/webhook alert on failure (configure ALERT_EMAIL or ALERT_WEBHOOK)
#   - pg_dumpall --globals-only to capture roles/users
# ============================================================

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────
BACKUP_DIR="/backups/aawsa"
DB_NAME="${PGDATABASE:-aawsa_billing}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"
RETENTION_DAYS=30           # Daily backups kept for 30 days
RETENTION_MONTHLY=12        # Monthly backups kept for 12 months
MIN_FREE_GB=5               # Warn if less than 5 GB free on backup volume
MIN_BACKUP_BYTES=102400     # Alert if backup < 100 KB (suspiciously small)

# ─── Optional alerting ──────────────────────────────────────
# Set ALERT_EMAIL to receive failure emails (requires 'mail' command installed)
ALERT_EMAIL="${ALERT_EMAIL:-}"
# Set ALERT_WEBHOOK to post a JSON payload to a Slack/Teams webhook on failure
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

# ─── Derived paths ──────────────────────────────────────────
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_MONTH=$(date +%d)
BACKUP_FILE="${BACKUP_DIR}/daily/aawsa_${DATE}.sql.gz"
MONTHLY_FILE="${BACKUP_DIR}/monthly/aawsa_$(date +%Y%m).sql.gz"
GLOBALS_FILE="${BACKUP_DIR}/daily/aawsa_globals_${DATE}.sql"
LOCK_FILE="/tmp/aawsa-db-backup.lock"
LOG_PREFIX="[$(date -Iseconds)]"

# ─── Helper: send failure alert ─────────────────────────────
send_alert() {
  local msg="$1"
  echo "${LOG_PREFIX} ❌ ALERT: ${msg}" >&2

  if [ -n "${ALERT_EMAIL}" ]; then
    echo "${msg}" | mail -s "❌ AAWSA Backup FAILED on $(hostname)" "${ALERT_EMAIL}" 2>/dev/null || true
  fi

  if [ -n "${ALERT_WEBHOOK}" ]; then
    curl -s -X POST "${ALERT_WEBHOOK}" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"❌ *AAWSA Backup FAILED* on \`$(hostname)\`: ${msg}\"}" 2>/dev/null || true
  fi
}

# ─── Helper: cleanup on exit ────────────────────────────────
cleanup() {
  rm -f "${LOCK_FILE}"
}
trap cleanup EXIT

# ─── 1. Lock file: prevent overlapping runs ─────────────────
if [ -f "${LOCK_FILE}" ]; then
  EXISTING_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "unknown")
  send_alert "Another backup is already running (PID ${EXISTING_PID}). Aborting."
  exit 1
fi
echo $$ > "${LOCK_FILE}"

# ─── 2. Create directories ──────────────────────────────────
mkdir -p "${BACKUP_DIR}/daily"
mkdir -p "${BACKUP_DIR}/monthly"

echo "${LOG_PREFIX} ───────────────────────────────────────────────"
echo "${LOG_PREFIX} 🚀 AAWSA Backup starting on $(hostname)"
echo "${LOG_PREFIX} ───────────────────────────────────────────────"

# ─── 3. Pre-flight: disk space check ────────────────────────
FREE_GB=$(df -BG "${BACKUP_DIR}" | awk 'NR==2 {gsub("G",""); print $4}')
if [ "${FREE_GB}" -lt "${MIN_FREE_GB}" ]; then
  send_alert "Low disk space: only ${FREE_GB} GB free on ${BACKUP_DIR}. Need at least ${MIN_FREE_GB} GB."
  # Do not abort — attempt backup anyway and log the warning
fi
echo "${LOG_PREFIX} 💾 Disk space available: ${FREE_GB} GB"

# ─── 4. Pre-flight: DB connectivity check ───────────────────
if ! PGPASSWORD="${PGPASSWORD:-}" pg_isready \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -q; then
  send_alert "Database ${DB_NAME} at ${DB_HOST}:${DB_PORT} is not reachable. Backup aborted."
  exit 1
fi
echo "${LOG_PREFIX} ✅ Database connectivity confirmed"

# ─── 5. Backup globals (roles & users) ──────────────────────
echo "${LOG_PREFIX} 👤 Backing up PostgreSQL roles/globals..."
PGPASSWORD="${PGPASSWORD:-}" pg_dumpall \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  --globals-only \
  > "${GLOBALS_FILE}" 2>/dev/null || {
    echo "${LOG_PREFIX} ⚠️  Globals dump failed (non-fatal — continuing)"
  }

# ─── 6. Run main database backup ────────────────────────────
echo "${LOG_PREFIX} 📦 Starting backup of ${DB_NAME}..."

PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip > "${BACKUP_FILE}"

# ─── 7. Integrity check BEFORE pruning anything ─────────────
if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  send_alert "Backup file is CORRUPTED: ${BACKUP_FILE}. Old backups preserved."
  exit 1
fi
echo "${LOG_PREFIX} ✅ Backup integrity verified (gzip -t passed)"

# ─── 8. Minimum size guard ──────────────────────────────────
BACKUP_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}")
if [ "${BACKUP_BYTES}" -lt "${MIN_BACKUP_BYTES}" ]; then
  send_alert "Backup is suspiciously small: ${BACKUP_BYTES} bytes (< ${MIN_BACKUP_BYTES} bytes). DB may be empty or truncated."
  # Do not abort — keep backup for inspection
fi

SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "${LOG_PREFIX} ✅ Backup complete: ${BACKUP_FILE} (${SIZE})"

# ─── 9. SHA-256 checksum ────────────────────────────────────
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
echo "${LOG_PREFIX} 🔐 Checksum saved: ${BACKUP_FILE}.sha256"

# ─── 10. Monthly snapshot (keep one per month) ──────────────
if [ "${DAY_OF_MONTH}" = "01" ]; then
  cp "${BACKUP_FILE}" "${MONTHLY_FILE}"
  sha256sum "${MONTHLY_FILE}" > "${MONTHLY_FILE}.sha256"
  echo "${LOG_PREFIX} 📅 Monthly snapshot saved: ${MONTHLY_FILE}"
fi

# ─── 11. Prune old daily backups (backup + checksum) ────────
find "${BACKUP_DIR}/daily" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}/daily" -name "*.sha256" -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}/daily" -name "*.sql" -mtime "+${RETENTION_DAYS}" -delete
echo "${LOG_PREFIX} 🗑️  Pruned daily backups older than ${RETENTION_DAYS} days"

# ─── 12. Prune old monthly backups (safe, no ls globbing) ───
MONTHLY_COUNT=$(find "${BACKUP_DIR}/monthly" -name "*.sql.gz" 2>/dev/null | wc -l)
if [ "${MONTHLY_COUNT}" -gt "${RETENTION_MONTHLY}" ]; then
  find "${BACKUP_DIR}/monthly" -name "*.sql.gz" -printf '%T+ %p\n' 2>/dev/null \
    | sort | head -n "-${RETENTION_MONTHLY}" \
    | awk '{print $2}' \
    | xargs -r rm -f
  # Also clean orphaned checksums
  for f in "${BACKUP_DIR}/monthly"/*.sha256; do
    base="${f%.sha256}"
    [ -f "${base}" ] || rm -f "${f}"
  done
  echo "${LOG_PREFIX} 🗑️  Pruned monthly backups beyond ${RETENTION_MONTHLY} months"
fi

echo "${LOG_PREFIX} ───────────────────────────────────────────────"
echo "${LOG_PREFIX} 🎉 Backup process complete"
echo "${LOG_PREFIX} ───────────────────────────────────────────────"
