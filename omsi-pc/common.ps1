Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
# A parent program may pass PowerShell 7 module paths to Windows PowerShell 5.1.
# Load the standard modules belonging to THIS process instead of a different runtime.
foreach ($moduleName in @('Microsoft.PowerShell.Utility','Microsoft.PowerShell.Management')) {
    Import-Module ([IO.Path]::Combine($PSHOME,"Modules\$moduleName\$moduleName.psd1")) -Force
}

function Get-FullPath([string]$Path) { [IO.Path]::GetFullPath($Path) }
function Assert-Within([string]$Parent,[string]$Path) {
    $base=(Get-FullPath $Parent).TrimEnd('\','/')+[IO.Path]::DirectorySeparatorChar
    $full=Get-FullPath $Path
    if (!$full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)) { throw "Sciezka poza dozwolonym folderem: $full" }
    return $full
}
function Assert-Hash([string]$Path,[string]$Expected) {
    if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Brak pliku: $Path" }
    if ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Expected) { throw "Nieprawidlowy SHA256: $Path. Pobierz ponownie oryginalna paczke." }
}
function Assert-Payload([string]$Folder) {
    $manifest=Get-Content -LiteralPath (Join-Path $Folder 'payload-sha256.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $manifest.PSObject.Properties) { Assert-Hash (Assert-Within $Folder (Join-Path $Folder $p.Name)) $p.Value }
}
function Get-PeMachine([string]$Path) {
    $stream=[IO.File]::OpenRead($Path);$reader=New-Object IO.BinaryReader($stream)
    try {
        if ($reader.ReadUInt16() -ne 0x5a4d) { throw "To nie jest plik Windows PE: $Path" }
        $stream.Position=0x3c;$offset=$reader.ReadInt32()
        if ($offset -lt 64 -or $offset -gt $stream.Length-6) { throw 'Uszkodzony naglowek PE' }
        $stream.Position=$offset
        if ($reader.ReadUInt32() -ne 0x4550) { throw 'Nieprawidlowa sygnatura PE' }
        return $reader.ReadUInt16()
    } finally { $reader.Dispose();$stream.Dispose() }
}
function Assert-PeMachine([string]$Path,[int]$Machine) {
    if ((Get-PeMachine $Path) -ne $Machine) { throw "Zla architektura pliku: $Path" }
}
function Test-GameRoot([string]$Path) {
    $engine=(Test-Path -LiteralPath (Join-Path $Path 'Omsi.exe') -PathType Leaf) -or (Test-Path -LiteralPath (Join-Path $Path 'openomsi.exe') -PathType Leaf) -or (Test-Path -LiteralPath (Join-Path $Path 'openomsi-srg-camera.exe') -PathType Leaf)
    return $engine -and (Test-Path -LiteralPath (Join-Path $Path 'maps') -PathType Container) -and (Test-Path -LiteralPath (Join-Path $Path 'Vehicles') -PathType Container)
}
function Get-SteamLibraries([string[]]$SteamRoots=@()) {
    $roots=@($SteamRoots)
    foreach ($key in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam')) {
        try { $item=Get-ItemProperty -LiteralPath $key -ErrorAction Stop; foreach ($name in @('SteamPath','InstallPath')) { if ($item.PSObject.Properties[$name]) { $roots+=$item.$name } } } catch {}
    }
    if (${env:ProgramFiles(x86)}) { $roots+=(Join-Path ${env:ProgramFiles(x86)} 'Steam') }
    $libraries=@()
    foreach ($root in @($roots | Where-Object { $_ } | Select-Object -Unique)) {
        $libraries+=$root;$vdf=Join-Path $root 'steamapps\libraryfolders.vdf'
        if (Test-Path -LiteralPath $vdf) {
            $text=Get-Content -LiteralPath $vdf -Raw -Encoding UTF8
            foreach ($match in [regex]::Matches($text,'"(?:path|[0-9]+)"\s+"([^"]+)"')) {
                $value=$match.Groups[1].Value.Replace('\\','\')
                if ([IO.Path]::IsPathRooted($value)) { $libraries+=$value }
            }
        }
    }
    return @($libraries | Select-Object -Unique)
}
function Get-GameRoots([string[]]$SteamRoots=@()) {
    $found=@()
    foreach ($library in @(Get-SteamLibraries $SteamRoots)) {
        $path=Join-Path $library 'steamapps\common\OMSI 2'
        if (Test-GameRoot $path) { $found+=(Get-FullPath $path) }
    }
    if ($env:LOCALAPPDATA) {
        $open=Join-Path $env:LOCALAPPDATA 'Programs\openOMSI'
        if (Test-GameRoot $open) { $found+=(Get-FullPath $open) }
    }
    return @($found | Select-Object -Unique)
}
function Resolve-GameRoot([string]$Requested) {
    if ($Requested) { $full=Get-FullPath $Requested; if (!(Test-GameRoot $full)) { throw 'Wskaz wlasny folder z maps, Vehicles oraz Omsi.exe lub openomsi.exe. Sam pusty folder programu nie zawiera danych gry.' };return $full }
    $found=@(Get-GameRoots)
    if ($found.Count -eq 1) { return $found[0] }
    if ($found.Count -gt 1) { Write-Host ($found -join "`n") }
    $answer=Read-Host 'Podaj pelna sciezke do folderu OMSI 2, bez cudzyslowow'
    if (!$answer) { throw 'Nie wybrano instalacji OMSI 2.' }
    return Resolve-GameRoot $answer.Trim('"')
}
function Copy-WithBackup([string]$Source,[string]$Destination,[string]$BackupFolder) {
    if (Test-Path -LiteralPath $Destination) {
        if ((Get-FileHash -LiteralPath $Source).Hash -eq (Get-FileHash -LiteralPath $Destination).Hash) { return }
        New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null
        Copy-Item -LiteralPath $Destination -Destination (Join-Path $BackupFolder ([IO.Path]::GetFileName($Destination)))
    }
    $parent=Split-Path $Destination;New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    Assert-Hash $Destination (Get-FileHash -LiteralPath $Source).Hash
}
function Install-Plugins([string]$Package,[string]$GameRoot,[string]$BackupFolder) {
    foreach ($name in @('SRGBridge.dll','SRGBridge.opl','SRGOpenOMSI.lua')) {
        Copy-WithBackup (Join-Path $Package "bridge\plugins\$name") (Join-Path $GameRoot "plugins\$name") $BackupFolder
    }
}
function Find-Adb([string]$Requested='') {
    $paths=@($Requested)
    if ($env:ANDROID_HOME) { $paths+=(Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe') }
    if ($env:ANDROID_SDK_ROOT) { $paths+=(Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe') }
    if ($env:LOCALAPPDATA) { $paths+=(Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe') }
    $command=Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($command) { $paths+=$command.Source }
    foreach ($path in $paths) { if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) { return Get-FullPath $path } }
    return ''
}
function Select-AdbDevice([string]$Output,[string]$Requested='') {
    $devices=@()
    foreach ($line in ($Output -split "`r?`n")) {
        if ($line -match '^(\S+)\s+(device|unauthorized|offline)\b') { $devices+=@{id=$matches[1];state=$matches[2]} }
    }
    if ($Requested) { $devices=@($devices | Where-Object { $_.id -ceq $Requested }) }
    if ($devices.Count -ne 1) { throw 'Podlacz jedno urzadzenie albo wybierz numer seryjny parametrem -Serial. Lista: adb devices' }
    if ($devices[0].state -ne 'device') { throw 'Odblokuj telefon, wlacz debugowanie USB i zatwierdz komunikat zaufania na jego ekranie.' }
    return $devices[0].id
}
function Save-Json([string]$Path,$Value) {
    [IO.File]::WriteAllText($Path,($Value | ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
}
function Get-LocalConfig([string]$Package) {
    $path=Join-Path $Package 'config.json'
    if (!(Test-Path -LiteralPath $path)) { throw 'Najpierw uruchom INSTALUJ.cmd. Brak konfiguracji tego komputera.' }
    return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Install-Runtime([string]$Package,[string]$Archive='') {
    $manifest=Get-Content -LiteralPath (Join-Path $Package 'runtime-source.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if (!$Archive) {
        $cache=Join-Path $Package 'downloads';New-Item -ItemType Directory -Path $cache -Force | Out-Null
        $Archive=Join-Path $cache 'openOMSI-0.3.45-windows-x64.zip'
        if (!(Test-Path -LiteralPath $Archive)) {
            [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            Write-Host 'Pobieranie oficjalnych bibliotek openOMSI 0.3.45 (ok. 67 MB)...'
            Invoke-WebRequest -Uri $manifest.url -OutFile $Archive -UseBasicParsing -TimeoutSec 180
        }
    }
    Assert-Hash $Archive $manifest.sha256
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
    $runtime=Join-Path $Package 'engine-runtime';New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    $backup=Join-Path $Package ('backups\runtime-'+[Guid]::NewGuid().ToString('N'))
    try {
        foreach ($name in $manifest.files) {
            if ([IO.Path]::GetFileName($name) -ne $name) { throw 'Nieprawidlowy manifest bibliotek.' }
            $entry=$zip.GetEntry($name);if (!$entry) { throw "Brak biblioteki w oficjalnym ZIP: $name" }
            $temporary=Join-Path $runtime ($name+'.new')
            $entryInput=$entry.Open();$entryOutput=[IO.File]::Create($temporary)
            try { $entryInput.CopyTo($entryOutput) } finally { $entryOutput.Dispose();$entryInput.Dispose() }
            if ($name.EndsWith('.dll')) { Assert-PeMachine $temporary 0x8664 }
            if ($name -eq 'omsi-plugin-host32.exe') { Assert-PeMachine $temporary 0x14c }
            Copy-WithBackup $temporary (Join-Path $runtime $name) $backup
            Remove-Item -LiteralPath $temporary
        }
    } finally { $zip.Dispose() }
    Copy-WithBackup (Join-Path $Package 'engine\openomsi-srg-camera.exe') (Join-Path $runtime 'openomsi-srg-camera.exe') $backup
    return $runtime
}
