# SRGMobile 1.4.74 — OMSI 2 Steam i openOMSI

## Wspólny mostek
Aplikacja Android korzysta z tego samego SRG-OMSI-Bridge 0.2 dla obu gier.
Wi-Fi: port 8765, kod 4-cyfrowy. USB: adb reverse tcp:8766 tcp:8766, bez kodu aplikacji. Zgoda Androida na debugowanie nadal jest wymagana.
Kopiuj SRGBridge.dll i SRGBridge.opl do folderu plugins danej instalacji. Dla openOMSI wymagany jest host wtyczek x86 omsi-plugin-host32.exe. Uruchamiaj jedną grę naraz: aktualny format telemetrii współdzieli jeden plik.

## Potwierdzone na komputerze 2026-11-01
- Oba buildy GitHub Actions zakończone sukcesem; aplikacja 1.4.74 zainstalowana z zachowaniem danych i zgodnym podpisem.
- Tablet 9185W łączy się przez USB bez kodu. Pole kodu i adresu Wi-Fi jest w USB ukryte.
- openOMSI launcher 0.3.45 / Grundorf / MAN GN92: plik telemetrii odnawia się, Velocity=0, IBIS_Route=1. Tablet pokazuje świeże dane z wtyczki przez USB.
- IBIS_Linie i IBIS_Ziel są niedostępne w tej próbie. MAN udostępnia m.in. IBIS_LinieKurs i IBIS_Linie_Complex; nie mapowano ich automatycznie na gotowy numer linii.
- Nie potwierdzono zmiany prędkości podczas jazdy ani połączenia Wi-Fi na fizycznym tablecie.

## OMSI 2 ze Steam — pozostała diagnostyka
Gra zatrzymywała się przy inicjalizacji wtyczek. W tym momencie załadowana była AUXI.dll, a nie SRGBridge.dll. To wskazuje etap blokady, ale nie dowodzi jeszcze winy AUXI.
Konfigurację AUXI przywrócono po niedokończonej próbie izolacji. Nie usunięto dodatków.
Test z izolacją wtyczek i odczyt telemetrii z oryginalnego OMSI pozostają do wykonania. Nie deklarować pełnej zgodności na podstawie samej kompilacji.

## Zakres obecnej integracji
Pasywny odczyt czterech zmiennych, status świeżości, historia, USB/Wi-Fi.
Rozkłady/HOF, pozycja i przełączanie przystanków, zapowiedzi, kamery oraz pełne sterowanie tablicą nadal wymagają rozwoju.

## Dokumentacja
https://github.com/openOMSI-org/openOMSI/blob/main/docs/PLUGINS.md — zgodność .opl/DLL.
