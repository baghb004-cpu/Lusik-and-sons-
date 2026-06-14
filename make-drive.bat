@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  Baghdo's Workshop — one-click thumb-drive builder (Windows)
REM  Double-click this file. It copies the project to your computer
REM  (fast disk), builds it there, then assembles the finished drive
REM  onto your USB stick. Safe to run even with the project ON the USB.
REM ============================================================
title Build Baghdo's Workshop drive
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it once from https://nodejs.org ^(the LTS button^), then run this again.
  pause
  exit /b 1
)

set "SRC=%~dp0"
set "WORK=%USERPROFILE%\BaghdosWorkshopBuild"

echo.
echo Building Baghdo's Workshop.
echo  - source folder:  %SRC%
echo  - work folder:    %WORK%   (fast local disk - building here, not on the USB)
echo.

echo [1/4] Copying the project to your computer (skipping big folders)...
robocopy "%SRC:~0,-1%" "%WORK%" /E /NFL /NDL /NJH /NJS /XD node_modules .next .git /XF *.zip >nul
if %ERRORLEVEL% GEQ 8 ( echo Could not copy the project. & pause & exit /b 1 )

cd /d "%WORK%"

echo.
echo [2/4] Installing dependencies (first time can take several minutes)...
call npm ci
if errorlevel 1 call npm install
if errorlevel 1 ( echo Dependency install failed - check your internet connection. & pause & exit /b 1 )

echo.
echo [3/4] Building the app...
call npm run next:build
if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )

echo.
set "DRIVE="
set /p DRIVE=Enter the USB folder to build into (example E:\Workshop):
if "%DRIVE%"=="" ( echo No folder entered. & pause & exit /b 1 )

echo.
echo [4/4] Assembling the drive at "%DRIVE%" ...
node desktop\scripts\make-portable.mjs "%DRIVE%"
if errorlevel 1 ( echo Drive assembly failed. & pause & exit /b 1 )

echo.
echo Done! Open "%DRIVE%" and double-click start.bat to run the Workshop.
echo (The build folder %WORK% can be deleted afterward if you like.)
pause
endlocal
