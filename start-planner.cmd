@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-planner.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Read the message above.
  pause
)
