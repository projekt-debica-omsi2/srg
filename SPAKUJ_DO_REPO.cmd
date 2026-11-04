@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 SPAKUJ_DO_REPO.py
if errorlevel 1 echo Nie utworzono kompletnej paczki. Popraw wskazany blad.
pause
