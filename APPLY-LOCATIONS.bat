@echo off
title Okeat - save reviewed locations
cd /d "%~dp0"
node scripts/fix-locations.mjs --apply
echo.
pause
