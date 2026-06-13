# setup-https.ps1
# Run this script on the Windows Server to enable HTTPS for the AAWSA Billing Portal.
# Usage: .\scripts\setup-https.ps1 -ServerIp 10.10.254.78

param(
    [string]$ServerIp = "10.10.254.78",
    [int]$HttpsPort = 443,
    [int]$AppPort = 3000,
    [string]$AppDir = "C:\Apps\aawsa-billing-portal",
    [string]$ProcessName = "aawsa-billing-web"
)

$ErrorActionPreference = 'Stop'

Write-Host "=== AAWSA Billing Portal - HTTPS Setup ===" -ForegroundColor Cyan
Write-Host "Server IP  : $ServerIp" -ForegroundColor White
Write-Host "HTTPS Port : $HttpsPort" -ForegroundColor White
Write-Host "App Port   : $AppPort (internal Next.js)" -ForegroundColor White
Write-Host ""

# ---------------------------------------------------------------
# 1. Check/Install mkcert
# ---------------------------------------------------------------
Write-Host "[1/5] Checking mkcert..." -ForegroundColor Yellow
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "  mkcert not found. Installing via Chocolatey..." -ForegroundColor White

    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Host "  Installing Chocolatey first..." -ForegroundColor White
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    }

    choco install mkcert -y
    refreshenv
}
Write-Host "  mkcert is available." -ForegroundColor Green

# ---------------------------------------------------------------
# 2. Install Root CA (on THIS server)
# ---------------------------------------------------------------
Write-Host "[2/5] Installing local root CA on server..." -ForegroundColor Yellow
mkcert -install
Write-Host "  Root CA installed. Run 'mkcert -CAROOT' to find the CA file for client distribution." -ForegroundColor Green

# ---------------------------------------------------------------
# 3. Generate certificate for the server IP
# ---------------------------------------------------------------
Write-Host "[3/5] Generating TLS certificate for $ServerIp..." -ForegroundColor Yellow
$certDir = Join-Path $AppDir "certificates"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

Push-Location $certDir
mkcert $ServerIp
Pop-Location

$certFile = Join-Path $certDir "$ServerIp.pem"
$keyFile  = Join-Path $certDir "$ServerIp-key.pem"

if (-not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
    Write-Error "Certificate files not found after mkcert. Check output above."
    exit 1
}
Write-Host "  Certificate : $certFile" -ForegroundColor Green
Write-Host "  Private Key : $keyFile" -ForegroundColor Green

# ---------------------------------------------------------------
# 4. Open Windows Firewall for HTTPS port
# ---------------------------------------------------------------
Write-Host "[4/5] Opening Windows Firewall port $HttpsPort..." -ForegroundColor Yellow
$ruleName = "AAWSA-Billing-HTTPS-$HttpsPort"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existing) {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $HttpsPort `
        -Action Allow | Out-Null
    Write-Host "  Firewall rule created for port $HttpsPort." -ForegroundColor Green
} else {
    Write-Host "  Firewall rule already exists for port $HttpsPort." -ForegroundColor Green
}

# ---------------------------------------------------------------
# 5. Update .env.production with HTTPS values
# ---------------------------------------------------------------
Write-Host "[5/5] Updating environment configuration..." -ForegroundColor Yellow
$envFile = Join-Path $AppDir ".env.production"
$envContent = Get-Content $envFile -Raw -ErrorAction SilentlyContinue

# Update NEXTAUTH_URL to https
if ($envContent -match 'NEXTAUTH_URL\s*=') {
    $envContent = $envContent -replace 'NEXTAUTH_URL\s*=.*', "NEXTAUTH_URL=https://$ServerIp"
} else {
    $envContent += "`nNEXTAUTH_URL=https://$ServerIp"
}

# Add/update cert paths
if ($envContent -match 'HTTPS_CERT_FILE\s*=') {
    $envContent = $envContent -replace 'HTTPS_CERT_FILE\s*=.*', "HTTPS_CERT_FILE=$certFile"
} else {
    $envContent += "`nHTTPS_CERT_FILE=$certFile"
}

if ($envContent -match 'HTTPS_KEY_FILE\s*=') {
    $envContent = $envContent -replace 'HTTPS_KEY_FILE\s*=.*', "HTTPS_KEY_FILE=$keyFile"
} else {
    $envContent += "`nHTTPS_KEY_FILE=$keyFile"
}

if ($envContent -match '^PORT\s*=') {
    $envContent = $envContent -replace '^PORT\s*=.*', "PORT=$HttpsPort"
} else {
    $envContent += "`nPORT=$HttpsPort"
}

Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Write-Host "  .env.production updated." -ForegroundColor Green

# ---------------------------------------------------------------
# Summary
# ---------------------------------------------------------------
Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Distribute the root CA to all staff devices:" -ForegroundColor White
$caRoot = mkcert -CAROOT
Write-Host "   CA file location: $caRoot\rootCA.pem" -ForegroundColor Cyan
Write-Host "   - Windows devices : Import via certmgr.msc -> Trusted Root Certification Authorities" -ForegroundColor White
Write-Host "   - Android devices : Copy rootCA.pem to device, open Settings > Security > Install Certificate" -ForegroundColor White
Write-Host "   - iOS devices     : AirDrop/email the file, then Settings > General > Profile" -ForegroundColor White
Write-Host ""
Write-Host "2. Rebuild and restart the app:" -ForegroundColor White
Write-Host "   cd $AppDir" -ForegroundColor Cyan
Write-Host "   npm run build" -ForegroundColor Cyan
Write-Host "   Copy-Item -Path '.\public\*' -Destination '.\.next\standalone\public\' -Recurse -Force" -ForegroundColor Cyan
Write-Host "   Copy-Item -Path '.\.next\static\*' -Destination '.\.next\standalone\.next\static\' -Recurse -Force" -ForegroundColor Cyan
Write-Host "   pm2 restart $ProcessName" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Access the app at: https://$ServerIp" -ForegroundColor Green
Write-Host "   (port 443 is the default HTTPS port, no port number needed in the URL)" -ForegroundColor White
Write-Host ""
Write-Host "4. Test Service Worker in Chrome DevTools -> Application -> Service Workers" -ForegroundColor White
