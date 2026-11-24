<#
  Starts Gradify "live" on this laptop:
    1. Postgres in Docker (docker-compose.yml)
    2. Backend built and run in production mode on 127.0.0.1:4000
    3. Tailscale Funnel exposing it at https://<device>.<tailnet>.ts.net
  Stop everything with .\stop-live.ps1. See LIVE-LAPTOP.md.

  Usage:  powershell -ExecutionPolicy Bypass -File .\start-live.ps1 [-SkipBuild]
#>
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root    = $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$LogDir  = Join-Path $Backend 'logs'
$PidFile = Join-Path $LogDir 'live.pid'
$Port    = 4000

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Stop-WithError($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }
function Invoke-Native {
  param([string]$Exe, [string[]]$ArgList)
  & $Exe @ArgList
  if ($LASTEXITCODE -ne 0) { Stop-WithError "'$Exe $($ArgList -join ' ')' failed (exit $LASTEXITCODE)" }
}

# --- Pre-flight -------------------------------------------------------------
Write-Step 'Checking prerequisites'
foreach ($cmd in 'docker', 'node', 'npm', 'tailscale') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Stop-WithError "'$cmd' was not found on PATH. Install it first (see LIVE-LAPTOP.md)."
  }
}
if (-not (Test-Path (Join-Path $Root '.env')))    { Stop-WithError 'Missing .env in the repo root (copy .env.example).' }
if (-not (Test-Path (Join-Path $Backend '.env'))) { Stop-WithError 'Missing backend\.env (copy backend\.env.example).' }

$frontendLine = Select-String -Path (Join-Path $Backend '.env') -Pattern '^\s*FRONTEND_URL\s*=' | Select-Object -First 1
if (-not $frontendLine) { Stop-WithError 'FRONTEND_URL is not set in backend\.env.' }
if ($frontendLine.Line -notmatch 'https://') {
  Write-Host 'WARNING: FRONTEND_URL in backend\.env has no https:// origin. Add your Vercel URL, e.g.' -ForegroundColor Yellow
  Write-Host '         FRONTEND_URL=http://localhost:3000,https://your-app.vercel.app' -ForegroundColor Yellow
}

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  $owner = ($listening | Select-Object -First 1).OwningProcess
  Stop-WithError "Port $Port is already in use (PID $owner). Stop the dev server (npm run start:dev) or run .\stop-live.ps1 first."
}

# --- 1. Database ------------------------------------------------------------
Write-Step 'Starting Postgres (Docker)'
Push-Location $Root
try { Invoke-Native 'docker' @('compose', 'up', '-d', 'postgres') } finally { Pop-Location }

Write-Host 'Waiting for Postgres to accept connections...'
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  & docker exec gradify_postgres pg_isready -q 2>$null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { Stop-WithError 'Postgres did not become ready within 60 seconds (check: docker logs gradify_postgres).' }

# --- 2. Backend (production mode) -------------------------------------------
Push-Location $Backend
try {
  if (-not $SkipBuild) {
    if (-not (Test-Path 'node_modules')) {
      Write-Step 'Installing backend dependencies'
      Invoke-Native 'npm' @('ci')
    }
    Write-Step 'Generating Prisma client'
    Invoke-Native 'npx' @('prisma', 'generate')
    Write-Step 'Building backend'
    Invoke-Native 'npm' @('run', 'build')
  }
  if (-not (Test-Path 'dist\main.js')) { Stop-WithError 'dist\main.js not found. Run without -SkipBuild.' }
} finally { Pop-Location }

Write-Step "Starting backend (production) on 127.0.0.1:$Port"
New-Item -ItemType Directory -Force $LogDir | Out-Null
# Inherited by the node process; backend\.env supplies the rest (dotenv never overrides these).
$env:NODE_ENV    = 'production'
$env:HOST        = '127.0.0.1'   # only reachable locally / through Funnel
$env:PORT        = "$Port"
$env:TRUST_PROXY = 'loopback'    # trust X-Forwarded-For only from the local Funnel proxy

$proc = Start-Process -FilePath 'node' -ArgumentList 'dist\main.js' -WorkingDirectory $Backend `
  -RedirectStandardOutput (Join-Path $LogDir 'live.out.log') `
  -RedirectStandardError  (Join-Path $LogDir 'live.err.log') `
  -WindowStyle Hidden -PassThru
Set-Content -Path $PidFile -Value $proc.Id -Encoding ascii

$up = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if ($proc.HasExited) { break }
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $up = $true; break
  } catch {
    # Any HTTP response (even 404) means the server is up.
    if ($_.Exception.Response) { $up = $true; break }
  }
}
if (-not $up) {
  Write-Host (Get-Content (Join-Path $LogDir 'live.err.log') -Tail 30 -ErrorAction SilentlyContinue | Out-String)
  Stop-WithError "Backend did not start. Logs: $LogDir"
}
Write-Host "Backend running (PID $($proc.Id)). Logs: $LogDir"

# --- 3. Tailscale Funnel ----------------------------------------------------
Write-Step "Starting Tailscale Funnel (public :443 -> 127.0.0.1:$Port)"
Invoke-Native 'tailscale' @('funnel', '--bg', "$Port")
& tailscale funnel status

Write-Host "`nGradify is live. Public API URL = the https://...ts.net address above." -ForegroundColor Green
Write-Host 'Put that URL (no trailing slash) in Vercel as NEXT_PUBLIC_API_URL.'
Write-Host 'Stop with: .\stop-live.ps1'
