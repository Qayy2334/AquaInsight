@echo off
cd /d "%~dp0"
title AquaInsight
echo [+] Stopping AquaInsight (data is kept)...
docker compose down
echo Done.
pause
