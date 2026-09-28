# 印样台快速启动：拉起前后端，等就绪后打开浏览器
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$pnpm = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
if (-not (Test-Path $pnpm)) { $pnpm = "pnpm" }

Write-Host "正在启动印样台..." -ForegroundColor Cyan
Start-Process -FilePath $pnpm -ArgumentList "-r", "--parallel", "dev" -WorkingDirectory $repo -WindowStyle Minimized

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = Invoke-WebRequest "http://127.0.0.1:5317/" -UseBasicParsing -TimeoutSec 2
        Start-Process "http://localhost:5317"
        Write-Host "已打开 http://localhost:5317" -ForegroundColor Green
        exit 0
    } catch { }
}

Write-Host "服务启动超时，请手工运行 pnpm dev 查看报错" -ForegroundColor Yellow
