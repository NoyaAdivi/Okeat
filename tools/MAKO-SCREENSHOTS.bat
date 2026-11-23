@echo off
title Okeat - press screenshots
cd /d "%~dp0.."
echo.
echo   Taking press screenshots of okeat.vercel.app ...
echo   A browser window will open and work by itself. Please do not touch it.
echo.
call npm install --no-save playwright
call npx playwright install chromium
node scripts\mako-screenshots.mjs
start "" "%cd%\mako-images"
pause
