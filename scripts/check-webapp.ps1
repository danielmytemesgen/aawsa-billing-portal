param(
    [string]$ServerIp,

    [int]$Port = 3000,

    [string]$Path = "/",

    [string]$ProcessName = "aawsa-billing-web"
)

$ErrorActionPreference = 'Stop'

function Import-DotEnvFile {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        return
    }

    foreach ($line in Get-Content -Path $FilePath) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }

        $pair = $trimmed -split '=', 2
        if ($pair.Count -ne 2) {
            continue
        }

        $name = $pair[0].Trim()
        $value = $pair[1].Trim().Trim('"').Trim("'")
        if ($name) {
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Import-DotEnvFile -FilePath (Join-Path $repoRoot '.env.production')
Import-DotEnvFile -FilePath (Join-Path $repoRoot '.env.local')
Import-DotEnvFile -FilePath (Join-Path $repoRoot '.env')

if ([string]::IsNullOrWhiteSpace($ServerIp)) {
    $ServerIp = $env:PUBLIC_SERVER_IP
}

if ([string]::IsNullOrWhiteSpace($ServerIp) -and $env:NEXTAUTH_URL) {
    try {
        $derivedUri = [Uri]$env:NEXTAUTH_URL
        $ServerIp = $derivedUri.Host
        if ($derivedUri.Port -gt 0) {
            $Port = $derivedUri.Port
        }
    } catch {
        # Ignore malformed URLs here; the explicit validation below will fail with a clearer message.
    }
}

if ([string]::IsNullOrWhiteSpace($ServerIp)) {
    throw "ServerIp is required. Pass -ServerIp <public-ip> or set PUBLIC_SERVER_IP / NEXTAUTH_URL."
}

Write-Host "Checking PM2 process '$ProcessName'..."
try {
    $pm2List = pm2 jlist | ConvertFrom-Json
    $process = $pm2List | Where-Object { $_.name -eq $ProcessName } | Select-Object -First 1
    if (-not $process) {
        throw "PM2 process '$ProcessName' was not found."
    }

    if ($process.pm2_env.status -ne 'online') {
        throw "PM2 process '$ProcessName' is '$($process.pm2_env.status)' instead of 'online'."
    }

    Write-Host "PM2 process is online."
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

Write-Host "Checking local listener on 127.0.0.1:$Port..."
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    Write-Error "Nothing is listening on local port $Port."
    exit 1
}
Write-Host "Port $Port is listening locally."

$url = "http://$ServerIp`:$Port$Path"
Write-Host "Checking HTTP response from $url..."

try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 5
    Write-Host "HTTP status: $($response.StatusCode)"
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
        throw "Unexpected HTTP status code $($response.StatusCode)."
    }
} catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        if ($statusCode -ge 300 -and $statusCode -lt 400) {
            Write-Host "HTTP redirect status: $statusCode"
        } else {
            Write-Error "HTTP check failed with status code $statusCode."
            exit 1
        }
    } else {
        Write-Error $_.Exception.Message
        exit 1
    }
}

Write-Host "Deployment check passed for http://$ServerIp`:$Port"