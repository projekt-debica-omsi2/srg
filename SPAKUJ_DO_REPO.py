"""Make an upload overlay after the user's MP3 and RJ are ready."""
import hashlib,json,zipfile
from pathlib import Path
from tools.prepare_grg import prepare as prepare_grg
from tools.prepare_rj import prepare
BASE=Path(__file__).resolve().parent
def main():
    prepare_grg();prepare(require=True)
    data=json.loads((BASE/"PLAN_GRG.json").read_text(encoding="utf-8"));jobs=data["jobs"]+data["directionJobs"]
    names=json.loads((BASE/'PLIKI_DO_REPO.json').read_text(encoding='utf-8'))
    names+=['PLAN_GRG.json','NAGRANIA_GRG_SHA256.json']+['app/src/main/assets/audio/grg/'+j['file'] for j in jobs]
    names += [str(p.relative_to(BASE)).replace('\\','/') for p in (BASE/'rj').glob('*.011')]
    target=BASE/'GOTOWE_DO_REPO_1.4.85.zip'
    files=[]
    for name in sorted(set(names)):
        p=(BASE/name).resolve()
        if not p.is_relative_to(BASE) or not p.is_file():raise ValueError('Brak/nieprawidłowy plik: '+name)
        files.append((p,name))
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        for p,name in files:z.write(p,name)
    with zipfile.ZipFile(target) as z:
        if z.testzip():raise ValueError('Błąd ZIP')
    target.with_suffix('.zip.sha256').write_text(hashlib.sha256(target.read_bytes()).hexdigest()+'  '+target.name+'\n',encoding='ascii')
    print('Gotowe:',target,'\nRozpakuj do lokalnej kopii repo, dodaj pliki i wyślij commit. GitHub nie rozpakowuje ZIP automatycznie.')
if __name__=='__main__':
    try:main()
    except Exception as e:raise SystemExit('BŁĄD: '+str(e))
