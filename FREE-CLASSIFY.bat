@echo off
title Okeat - free food types
cd /d "%~dp0"
if not exist node_modules call npm install
node scripts/classify-free.mjs
call npm run classify:diet -- --no-ai
echo.
pause
