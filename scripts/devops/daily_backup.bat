@echo off
SETLOCAL

:: ====================================================================
:: AAWSA Billing Portal - Automated PostgreSQL Backup Script (Windows)
:: Instructions: Schedule this script via Windows Task Scheduler to run daily at midnight.
:: ====================================================================

:: Set Database Connection Variables
:: Note: Replace these with your actual production database credentials if different
SET PG_USER=postgres
SET PG_PASSWORD=Da@121212
SET PG_DATABASE=aawsa_billing
SET PG_HOST=localhost
SET PG_PORT=5432

:: Set Path to pg_dump executable (Update if PostgreSQL is installed elsewhere)
SET PGDUMP_EXE="C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"

:: Create Backups Directory
SET BACKUP_DIR=%~dp0..\backups
IF NOT EXIST "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

:: Generate Timestamp for Filename (YYYYMMDD_HHMMSS)
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
SET TIMESTAMP=%mydate%_%mytime: =0%
SET BACKUP_FILE=%BACKUP_DIR%\backup_%PG_DATABASE%_%TIMESTAMP%.sql

echo [AAWSA Backup] Starting database backup...

:: Set PGPASSWORD environment variable to avoid password prompt
SET PGPASSWORD=%PG_PASSWORD%

:: Execute Backup
%PGDUMP_EXE% -h %PG_HOST% -p %PG_PORT% -U %PG_USER% -d %PG_DATABASE% -F p -f "%BACKUP_FILE%"

IF %ERRORLEVEL% NEQ 0 (
    echo [AAWSA Backup ERROR] pg_dump failed with error code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo [AAWSA Backup SUCCESS] Database successfully backed up to: %BACKUP_FILE%

:: Optional: Zip the backup to save space
:: Add logic here if 7zip is installed

:: Clear password
SET PGPASSWORD=
ENDLOCAL
