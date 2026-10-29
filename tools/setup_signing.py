"""One-time private signing setup. Requires Python 3, Java keytool and GitHub CLI."""
import base64, hashlib, json, os, secrets, shutil, subprocess, sys
from pathlib import Path
REPO='projekt-debica-omsi2/srg'
KEYS=['SRG_KEYSTORE_BASE64','SRG_KEYSTORE_PASSWORD','SRG_SIGNING_CERT_SHA256']
def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs).stdout

def main():
    for command in ['gh','keytool']:
        if not shutil.which(command): raise RuntimeError('Zainstaluj '+command+' i uruchom ponownie.')
    run(['gh','auth','status'])
    existing={r['name'] for r in json.loads(run(['gh','secret','list','--repo',REPO,'--json','name']))}
    if set(KEYS).issubset(existing):
        print('Stały podpis jest już skonfigurowany. Nie zmieniono żadnego sekretu.');return
    folder=Path.home()/'SRG-signing-backup'
    key=folder/'srg-release.p12'; password_file=folder/'password.txt'
    if existing.intersection(KEYS) and not(key.exists() and password_file.exists()):
        raise RuntimeError('Repozytorium ma już podpis. Przywróć oryginalny folder SRG-signing-backup; nie generuj nowego klucza.')
    if key.exists()!=password_file.exists(): raise RuntimeError('Niekompletna kopia podpisu. Przywróć oba pliki z kopii zapasowej.')
    folder.mkdir(mode=0o700,parents=True,exist_ok=True)
    if not key.exists():
        password=secrets.token_urlsafe(36)
        fd=os.open(password_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f:f.write(password)
        env={**os.environ,'SRG_SIGNING_PASSWORD':password}
        run(['keytool','-genkeypair','-keystore',str(key),'-storetype','PKCS12','-alias','srg','-keyalg','RSA','-keysize','3072','-validity','36500','-dname','CN=SRG Mobile','-storepass:env','SRG_SIGNING_PASSWORD','-keypass:env','SRG_SIGNING_PASSWORD'],env=env)
        key.chmod(0o600)
    password=password_file.read_text().strip();env={**os.environ,'SRG_SIGNING_PASSWORD':password}
    cert=run(['keytool','-exportcert','-keystore',str(key),'-alias','srg','-storepass:env','SRG_SIGNING_PASSWORD'],env=env)
    fingerprint=hashlib.sha256(cert).hexdigest()
    fingerprint_file=folder/'certificate-sha256.txt'
    if fingerprint_file.exists() and fingerprint_file.read_text().strip()!=fingerprint: raise RuntimeError('Klucz nie zgadza się z zachowanym certyfikatem.')
    fingerprint_file.write_text(fingerprint+'\n')
    values=[base64.b64encode(key.read_bytes()),password.encode(),fingerprint.encode()]
    for name,value in zip(KEYS,values):
        run(['gh','secret','set',name,'--repo',REPO],input=value)
    print('Ustawiono stały podpis w GitHub Actions.')
    print('Zachowaj prywatną kopię folderu:',folder)
    print('Nie wgrywaj tego folderu do repozytorium. Używaj tego samego klucza dla wszystkich kolejnych wersji.')
if __name__=='__main__':
    try:main()
    except subprocess.CalledProcessError:
        print('Nie udało się zakończyć operacji. Sprawdź logowanie gh auth login, uprawnienia do repozytorium i lokalne narzędzia. Klucza nie usuwaj.',file=sys.stderr);sys.exit(1)
    except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
