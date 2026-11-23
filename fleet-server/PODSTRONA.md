# Przyszłe uruchomienie pod podścieżką

Obecna instalacja i port8790 pozostają bez migracji.

Frontend używa względnych adresów zasobów i API, więc może działać np. pod `/srg/`. Przyszły reverse proxy musi przekazywać ten katalog do obecnego serwera z usuniętym prefiksem `/srg/` i zachować nagłówki Host/Origin. Adres sterownika należy wtedy ustawić na pełny adres z prefiksem, np. `https://twoja-domena/srg`.

Nie zmieniaj teraz DNS, certyfikatów ani konfiguracji istniejącej strony. Zmiana ścieżki nie wymaga przenoszenia bazy SQL lub zwalniania numerów taborowych.

Aktualizator APK korzysta z gotowych plików APK w GitHub Releases repozytorium `projekt-debica-omsi2/srg`. Nazwa pliku musi rozróżniać SRGMobile, Public i TestGPS oraz zawierać wersję, np. `SRGMobile-1.4.93.apk`, `SRGMobile-Public-1.4.93.apk`, `SRGMobile-TestGPS-1.4.93.apk`. Nie korzysta z plików ZIP z artefaktami Actions. Instalacja zachowująca dane wymaga tej samej nazwy pakietu i zgodnego podpisu. Publikacja nowego APK do repo wymaga potwierdzenia użytkownika.
