"""Read AutoEdit GRG .skl names and generate numbered stop announcements."""
from __future__ import annotations
import argparse,asyncio,collections,csv,datetime,hashlib,json,re,shutil,sys
from pathlib import Path
BASE=Path(__file__).resolve().parent
VOICE='pl-PL-MarekNeural';RATE='-4%'

def clean_name(parts):
    text=re.sub(r'\s+',' ',' '.join(parts)).strip()
    # Technical annotations may wrap over several lines; keep (NOWA WIEŚ).
    text=re.sub(r'\((?:MONIS\s+DĘBICA|GPS\s+ZATWIERDZONY\s+PRZEZ\s+UŻYTKOWNIKA)[^)]*\)','',text,flags=re.I)
    return re.sub(r'\s+',' ',text).strip()

def read_grg(path):
    raw=Path(path).read_bytes()
    try:text=raw.decode('utf-8-sig')
    except UnicodeDecodeError:text=raw.decode('cp1250')
    records=[];routes=[];current=None
    for line in text.splitlines():
        match=re.match(r'^\s*(\*)?\s*(\d+)\s*:\s*!?\s*(.*)$',line)
        if match:
            if current:records.append(current)
            current={'star':bool(match[1]),'id':int(match[2]),'parts':[match[3]],'hints':[]};continue
        route=re.match(r'^\s*&L(K[0-9A-Fa-f]{4})\s*:\s*(.+)$',line)
        if route:
            if current:records.append(current);current=None
            routes.append({'code':route[1].upper(),'name':route[2].strip()});continue
        if current and line.strip():
            hint=re.fullmatch(r'(?:HEX:\s*)?(P[0-9A-Fa-f]{4}\.mp3)',line.strip(),flags=re.I)
            if hint:current['hints'].append(hint[1].upper())
            else:current['parts'].append(line.strip())
    if current:records.append(current)
    normal={};star={}
    for record in records:
        number=record['id']
        if not 1<=number<=65535:raise ValueError('Numer komunikatu poza zakresem: '+str(number))
        name=clean_name(record['parts'])
        if not name:raise ValueError('Pusta nazwa komunikatu '+str(number))
        expected=f'P{number:04X}.MP3'
        if any(h!=expected for h in record['hints']):raise ValueError('Adnotacja MP3 nie odpowiada numerowi GRG: '+str(number))
        target=star if record['star'] else normal
        if number in target:raise ValueError('Powielony rekord tego samego typu: '+str(number))
        target[number]=name
    if not normal:raise ValueError('Nie znaleziono komunikatów przystankowych w SKL')
    if star and star!=normal:raise ValueError('Nazwy/numery w zwykłych i oznaczonych * rekordach są różne. Nie zgaduję przypisania.')
    return normal,routes,hashlib.sha256(raw).hexdigest()

def spoken(name):
    name=re.sub(r'\s+(?:N\.?\s*Ż\.?|NZ|NA ŻĄDANIE)\s*$','',name,flags=re.I).strip()
    name=re.sub(r'\b(BRZEZINY BERDECHÓW|WIELOPOLE SKRZYŃSKIE)\s+[I1]\s+\d{2}\b',r'\1 jeden',name,flags=re.I)
    name=re.sub(r'\s+\d{2,4}\s*$','',name)
    name=re.sub(r'\b3\s*-\s*MAJA\b','trzeciego maja',name,flags=re.I)
    name=re.sub(r'\bE4\b','E cztery',name,flags=re.I)
    name=re.sub(r'\b([123])\b',lambda m:{'1':'jeden','2':'dwa','3':'trzy'}[m[1]],name)
    name=name.replace('(',' , ').replace(')','')
    name=re.sub(r'\s+',' ',name).replace(' ,',',').strip(' ,.')
    name=name[:1].upper()+name[1:].lower()
    for city in ['Dębica','Rzeszów','Ropczyce','Sędziszów Małopolski']:
        if name.casefold().startswith(city.casefold()+' '):
            name=city+', '+name[len(city)+1:];break
    # Keep the user's approved acronym pronunciation; do not phoneticize MKS.
    for code,words in [('OSP','o es pe'),('MKS','MKS')]:name=re.sub(r'\b'+code+r'\b',words,name,flags=re.I)
    if re.fullmatch(r'Dębica, rzeszowska MKS',name,re.I):
        name='Dębica, Rzeszowska MKS'
    return name+'.'

