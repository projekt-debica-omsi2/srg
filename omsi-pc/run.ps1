[CmdletBinding()]
param([ValidateSet('Bridge','Game','USB','Check')][string]$Action='Check',[string]$Serial,[string]$AdbPath)
. (Join-Path $PSScriptRoot 'common.ps1')
try {
    Assert-Payload $PSScriptRoot
    $config=Get-LocalConfig $PSScriptRoot
    if (!(Test-GameRoot $config.omsiRoot)) { throw 'Folder OMSI przeniesiono lub usunieto. Uruchom ponownie INSTALUJ.cmd.' }
    $logs=Join-Path $PSScriptRoot 'logs';New-Item -ItemType Directory -Path $logs -Force | Out-Null
    if ($Action -eq 'USB') {
        $requested=$AdbPath;if (!$requested) { $requested=$config.adb }
        $adb=Find-Adb $requested
        if (!$adb) { throw 'Nie znaleziono adb.exe. Pobierz oficjalne Android Platform Tools i podaj -AdbPath lub dodaj je do PATH. Patrz README.' }
        $output=& $adb devices 2>&1;if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
        $device=Select-AdbDevice ($output -join "`n") $Serial
        & $adb -s $device reverse tcp:8766 tcp:8766
        if ($LASTEXITCODE -ne 0) { throw 'ADB reverse nie powiodlo sie.' }
        Write-Host 'USB gotowe. W SRGMobile lub SRGMobile Public wybierz USB bez kodu.'
        exit 0
    }
    if ($Action -eq 'Bridge') {
        if (Get-Process -Name 'SRG-OMSI-Bridge' -ErrorAction SilentlyContinue) { throw 'Mostek jest juz uruchomiony. Uzyj jego kodu; nie otwieram drugiej kopii.' }
        $stamp=(Get-Date).ToString('yyyyMMdd-HHmmss');$out=Join-Path $logs "bridge-$stamp.log";$err=Join-Path $logs "bridge-$stamp-error.log"
        $process=Start-Process -FilePath (Join-Path $PSScriptRoot 'bridge\SRG-OMSI-Bridge.exe') -WorkingDirectory (Join-Path $PSScriptRoot 'bridge') -ArgumentList @('--omsi-root',('"'+$config.omsiRoot+'"')) -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
        for ($i=0;$i -lt 15;$i++) { Start-Sleep -Milliseconds 400;if ($process.HasExited) { throw ('Mostek zakonczyl sie. '+(Get-Content -LiteralPath $err -Raw -Encoding UTF8)) };if ((Test-Path -LiteralPath $out) -and ((Get-Content -LiteralPath $out -Raw -Encoding UTF8) -match 'Kod parowania:')) { break } }
        Write-Host "Mostek PID $($process.Id). Log lokalny: $out"
        if (Test-Path -LiteralPath $out) { Get-Content -LiteralPath $out | Write-Host }
        exit 0
    }
    if ($Action -eq 'Game') {
        if (Get-Process -Name 'Omsi','openomsi','openomsi-srg-camera' -ErrorAction SilentlyContinue) { throw 'Gra jest juz uruchomiona. Nie otwieram drugiej sesji.' }
        if ($config.mode -eq 'Steam') {
            Start-Process -FilePath (Join-Path $config.omsiRoot 'Omsi.exe') -WorkingDirectory $config.omsiRoot
        } else {
            $runtime=Join-Path $PSScriptRoot 'engine-runtime'
            $exe=Join-Path $runtime 'openomsi-srg-camera.exe'
            if (!(Test-Path -LiteralPath $exe)) { throw 'Brak silnika lub bibliotek. Uruchom INSTALUJ.cmd.' }
            $manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-source.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($name in $manifest.files) { if (!(Test-Path -LiteralPath (Join-Path $runtime $name))) { throw "Brak biblioteki: $name. Uruchom ponownie instalacje." } }
            $stamp=(Get-Date).ToString('yyyyMMdd-HHmmss')
            Start-Process -FilePath $exe -WorkingDirectory $config.omsiRoot -ArgumentList @('--root',('"'+$config.omsiRoot+'"')) -RedirectStandardOutput (Join-Path $logs "game-$stamp.log") -RedirectStandardError (Join-Path $logs "game-$stamp-error.log")
        }
        exit 0
    }
    $report=[ordered]@{os=[Environment]::OSVersion.VersionString;architecture=[Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString();mode=$config.mode;omsiRoot=$config.omsiRoot;adb=(Find-Adb $config.adb);bridgeRunning=[bool](Get-Process 'SRG-OMSI-Bridge' -ErrorAction SilentlyContinue);graphics='Nie wykonano testu renderowania GPU'}
    try { $report.video=@(Get-CimInstance Win32_VideoController -ErrorAction Stop | Select-Object Name,DriverVersion) } catch { $report.video='Brak dostepu do informacji GPU; nie oznacza awarii gry.' }
    Save-Json (Join-Path $logs 'diagnostyka.json') $report
    $report | Format-List
    Write-Host 'Raport lokalny logs\diagnostyka.json zawiera sciezki tego komputera. Nie wysylaj go publicznie bez przejrzenia.'
} catch { Write-Error $_.Exception.Message -ErrorAction Continue;exit 1 }
