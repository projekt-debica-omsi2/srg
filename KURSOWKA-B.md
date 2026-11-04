# Kursówka B

Nowa kursówka zwykłego trybu, dostępna na liście kursówek oraz jako cztery osobne kursy. Nazwa robocza B może zostać później zmieniona. Dane godzinowe: wiadomość użytkownika z 2026-11-03.

| Kurs | Początek | Odjazd | Koniec | Przyjazd | Oznaczenie |
|---|---|---|---|---|---|
| 1 | Ropczyce Dworzec Autobusowy | 07:10 | Brzeziny Berdechów | 07:40 | DN |
| 2 | Brzeziny Berdechów | 07:40 | Ropczyce Mickiewicza | 08:30 | DN |
| 3 | Ropczyce Mickiewicza | 13:18 | Brzeziny Berdechów | 14:05 | SX |
| 4 | Brzeziny Berdechów | 14:05 | Ropczyce Dworzec Autobusowy | 14:50 | SX |

DN: od poniedziałku do piątku, oprócz świąt. SX: wyłącznie dni nauki szkolnej. Oznaczenia widoczne przy wyborze kursu; pozostaje dotychczasowy ręczny wybór kursówki.

Pełna kursówka korzysta z dotychczasowego mechanizmu zatwierdzania końca kursu i przejścia do następnego. Wybór osobnego kursu nie uruchamia kolejnych kursów automatycznie. Pomiędzy kursem 2 i 3 jest przerwa 08:30–13:20 na Mickiewicza.

Przystanki pośrednie pochodzą z wcześniej podanej przez użytkownika trasy przez Chechły, Okonin, Łączki Kucharskie, Broniszów, Glinik, Wielopole Skrzyńskie i Brzeziny. Dworzec i Mickiewicza są odrębnymi przystankami. Berdechów pozostaje częścią nazwy jednego przystanku końcowego. Nie dodano niepotwierdzonych godzin pośrednich, numeru linii ani współrzędnych GPS. Numery słupków pośrednich zachowano zgodnie z wcześniejszą listą.

Sprawdzenie: test-v1429.cjs obejmuje godziny, oznaczenia, końce tras, osobne wpisy, kolejność przejść i brak powielania wariantów. Przeszły regresje kursówek fotograficznych, S-27, LCD/RJ, odchyłki i cztery testy OMSI. Zmiana źródeł nie oznacza instalacji nowego APK na tablecie.

Doprecyzowanie ID: do Brzezin Mickiewicza 55 i Dworzec 56; z Brzezin Mickiewicza 15 i Dworzec 14. Są to istniejące kierunkowe rekordy z bazy v12. Nowe nazwy: 3-Maja Chechły 1/2/3, Brzeziny Berdechów 1 03 (Nowa Wieś), Wielopole Skrzyńskie 1 02.

Potwierdzenie użytkownika: szkolny kurs 3 SX zaczyna się na Mickiewicza o 13:18 i odjeżdża z Dworca Autobusowego o 13:20. To jeden kurs; godzina na dworcu jest dokładna.

Zdjęcie użytkownika: 3-Maja Chechły 1, kierunek Brzeziny Berdechów: kurs 1 DN 07:13; kurs 3 SX 13:23. Dodano wyłącznie te dwie godziny; pozostałe kierunki ze zdjęcia pominięto.

Zdjęcie użytkownika: Broniszów, kierunek Brzeziny Berdechów: kurs 1 DN 07:29; kurs 3 SX 13:39. Pozostałe godziny ze zdjęcia pominięto zgodnie z wyborem użytkownika.

Brzeziny Klub: do Berdechowa kurs 3 13:58; powrót do Mickiewicza kurs 2 07:46; powrót do Ropczyc kurs 4 14:11. Zdjęcie zawiera też 07:48 do Berdechowa: nie przypisano do kursu 1, bo koliduje z przyjazdem 07:40. Użytkownik potwierdził pozostawienie 07:48 poza Kursówką B.

GPS: użytkownik zatwierdził wszystkie 46 pozycji (38 przesuniętych i 8 bez przesunięcia). Wpisano współrzędne do routeStops wszystkich czterech kursów; gpsVerified=true. Rozdzielono 15 nowych ID stron drogi (96–110), zachowując wspólne ID w kursach tego samego kierunku i istniejące 14/15/55/56. Baza natywna v14 ma 110 przystanków, 11 wariantów i 279 pozycji tras; odczyt kontrolny GPS przeszedł. Nie wykonano nowego eksportu .011 ani instalacji APK.

AutoEdit v16: ulice/miejscowości wszystkich przystanków B są uzupełnione w rejestrze ulic, ID_STREET oraz rekordach trasy; analogicznie w kodzie aplikacji. Siedem starszych wariantów i cztery B pozostają w jednym projekcie.
