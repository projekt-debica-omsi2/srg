# Aktualizacje i powrót o jedno wydanie

Aktualizator korzysta z opublikowanych GitHub Releases. Artefakty Actions same nie są widoczne dla starszych aplikacji.

- Normalny APK: `SRGMobile-TestGPS-1.4.97.apk`, pakiet `pl.srgmobile.testgps`, versionCode 1149700.
- Ratunkowy APK: `SRGMobile-TestGPS-previous-1.4.96.apk`, ten sam pakiet i podpis, funkcje ze zrzutu źródeł 1.4.96, versionCode 1149701 i versionName `1.4.97-rollback-1.4.96-testgps`.
- Powrót nie wymaga odinstalowania ani czyszczenia danych. Nie jest obniżeniem versionCode Androida.
- Po powrocie kolejną aktualizacją musi być nowsze wydanie (np. 1.4.98, kod co najmniej 1149800). Zwykły APK 1.4.97 ma niższy kod i nie może zastąpić pakietu ratunkowego.
- Dla kolejnych wydań rezerwuj blok 100 kodów, ratunkowy normalny+1. W praktyce dla 1.4.98 użyj 1149800 i 1149801; przed publikacją sprawdź monotoniczność. Nazwa pliku ratunkowego zawiera wersję funkcjonalną, a versionName zaczyna się numerem wydania, do którego należy mechanizm powrotu.
- W jednym wydaniu publikuj najwyżej jeden poprzedni APK na edycję. Najpierw normalny, potem ratunkowy. Stary aktualizator widzi numer w nazwie pliku i wybierze normalny nowszy APK.
- Nowy aktualizator wybiera powrót tylko z wydania odpowiadającego aktualnie zainstalowanej wersji. Po powrocie nie oferuje go ponownie.
- Każdy pakiet musi być podpisany dokładnie kluczem właściwej edycji. TestGPS używa istniejącego podpisu testowego. Zwykłe wydanie i Public wymagają swojego stałego podpisu publikacyjnego; nie należy publikować ich z losowym kluczem debug.
- Przed zmianami formatu danych sprawdź, czy poprzedni kod nadal potrafi odczytać dane nowego wydania. Sam wyższy versionCode nie zapewnia zgodności baz danych.

Testy wyboru wydań są w ApkUpdatesTest. APK należy dodatkowo sprawdzić `apksigner verify --print-certs` i `aapt dump badging`. Bez urządzenia nie można potwierdzić rzeczywistego działania instalatora ani pełnego zachowania aplikacji po powrocie.
