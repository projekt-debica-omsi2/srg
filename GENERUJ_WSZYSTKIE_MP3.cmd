@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =============================================
echo SRG Mobile - 79 nagran Marek Neural
 echo =============================================
py -3.12 --version >nul 2>&1
if %errorlevel%==0 goto python312
py -3 --version >nul 2>&1
if %errorlevel%==0 goto python3
echo Nie znaleziono Python 3. Zainstaluj Python i zaznacz opcje PATH.
pause
exit /b 1
:python312
py -3.12 GENERUJ_MP3_MAREK.py
 goto finish
:python3
py -3 GENERUJ_MP3_MAREK.py
:finish
if errorlevel 1 echo Blad generowania. Uruchom ponownie by wznowic.
pause
