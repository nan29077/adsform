@echo off
chcp 65001 >nul
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js 22.13 or newer is required.
  pause
  exit /b 1
)
node share.mjs
pause
