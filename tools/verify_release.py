"""Fail publication if APK identity, version or signing certificate is wrong."""
import os, re, subprocess
from pathlib import Path
sdk=Path(os.environ['ANDROID_HOME'])/'build-tools/35.0.0'
apk=Path('app/build/outputs/apk/release/app-release.apk')
signature=subprocess.check_output([str(sdk/'apksigner'),'verify','--verbose','--print-certs',str(apk)],text=True)
actual=re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]+)',signature)
expected=os.environ['SRG_SIGNING_CERT_SHA256'].strip().lower()
if len(actual)!=1 or actual[0].lower()!=expected:raise SystemExit('Błędny podpis APK — publikacja zatrzymana.')
badging=subprocess.check_output([str(sdk/'aapt'),'dump','badging',str(apk)],text=True)
identity=re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'",badging)
gradle=Path('app/build.gradle').read_text()
code=re.search(r'versionCode\s+(\d+)',gradle).group(1)
name=re.search(r"versionName\s+'([^']+)'",gradle).group(1)
if not identity or identity.groups()!=('pl.srgmobile.classic.lcd23',code,name) or int(code)<11465:raise SystemExit('Błędna tożsamość / wersja APK.')
print('Zweryfikowano stały podpis, pakiet i wersję APK.')
