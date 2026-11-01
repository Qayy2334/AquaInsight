@echo off
cd /d "%~dp0"
title AquaInsight
echo.
echo  This deletes ALL AquaInsight data: accounts, imported and edited records, analysis results.
echo  The original plant records are imported again on the next start.
echo.
set /p CONFIRM=Type YES to continue: 
if /i not "%CONFIRM%"=="YES" (
  echo Cancelled.
  pause
  exit /b 0
)
docker compose down -v
echo Done. Run start-windows.bat to start fresh.
pause
