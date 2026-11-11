@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then reopen this file.
  echo Download Node from https://nodejs.org/
  pause
  exit /b 1
)
node scripts\publish.mjs %*
set RESULT=%ERRORLEVEL%
echo.
if not "%RESULT%"=="0" echo Publishing stopped. Read the message above; nothing was force-pushed.
pause
exit /b %RESULT%
