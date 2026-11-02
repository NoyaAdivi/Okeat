@echo off
cd /d "%~dp0"
echo Checking Okeat (types + production build)... > check-output.log
echo ===== TYPESCRIPT ===== >> check-output.log
call npx tsc --noEmit >> check-output.log 2>&1
echo TSC EXIT %ERRORLEVEL% >> check-output.log
echo ===== BUILD ===== >> check-output.log
call npm run build >> check-output.log 2>&1
echo BUILD EXIT %ERRORLEVEL% >> check-output.log
echo DONE >> check-output.log
