# SRGMobile — wspólna paczka komputerowa OMSI 0.8

Ta sama paczka obsługuje **SRGMobile** i **SRGMobile Public**. APK instalujesz na Androidzie; tę paczkę rozpakowujesz na Windows. Instalacja nie uruchamia gry ani mostka. Nie zawiera map, autobusów, zapisów ani rozkładów autora. Zachowuje oryginalny Omsi.exe i robi kopie zmienianych pluginów.

## Wymagania i rzeczywisty zakres

- Windows **x64**, Windows 10 1809 lub nowszy / Windows 11, PowerShell 5.1 lub 7. Windows 32-bit, ARM64, Linux i macOS nie są obsługiwane przez ten instalator.
- Własna działająca instalacja OMSI 2 z `Omsi.exe`, `maps` i `Vehicles`, np. ze Steam. Gry nie ma w tej paczce.
- Tryb **openOMSI** używa osobnego testowego silnika 0.3.45 z kamerami SRG. Pobiera ok. 67 MB oficjalnych bibliotek przypiętego openOMSI; instalator sprawdza SHA256 całego archiwum i architekturę DLL. Nie pobiera najnowszego losowego wydania. Jeśli pobieranie jest niedostępne, instalacja kończy się błędem zamiast uruchamiać niekompletną grę.
- Potrzebny jest działający sterownik karty graficznej obsługujący renderer openOMSI (Vulkan/DirectX 12; dostępność pozostałych backendów zależy od silnika). Sama obecność bibliotek nie potwierdza zgodności GPU. Nie obiecujemy działania na każdym komputerze.
- Tryb **Steam** instaluje plugin x86 i uruchamia oryginalny Omsi.exe. Nie dodaje niezależnych kamer do oryginalnego OMSI 2. Pełniejsza obsługa rozkładu i kamer dotyczy openOMSI.

## Instalacja

1. Rozpakuj cały ZIP do osobnego zapisywalnego folderu, np. `Dokumenty\SRG-OMSI-PC`. Nie uruchamiaj z podglądu ZIP. Nie rozpakowuj całej paczki do folderu gry.
2. Zamknij samodzielnie OMSI i zapisz swój postęp. Uruchom `INSTALUJ.cmd`. Domyślnie wybierany jest openOMSI.
3. Wykrywanie sprawdza Steam i jego dodatkowe biblioteki, także na innym dysku. Jeśli znajdzie kilka instalacji albo żadnej, wpisz właściwy folder. Możesz też podać go jawnie:

```bat
INSTALUJ.cmd -OmsiRoot "D:\SteamLibrary\steamapps\common\OMSI 2"
```

Oryginalne OMSI bez niezależnych kamer:

```bat
INSTALUJ.cmd -Mode Steam -OmsiRoot "D:\Gry\OMSI 2"
```

Kontrola bez instalowania, pobierania i uruchamiania:

```bat
INSTALUJ.cmd -CheckOnly -OmsiRoot "D:\Gry\OMSI 2"
```

Oficjalny ZIP bibliotek możesz przenieść z innego komputera; sprawdzany jest ten sam przypięty hash:

```bat
INSTALUJ.cmd -OmsiRoot "D:\Gry\OMSI 2" -RuntimeArchive "D:\Pobrane\openOMSI-0.3.45-windows-x64.zip"
```

Jeśli system odmówi zapisania trzech pluginów w folderze gry, uruchom `INSTALUJ.cmd` jako administrator. Instalator sam nie podnosi uprawnień i nie zmienia zabezpieczeń folderu. Nie wyłączaj antywirusa ani Zapory. Pliki `.cmd` uruchamiają dołączony skrypt PowerShell z polityką wykonywania ustawioną tylko dla tego procesu; nie zmieniają polityki systemowej.

## Uruchomienie i Wi-Fi

1. `URUCHOM-MOSTEK.cmd` uruchamia mostek w tle i pokazuje jego lokalny log z adresem IPv4 i czterocyfrowym kodem.
2. PC i Android muszą być w tej samej zaufanej sieci (PC może mieć Ethernet). W aplikacji włącz OMSI, wybierz Wi-Fi, wpisz adres PC i kod. Port: TCP 8765.
3. Jeśli Windows pokaże pytanie Zapory, dostęp jest potrzebny tylko w **sieci prywatnej**. Instalator nie tworzy automatycznie reguł i nie otwiera portów w routerze. Sieć gościnna może blokować urządzenia.
4. `URUCHOM-GRE.cmd` uruchamia tryb wybrany podczas instalacji. Nie otwiera drugiej sesji gry. Najpierw sprawdź podstawowy MAN GN92 / Grundorf; wybierz mapę, autobus i kurs w grze.

