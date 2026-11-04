@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 -m pip install -r requirements-berdechow.txt
if errorlevel 1 goto error
py -3 GENERUJ_BERDECHOW.py
if errorlevel 1 goto error
echo Gotowe. Nowe MP3 sa w app\src\main\assets\audio\berdechow.
pause
exit /b 0
:error
echo Generowanie przerwane. Nie wysylaj niepelnych nagran. Ponowne uruchomienie wznowi prace.
pause
exit /b 1
