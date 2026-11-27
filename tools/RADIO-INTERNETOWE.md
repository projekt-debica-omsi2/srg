# Radio internetowe - 1.4.98

Panel: Dźwięk -> Radio internetowe. Wyszukiwanie w Radio Browser po nazwie, opcjonalnie tylko Polska. Wyniki pochodzą z katalogu, nie są listą przykładowych stacji. Użytkownik uruchamia stację ręcznie. Zapamiętywana jest ostatnia stacja, głośność i poziom ściszenia. Sam start aplikacji nie uruchamia wyszukiwania ani strumienia.

Domyślna głośność radia to 50%, a podczas zapowiedzi pozostaje 10% tego poziomu. Radio ścisza się przed rozpoczęciem komunikatu. Powrót do własnej głośności trwa około 0,5 s. SpeechMix pilnuje całego komunikatu, aby nie podgłaśniać między melodią i kolejnymi MP3. Dotyczy również gotowych nagrań lokalnych WAV i mowy Android TTS. Zakończenie, anulowanie i błędy zwalniają priorytet zapowiedzi.

Radio jest odtwarzane przez Android MediaPlayer w usłudze pierwszoplanowej typu mediaPlayback. Powiadomienie zawiera Zatrzymaj. Wyjście audio korzysta z tej samej zapisanej preferencji co zapowiedzi; wyjście Bluetooth trzeba wcześniej połączyć z Androidem. Zmiana urządzenia w trakcie transmisji może wymagać ponownego włączenia stacji. Odebranie audio przez inne aplikacje/rozmowę może zatrzymać lub wstrzymać odtwarzanie. Odłączenie słuchawek lub Bluetooth zatrzymuje radio, zamiast świadomie uruchamiać głośnik telefonu.

Katalog: https://docs.radio-browser.info/ . Wyszukiwanie korzysta z HTTPS, wykrywania serwerów przez DNS i zapasowego serwera katalogu. Media mogą być HTTP lub HTTPS; konfiguracja sieci Androida dopuszcza HTTP dla rzeczywistych strumieni nadawców. Strumienie wymagają internetu i zużywają transfer. Nie są pobierane na stałe do APK. Kod nie przesyła do katalogu numeru pojazdu ani GPS.

Istotne pliki: InternetRadio.java, InternetRadioService.java, RadioStations.java, SpeechMix.java, internet-radio.js. Public dostaje moduł przez listę dozwolonych zasobów w prepare_public.py. Głosy, rozkłady i dane kierowcy nie są dołączane do Public przez ten moduł.

Weryfikacja: lokalna kompilacja TestGPS i Public oraz testy jednostkowe; testy mieszania i wyboru stacji; rzeczywiste wyszukanie RMF i odbiór 4096 bajtów strumienia MP3 audio/mpeg. Nie wykonano odsłuchu na telefonie, testu rozmowy ani fizycznego zestawu radio Bluetooth + LED - brak urządzenia w tej sesji. Nie każdy format i strumień musi być obsługiwany przez każde urządzenie.

Kanał TestGPS: normalny 1.4.98 kod 1149800; wersja ratunkowa z funkcjami 1.4.97 kod 1149801. Pakiet i istniejący podpis pozostają zgodne. Zwykłe wydanie i Public mają osobne pakiety i są budowane przez CI ze stałym podpisem.
