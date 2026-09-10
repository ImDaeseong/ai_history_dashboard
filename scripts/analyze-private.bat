@echo off
cd /d "%~dp0.."
node scripts\analyze-prompts.js
if errorlevel 1 (
  echo.
  echo FAILED - see error above.
) else (
  echo.
  echo Done. Open private-dashboard.html locally. This file is not published.
)
pause
