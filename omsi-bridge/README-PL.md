# SRG OMSI Bridge 0.8

Wspolny mostek dla SRGMobile i SRGMobile Public. Zalecana pelna instalacja komputerowa: paczka SRG-OMSI-PC-0.8-Windows-x64 i jej aktualny README.

## Osobna instalacja mostka / pluginu

Przy zamknietej grze zachowaj kopie poprzednich plikow, a nastepnie skopiuj plugins/SRGBridge.dll, plugins/SRGBridge.opl i plugins/SRGOpenOMSI.lua do plugins wlasnej instalacji OMSI 2. Nie zmieniaj Omsi.exe, map ani autobusow.

Uruchom SRG-OMSI-Bridge.exe. Dla niestandardowej lokalizacji gry (inny dysk/biblioteka Steam) podaj:

```
SRG-OMSI-Bridge.exe --omsi-root "D:\SteamLibrary\steamapps\common\OMSI 2"
```

Opcja rejestruje konkretny katalog pluginu, do ktorego wolno zapisac polecenia sterownika. Nie uznajemy dowolnego katalogu podanego przez pakiet telemetryczny. Zalecany instalator wybiera ta sciezke automatycznie.

## Polaczenie

Wi-Fi: wspolna prywatna siec, IPv4 PC, TCP 8765, czterocyfrowy kod z okna/logu mostka. USB: adb reverse tcp:8766 tcp:8766, aplikacja w trybie USB bez kodu; port 8766 tylko na loopback. Nie trzeba dwoch mostkow dla dwoch APK. Przy wielu urzadzeniach uzyj skryptu USB z pelnej paczki lub wybierz serial jawnie. USB.cmd z tej osobnej paczki wymaga adb w PATH i jednego urzadzenia.

Zapora moze wymagac zgody dla prywatnej sieci. Nie zmieniamy jej automatycznie, nie otwieramy routera. Zajete porty 8765/8766/47851 oznaczaja zwykle uruchomiony poprzedni mostek; nie zabijamy go automatycznie.

## Zakres i testy

Plugin oryginalnego OMSI ma podstawowa telemetrie. Pelniejszy rozklad, komendy i niezalezne kamery wymagaja testowego silnika openOMSI z patchem SRG. Sama DLL nie dodaje niezaleznych kamer do oryginalnej gry Steam. Dotychczasowe testy obrazu dotyczyly MAN GN92 i Grundorfu w openOMSI, nie wszystkich autobusow/map/GPU.

Logi lokalne: LOCALAPPDATA/SRG-OMSI. Dane wymagaja aktualnosci; brak swiezych danych nie jest zastepowany zerami. Protokoly obu APK sa wspolne. Poprawka 0.8 dotyczy przenosnych sciezek i komunikatow uruchamiania, bez zmian w funkcjach zegara, opoznienia i czterech kamer.
