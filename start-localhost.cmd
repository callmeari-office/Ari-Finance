@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { exit 0 } else { exit 1 }"

if %ERRORLEVEL% EQU 0 (
  echo ARI Finance server is already running at http://localhost:3000
  start "" "http://localhost:3000/login"
  exit /b 0
)

echo Starting ARI Finance dev server...
echo.
start "" "http://localhost:3000/login"
npm.cmd run dev
