@echo off
setlocal
cd /d "%~dp0.."

echo [1/2] Updating public activity dashboard...
node scripts\regenerate.js
if errorlevel 1 goto :failed

echo.
echo [2/2] Updating local AI prompt analysis...
node scripts\analyze-prompts.js
if errorlevel 1 goto :failed

echo.
echo Update complete.
echo   Public dashboard: index.html
echo   Local analysis:   private-dashboard.html
echo.
echo No commit or push was performed.
pause
exit /b 0

:failed
echo.
echo UPDATE FAILED. Review the error shown above.
echo Files from completed earlier steps may have been refreshed.
pause
exit /b 1
