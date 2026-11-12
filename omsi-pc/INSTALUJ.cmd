@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"  %*
if errorlevel 1 echo Niepowodzenie. Szczegoly powyzej i w README-PL.md.
pause
