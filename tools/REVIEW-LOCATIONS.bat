@echo off
title Okeat - review locations
cd /d "%~dp0.."
node scripts/fix-locations.mjs
echo.
pause
