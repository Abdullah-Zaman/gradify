<#
  Stops what start-live.ps1 started: Tailscale Funnel, the production backend,
  and the Postgres container (data is kept in the Docker volume).

  Usage:  powershell -ExecutionPolicy Bypass -File .\stop-live.ps1 [-KeepDatabase]
#>
param(
  [switch]$KeepDatabase
)

$Root    = $PSScriptRoot
$PidFile = Join-Path $Root 'backend\logs\live.pid'
$Port    = 4000

Write-Host '==> Stopping Tailscale Funnel' -ForegroundColor Cyan
if (Get-Command tailscale -ErrorAction SilentlyContinue) {
  & tailscale funnel reset
} else {
  Write-Host 'tailscale not found; skipping.'
}

Write-Host '==> Stopping backend' -ForegroundColor Cyan
$stopped = $false
if (Test-Path $PidFile) {
  $backendPid = [int](Get-Content $PidFile -Raw).Trim()
  $p = Get-Process -Id $backendPid -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -eq 'node') {
    Stop-Process -Id $backendPid -Force -Confirm:$false
    Write-Host "Stopped backend (PID $backendPid)."
    $stopped = $true
  }
  Remove-Item $PidFile -Force -Confirm:$false
}
if (-not $stopped) {
  $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    Write-Host "No live backend PID recorded, but PID $(($listening | Select-Object -First 1).OwningProcess) is listening on port $Port (dev server?). Left running." -ForegroundColor Yellow
  } else {
    Write-Host 'Backend was not running.'
  }
}

if (-not $KeepDatabase) {
  Write-Host '==> Stopping Postgres (data is kept)' -ForegroundColor Cyan
  Push-Location $Root
  try { & docker compose stop postgres } finally { Pop-Location }
}

Write-Host "`nGradify live mode stopped." -ForegroundColor Green
