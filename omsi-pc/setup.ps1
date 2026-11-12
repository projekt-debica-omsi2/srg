[CmdletBinding()]
param([string]$OmsiRoot,[ValidateSet('Steam','openOMSI')][string]$Mode='openOMSI',[string]$RuntimeArchive,[string]$AdbPath,[switch]$CheckOnly)
. (Join-Path $PSScriptRoot 'common.ps1')
try {
    if (![Environment]::Is64BitOperatingSystem -or ![Environment]::Is64BitProcess) { throw 'Wymagany Windows x64 i 64-bitowy PowerShell. Systemy ARM64/32-bit nie sa obslugiwane przez te paczke.' }
    $architecture=[Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    if ($architecture -ne 'X64') { throw "Ta paczka wymaga Windows x64; wykryto $architecture." }
    if ([Environment]::OSVersion.Version.Build -lt 17763) { throw 'Wymagany Windows 10 1809 lub nowszy / Windows 11.' }
    Assert-Payload $PSScriptRoot
    $game=Resolve-GameRoot $OmsiRoot
    if ($Mode -eq 'Steam' -and !(Test-Path -LiteralPath (Join-Path $game 'Omsi.exe'))) { throw 'Tryb Steam wymaga Omsi.exe. Dla folderu openOMSI wybierz -Mode openOMSI.' }
    if (Test-Path -LiteralPath (Join-Path $game 'Omsi.exe')) { Assert-PeMachine (Join-Path $game 'Omsi.exe') 0x14c }
    Assert-PeMachine (Join-Path $PSScriptRoot 'bridge\plugins\SRGBridge.dll') 0x14c
    Assert-PeMachine (Join-Path $PSScriptRoot 'bridge\SRG-OMSI-Bridge.exe') 0x14c
    Assert-PeMachine (Join-Path $PSScriptRoot 'engine\openomsi-srg-camera.exe') 0x8664
    $adb=Find-Adb $AdbPath
    Write-Host "OMSI: $game`nTryb: $Mode`nADB: $adb"
    if ($CheckOnly) { Write-Host 'Kontrola plikow zakonczona. Bez instalacji, pobierania i uruchamiania gry.';exit 0 }
    if (Get-Process -Name 'Omsi','openomsi','openomsi-srg-camera' -ErrorAction SilentlyContinue) { throw 'Zamknij gre samodzielnie i zapisz postep przed instalacja. Nie koncze jej procesu.' }
    $runtime=''
    if ($Mode -eq 'openOMSI') { $runtime=Install-Runtime $PSScriptRoot $RuntimeArchive }
    $backup=Join-Path $PSScriptRoot ('backups\plugins-'+[Guid]::NewGuid().ToString('N'))
    Install-Plugins $PSScriptRoot $game $backup
    $config=Join-Path $PSScriptRoot 'config.json'
    if (Test-Path -LiteralPath $config) { New-Item -ItemType Directory -Path $backup -Force | Out-Null;Copy-Item -LiteralPath $config -Destination $backup }
    Save-Json $config @{schema=1;omsiRoot=$game;mode=$Mode;adb=$adb;runtime=$runtime;created=(Get-Date).ToString('o')}
    Write-Host 'Gotowe. Konfiguracja zostala zapisana tylko na tym komputerze. Gra i mostek nie zostaly uruchomione.'
    if (!$adb) { Write-Host 'Wi-Fi jest gotowe bez ADB. Do USB zainstaluj oficjalne Android Platform Tools, potem uruchom USB.cmd.' }
    Write-Host 'Dalsze kroki: URUCHOM-MOSTEK.cmd, USB.cmd (jesli kabel), potem URUCHOM-GRE.cmd. Szczegoly w README-PL.md.'
} catch { Write-Error ($_.Exception.Message+' W razie braku praw do plugins uruchom INSTALUJ.cmd jako administrator. Nie zmieniaj uprawnien calego folderu gry.') -ErrorAction Continue;exit 1 }
