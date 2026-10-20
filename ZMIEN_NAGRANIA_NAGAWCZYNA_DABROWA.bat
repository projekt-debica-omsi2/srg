@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Aktualizacja generatora mowy - poprawka bledu 403...
py -3 -m pip install --upgrade "edge-tts>=7.3.0"
if errorlevel 1 (
 echo Nie udalo sie zaktualizowac edge-tts. Nagrania nie zostaly zmienione.
 pause
 exit /b 1
)
py -3 GENERUJ_MP3_MAREK.py --nazwy-nagawczyna-dabrowa
if errorlevel 1 (
 echo Generowanie nie zostalo zakonczone. Sprawdz komunikat powyzej.
 pause
 exit /b 1
)
echo Gotowe. Wgraj zmienione pliki audio i manifest do GitHub, aby zbudowac APK.
pause
