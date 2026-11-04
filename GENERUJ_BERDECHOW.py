"""Generate only the new Marek Neural announcements; keep existing recordings intact."""
from __future__ import annotations
import argparse, asyncio, hashlib, json, re, sys
from pathlib import Path
BASE=Path(__file__).resolve().parent
OUT=BASE/'app/src/main/assets/audio'
STATE=BASE/'NAGRANIA_BERDECHOW_SHA256.json'

def plan():
    data=json.loads((BASE/'ZAPOWIEDZI_BERDECHOW.json').read_text(encoding='utf-8'))
    jobs=data['jobs']
    if len({j['file'] for j in jobs})!=len(jobs) or any(not re.fullmatch(r'berdechow/(?:stop-\d{3}|start-[1-4])\.mp3',j['file']) for j in jobs):raise ValueError('Nieprawidłowy plan nagrań')
    return data, jobs

def mp3_ok(path):
    if not path.is_file() or path.stat().st_size<1000:return False
    with path.open('rb') as f:b=f.read(3)
    return b==b'ID3' or (len(b)>=2 and b[0]==255 and b[1]&224==224)

def fingerprint(data,job):
    return hashlib.sha256((data['voice']+'|'+data['rate']+'|'+job['text']).encode()).hexdigest()

def verify(data,jobs):
    state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    missing=[]
    for j in jobs:
        p=OUT/j['file'];entry=state.get(j['file'],{})
        if not mp3_ok(p) or entry.get('textHash')!=fingerprint(data,j) or entry.get('sha256')!=hashlib.sha256(p.read_bytes()).hexdigest():missing.append(j['file'])
    if missing:raise ValueError('Brak/popraw nowe nagrania: '+', '.join(missing)+'\nUruchom GENERUJ_BERDECHOW.cmd przed wysłaniem do repo.')

async def generate(data,jobs):
    try:import edge_tts
    except ImportError:raise ValueError('Zainstaluj zależność: py -3 -m pip install -r requirements-berdechow.txt')
    state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    for i,j in enumerate(jobs,1):
        p=OUT/j['file'];p.parent.mkdir(parents=True,exist_ok=True);entry=state.get(j['file'],{})
        if mp3_ok(p) and entry.get('textHash')==fingerprint(data,j) and entry.get('sha256')==hashlib.sha256(p.read_bytes()).hexdigest():print(f'[{i}/{len(jobs)}] Gotowe: {j["file"]}');continue
        tmp=p.with_suffix('.new.mp3')
        for attempt in range(3):
            try:
                await edge_tts.Communicate(j['text'],data['voice'],rate=data['rate']).save(str(tmp))
                if not mp3_ok(tmp):raise ValueError('Nieprawidłowe MP3')
                tmp.replace(p);state[j['file']]={'textHash':fingerprint(data,j),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()};STATE.write_text(json.dumps(state,indent=2),encoding='utf-8');print(f'[{i}/{len(jobs)}] OK: {j["text"]}');break
            except Exception:
                if attempt==2:raise
                await asyncio.sleep(2*(attempt+1))
    verify(data,jobs)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--dry-run',action='store_true');ap.add_argument('--verify',action='store_true');args=ap.parse_args();data,jobs=plan()
    if args.dry_run:
        for j in jobs:print(j['file'],'->',j['text'])
    elif args.verify:verify(data,jobs);print('Nowe MP3 i SHA256: OK')
    else:asyncio.run(generate(data,jobs));print('Gotowe. Wyślij do repo nowe MP3 i NAGRANIA_BERDECHOW_SHA256.json wraz z kodem.')
if __name__=='__main__':
    try:main()
    except Exception as exc:print('BŁĄD:',exc);sys.exit(1)
