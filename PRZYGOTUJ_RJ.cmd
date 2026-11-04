@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 tools\prepare_rj.py --require
if errorlevel 1 goto error
py -3 tools/prepare_grg.py
if errorlevel 1 goto error
echo RJ i nowe zapowiedzi sa gotowe do wyslania do repo.
pause
exit /b 0
:error
echo Popraw wskazany blad. Nie wysylaj niepelnej paczki.
pause
exit /b 1
