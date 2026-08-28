@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo [KINOSIS] npm was not found.
  echo Install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)
echo [KINOSIS] Starting Netlify local development server...
echo API-backed features require the same environment variables used by the deployed site.
call npm run dev
if errorlevel 1 pause
