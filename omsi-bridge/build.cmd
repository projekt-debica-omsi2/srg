@echo off
setlocal
cd /d "%~dp0"
where cl >nul 2>nul
if errorlevel 1 (
 echo Uruchom ten plik z x86 Native Tools Command Prompt for VS 2022.
 exit /b 1
)
cl /nologo /std:c++17 /EHsc /MT /W4 /LD src\SRGBridge.cpp /link /DEF:src\SRGBridge.def /OUT:plugins\SRGBridge.dll shell32.lib
exit /b %errorlevel%