Do zakończenia mostka użyj Menedżera zadań i procesu `SRG-OMSI-Bridge.exe`. Nie zabijaj procesu gry, aby zatrzymać mostek. Stary mostek na tych samych portach trzeba zakończyć przed nowym uruchomieniem; program nie kończy innych procesów automatycznie.

## USB — dowolny telefon lub tablet

Wymagane są oficjalne **Android SDK Platform Tools**: https://developer.android.com/tools/releases/platform-tools . Pobierz i zainstaluj je zgodnie z warunkami dostawcy. Nie są dołączane do tego ZIP. ADB wykrywany jest z PATH, ANDROID_HOME, ANDROID_SDK_ROOT lub standardowego folderu Android SDK w profilu aktualnego użytkownika.

Na Androidzie włącz opcje programistyczne i debugowanie USB, podłącz kabel danych, odblokuj ekran i ręcznie zatwierdź zaufanie do tego PC. W razie potrzeby zainstaluj sterownik USB producenta urządzenia. Uruchom `USB.cmd`, a w aplikacji wybierz USB. Port loopback: 8766, bez kodu. Tunel trzeba odtworzyć po ponownym podłączeniu telefonu.

Jawna lokalizacja ADB i wybór urządzenia:

```bat
USB.cmd -AdbPath "D:\Android\platform-tools\adb.exe"
USB.cmd -Serial NUMER_Z_ADB_DEVICES
```

Przy więcej niż jednym urządzeniu program prosi o wybór zamiast sterować przypadkowym telefonem. Numery seryjne nie są zapisane w paczce. Nie odblokowuje telefonu ani nie zatwierdza komunikatu zaufania za użytkownika.

## Diagnostyka, aktualizacja i kopie

`DIAGNOSTYKA.cmd` zapisuje lokalny raport w `logs\diagnostyka.json`: system, GPU/sterownik (jeśli Windows pozwoli odczytać), folder gry, ADB i proces mostka. To nie jest test renderowania. Folder `logs` zawiera też logi uruchomień. Raporty zawierają ścieżki użytkownika, a log mostka również jego kod parowania — przed udostępnieniem trzeba je przejrzeć.

`config.json`, `logs`, `downloads`, `engine-runtime` i `backups` są tworzone na danym komputerze; **nie wysyłaj znajomym swojego zainstalowanego folderu**. Wyślij oryginalny czysty ZIP wydania. Po przeniesieniu gry lub folderu paczki uruchom instalację ponownie.

Przed zmianą istniejących `SRGBridge.dll`, `SRGBridge.opl`, `SRGOpenOMSI.lua` ich poprzednie wersje trafiają do `backups\plugins-...`. Identyczne pliki nie są nadpisywane. Przy zamkniętej grze można ręcznie przywrócić tylko te trzy pliki z kopii. Instalator nie usuwa pluginów innych autorów ani danych gry. Aktualizuj przez rozpakowanie nowego czystego ZIP do nowego folderu, konfigurację i kontrolę; zachowaj poprzedni folder do czasu testu.

## Kamery i ograniczenia

Wspólny silnik kamer pochodzi z przypiętego kodu openOMSI i patcha SRG. Dotychczas potwierdzono cztery różne obrazy jednocześnie na **MAN GN92 / Grundorf w openOMSI**, z ograniczonym odświeżaniem około 1 klatki/s na kanał. Nie wszystkie autobusy mają te same lusterka/kamery. Nie ma potwierdzenia wszystkich map, pojazdów i sterowników GPU.

Pakiet 0.8 naprawia przenośność: własne biblioteki runtime, dowolną bibliotekę Steam, ścieżkę komend pluginu, brak numeru telefonu wpisanego na sztywno i diagnostykę. Testy instalatora nie zastępują testu gry na komputerze odbiorcy. SRGMobile i SRGMobile Public używają tego samego protokołu. Uruchamiaj jeden panel aplikacji naraz, gdy korzystasz z LCD na porcie 47283.

Źródła/wersje: `SOURCES.md`, `runtime-source.json`, `payload-sha256.json`. openOMSI: https://github.com/openOMSI-org/openOMSI/releases/tag/v0.3.45 . Licencja silnika: GPL-3.0, dołączony patch i przypięta rewizja; upstream zawiera pełne źródła. Biblioteki są pobierane przez użytkownika z oficjalnej paczki, nie kopiowane z komputera autora.
