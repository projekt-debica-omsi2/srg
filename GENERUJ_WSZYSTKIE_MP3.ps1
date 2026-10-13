# SRG Mobile - nagrania juz w projekcie; wymaga Internetu tylko przy generowaniu brakujacych MP3
Set-Location $PSScriptRoot
py -3.12 GENERUJ_MP3_MAREK.py
if ($LASTEXITCODE -ne 0) { Write-Host 'Przy bledzie uruchom ponownie - skrypt wznawia prace.' }
Read-Host 'Nacisnij Enter aby zamknac'
