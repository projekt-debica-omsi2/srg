# SRG Mobile v1.4.25 — Marek Neural + 4 melodie + lokalna tablica LCD

**Projekt źródłowy do zbudowania APK na GitHubie. Nie jest to skompilowany instalator.**

Przygotowany na bazie v1.4.22 (odjazd około +50 m, zapowiedź przy dojeździe, pamięć kursu, 68 współrzędnych GPS, 7 wariantów RJ). Wersja ma osobny identyfikator `pl.srgmobile.classic.lcd23`, więc można ją zainstalować **obok** działającej starszej wersji. Nie odinstalowuj działającej v1.4.19 / v1.4.18.

## 79 MP3 — komplet gotowy, dostarczony przez użytkownika

Nagrania `pl-PL-MarekNeural` zostały wygenerowane w Windows i dostarczone w `audio_generated.zip`, z którego skopiowano do Android `assets/audio` wszystkie **79 oryginalnych plików**, bez generowania na GitHubie: 68 nazw przystanków, 7 startów wariantów i 4 komunikaty (`next`, `inspection`, `terminal`, `na_zadanie`). Komplet chronią SHA256 zapisane w `NAGRANIA_79_SHA256.json`.

Na Windows **nie uruchamiaj ponownie generatora**, jeśli nie zamierzasz zmieniać nazw. `GENERUJ_MP3_MAREK.py` jest zachowany do przyszłych zmian i pomija wszystkie gotowe pliki, gdy pasuje hash tekstu. Plik `.tts_status.json` dołączono do repozytorium. Program na tablecie odtwarza MP3 **całkowicie offline**. Po `Commit` i `Push origin` GitHub Actions zweryfikuje 79 plików i zbuduje APK.

Domyślna melodyjka `audio/chimes/1.mp3` to wybrane przez użytkownika **pianino B2–E4–C4**, 2,69 sekundy. Pozostałe 3 warianty pozostają jako opcjonalne w ustawieniach. W słownych nagraniach nazwy typu „Świlcza Nowy Dwór 71 N.Ż.” są odczytywane bez numeru i końcówki N.Ż.; osobne `na_zadanie.mp3` jest dołączane przy takim przystanku po nazwie. Na ekranie tabletowym i LCD pełna nazwa i numer pozostają.

## Zapowiedzi i przyciski

- **Początek kursu:** melodia + „Przystanek początkowy: [pierwszy]. Kierunek: [ostatni]”.
- **Około 50 m po odjeździe** (według GPS v1.4.22): melodia + „Następny przystanek” + nazwa następnego przystanku. Ekran kursu przełącza się na kolejny.
- **Zbliżanie się / dojazd** do przystanku (strefa GPS około 40–85 m, dwa pomiary): melodia + sama nazwa przystanku. Nie powtarza się na postoju.
- **Ostatni przystanek:** melodia + „Następny przystanek” + nazwa końcowego + „Przystanek końcowy”.
- **Kasownik po lewej:** melodia + „Kontrola biletów”. Nie zmienia stanu kasownika.
- **Kliknięcie zielonego paska przystanku obok godziny:** melodia + nazwa aktualnie wyświetlanego przystanku, bez zmiany przystanku.
- W **Ustawienia → GPS** znajdują się 4 przyciski do wybrania i przetestowania melodii.

Pierwsza melodia to krótkie pianino B2–E4–C4 wybrane przez użytkownika; pozostałe są opcjonalne, nie są oryginalnymi nagraniami R&G. Wskaźnik GPS i licznik kursu pozostają na tablecie. Ograniczona dokładność satelitarna oznacza, że progi 50 m są przybliżone.

## Tablica wewnętrzna SRG LCD — podgląd z filmu

To **dodatkowy ekran HTML** dla pasażerów, a nie modyfikacja oryginalnej zewnętrznej tablicy R&G 24 V.

