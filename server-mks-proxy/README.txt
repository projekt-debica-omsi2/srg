Proxy MKS do wersji 1.4.59
1. Na hostingu z PHP 8.1 lub nowszym umieść oba pliki PHP w tym samym katalogu. PHP wymaga dostępu wychodzącego do rj.mks.debica.pl i możliwości zapisu katalogu cache.
2. Użyj adresu HTTPS pliku mybus-hub-api.php w aplikacji: Ustawienia -> Aktualizacja rozkładów -> Proxy MKS -> Zapisz proxy MKS.
3. Aplikacja dopisuje ?city=DEBIC&action=schedule, gdy adres nie ma parametrów. Pełny adres z tymi parametrami też jest obsługiwany.
4. Tablet łączy się z proxy tylko przez Wi-Fi. Proxy wykonuje protokół MKS po stronie hostingu i oddaje bazę binarną; nie używaj mks-api-bridge.php obsługującego wyłącznie PingService/GetVehicles do pobierania rozkładu.
5. W przesłanym hubie pamięć podręczna bazy ma 12 godzin. Aplikacja sprawdza źródło co 6 godzin. Przy błędzie serwera hub może zwrócić poprzednią kopię, a nie nowy rozkład.
Pliki pochodzą z przesłanej paczki, nie są uruchomione ani wdrożone przez asystenta. Nie wykonano testu na żywym hostingu — adres hostingu nie został podany.
Pobranie bazy nie oznacza jeszcze podmiany godzin MKS: parser oryginalnej bazy binarnej pozostaje do dokończenia po uzyskaniu próbki. Przycisk Zapisz pobraną bazę MKS pozwala ją przekazać.

Aktualizacja 1.4.60: znaleziono istniejące wdrożenie pod http://xn--e-dbica-c9a.pl:8088/mybus-hub-api.php?city=DEBIC&action=schedule (e-dębica.pl z ę). HTTP 200, pobrano poprawny gzip. Ten adres jest teraz domyślny; wyjątek HTTP ograniczony do tej domeny i portu w walidacji aplikacji. Nie wdrażano nowych plików na serwerze.

Wersja 1.4.61: parser SQLite jest już zaimplementowany. Aplikacja odczytuje KALENDARZ, ODJAZDY, KIERUNKI i UWAGI; wcześniejsze informacje o braku parsera dotyczą wyłącznie wersji 1.4.59–1.4.60.
