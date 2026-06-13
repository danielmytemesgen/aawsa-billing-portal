param(
    [string]$ServerIp,
    [int]$Port = 3000,
    [string]$ProcessName = "aawsa-billing-web"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ServerIp)) {
    $ServerIp = $env:PUBLIC_SERVER_IP
}

if ([string]::IsNullOrWhiteSpace($ServerIp) -and $env:NEXTAUTH_URL) {
    try {
        $ServerIp = ([Uri]$env:NEXTAUTH_URL).Host
    } catch {
    }
}

if ([string]::IsNullOrWhiteSpace($ServerIp)) {
    throw "ServerIp is required. Pass -ServerIp <public-ip> or set PUBLIC_SERVER_IP / NEXTAUTH_URL."
}

Write-Host "Building application..."
npm run build

Write-Host "Copying public and static assets to standalone directory..."
$standaloneDir = Join-Path $repoRoot ".next\standalone"
$standalonePublic = Join-Path $standaloneDir "public"
$standaloneStatic = Join-Path $standaloneDir ".next\static"

# Create destination folders if they don't exist
if (-not (Test-Path $standalonePublic)) {
    New-Item -ItemType Directory -Path $standalonePublic -Force | Out-Null
}
if (-not (Test-Path $standaloneStatic)) {
    New-Item -ItemType Directory -Path $standaloneStatic -Force | Out-Null
}

# Copy contents
if (Test-Path (Join-Path $repoRoot "public")) {
    Copy-Item -Path (Join-Path $repoRoot "public\*") -Destination $standalonePublic -Recurse -Force
}
if (Test-Path (Join-Path $repoRoot ".next\static")) {
    Copy-Item -Path (Join-Path $repoRoot ".next\static\*") -Destination $standaloneStatic -Recurse -Force
}

Write-Host "Starting PM2 process '$ProcessName'..."
pm2 start ecosystem.config.js
pm2 save

Write-Host "Running deployment verification..."
powershell -ExecutionPolicy Bypass -File .\scripts\check-webapp.ps1 -ServerIp $ServerIp -Port $Port -ProcessName $ProcessName