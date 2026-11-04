@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
py -3 GENERUJ_Z_GRG.py --dry-run
pause
