# Database Backup Strategy — AAWSA Billing Portal

## Overview

All billing and payment data is automatically backed up daily to protect against data loss from hardware failure, accidental deletion, or database corruption.

---

## Backup Schedule

| Type | Frequency | Retention | Location |
|---|---|---|---|
| **Daily** | Every day at 02:00 AM | 30 days | `/backups/aawsa/daily/` |
| **Monthly** | 1st of each month | 12 months | `/backups/aawsa/monthly/` |

---

## Backup Script Setup

### 1. Install the script
```bash
cp scripts/backup/db-backup.sh /opt/aawsa/db-backup.sh
chmod +x /opt/aawsa/db-backup.sh
```

### 2. Add environment variables
Create `/opt/aawsa/.backup.env`:
```bash
export PGDATABASE=aawsa_billing
export PGUSER=postgres
export PGPASSWORD=your_db_password
export PGHOST=127.0.0.1
export PGPORT=5432

# Optional: alerting
export ALERT_EMAIL=ops-team@aawsa.gov.et
export ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Schedule with cron
```bash
crontab -e
```
Add this line:
```cron
0 2 * * * source /opt/aawsa/.backup.env && /opt/aawsa/db-backup.sh >> /var/log/aawsa-backup.log 2>&1
```

### 4. On Windows Server (Task Scheduler)
Use `pg_dump` via a PowerShell script and schedule with Task Scheduler. See [`WINDOWS_SERVER_DEPLOYMENT.md`](WINDOWS_SERVER_DEPLOYMENT.md).

---

## Backup File Naming

```
aawsa_20260910_020001.sql.gz        <- daily backup
aawsa_20260910_020001.sql.gz.sha256 <- SHA-256 checksum
aawsa_globals_20260910_020001.sql   <- PostgreSQL roles/users dump
aawsa_202609.sql.gz                 <- monthly snapshot
aawsa_202609.sql.gz.sha256          <- monthly checksum
```

---

## How to Restore

### Full restore (replaces entire database)
```bash
# 1. Stop the application
pm2 stop aawsa-billing

# 2. Drop and recreate the database (DANGER: data loss!)
psql -U postgres -c "DROP DATABASE aawsa_billing;"
psql -U postgres -c "CREATE DATABASE aawsa_billing;"

# 3. Restore from backup
gunzip -c /backups/aawsa/daily/aawsa_20260910_020001.sql.gz \
  | psql -U postgres -d aawsa_billing

# 4. Restart the application
pm2 start aawsa-billing
```

### Restore a single table (e.g. payments)
```bash
gunzip -c /backups/aawsa/daily/aawsa_YYYYMMDD.sql.gz \
  | grep -A999999 "COPY public.payments" \
  | grep -B999999 "^\\\." \
  | psql -U postgres -d aawsa_billing
```

---

## Backup Integrity Verification (v2 Script)

The enhanced script automatically:
1. Runs `gzip -t` **before** pruning old backups — corrupt new backup never deletes old ones.
2. Saves a **SHA-256 checksum** alongside every backup file.
3. Guards against suspiciously small backups (< 100 KB) — alerts without aborting.
4. Checks **DB connectivity** with `pg_isready` before dumping.
5. Uses a **lock file** to prevent two backup processes running simultaneously.
6. Backs up **PostgreSQL roles/users** (`pg_dumpall --globals-only`).
7. Checks **disk space** before starting.

To manually verify:
```bash
# Check file is readable
gzip -t /backups/aawsa/daily/aawsa_YYYYMMDD.sql.gz && echo "OK"

# Verify checksum hasn't changed since backup was taken
sha256sum -c /backups/aawsa/daily/aawsa_YYYYMMDD.sql.gz.sha256
```

---

## Failure Alerting

Configure in `/opt/aawsa/.backup.env`:
```bash
export ALERT_EMAIL=ops-team@aawsa.gov.et            # requires 'mail' installed
export ALERT_WEBHOOK=https://hooks.slack.com/...    # Slack/Teams webhook
```

The script will automatically POST to the webhook and/or email on any failure.

---

## Monitoring Backup Health

```bash
# List most recent backups
ls -lht /backups/aawsa/daily/ | head -5

# Tail the log for errors
tail -30 /var/log/aawsa-backup.log
```

---

## Implementation Files

| File | Purpose |
|---|---|
| [`scripts/backup/db-backup.sh`](../scripts/backup/db-backup.sh) | Backup script (v2 — production hardened) |
