# SRG OMSI — wersja testowa 0.1 / aplikacja 1.4.69-omsi-test

To działający kod pierwszego połączenia, nie ukończona realizacja pełnego zakresu.
Kompilacja i testy automatyczne nie zastępują testu w OMSI 2.

## Instalacja na komputerze

1. Zamknij OMSI 2.
2. Z paczki skopiuj `plugins/SRGBridge.dll` i `plugins/SRGBridge.opl` do
   folderu `plugins` w katalogu OMSI 2 (obok innych wtyczek). Nie kopiuj kodu źródłowego.
3. Uruchom `SRG-OMSI-Bridge.exe`. Pozostaw okno otwarte.
4. Jeśli Zapora Windows zapyta, zezwól na komunikację tylko w zaufanej sieci prywatnej.
5. Uruchom OMSI 2 i wczytaj mapę oraz autobus. Pierwszy test: podstawowy MAN i Grundorf.
6. Zainstaluj dołączone APK testowe; w aplikacji: Menu → Ustawienia → OMSI 2.
7. Włącz tryb, wybierz połączenie, wpisz kod parowania z okna programu i naciśnij „Zapisz i połącz”.

Nie nadpisuj żadnych plików autobusu, map ani HOF. Aby wyłączyć dodatek, zamknij grę i usuń tylko te dwa pliki SRGBridge.

## Wi-Fi

Komputer i Android muszą znajdować się w tej samej sieci lokalnej. W aplikacji wpisz
prywatny adres IPv4 komputera podany w programie, np. 192.168.1.10.
Komputer może być podłączony do tego samego routera kablem Ethernet.
Port TCP: 8765. Nie przekierowuj go w routerze do internetu. Sieć gościnna może blokować połączenia.
Kod parowania zmienia się po każdym uruchomieniu programu. Połączenie lokalne nie jest szyfrowane.

## USB

1. Zainstaluj oficjalne Android SDK Platform Tools: https://developer.android.com/tools/releases/platform-tools
2. Dodaj folder z `adb.exe` do PATH (lub uruchom polecenie poniżej w tym folderze).
3. Na Androidzie włącz opcje programistyczne i debugowanie USB.
4. Podłącz kabel obsługujący dane; zatwierdź ten komputer na Androidzie.
5. Uruchom `USB.cmd` albo `adb -d reverse tcp:8765 tcp:8765`.
6. W sterowniku wybierz USB, wpisz kod i zapisz. Używany adres to 127.0.0.1.

Podłącz tylko jeden telefon/tablet na czas uruchamiania USB.cmd.
Po ponownym podłączeniu może być potrzebne ponowienie polecenia.
Samo ładowanie kablem nie ustanawia połączenia z grą.

## Co jest zaimplementowane

- Wtyczka x86: pasywny odczyt `Velocity`, `IBIS_Linie`, `IBIS_Route`, `IBIS_Ziel`.
- Brakujące i nieaktualne zmienne są oznaczane jako niedostępne, a nie jako zero.
- Mostek Windows, parowanie kodem, Wi-Fi i transport USB przez ADB.
- Kafelek OMSI, przełącznik, niebieskie akcenty z wyłączeniem kalendarza.
- Widok rzeczywistych wartości, nazwa komputera, osobny status świeżych danych z gry.
- Oddzielenie zwykłych kursówek od trybu OMSI, zachowanie lokalnych zapisów.
- Historia połączeń w aplikacji oraz logi JSONL komputera w `%LOCALAPPDATA%\SRG-OMSI`.
  Logi wskazują czas zaobserwowania kontaktu, nie gwarantowany początek/koniec gry.

Kody IBIS są surowymi wartościami skryptu, nie gotowym numerem linii ani rozkładem.

## Jeszcze niezaimplementowane / niepotwierdzone

Pełny odczyt kursówek, HOF i rozkładów map, współrzędne i przełączanie przystanków,
próg 50 m, generowanie/przesyłanie/cache zapowiedzi, ręczna obsługa zapisanej trasy,
sterowanie tablicami oraz przechwytywanie kamery/lusterka. Obecny ekran kamer jest
czarny, bo mostek nie dostarcza jeszcze obrazu. Docelowo kamera ma pierwszeństwo,
a jej brak powinien uruchamiać obraz wewnętrznego lusterka.

Nie potwierdzono zgodności z OpenOMSI ani wszystkimi podstawowymi autobusami i mapami.
Nie należy utożsamiać udanej kompilacji z testem w grze.

## Test na twoim komputerze

Sprawdź: wykrycie wtyczki, prędkość podczas jazdy, zmianę statusu po zamknięciu gry,
rozłączenie i powrót Wi-Fi, to samo przez USB, powrót zwykłych kursówek po wyłączeniu trybu.
Prześlij log mostka i `logfile.txt` OMSI, jeśli wtyczka nie startuje. Nie przesyłaj kluczy podpisu ani haseł.

## Źródła interfejsów

- OMSI plugin API: https://wiki.omnibussimulator.de/omsiwikineu.de/index.php?title=Plug-in-Schnittstelle
- Android USB reverse forwarding: https://developer.android.com/develop/ui/views/layout/webapps/access-local-server
