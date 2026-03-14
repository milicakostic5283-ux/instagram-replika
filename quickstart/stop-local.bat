@echo off
taskkill /FI "WINDOWTITLE eq Mock API (8081)*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Frontend (3000)*" /F >nul 2>nul
echo Lokalne sesije za quickstart su ugasene.
