$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$url = "http://localhost:5317"
$health = "http://127.0.0.1:5317/"

function Test-App {
    try {
        $r = Invoke-WebRequest $health -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Resolve-Pnpm {
    $bundled = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
    if (Test-Path $bundled) { return $bundled }
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

Write-Host ""
Write-Host "  Yinyangtai - photo planning workbench" -ForegroundColor Cyan
Write-Host "  --------------------------------------" -ForegroundColor DarkGray

# 1. already running? just open the browser
if (Test-App) {
    Write-Host "  [OK] service is already running" -ForegroundColor Green
    Start-Process $url
    Write-Host "  [OK] browser opened: $url" -ForegroundColor Green
    exit 0
}

# 2. port used but not answering: do not start a second copy
$occupied = Get-NetTCPConnection -LocalPort 5317 -State Listen -ErrorAction SilentlyContinue
if ($occupied) {
    Write-Host "  [WARN] port 5317 is occupied but not answering." -ForegroundColor Yellow
    Write-Host "         Another process may be starting up, or a stale one is stuck." -ForegroundColor Yellow
    Write-Host "         Close it (or wait a moment) and run this shortcut again." -ForegroundColor Yellow
    exit 1
}

$pnpm = Resolve-Pnpm
if (-not $pnpm) {
    Write-Host "  [FAIL] pnpm not found. Install Node.js 20+ and pnpm first." -ForegroundColor Red
    exit 1
}

# 3. first run: install dependencies
if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Host "  [..] first run, installing dependencies (may take a few minutes)" -ForegroundColor Yellow
    & $pnpm install
}

# 4. start the dev servers in a minimized window
Write-Host "  [..] starting local service..." -ForegroundColor Yellow
Start-Process -FilePath $pnpm -ArgumentList "-r", "--parallel", "dev" -WorkingDirectory $root -WindowStyle Minimized

# 5. wait until it answers, then open the browser
for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-App) {
        Start-Process $url
        Write-Host "  [OK] ready, browser opened: $url" -ForegroundColor Green
        exit 0
    }
    if ($i % 10 -eq 0) { Write-Host "  [..] still starting ($i s)" -ForegroundColor DarkGray }
}

Write-Host "  [FAIL] service did not answer within 60s." -ForegroundColor Red
Write-Host "         Open the minimized window to see the error, or run: pnpm dev" -ForegroundColor Red
exit 1
