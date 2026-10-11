# SRG Mobile v1.4.18 — GPS DIAGNOSTYKA

Wersja testowa. Naprawa obsługi przerwania/wznowienia GPS przez systemowe okno uprawnień oraz diagnostyka statusów odbiornika. Android `applicationId`: `pl.srgmobile.classic.gpsfix18`, więc instaluje się **obok** wcześniejszych APK — nie usuwaj v1.3.5.

## Jak zbudować prawdziwy APK

1. Rozpakuj ZIP.
2. Skopiuj **jego zawartość** do istniejącego repozytorium `SRG-Mobile`, zastępując poprzednie pliki. Nie kopiuj osobnego folderu nadrzędnego.
3. GitHub Desktop → commit np. `SRG Mobile v1.4.18 GPS diagnostics` → Push origin.
4. Na GitHub → Actions → Build SRG Mobile GPS APK → po zielonym wyniku pobierz artifact `SRG-Mobile-v1.4.18-GPS-DIAGNOSTYKA-debug`.
5. Rozpakuj pobrany artifact, zainstaluj `app-debug.apk` na Androidzie.

## Test

1. Włącz w Androidzie główny przełącznik **Lokalizacja**, a aplikacji nadaj **Dokładną lokalizację**.
2. Otwórz ustawienia → GPS; użyj **Sprawdź stan** i następnie **Uruchom GPS**.
3. Jeśli pozostanie problem, przepisz **kod z pola `Android GPS:`** i dalszy opis — np. `DISABLED`, `NO_PROVIDER`, `PERMISSION`, `WAITING` albo `ERROR`.
4. Dla `WAITING` odczekaj na otwartej przestrzeni kilka minut. `NO_PROVIDER` oznacza brak sprzętowego GPS_PROVIDER, którego nie da się naprawić samymi uprawnieniami.

GPS w tej wersji jest satelitarny (`GPS_PROVIDER`), nie zastępowany po cichu lokalizacją z sieci. Punkty GPS z RJ zachowano. Nie włączono automatycznej zmiany przystanków, dopóki nie potwierdzimy odbioru pozycji na urządzeniu.

## Zmiany
- Odmowa i oczekiwanie na zgodę lokalizacji mają różne kody.
- Okno uprawnień nie wyłącza natychmiast GPS poprzez `onPause`.
- Powrót do aplikacji przywraca subskrypcję GPS.
- Licznik satelitów nie blokuje GPS, jeśli system nie obsługuje tego wywołania.
- Widok GPS ponownie odczytuje faktyczny stan usługi i udostępnia **Sprawdź stan**.
- Nowy identyfikator Androida zapobiega konfliktowi podpisu z wcześniej instalowanymi eksperymentalnymi APK.
