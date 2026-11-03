@echo off
title Okeat - backup
cd /d "%~dp0.."
if not exist .env.local (
  echo.
  echo   .env.local is missing from this folder.
  echo.
  pause
  exit /b 1
)
if not exist node_modules call npm install
node scripts/backup.mjs
pause
