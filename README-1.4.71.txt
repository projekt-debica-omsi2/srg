SRG Mobile 1.4.71 — overlay źródeł

Funkcja:
- Ustawienia -> R&G -> „Przechwyć ramki z SRG”
- oryginalny sterownik SRG zostaje podłączony do RS-485
- konwerter USB-RS485 podłączony równolegle tylko nasłuchuje
- START zapisuje porcje RX z czasem dt/t i surowym HEX
- STOP zapisuje plik JSONL do Pobrane/SRG-Captures (folder można zmienić)
- zapis jest zapamiętany lokalnie jako kategoria „linia_dodatkowa”
- nazwa przechwytu może być np. DĘBICA, RZESZÓW DWORZEC LOKALNY
- plik JSONL można później wysłać do analizy

WAŻNE:
Do PRZECHWYTYWANIA sterownik SRG ma być PODŁĄCZONY.
Do ODTWARZANIA przechwytu sterownik SRG ma być ODŁĄCZONY.

GitHub:
Połączenie w tej rozmowie miało odczyt, ale przy próbie zapisu zwróciło HTTP 403,
dlatego ta paczka jest przygotowana jako overlay do repozytorium.
