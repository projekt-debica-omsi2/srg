SRG Mobile 1.4.73 — AUTO diagnostyka odbioru R&G

Co robi:
- automatycznie przechodzi do kolejnej konfiguracji, jeżeli licznik RX nie rośnie,
- zatrzymuje się natychmiast, gdy znajdzie odbiór,
- testuje CALLBACK i RAW port.read(),
- testuje wszystkie 4 kombinacje DTR/RTS,
- czyści bufor RX przed próbą,
- pokazuje licznik bajtów, porcji, błędów, ostatni RX,
- zapisuje działające DTR/RTS i tryb RX w przechwycie JSONL.

Tryb podstawowy:
9600 / 8N1 × CALLBACK/RAW × DTR ON/OFF × RTS ON/OFF = 8 prób.

Tryb ROZSZERZONY:
dodatkowo 4800, 19200, 38400, parity NONE/EVEN/ODD oraz 1/2 stop.
To jest dużo kombinacji i może trwać długo. Niczego nie nadaje na RS-485 podczas auto diagnozy.

Jak testować:
1. Oryginalny SRG podłączony i normalnie steruje tablicą.
2. Konwerter równolegle do A/B.
3. Połącz USB w aplikacji.
4. START AUTO DIAGNOZA.
5. Przez cały test zmieniaj kierunki / ekrany na oryginalnym SRG, żeby był ruch.
6. Jeśli aplikacja wykryje bajty, zatrzyma się sama.
7. Wtedy uruchom przechwytywanie kierunku i wyślij JSONL.

UWAGA:
Auto diagnostyka tylko nasłuchuje. Nie uruchamiaj replay podczas podłączonego oryginalnego sterownika.
