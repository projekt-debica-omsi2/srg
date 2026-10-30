SRG Mobile 1.4.72 — diagnostyka RX

Nowości:
- licznik BAJTY RX
- licznik PORCJE RX
- licznik BŁĘDY RX
- czas OSTATNI RX
- stan PORT OTWARTY/ZAMKNIĘTY
- tryb CALLBACK / RAW POLL
- przycisk WŁĄCZ RAW RX
- RAW RX używa bezpośrednio port.read(..., 250 ms)
- przechwyty JSONL zapisują, czy dane były odebrane przez callback czy raw-poll

Test:
1. Oryginalny SRG PODŁĄCZONY do magistrali.
2. Konwerter równolegle do A/B.
3. W aplikacji połącz 9600 8N1.
4. Najpierw obserwuj BAJTY RX w CALLBACK.
5. Jeśli 0, kliknij WŁĄCZ RAW RX.
6. Zmień kilka kierunków na SRG.
7. Jeśli licznik ruszy — START przechwytywania, potem STOP i zapisz.
8. Wyślij plik JSONL.

Do odtwarzania ramek oryginalny sterownik odłączamy.
