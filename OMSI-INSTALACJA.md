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

## Rozszerzenie 1.4.75 / mostek 0.3
W openOMSI dodaj również plugins/SRGOpenOMSI.lua. Dodatek odczytuje duty/info/position i wysyła dane wyłącznie na loopback UDP 47851. Mostek składa listę przystanków z części (limit 8 KB na datagram); pełne dane mają pierwszeństwo przed podstawowym plikiem DLL, tylko przez 3 sekundy od ostatniej aktualizacji.

Na tablecie potwierdzono rzeczywistą linię 76, brygadę 2, kierunek Krankenhaus, osiem pozycji rozkładu Grundorfu, bieżący przystanek Bauernhof, czas gry, odchyłkę i pozycję z odległością. Podwójny Bauernhof pochodzi z danych gry; nie łączono przystanków wyłącznie po nazwie.
Strzałki zmieniają podgląd na tablecie, bez sterowania grą. Przycisk śledzenia przywraca automatyczne wskazanie z gry. Zapowiedzi korzystają z głosu systemowego Androida w wybranym języku; to nie nagrania Marek. Test ręcznej zapowiedzi został przyjęty przez TTS. Automatyczne zapowiedzi są domyślnie wyłączone; kolejne nazwy są odczytywane przy zmianie przystanku gry, bez powtarzania przy każdym odpytywaniu.

APK: build 41330067850, mostek: build 41330003474; sukces. APK 1.4.75 zainstalowane na tablecie, zgodny podpis i zachowane dane. Rozszerzony panel sprawdzono z działającą grą i USB.

Pozostało: test podczas jazdy i ponownego łączenia; Wi-Fi na fizycznym tablecie; pełny odczyt tras w oryginalnym OMSI 2 ze Steam; sterowanie grą, ręczna trasa offline, nagrania z gry, kamery/lusterka i sterowanie fizyczną tablicą. Nie przedstawiać tych funkcji jako ukończonych.

## Sterownik OMSI 1.4.76 / mostek 0.4
Główny ekran OMSI powiela układ zwykłej kursówki, w niebieskiej kolorystyce. KURS otwiera wyłącznie dane gry. Przycisk Wybierz kurs prowadzi do listy linii/brygad i kursów odczytanych z gry; nie są to lokalne kursówki MKS.
Przy wyborze kursu można jawnie dopasować czas gry do odjazdu. Bez tego openOMSI może przejść do kursu odpowiadającego aktualnemu czasowi. Na Grundorfie potwierdzono wybór 76/1/11 z dopasowaniem czasu i potwierdzeniem z gry. Ustawianie tablic w grze wykorzystuje duty.type_ibis; zakres efektu zależy od skryptu autobusu.
Strzałki pokazują przystanek, zatwierdzenie zleca skip_to w grze, anulowanie przywraca śledzenie. Szczegóły, głos i historia pozostają w osobnym widoku.

Polecenia POST /api/command są chronione tym samym uwierzytelnianiem co status. USB dostępne tylko przez loopback. Do gry trafia wyłącznie lista dozwolonych akcji i atomowy plik command.json w znanym katalogu danych dodatku. Polecenie zawiera identyfikator aktualnej sesji; aplikacja czeka na potwierdzenie gry, nie utożsamia samego przyjęcia przez mostek z wykonaniem.

Fizyczna tablica R&G: zmiana linii/kierunku z OMSI emituje zdarzenie do istniejącego modułu USB-RS485. Automatyczne wysyłanie nadal wymaga podłączonego konwertera i wcześniej potwierdzonego profilu ramki tekstowej. Nie potwierdzono sterowania fizyczną tablicą w tej sesji. Przycisk Tablica R&G otwiera jej ustawienia. W czasie bezpośredniego połączenia konwertera z tabletem połączenie z PC należy zestawić przez Wi-Fi.


## Zegary i strony kamer — 1.4.80 / mostek 0.7
Na głównym ekranie OMSI duży zegar pokazuje czas gry HH:MM:SS (24 h), a mniejszy pod nim czas rzeczywisty tabletu, także 24 h. Czas gry jest brany z każdej aktualizacji telemetrii; zmiany i cofnięcia godziny nie są zastępowane zegarem Androida. Przy utracie danych gry wyświetlane jest „Gra: —”. Potwierdzono oba odczyty na tablecie 9185W; test obejmuje skok z 23:59:58 na 02:03:04.
Odchyłka rozkładu: spóźnienie ma znak minus, przyspieszenie plus, zero bez znaku.
Kamery mają maksymalnie cztery różne ujęcia na stronie i strzałki stron; 5 daje 4+1, 65 daje 17 stron. Testy stron i świeżości obrazu przeszły.

Stan rzeczywistego obrazu: w oddzielnej testowej kompilacji openOMSI potwierdzono czyste lusterko wewnętrzne i prawe oraz cztery odbierane kanały. Poprawki zakłóceń widoku pasażerskiego i czarnego lewego lusterka są w kolejnym buildzie; wymagają ponownego testu. Dla pustej lewej refleksji przewidziano oznaczoną kamerę zewnętrzną lewego boku. Nie jest to jeszcze potwierdzenie pełnej obsługi kamer w standardowym OMSI 2 ze Steam ani wszystkich modeli autobusów.


## LCD z OMSI — 1.4.83
W trybie OMSI istniejący serwer tabletu na porcie 47283 publikuje dane bieżącej gry: linię, kierunek, pełną listę przystanków, aktualny i następny przystanek oraz zegar gry 24 h. Lokalna kursówka RJ nie jest używana jako zastępstwo. Po utracie telemetrii pola kursu są czyszczone. Przejście do następnego przystanku i dojazd do niego uruchamiają odpowiedni ekran LCD na czas ustawiony w konfiguracji; cykl i reklamy pozostają obsługiwane przez istniejący moduł.
Numer linii ma osobne duże pole przed strzałką, z miejscem na cztery cyfry. Kierunek może zajmować dwa duże wiersze. Przy braku numeru pole jest ukrywane. Sprawdzono podgląd 1234 z długim kierunkiem i dwuwierszowym zawijaniem. Testy obejmują przesuwanie trasy, dojazd, koniec trasy, zmianę godziny gry i brak świeżych danych.
Na tablecie z poprzednim buildem 1.4.82 potwierdzono rzeczywisty odczyt LCD: linia 76, Krankenhaus, osiem przystanków i czas OMSI przez endpoint /api/state. W 1.4.83 doprecyzowano oznaczanie przystanku końcowego: samo upłynięcie czasu kursu nie oznacza, że poprzedni przystanek jest końcowy.

Po instalacji 1.4.83 sprawdzono rzeczywisty serwer tabletu: aktywna linia 76, kierunek Bauernhof, aktualny Gaussdorf, następny Elsterplatz i zegar 08:20:39. Strona LCD po odświeżeniu pokazuje duże „76 → BAUERNHOF” oraz bieżącą pozostałą trasę. Zapis podglądu: wydania/1.4.83/lcd-omsi-live.jpg; osobny test układu 1234 z długim kierunkiem: lcd-four-digit-layout-test.jpg. Dane testowe nie były publikowane do rzeczywistej tablicy.
