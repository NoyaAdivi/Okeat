@echo off
title Okeat is running - keep this window open
cd /d "%~dp0"
echo.
echo   Starting Okeat... the browser will open in a few seconds.
echo   Keep this window open while you use the site.
echo.
start "" cmd /c "timeout /t 12 >nul & start http://localhost:3000"
npm run dev
pause
