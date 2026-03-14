@echo off
setlocal
set SCRIPT_DIR=%~dp0
for %%I in ("%SCRIPT_DIR%..") do set ROOT=%%~fI

start "Mock API (8081)" cmd /k "cd /d %ROOT% && node quickstart\mock-api.js"
start "Frontend (3000)" cmd /k "cd /d %ROOT%\services\frontend-service && node server.js"

echo Pokrenuto:
echo - API: http://localhost:8081/health
echo - Frontend: http://localhost:3000
endlocal
