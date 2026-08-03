@echo off
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\regenerate.ps1
pause
