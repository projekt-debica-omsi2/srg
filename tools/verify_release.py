"""Fail publication if APK identity, version or signing certificate is wrong."""
import os, re, subprocess
from pathlib import Path
sdk=Path(os.environ['ANDROID_HOME'])/'build-tools/35.0.0'
apk=Path(os.environ.get('SRG_APK_PATH','app/build/outputs/apk/release/app-release.apk'))
signature=subprocess.check_output([str(sdk/'apksigner'),'verify','--verbose','--print-certs',str(apk)],text=True)
actual=re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]+)',signature)
expected=os.environ['SRG_SIGNING_CERT_SHA256'].strip().lower()
if len(actual)!=1 or actual[0].lower()!=expected:raise SystemExit('Błędny podpis APK — publikacja zatrzymana.')
badging=subprocess.check_output([str(sdk/'aapt'),'dump','badging',str(apk)],text=True)
identity=re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'",badging)
gradle=Path('app/build.gradle').read_text()
code=re.search(r'versionCode\s+(\d+)',gradle).group(1)
name=re.search(r"versionName\s+'([^']+)'",gradle).group(1)
package='pl.srgmobile.publicapp' if os.environ.get('SRG_EDITION')=='public' else 'pl.srgmobile.classic.lcd23'
if not identity or identity.groups()!=(package,code,name) or int(code)<11465:raise SystemExit('Błędna tożsamość / wersja APK.')
if os.environ.get('SRG_EDITION')=='public':
    import zipfile
    with zipfile.ZipFile(apk) as z:
        names=z.namelist()
        forbidden=[n for n in names if n.startswith('assets/') and (n.lower().endswith(('.011','.mp3')) or any(x in n for x in ['bundled-rj','reviewed-gps','grg-audio-data','transfers-data','replay-data']))]
        if forbidden:raise SystemExit('Public APK zawiera dane kierowcy: '+str(forbidden))
        if b"public:true" not in z.read('assets/edition.js'):raise SystemExit('Brak flagi wersji publicznej')
print('Zweryfikowano stały podpis, pakiet i wersję APK.')
