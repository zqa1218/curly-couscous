# kept only as a forwarder; the real script is start-planner.ps1 (ASCII name avoids encoding issues)
& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "start-planner.ps1")