def make_plan(path):
    stops,routes,sha=read_grg(path)
    jobs=[{'id':number,'file':f'P{number:04X}.mp3','name':name,'text':spoken(name),'onRequest':bool(re.search(r'(?:N\.?\s*Ż\.?|NZ|NA ŻĄDANIE)\s*$',name,re.I))} for number,name in sorted(stops.items())]
    groups=collections.defaultdict(list)
    for route in routes:groups[route['code']].append(route['name'])
    conflicts={code:names for code,names in groups.items() if len(set(names))>1}
    direction_jobs=[]
    for code,names in groups.items():
        if code in conflicts:continue
        name=names[0];parts=name.split('>')
        text=('Kierunek: '+spoken(parts[0].strip())+' '+spoken(parts[1].strip())) if len(parts)==2 else 'Kierunek: '+spoken(name)
        direction_jobs.append({'id':code,'file':code+'.mp3','name':name,'text':text,'onRequest':False})
    return {'source':str(path),'sourceSHA256':sha,'voice':VOICE,'rate':RATE,'jobs':jobs,'directionJobs':direction_jobs,'directions':routes,'directionCodeConflicts':conflicts}

def write_preview(plan,out):
    out.mkdir(parents=True,exist_ok=True)
    (out/'PLAN_GRG.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    with (out/'PODGLAD_NAZW_GRG.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f,delimiter=';');w.writerow(['numer_GRG','plik_HEX','nazwa_z_AutoEdit','tekst_mowiony','na_zadanie'])
        for j in plan['jobs']:w.writerow([j['id'],j['file'],j['name'],j['text'],j['onRequest']])
    with (out/'PODGLAD_KIERUNKOW_GRG.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f,delimiter=';');w.writerow(['kod','plik','relacja','tekst_mowiony'])
        for j in plan['directionJobs']:w.writerow([j['id'],j['file'],j['name'],j['text']])
    (out/'KODY_KIERUNKOW_DO_SPRAWDZENIA.json').write_text(json.dumps(plan['directionCodeConflicts'],ensure_ascii=False,indent=2),encoding='utf-8')

def mp3_ok(path):
    if not path.is_file() or path.stat().st_size<1000:return False
    with path.open('rb') as f:b=f.read(3)
    return b==b'ID3' or len(b)>1 and b[0]==255 and b[1]&224==224

async def generate(plan,out):
    try:import edge_tts
    except ImportError:raise ValueError('Uruchom GENERUJ_Z_GRG.cmd, aby zainstalować edge-tts.')
    statusfile=out/'NAGRANIA_GRG_SHA256.json'
    status=json.loads(statusfile.read_text(encoding='utf-8')) if statusfile.exists() else {}
    cache=out/'_cache';cache.mkdir(exist_ok=True)
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    jobs=plan['jobs']+plan['directionJobs']
    for i,job in enumerate(jobs,1):
        path=out/job['file'];digest=hashlib.sha256((VOICE+'|'+RATE+'|'+job['text']).encode()).hexdigest();entry=status.get(job['file'],{})
        if mp3_ok(path) and entry.get('textHash')==digest and entry.get('sha256')==hashlib.sha256(path.read_bytes()).hexdigest():print(f'[{i}/{len(jobs)}] GOTOWY {job["file"]}');continue
        cached=cache/(digest+'.mp3')
        if not mp3_ok(cached):
            for attempt in range(3):
                try:
                    tmp=cache/(digest+'.new.mp3');await edge_tts.Communicate(job['text'],VOICE,rate=RATE).save(str(tmp))
                    if not mp3_ok(tmp):raise ValueError('Nieprawidłowe MP3')
                    tmp.replace(cached);break
                except Exception:
                    if attempt==2:raise
                    await asyncio.sleep(2*(attempt+1))
        if path.exists():
            backup=out/'_kopie'/stamp;backup.mkdir(parents=True,exist_ok=True);shutil.copy2(path,backup/path.name)
        shutil.copy2(cached,path)
        status[job['file']]={'id':job['id'],'name':job['name'],'text':job['text'],'textHash':digest,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        statusfile.write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf-8');print(f'[{i}/{len(jobs)}] OK {job["file"]}: {job["text"]}')
    print('Gotowe nagrania:',out)

def main():
    desktop=Path.home()/'Desktop/grg/grgmonis.skl';bundled=BASE/'grgmonis.skl';default=bundled if bundled.exists() else desktop
    ap=argparse.ArgumentParser();ap.add_argument('--input',type=Path,default=default);ap.add_argument('--output',type=Path);ap.add_argument('--dry-run',action='store_true');args=ap.parse_args()
    source=args.input.resolve();out=args.output.resolve() if args.output else (desktop.parent/'MP3' if desktop.parent.is_dir() else source.parent/'MP3');plan=make_plan(source);write_preview(plan,out)
    print('Przystanki:',len(plan['jobs']),'różne teksty:',len({j['text'] for j in plan['jobs']}),'kierunki z jednoznacznym kodem:',len(plan['directionJobs']))
    if plan['directionCodeConflicts']:print('UWAGA: kilka kierunków ma ten sam kod K. Raport zapisano obok podglądu; skrypt pomija konfliktowy plik K, generuje wszystkie P i tylko jednoznaczne K.')
    if args.dry_run:
        print('Tylko podgląd, bez generowania mowy:',out);return
    asyncio.run(generate(plan,out))
if __name__=='__main__':
    try:main()
    except Exception as exc:print('BŁĄD:',exc);sys.exit(1)
