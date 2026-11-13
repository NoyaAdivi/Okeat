@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "OLD=%~dp0..\old\okeat"
echo Moving local-only files to: %OLD%
if not exist "%OLD%" mkdir "%OLD%"
if exist backups move backups "%OLD%\backups"
if exist linkedin-images move linkedin-images "%OLD%\linkedin-images"
if exist social-preview.jpg move social-preview.jpg "%OLD%\"
if exist social-preview-he.jpg move social-preview-he.jpg "%OLD%\"
if exist supabase\RUN-ME*.sql (
  if not exist "%OLD%\supabase-old-sql" mkdir "%OLD%\supabase-old-sql"
  move supabase\RUN-ME*.sql "%OLD%\supabase-old-sql\"
)
echo.
echo Done. Okeat now has only the GitHub project (+ .env.local and node_modules).
pause
(goto) 2>nul & del "%~f0"
