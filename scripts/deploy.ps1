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

Write-Host "Starting PM2 process '$ProcessName'..."
pm2 start ecosystem.config.js
pm2 save

Write-Host "Running deployment verification..."
powershell -ExecutionPolicy Bypass -File .\scripts\check-webapp.ps1 -ServerIp $ServerIp -Port $Port -ProcessName $ProcessName