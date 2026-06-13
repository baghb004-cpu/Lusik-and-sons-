@echo off
REM ============================================================
REM  Baghdo's Workshop — one-click thumb-drive builder (Windows)
REM  Double-click this file. It runs the same 3 commands as the
REM  guide in docs/SHIP_THE_DRIVE.md. No compiler needed.
REM ============================================================
title Build Baghdo's Workshop drive
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it once from https://nodejs.org ^(LTS^), then run this again.
  pause
  exit /b 1
)

echo.
echo [1/3] Installing dependencies (first time can take a few minutes)...
call npm ci
if errorlevel 1 call npm install
if errorlevel 1 ( echo Dependency install failed. & pause & exit /b 1 )

echo.
echo [2/3] Building the app...
call npm run next:build
if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )

echo.
set "DRIVE="
set /p DRIVE=Enter the USB folder to build into (example E:\Workshop):
if "%DRIVE%"=="" ( echo No folder entered. & pause & exit /b 1 )

echo.
echo [3/3] Assembling the drive at "%DRIVE%" ...
node desktop\scripts\make-portable.mjs "%DRIVE%"
if errorlevel 1 ( echo Drive assembly failed. & pause & exit /b 1 )

echo.
echo Done. Open "%DRIVE%" and double-click start.bat to run the Workshop.
pause
