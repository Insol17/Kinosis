@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [KINOSIS] Node.js was not found.
  echo Install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)
echo [KINOSIS] Starting local UI preview...
node tools\preview-server.mjs
if errorlevel 1 pause