1. Zainstaluj zbudowane APK v1.4.25 na tablecie REVVL Tab 2.
2. Połącz tablet i urządzenie z ekranem LCD z **tym samym prywatnym Wi-Fi**, bez izolacji klientów.
3. Uruchom SRG Mobile, wybierz kurs, włącz GPS.
4. W `Ustawienia → GPS` odczytaj adres, np. `http://192.168.1.123:47283/?key=12345678` (to tylko przykład; użyj **swojego** adresu i kodu).
5. Otwórz ten adres w przeglądarce urządzenia z LCD. Tablica będzie pobierała numer linii, kierunek, aktualny i kolejne przystanki co 1,7 sekundy.
6. Aby **ukryć pasek adresu** w Chrome na komputerze naciśnij `F11`, albo kliknij subtelny przycisk `⛶` w prawym dolnym rogu. Na Androidzie można użyć trybu pełnoekranowego przeglądarki / instalacji strony na ekran główny (zależnie od przeglądarki). Sama zwykła strona HTML nie może na stałe wymusić schowania pasków systemowych.
7. Ekran `app/src/main/assets/lcd.html` możesz otworzyć na komputerze **osobno** jako demonstrację wyglądu — zobaczysz znacznik DEMO. Nie wysyła wtedy danych GPS.

**Uwaga:** `localhost` na drugim urządzeniu oznacza to **drugie** urządzenie, dlatego do tablicy trzeba użyć IP tabletu, nie `127.0.0.1`. Tablet posiada lokalny serwer HTTP na porcie `47283` (bez osobnego Windows Server). Połączenie chronione jest 8-cyfrowym kodem w adresie, ale **lokalny HTTP nie jest szyfrowany**: używaj wyłącznie prywatnego, zaufanego Wi-Fi; nie przekierowuj portu `47283` na publiczny internet. Do tablicy przekazywane są wyłącznie informacje pasażerskie, **bez współrzędnych GPS** i danych kierowcy.

## Testy projektu

```text
node tests/test-auto-gps.cjs
node tests/test-voice-gps.cjs
node tests/test-lcd-and-rj.cjs
node tests/test-photo-timetables.cjs
node tests/test-nz-audio.cjs
python GENERUJ_MP3_MAREK.py --dry-run  # pliki gotowe, to tylko podgląd tekstów
node tests/test-marek-generated.cjs  # weryfikuje otrzymane 79 MP3
```

Testy logiki GPS są komputerowe. **Aplikacja v1.4.25 i serwer LCD nie były jeszcze uruchomione na prawdziwym tablecie ani skompilowane z użyciem GitHub Actions**. Ich działanie trzeba potwierdzić na urządzeniach, a szczególnie prawidłowy adres Wi-Fi, dźwięk przycisków i odtwarzanie MP3.


## Aktualizacja 1.4.24 — rozkłady S-25 i S-27 ze zdjęć

- S-25 kurs 1, Dębica 16:00 → Rzeszów 17:20, wariant RJ 0.
- S-27 kurs 6 (ostatni), Rzeszów 14:20 → Dębica 15:45, wariant RJ 1.
- W tych dwóch kursach aplikacja pokazuje godziny sfotografowane, nie interpolowane; przy niedopasowanych do RJ przystankach pokazuje `--:--`.
- Pełne 64 godziny źródłowe: `KURSOWKI_FOTO_1600_1420.csv` i `.json`; poprawki nazw dopisuje się po ich potwierdzeniu.

## Aktualizacja 1.4.25 — audio z ZIP użytkownika

- Zachowano S-25 16:00–17:20 i S-27 14:20–15:45 z v1.4.24, wraz z brakującymi mapowaniami oznaczonymi `--:--`.
- Wgrano 79 prawdziwych MP3 do `app/src/main/assets/audio`; już nie potrzeba generowania na Windows ani w GitHub Actions.
- Zapowiedzi „Na żądanie” dołączane osobno zarówno po frazie „Następny przystanek”, jak i przy ogłoszeniu dojazdu oraz ręcznym ogłoszeniu nazwy.
- Port wewnętrznej tablicy Android poprawiono z 8765 na **47283**; 8-cyfrowy kod parowania pozostaje.
- **UWAGA:** projekt 1.4.25 nadal używa wcześniejszego prostego widoku tablicy LCD z 1.4.24. Pełny osobny prototyp LCD v4.1 (reklamy/przesiadki) nie został jeszcze zintegrowany z Androidem. Nie przedstawiać go jako gotowego elementu APK.
- Kompilacja APK i test na tablecie nadal wymagane.
