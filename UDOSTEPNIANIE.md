# Udostępnianie SRGMobile

Repozytorium projekt-debica-omsi2/srg jest publiczne. Aktualne zmiany OMSI są na gałęzi codex/omsi-usb-wifi-1.4.74; nie zostały scalone z main.

## Dla użytkownika
Najwygodniej przygotować GitHub Release zawierający:
- SRGMobile.apk — podpisany tym samym stałym kluczem co poprzednie wydania.
- SRG-OMSI-Windows.zip — mostek, wtyczki DLL/OPL/Lua, USB.cmd oraz krótka instrukcja.
- Instrukcję: instalacja na Androidzie, instalacja wtyczki, USB i Wi-Fi z kodem 4-cyfrowym.
- Numer wersji, sprawdzony zakres działania, znane ograniczenia i sumy SHA-256.

Po publikacji wydania można wysłać jeden link do jego strony w Releases. Nie trzeba dawać użytkownikowi dostępu do budowania ani sekretów repozytorium.
Dokumentacja GitHub: https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases

## Dla programisty
Można wysłać link do repozytorium i konkretnej gałęzi/commita. Osobę współpracującą można później dodać do repozytorium z odpowiednim dostępem. Samo pobieranie publicznego kodu nie wymaga uprawnień do jego modyfikowania.
Przed formalnym udostępnieniem SRGMobile jako open source trzeba ustalić licencję własnego projektu; w sprawdzonych plikach nie znaleziono głównego pliku LICENSE dla SRGMobile.

## Testowe kamery openOMSI
Zmodyfikowane openOMSI należy pakować osobno, jako wydanie testowe, razem z licencją i odpowiadającymi źródłami oraz poprawkami i instrukcją budowania. Nie dodawać płatnych map, autobusów ani plików bazowej gry OMSI 2. Odbiorca korzysta ze swojej instalacji gry i własnych dodatków.
Źródła silnika: https://github.com/openOMSI-org/openOMSI
Wersja bazowa i patch: engine-camera/ w tym repozytorium.
Nie opisywać kamer jako działających przed kompilacją i testem prawdziwego obrazu.

## Co zostaje prywatne
Klucz podpisu APK i hasło zostają w dotychczasowym bezpiecznym miejscu/GitHub Secrets; nie w paczce dla użytkownika. Zachowanie tego samego podpisu pozwala instalować aktualizacje bez odinstalowywania aplikacji.

Status: przygotowano instrukcję udostępniania. Nie utworzono ani nie opublikowano GitHub Release w tej sesji.
