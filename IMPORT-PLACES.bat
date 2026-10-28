@echo off
title Okeat - adding places
cd /d "%~dp0"
echo.
echo   Downloading all the restaurants in Israel. This takes a few minutes...
echo.
npm run import:osm
echo.
pause
