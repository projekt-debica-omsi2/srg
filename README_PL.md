# SRG Mobile v1.4.19 — AUTO PRZYSTANKI GPS

Wersja testowa: automatyczne przełączanie przystanków w aktywnym kursie na podstawie GPS Android. Bazą jest działająca na tablecie v1.4.18. Moduł Android LocationManager pozostał bez zmian.

## Co robi
- Funkcja **AUTO PRZYSTANKI: WŁ.** jest domyślnie włączona (stan zapisywany lokalnie, można ją wyłączyć na ekranie Ustawienia → GPS).
- Po wybraniu kursu korzysta z kolejności przystanków WŁAŚCIWEGO WARIANTU RJ i 68 lokalizacji GPS zapisanych w aplikacji.
- Przełącza **jedynie na kolejny** przystanek, gdy trzy osobne odczyty przez co najmniej 2,2 s potwierdzą wejście w strefę do ok. 65 m, z dokładnością GPS nie gorszą niż 65 m. Tablet musi znajdować się bliżej następnego niż bieżącego przystanku.
- Zabezpieczenie: min. 5 s pomiędzy zmianami, brak przełączania przy ręcznym podglądzie, bez cofania i bez automatycznego kończenia kursu.
- Ręczna zmiana przyciskami i ✓ nadal działa; AUTO GPS kontynuuje od ustawionego ręcznie przystanku.
- Przejrzysty stan działania na ekranie GPS, mała etykieta AUTO GPS na ekranie KURS.
- Jeśli wczytasz zewnętrzny RJ bez przypisanych koordynatów, przełączanie automatyczne jest wstrzymane, a nie zgadywane.

## Instalacja i budowanie
1. Rozpakuj ZIP w folderze repozytorium **srg**. Skopiuj zawartość (nie katalog nadrzędny) z zastąpieniem wcześniejszych plików.
2. GitHub Desktop → Commit to main → Push origin.
3. GitHub → Actions → kompilacja `Build SRG Mobile GPS APK`.
4. Pobierz plik z sekcji Artifacts (ZIP) i z niego `app-debug.apk`.
5. Zainstaluj APK na tablecie. Pakiet `pl.srgmobile.classic.autogps19` instaluje się obok v1.4.18.

## Test w trasie (bezpieczeństwo)
Po uruchomieniu kursu sprawdź, czy GPS pokazuje pozycję i otwórz Ustawienia → GPS: `AUTO PRZYSTANKI: WŁ.`. Gdy zbliżysz się do **następnego** przystanku, powinien sam zmienić pozycję licznika na ekranie KURS. Nie powinien przeskoczyć kilku przystanków ani przełączyć na sąsiedni kierunek. Przy niepoprawnych współrzędnych wyłącz AUTO GPS i popraw przystanek ręcznie.

**Ważne:** współrzędne 68 przystanków pochodzą z wcześniej zebranych danych, `gpsVerified=false`. Nie wszystkie przystanki ani punkty pośrednie zostały zweryfikowane w jeździe; automatyka jest eksperymentalna i nie służy do obsługi informacji pasażerskiej bez kontroli kierowcy.

## Kontrola testowa
Algorytm w `app/src/main/assets/auto-gps.js` jest oddzielny od odbiornika GPS (Java) i może być testowany w Node.js (`node tests/test-auto-gps.cjs`). Nie dodawano dostępu do Internetu.
