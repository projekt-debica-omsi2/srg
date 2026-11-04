# Niezależne kamery openOMSI — eksperyment

Patch do przypiętej wersji źródeł openOMSI, GPL-3.0. Nie zastępuje standardowego wydania gry.
Nie przełącza kamery kierowcy. Osobny mały render widoku pasażerskiego lub lusterek, maksymalnie 4 klatki/s dla wybranego kanału. Brak odpowiedniej kamery w modelu daje jawną informację zamiast obrazu zastępczego.
Odbiorca musi odnawiać lokalny plik camera-request.json w LOCALAPPDATA/SRG-OMSI; po 2 sekundach bez żądania dodatkowe renderowanie ustaje. Kodowanie JPEG pracuje na pojedynczej ograniczonej kolejce.
Wymagane: kompilacja CI i test prawdziwego obrazu, orientacji lusterek, zachowania widoku kierowcy oraz wpływu na FPS. Na tym etapie nie potwierdzono działania.

Źródła i licencja: https://github.com/openOMSI-org/openOMSI/tree/c24a86d0a79f2fb377212d96c0181d7beca9e16d
