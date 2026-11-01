@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title AquaInsight

echo.
echo  ==============================
echo    AquaInsight - starting up
echo  ==============================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [!] Docker is not installed.
  echo     Install Docker Desktop: https://www.docker.com/products/docker-desktop/
  goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [!] Docker Desktop is not running.
  echo     Start Docker Desktop, wait until it says "Engine running", then run this file again.
  goto :fail
)

if not exist ".env" if exist ".env.example" (
  copy ".env.example" ".env" >nul
  echo [+] Created .env from .env.example
)

rem Ports from .env (defaults match docker-compose.yml)
set "PORT=8080"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="FRONTEND_PORT" set "PORT=%%b"
  )
)

rem Offline package: load prebuilt images once if they are not present yet.
if exist "docker-images\*.tar" (
  docker image inspect aquainsight-backend:latest >nul 2>&1
  if errorlevel 1 (
    echo [+] Loading offline images, this can take a few minutes...
    for %%f in ("docker-images\*.tar") do (
      echo     %%~nxf
      docker load -i "%%f"
      if errorlevel 1 goto :fail
    )
  )
)

echo [+] Starting containers...
docker compose up -d
if errorlevel 1 goto :fail

echo [+] Waiting for AquaInsight to be ready on port !PORT! ...
for /l %%i in (1,1,90) do (
  curl -sf -o nul "http://localhost:!PORT!/api/health" >nul 2>&1
  if not errorlevel 1 goto :ready
  timeout /t 2 /nobreak >nul
)
echo [!] The app did not answer within 3 minutes. Check Docker Desktop for container logs.
goto :fail

:ready
echo.
echo  AquaInsight is running:  http://localhost:!PORT!
echo  To stop it, run stop-windows.bat
echo.
start "" "http://localhost:!PORT!"
timeout /t 5 >nul
exit /b 0

:fail
echo.
pause
exit /b 1
