@echo off
where adb >nul 2>nul
if errorlevel 1 (
 echo Dodaj Android SDK Platform Tools do PATH. Patrz README-PL.md.
 pause
 exit /b 1
)
adb -d reverse tcp:8765 tcp:8765
if errorlevel 1 (
 echo Sprawdz kabel danych, debugowanie USB i zgode na ekranie Androida. Podlacz tylko jedno urzadzenie.
) else (
 echo USB gotowe. Na Androidzie otworz adres localhost wyswietlony przez START.cmd.
)
pause
