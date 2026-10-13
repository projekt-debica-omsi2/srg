# SRG Mobile v1.4.28 — zmiany i instalacja

**Baza:** przesłany ZIP `SRG_Mobile_v1.4.26_LCD_V4_1_NUMER_POJAZDU_ZAPOWIEDZI_47283.zip`.
**Zachowane:** 79 MP3 Marka Neural bez podmieniania lektora, wybrana melodia pianina B2–E4–C4, ikona SRG Mobile Dębica, numer pojazdu, kursówki S-25/S-27, 68 punktów GPS, 7 wariantów RJ, port LCD **47283**.

## Główne poprawki

1. Odchyłka czasu z **potwierdzonego przystanku** aktualnego kursu; zmienia się co sekundę. `-` = spóźnienie, `+` = przyspieszenie, `0:00` = dokładnie na czas. Nie cofa się do godziny przystanku początkowego przy braku pełnego mapowania. Brakujące pozycje między potwierdzonymi godzinami w kursach ze zdjęć pokazują `~HH:MM` (szacunek), nie udawaną godzinę oryginalną. Na pozostałych kursach szacunek opiera się o długości segmentów GPS.
2. Klęczany Stadion (23) i Klęczany Szkoła (47): różne współrzędne i kierunki. Wspólna lokalizacja rozkładowa nie oznacza wspólnego punktu GPS ani kopiowania godzin między kierunkami.
3. Po ostatnim przystanku: dwie kolejne pozycje mają `--:-- ====================`. Pole Droga dalej pokazuje metry na ostatnim odcinku, bez `KONIEC TRASY`.
4. DŹWIĘK: duży ekran po prawej stronie stałych ikon. Zakładki Głośnik i Mikrofon (WRG), wybór wbudowany/zewnętrzny, ON/OFF dla WRG, 0–100% i przełącznik ZAPOWIEDZI. Native MP3 respektuje poziom ustawiony przy Głośniku.
5. Kamera przednia lub tylna: przyciski włączania podglądu oraz uprawnienia Android. Tryb domyślny: **jedna kamera na raz**. Android WebView/REVVL Tab 2 musi fizycznie wspierać getUserMedia, co należy przetestować na urządzeniu.
6. LCD 4.1: animacja długiego napisu nie restartuje się co 0,5 s. Czas i data, pełna trasa pobrana z RJ, dynamiczna aktualna/następna nazwa przystanku, reklamy lokalne; bez klucza w URL, bez możliwości sterowania tabletem. Przesiadki odłożone, bo nie ma zweryfikowanego kompletu danych.
7. Kasownik: ON = czerwony X + komunikat kontroli; OFF = usunięcie X **bez komunikatu**.

## GitHub Desktop

Rozpakuj ZIP i skopiuj **zawartość** do katalogu repozytorium, nadpisując istniejące pliki. W GitHub Desktop wpisz np. `SRG Mobile v1.4.28`, kliknij `Commit to main`, potem `Push origin`. Następnie w GitHub Actions pobierz debug APK. **Nie rozpakowuj ZIP-a do dodatkowego katalogu wewnątrz repozytorium.**

## Ważne

- Adres tablicy: `http://192.168.5.105:47283/`, o ile IP hotspotu tabletu nadal wynosi `192.168.5.105`. Nie trzeba aktualizować naklejki QR, dopóki IP się nie zmieni. Port 47283 jest nietypowy, ale **nie stanowi sam w sobie zabezpieczenia** — z serwera może odczytywać każdy klient w tej samej sieci. API nie pozwala sterować SRG.
- Wyjście na dwa różne głośniki Bluetooth jednocześnie **nie jest zagwarantowane**; zależy od routingu audio tabletu/Androida. Wybór Wewn./Zewn. w SRG jest profilem interfejsu, nie sprzętowym przekierowaniem sygnału.
- Uruchomienie mikrofonu WRG powoduje odsłuch na aktualnie wybranym wyjściu audio Androida. Przy zbyt bliskim ustawieniu mikrofonu i głośników może wystąpić głośne sprzężenie. Mikrofon WYŁ. po wyjściu z ekranu.
- **Nie regenerowano MP3:** jeżeli mają zostać zmienione wymowy Nagawczyna 1/2 i Dąbrowa 2, potrzebne są odpowiednie nowe pliki Marka Neural; to osobna poprawka nagrań.
- Przeszło 9 testów Node.js i test widoku kursu/dźwięku na Chromium (bez błędów JavaScript). **Nie ma lokalnie Android SDK**, więc nie twierdzimy, że APK zostało skompilowane lub że kamera/WRG zostały fizycznie wypróbowane.
