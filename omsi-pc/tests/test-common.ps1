. (Join-Path (Split-Path $PSScriptRoot) 'common.ps1')
function Assert-True($Value,[string]$Message) { if (!$Value) { throw "TEST: $Message" } }
function Assert-Throws([scriptblock]$Action) { $caught=$false;try { &$Action } catch { $caught=$true };Assert-True $caught 'Expected failure' }
function Write-FakePe([string]$Path,[int]$Machine) {
    $bytes=New-Object byte[] 256;$bytes[0]=0x4d;$bytes[1]=0x5a;$bytes[0x3c]=0x80;$bytes[0x80]=0x50;$bytes[0x81]=0x45
    $bytes[0x84]=$Machine -band 255;$bytes[0x85]=($Machine -shr 8) -band 255;[IO.File]::WriteAllBytes($Path,$bytes)
}
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('srg-portable-tests-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $steam=Join-Path $testRoot 'Steam';$library=Join-Path $testRoot ('Steam Library '+[char]0x0141+[char]0x00f3+'dz')
    $game=Join-Path $library 'steamapps\common\OMSI 2'
    New-Item -ItemType Directory -Path (Join-Path $steam 'steamapps'),(Join-Path $game 'maps'),(Join-Path $game 'Vehicles') -Force | Out-Null
    Write-FakePe (Join-Path $game 'Omsi.exe') 0x14c
    $vdf='"libraryfolders" { "1" { "path" "'+$library.Replace('\','\\')+'" } }'
    [IO.File]::WriteAllText((Join-Path $steam 'steamapps\libraryfolders.vdf'),$vdf,(New-Object Text.UTF8Encoding($false)))
    $games=@(Get-GameRoots @($steam));Assert-True ($games -contains $game) 'Custom Steam library with spaces / Unicode not detected'
    Assert-True ((Resolve-GameRoot $game) -eq $game) 'Explicit root failed'
    $open=Join-Path $testRoot 'standalone openOMSI'
    New-Item -ItemType Directory -Path (Join-Path $open 'maps'),(Join-Path $open 'Vehicles') -Force | Out-Null
    Write-FakePe (Join-Path $open 'openomsi.exe') 0x8664
    Assert-True (Test-GameRoot $open) 'Standalone openOMSI content root rejected'
    Assert-True ((Resolve-GameRoot $open) -eq $open) 'Standalone openOMSI explicit root failed'
    Assert-Throws { Resolve-GameRoot (Join-Path $testRoot 'not-game') }
    Assert-PeMachine (Join-Path $game 'Omsi.exe') 0x14c
    Assert-Throws { Assert-PeMachine (Join-Path $game 'Omsi.exe') 0x8664 }
    Assert-Throws { Assert-Within $testRoot (Join-Path $testRoot '..\escape.txt') }
    $package=Join-Path $testRoot 'package';$plugins=Join-Path $package 'bridge\plugins'
    New-Item -ItemType Directory -Path $plugins -Force | Out-Null
    foreach ($name in @('SRGBridge.dll','SRGBridge.opl','SRGOpenOMSI.lua')) { [IO.File]::WriteAllText((Join-Path $plugins $name),'new-'+$name) }
    $backup=Join-Path $testRoot 'backups'
    New-Item -ItemType Directory -Path (Join-Path $game 'plugins') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $game 'plugins\SRGOpenOMSI.lua'),'old-plugin')
    Install-Plugins $package $game $backup
    Assert-True (([IO.File]::ReadAllText((Join-Path $backup 'SRGOpenOMSI.lua'))) -eq 'old-plugin') 'Backup not preserved'
    $second=Join-Path $testRoot 'no-change-backup';Install-Plugins $package $game $second
    Assert-True (!(Test-Path -LiteralPath $second)) 'Identical plugin overwritten'
    $config=Join-Path $testRoot 'unicode-config.json';Save-Json $config @{omsiRoot=$game}
    Assert-True (((Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json).omsiRoot) -eq $game) 'Unicode config damaged'
    Assert-True ((Select-AdbDevice "List of devices attached`nABC`tdevice`n") -ceq 'ABC') 'ADB single device'
    Assert-Throws { Select-AdbDevice "ABC`tdevice`nDEF`tdevice" }
    Assert-Throws { Select-AdbDevice "ABC`tunauthorized" }
    Assert-True ((Select-AdbDevice "ABC`tdevice`nDEF`tdevice" 'DEF') -ceq 'DEF') 'Explicit ADB device selection'
    [IO.File]::WriteAllText((Join-Path $package 'probe.txt'),'ok');$hash=(Get-FileHash -LiteralPath (Join-Path $package 'probe.txt')).Hash
    Save-Json (Join-Path $package 'payload-sha256.json') @{'probe.txt'=$hash};Assert-Payload $package
    [IO.File]::WriteAllText((Join-Path $package 'probe.txt'),'tampered');Assert-Throws { Assert-Payload $package }
    Assert-True ((Get-Command Get-FileHash).Module.Path.StartsWith($PSHOME,[StringComparison]::OrdinalIgnoreCase)) 'Hash command loaded from a different PowerShell installation'
    foreach ($file in (Get-ChildItem -LiteralPath (Split-Path $PSScriptRoot) -Filter '*.ps1')) {
        $tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors) | Out-Null
        Assert-True ($errors.Count -eq 0) ('Syntax: '+$file.Name)
    }
    Write-Output 'PASS: Steam custom/Unicode paths, PE architecture, path traversal, backups, idempotence, JSON, ADB selection, payload tampering, PowerShell syntax. No game launched.'
} finally {
    $checked=Assert-Within ([IO.Path]::GetTempPath()) $testRoot
    if ([IO.Path]::GetFileName($checked).StartsWith('srg-portable-tests-')) { Remove-Item -LiteralPath $checked -Recurse -Force }
}
