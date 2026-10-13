#!/usr/bin/env python3
"""Offline-ready speech files after one-time online Edge Neural generation.
Run on Windows with Python 3.10+: py -3 GENERUJ_79_MP3_MAREK.py
Voice service is external and may change; resulting MP3 are local and work offline.
"""
from __future__ import annotations
import argparse, asyncio, hashlib, json, re, subprocess, sys, time
from pathlib import Path
BASE=Path(__file__).resolve().parent
DATA=BASE/'route_data.json'
OUT=BASE/'app'/'src'/'main'/'assets'/'audio'
VOICE='pl-PL-MarekNeural';RATE='-4%'
STATUS=BASE/'.tts_status.json'

def spoken(name):
    name=re.sub(r'\s+(?:N\.?\s*Ż\.?|NZ|NA ŻĄDANIE)\s*$', '',str(name).strip(),flags=re.I)
    name=re.sub(r'\s+\d{1,4}[a-z]?\s*$', '',name,flags=re.I)
    return name.strip()

def sentence(name):
    name=spoken(name).lower()
    if name.startswith('dębica ') or name.startswith('rzeszów ') or name.startswith('ropczyce ') or name.startswith('sędziszów '):
        city=name.split(' ',1)[0];name=city.title()+', '+name[len(city)+1:]
    elif name:name=name[:1].upper()+name[1:]
    name=re.sub(r'\bE4\b','E cztery',name,flags=re.I)
    return name.rstrip('. ')+'.'

def build_jobs():
    data=json.loads(DATA.read_text('utf-8'))
    assert len(data['stops'])==68 and len(data['variants'])==7,'Wymagane 68 przystanków + 7 wariantów'
    lookup={int(s['id']):s['name'] for s in data['stops']}
    jobs=[('next.mp3','Następny przystanek.'),('terminal.mp3','Przystanek końcowy.'),
          ('inspection.mp3','Kontrola biletów.'),('na_zadanie.mp3','Na żądanie.')]
    for id_,name in sorted(lookup.items()):jobs.append((f'stops/{id_}.mp3',sentence(name)))
    for variant in data['variants']:
        ids=variant['stopIds'];a=sentence(lookup[ids[0]]);b=sentence(lookup[ids[-1]])
        jobs.append((f'start/{variant["index"]}.mp3',f'Przystanek początkowy. {a} Kierunek: {b}'))
    assert len(jobs)==79 and len(set(f for f,_ in jobs))==79
    return jobs

def ready(jobs):
    if not STATUS.exists(): return False
    try: data=json.loads(STATUS.read_text('utf-8'))
    except (ValueError, OSError):return False
    return all(data.get(rel)==hashlib.sha256((VOICE+'|'+RATE+'|'+txt).encode('utf-8')).hexdigest()
               and (OUT/rel).is_file() and (OUT/rel).stat().st_size>1000
               for rel,txt in jobs)

def get_tts():
    try: import edge_tts;return edge_tts
    except ImportError:
        print('Instaluję edge-tts dla aktualnego Pythona...')
        subprocess.check_call([sys.executable,'-m','pip','install','edge-tts'])
        import edge_tts;return edge_tts

async def generate(jobs, force=False):
    if not force and ready(jobs):
        print(f'Wszystkie {len(jobs)} MP3 są już gotowe. Nie pobieram ani nie generuję niczego.')
        return 0
    edge_tts=get_tts();OUT.mkdir(parents=True,exist_ok=True)
    try: status=json.loads(STATUS.read_text('utf-8'))
    except (ValueError,FileNotFoundError):status={}
    failed=[]
    for i,(rel,txt) in enumerate(jobs,1):
        path=OUT/rel;path.parent.mkdir(parents=True,exist_ok=True)
        digest=hashlib.sha256((VOICE+'|'+RATE+'|'+txt).encode('utf-8')).hexdigest()
        if not force and status.get(rel)==digest and path.exists() and path.stat().st_size>1000:
            print(f'[{i:02}/{len(jobs)}] GOTOWY: {rel}');continue
        tmp=path.with_suffix('.new.mp3');success=False
        for retry in range(3):
            try:
                await edge_tts.Communicate(txt,VOICE,rate=RATE).save(str(tmp))
                if not tmp.is_file() or tmp.stat().st_size<1000:raise ValueError('pusty MP3')
                tmp.replace(path);status[rel]=digest
                STATUS.write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf-8')
                print(f'[{i:02}/{len(jobs)}] OK: {rel} - {txt}');success=True;break
            except Exception as exc:
                tmp.unlink(missing_ok=True)
                print(f'[{i:02}/{len(jobs)}] BŁĄD (próba {retry+1}/3): {exc}')
                await asyncio.sleep(2*(retry+1))
        if not success:failed.append(rel)
        await asyncio.sleep(.15)
    if failed:
        print('Nie udało się:',', '.join(failed),'Uruchom ponownie, gotowe zostaną pominięte.');return 1
    print('Gotowe. MP3 są w assets/audio i będą pakowane do APK.');return 0

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--dry-run',action='store_true');ap.add_argument('--force',action='store_true');args=ap.parse_args()
    jobs=build_jobs()
    print('Marek Neural: komplet 79 plików już dołączony; brak konieczności ponownego generowania')
    if args.dry_run:
        for fn,text in jobs: print(fn,'->',text)
        return 0
    return asyncio.run(generate(jobs,args.force))
if __name__=='__main__':sys.exit(main())
