@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" -Action Bridge %*
if errorlevel 1 echo Niepowodzenie. Szczegoly powyzej i w README-PL.md.
pause
