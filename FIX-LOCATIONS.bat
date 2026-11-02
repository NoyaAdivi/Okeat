@echo off
title Okeat - fix locations
cd /d "%~dp0"
if not exist .env.local (
  echo.
  echo   .env.local is missing from this folder. Copy it here from your Okeat folder and run again.
  echo.
  pause
  exit /b 1
)
if not exist node_modules call npm install
node scripts/fix-locations.mjs
echo.
pause
