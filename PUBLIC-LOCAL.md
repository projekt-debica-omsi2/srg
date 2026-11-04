# SRG Mobile 1.4.87 — Public i Kierowca

Public ma pakiet `pl.srgmobile.publicapp`, Kierowca zachowuje `pl.srgmobile.classic.lcd23` i aktualizuje poprzednie APK. Można zainstalować oba. Każdy ma własne kursówki, ustawienia i zapis. W Public nie ma rozkładów, nagrań, GPS ani przechwytów R&G kierowcy.

## Wpisanie kursówki na telefonie

Menu → następna strona → Ustawienia → Rozkład jazdy / plik RJ → Edytuj kursówki lokalne / TXT. Wpisz tekst, wybierz „Sprawdź i zapisz”. „Wstaw przykład” wypełnia tylko edytor; przykładowa kursówka nie jest aktywna bez zapisania.

```
KURSOWKA | Moja kursówka
KURS | 12 | DN
07:00 | 1 | Dworzec | Kolejowa
07:15 | 2 | Centrum | Rynek
KONIEC
KURS | 12 | DN
07:30 | 3 | Centrum powrót | Rynek
07:45 | 4 | Dworzec powrót | Kolejowa
KONIEC
```

Każda linia przystanku: `HH:MM | ID | nazwa | ulica | szerokość GPS | długość GPS`. Ulica i GPS są opcjonalne; wpisuj obie współrzędne albo żadnej. ID tego samego stanowiska musi oznaczać tę samą nazwę, ulicę i GPS. Przystanek po drugiej stronie drogi może mieć osobny ID. Wszystkie kursy zachowują kolejność w pliku, również przez północ; godziny są dokładnie takie jak wpisane, bez interpolacji.

Można dodać kolejne sekcje KURSOWKA i kolejne KURS. Oznaczenia: CODZIENNIE, DN, SX, SOB, ND. W wyborze kursówki użytkownik wybiera filtr dnia; aplikacja nie zgaduje ferii, świąt ani dni nauki szkolnej. Komentarz zaczyna się od `#`. Limit: 2 MB, 1000 kursów, 500 przystanków w jednym kursie. Sam znak `|` jest separatorem, nie częścią nazwy.

## Notatnik na komputerze

1. W edytorze aplikacji wybierz „Zapisz TXT do pliku”, np. do Dokumentów lub Pobranych.
2. Podłącz telefon przez USB i wybierz przesyłanie plików. Skopiuj TXT na komputer, zmień w Notatniku i zapisz jako UTF-8.
3. Skopiuj TXT z powrotem na telefon. W aplikacji wybierz „Importuj TXT / plik RJ .011”. Wskaż plik i sprawdź kursy.

Aplikacja zachowuje prywatną kopię importu. Zmiana pliku na komputerze wymaga ponownego importu; nie ma automatycznej synchronizacji. Plik tekstowy jest kopią zapasową: odinstalowanie lub wyczyszczenie danych aplikacji usuwa prywatny zapis. Obecnie import zastępuje cały aktywny zestaw, więc łącz kursówki w jednym TXT.

## R&G i głos

Obie wersje importują własny binarny RJ `.011` przez ten sam parser; plik LG nie jest rozkładem. Funkcje dostępne po imporcie zależą od danych w pliku. Nie dopisujemy prywatnego GPS do Public. Dla GPS można wpisać współrzędne w TXT. Edytor nie generuje plików `.011` dla fizycznego sterownika.

Własne kursówki i rozkłady Public korzystają z polskiego głosu offline Androida. Wymaga on zainstalowanego polskiego głosu niewymagającego sieci; nie musi to być Marek. Wersja Kierowca zachowuje dotychczasowe nagrania Marka dla wbudowanego rozkładu.

W Ustawienia → Rozkład jazdy → Zapowiedzi offline wybierz silnik i głos, sprawdź próbkę, następnie wybierz „Generuj dla wczytanego RJ”. Obsługiwane są aplikacje, które rejestrują silnik TTS w Androidzie i udostępniają polski głos oznaczony jako offline; nie każda aplikacja do czytania tekstu udostępnia taki interfejs. Dane głosu trzeba wcześniej zainstalować w aplikacji dostawcy. Samo generowanie w SRG nie używa chmury.

Generator tworzy komunikaty przystanków, następnego przystanku, końcowego i kierunków, deduplikuje jednakowe teksty i zapisuje pliki WAV w prywatnej pamięci aplikacji. Zapisany tekst, silnik i wybrany głos określają nagranie: po zmianie nazwy lub głosu stare nagranie nie zostanie przypisane do nowej nazwy. Odtwarzanie używa gotowego pliku; jeśli jeszcze go nie ma, korzysta z wybranego TTS offline. Tempo jest stałe: 96%. Generuj z aplikacją na ekranie; wyjście do tła przerywa operację. Anulowanie zachowuje gotowe pliki. Ponowienie pomija gotowe nagrania. Limit prywatnej biblioteki wynosi 100 MB.

Wygląd głównego ekranu, kamery, LCD i obsługa kursu są wspólne z wersją Kierowca. Wybór silnika/głosu odbywa się w systemowym oknie, a nowe przyciski są w ustawieniach RJ. Nagrania lokalne i ustawienia głosu pozostają oddzielne w obu APK. Usunięcie danych lub odinstalowanie aplikacji usuwa jej wygenerowane nagrania.

## Wspólne OMSI

Mostek 0.7 i pluginy SRGBridge.dll/SRGBridge.opl/SRGOpenOMSI.lua pozostają wspólne dla obu APK. Nie sprawdzają identyfikatora pakietu APK. Te same ustawienia: USB loopback 8766 bez kodu, Wi-Fi 8765 z kodem. Moduły `omsi.js`, `ibis.js`, `rg-usb.js` i panel LCD są identyczne w obu wydaniach. Silnik kamer openOMSI pozostaje wspólny, z istniejącego udanego builda 41748859912.

Uruchamiaj do obsługi jedną aplikację naraz: oba panele LCD używają portu 47283. Nie potwierdzono nowego wydania w grze ani niezależnych kamer w oryginalnym OMSI 2 Steam; dotychczasowe testy kamer dotyczyły openOMSI, MAN GN92 i Grundorfu.

## Budowanie

Kierowca: `gradle :app:assembleRelease`. Public: `gradle -PsrgPublic=true :app:assembleRelease`. Wymagany ten sam stały podpis co wcześniej. CI tworzy dwa osobne artefakty; kontrola Public odrzuca APK zawierające prywatne RJ lub MP3. Nie kopiuj katalogu z danymi kierowcy do wersji Public.
