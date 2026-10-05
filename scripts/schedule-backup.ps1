<#
.SYNOPSIS
  Automated PostgreSQL Backup Runner for AAWSA Bulk Billing Portal
  Designed for Windows Task Scheduler or cron execution.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\schedule-backup.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\schedule-backup.ps1 -BaseUrl "http://localhost:3000"
#>

[CmdletBinding()]
param (
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Secret = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectDir ".env.local"
$LogFile = "C:\aawsa\scheduler-backup.log"

function Write-TimestampedLog([string]$Message, [string]$Color = "White") {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $Message"
    Write-Host $line -ForegroundColor $Color
    try {
        if (!(Test-Path "C:\aawsa")) { New-Item -ItemType Directory -Path "C:\aawsa" -Force | Out-Null }
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    } catch {}
}

Write-TimestampedLog "==========================================================" "Cyan"
Write-TimestampedLog "[RUN] Starting AAWSA Automated Scheduled Backup" "Cyan"

# 1. Resolve Cron Secret
if (-not $Secret) {
    if (Test-Path $EnvFile) {
        $envLines = Get-Content $EnvFile
        foreach ($line in $envLines) {
            if ($line -match '^\s*BACKUP_CRON_SECRET\s*=\s*(.+)$') {
                $Secret = $matches[1].Trim()
                break
            }
        }
    }
}

if (-not $Secret) {
    $Secret = [System.Environment]::GetEnvironmentVariable("BACKUP_CRON_SECRET")
}

if (-not $Secret) {
    Write-TimestampedLog "[ERROR] BACKUP_CRON_SECRET not found in .env.local or environment." "Red"
    exit 1
}

Write-TimestampedLog "[INFO] Loaded cron secret token." "Gray"

# 2. Trigger Backup Job via API
$RunUrl = "$BaseUrl/admin/backup/api/run"
$Headers = @{
    "x-cron-secret" = $Secret
    "Content-Type"  = "application/json"
}

try {
    Write-TimestampedLog "[INFO] Triggering backup via API: $RunUrl" "Yellow"
    $response = Invoke-RestMethod -Uri $RunUrl -Method Post -Headers $Headers -Body "{}" -TimeoutSec 30
} catch {
    Write-TimestampedLog "[ERROR] API trigger request failed: $($_.Exception.Message)" "Red"
    exit 1
}

if (-not $response.jobId) {
    Write-TimestampedLog "[ERROR] Invalid response from backup API: $($response | ConvertTo-Json -Compress)" "Red"
    exit 1
}

$jobId = $response.jobId
Write-TimestampedLog "[INFO] Backup job created: $jobId" "Green"

# 3. Poll for completion
$StatusUrl = "$BaseUrl/admin/backup/api/run?jobId=$jobId"
$maxWaitSec = 600
$startTime = Get-Date

while ($true) {
    Start-Sleep -Seconds 2
    $elapsed = (Get-Date) - $startTime

    if ($elapsed.TotalSeconds -gt $maxWaitSec) {
        Write-TimestampedLog "[ERROR] Backup timed out after $($maxWaitSec)s" "Red"
        exit 1
    }

    try {
        $job = Invoke-RestMethod -Uri $StatusUrl -Method Get -Headers $Headers -TimeoutSec 15
    } catch {
        Write-TimestampedLog "[WARN] Error polling job status: $($_.Exception.Message)" "Yellow"
        continue
    }

    if ($job.status -eq "done") {
        Write-TimestampedLog "[SUCCESS] Backup completed successfully in $($job.durationSeconds)s!" "Green"
        Write-TimestampedLog "[INFO] File: $($job.filename) ($($job.sizeFormatted))" "Green"
        if ($job.compressionRatio) {
            Write-TimestampedLog "[INFO] Saved $($job.compressionRatio) via streaming gzip compression" "Green"
        }
        if ($job.sha256) {
            Write-TimestampedLog "[INFO] SHA-256: $($job.sha256)" "Gray"
        }
        Write-TimestampedLog "==========================================================" "Cyan"
        exit 0
    }

    if ($job.status -eq "failed") {
        Write-TimestampedLog "[ERROR] Backup failed: $($job.error)" "Red"
        Write-TimestampedLog "==========================================================" "Cyan"
        exit 1
    }

    Write-Host -NoNewline "."
}
