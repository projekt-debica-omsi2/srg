@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
py -3 -m pip install "edge-tts>=7.3.0,<8"
if errorlevel 1 goto error
py -3 GENERUJ_Z_GRG.py
if errorlevel 1 goto error
pause
exit /b 0
:error
echo Generowanie przerwane. Wczesniejsze nagrania pozostaly zachowane. Uruchom ponownie, aby wznowic.
pause
exit /b 1
