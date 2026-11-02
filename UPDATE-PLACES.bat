@echo off
title Okeat - update all places
cd /d "%~dp0"
if not exist .env.local (
  echo.
  echo   .env.local is missing from this folder. Copy it here from your Okeat folder and run again.
  echo.
  pause
  exit /b 1
)
if not exist node_modules call npm install
call npm install --no-save @duckdb/node-api
echo.
echo   1 of 4: places from OpenStreetMap
call npm run import:osm || goto failed
echo.
echo   2 of 4: places from Overture Maps
call npm run import:overture -- --min-confidence 0.4 || goto failed
echo.
echo   3 of 4: food types
call npm run classify || goto failed
echo.
echo   4 of 4: vegan, vegetarian and gluten-free
call npm run classify:diet || goto failed
echo.
echo   Done. Refresh the site.
echo.
pause
exit /b 0
:failed
echo.
echo   Something failed. Send a screenshot of this window.
echo.
pause
exit /b 1
