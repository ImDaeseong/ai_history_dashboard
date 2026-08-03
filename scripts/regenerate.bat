@echo off
cd /d "%~dp0.."
echo Regenerating dashboard data from local logs...
node scripts\regenerate.js
if errorlevel 1 (
  echo.
  echo FAILED - see error above.
) else (
  echo.
  echo Done. Review with: git diff index.html
  echo Then commit/push yourself, or run publish.bat to do both.
)
pause
