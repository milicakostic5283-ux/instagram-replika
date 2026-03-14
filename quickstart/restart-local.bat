@echo off
setlocal
set SCRIPT_DIR=%~dp0
for %%I in ("%SCRIPT_DIR%..") do set ROOT=%%~fI

for %%P in (8081 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>nul
  )
)

taskkill /FI "WINDOWTITLE eq Mock API (8081)*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Frontend (3000)*" /F >nul 2>nul

start "Mock API (8081)" cmd /k "cd /d %ROOT% && node quickstart\mock-api.js"
start "Frontend (3000)" cmd /k "cd /d %ROOT%\services\frontend-service && node server.js"

echo Restartovan quickstart.
echo API: http://localhost:8081/health
echo FE:  http://localhost:3000
endlocal
