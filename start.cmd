@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or newer is required.
  pause
  exit /b 1
)
node server.mjs
pause
