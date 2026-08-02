#!/bin/bash
# ====================================================================
# AAWSA Billing Portal - Automated PostgreSQL Backup Script (Linux/Mac)
# Instructions: Schedule this script via cron to run daily at midnight:
# 0 0 * * * /path/to/project/scripts/daily_backup.sh >> /var/log/aawsa_backup.log 2>&1
# ====================================================================

# Set Database Connection Variables
PG_USER="postgres"
PG_PASSWORD="Da@121212"
PG_DATABASE="aawsa_billing"
PG_HOST="localhost"
PG_PORT="5432"

# Determine Backups Directory (Relative to script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKUP_DIR="${SCRIPT_DIR}/../backups"

# Create Backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate Timestamp for Filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${PG_DATABASE}_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

echo "[AAWSA Backup] Starting database backup at $(date)..."

# Execute Backup
export PGPASSWORD="$PG_PASSWORD"
pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -F p -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[AAWSA Backup SUCCESS] Database successfully backed up to: $BACKUP_FILE"
    
    # Compress the backup to save space
    gzip "$BACKUP_FILE"
    echo "[AAWSA Backup] Backup compressed to: $COMPRESSED_FILE"
    
    # Optional: Delete backups older than 30 days
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +30 -delete
    echo "[AAWSA Backup] Cleaned up backups older than 30 days."
else
    echo "[AAWSA Backup ERROR] pg_dump failed."
    exit 1
fi

unset PGPASSWORD
echo "[AAWSA Backup] Process finished successfully at $(date)."
