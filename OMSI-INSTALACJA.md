# Paczka zmian SRG 1.4.69-omsi-test

## Wgraj do GitHuba

To uzupełnienie istniejącego repozytorium `projekt-debica-omsi2/srg`, a nie samodzielny pełny projekt.

1. Rozpakuj ZIP.
2. Skopiuj foldery `app`, `tests`, `omsi-bridge` oraz ukryty folder `.github` do GŁÓWNEGO katalogu lokalnego repozytorium SRG. Scal foldery i zastąp wskazane pliki. Nie usuwaj pozostałych plików repozytorium. Nie kopiuj do BRANDING.
3. W GitHub Desktop przejrzyj zmiany, wykonaj Commit i Push.
4. W Actions powinny uruchomić się dwa procesy:
   - Build SRG Mobile 1.4.69-omsi-test APK;
   - Build OMSI test bridge.
5. Dopiero gdy oba zakończą się powodzeniem, pobierz ich artefakty. Pierwszy zawiera APK. Drugi zawiera folder plugins z DLL/OPL i program SRG-OMSI-Bridge.exe.
6. Instalacja dodatku i USB/Wi-Fi: `omsi-bridge/README-PL.md`.

Stały klucz podpisu korzysta z istniejących sekretów GitHub Actions. Ta paczka NIE zawiera klucza ani hasła. Nie zmieniaj ustawień podpisu.

## Faktyczny stan

Zaimplementowano źródła trybu OMSI, konfigurację połączenia, status komputera i danych z gry,
podgląd czterech zmiennych, historię kontaktu, pasywną wtyczkę x86, mostek Windows i skrypt USB.
Nie wykonano kompilacji Windows/Android w tej sesji. Zapis do GitHuba zwrócił 403.
Nie przeprowadzono testu w OMSI ani na Androidzie.

NIE JEST TO pełna uzgodniona integracja. Nie ma jeszcze rozkładów map/HOF,
pozycji i progu 50 m, generowania/przesyłania zapowiedzi, zapisanej trasy do ręcznej
obsługi ani obrazu kamer/lusterek. Czarne pole oznacza niezaimplementowany odczyt obrazu.
OpenOMSI nie zostało zweryfikowane.

## Wykonane sprawdzenia lokalne

- Testy mostka Python: brak pliku, przeterminowanie danych, uszkodzony JSON, zatrzymana wtyczka;
  odrzucenie żądania bez kodu parowania, poprawna odpowiedź z kodem, odrzucenie innych ścieżek.
- Sprawdzenie składni JavaScript i zabezpieczeń oddzielających zapis zwykłej sesji od trybu OMSI.
- Test interfejsu w przeglądarce NIE został uruchomiony: środowisko nie miało Chromium.
- Test ABI i uruchomienia DLL jest dołączony do procesu Windows, ale nie został tu wykonany.
