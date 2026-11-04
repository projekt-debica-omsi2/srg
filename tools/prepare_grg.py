"""Verify the complete GRG recordings against their fingerprints and active RJ."""
import hashlib,json,re,struct
from pathlib import Path
try:
    from .prepare_rj import inspect,norm
except ImportError:
    from prepare_rj import inspect,norm
ROOT=Path(__file__).resolve().parents[1]
def prepare():
    plan=json.loads((ROOT/'PLAN_GRG.json').read_text(encoding='utf-8'))
    if (plan['voice'],plan['rate'])!=('pl-PL-MarekNeural','-4%'):raise ValueError('Niespójny głos lub tempo GRG')
    state=json.loads((ROOT/'NAGRANIA_GRG_SHA256.json').read_text(encoding='utf-8'))
    jobs=plan['jobs']+plan['directionJobs']
    if len(plan['jobs'])!=110 or len(plan['directionJobs'])!=11 or plan['directionCodeConflicts']:raise ValueError('Niepełny plan GRG')
    files=list((ROOT/'rj').glob('*.011'))
    if len(files)!=1:raise ValueError('Wymagany jeden RJ')
    data=files[0].read_bytes();stops,sections=inspect(data)
    if {s['id']:norm(s['name']) for s in stops}!={j['id']:norm(j['name']) for j in plan['jobs']}:raise ValueError('Przystanki GRG nie pasują do RJ')
    u16=lambda p:struct.unpack_from('>H',data,p)[0]
    u32=lambda p:struct.unpack_from('>I',data,p)[0]
    po,pl,ps=sections['Prz']; byaddr={po+i*ps:s for i,s in enumerate(stops)}
    vo,vl,vs=sections['Vtr'];to,tl,ts=sections['Trs']
    actual={}
    for p in range(vo,vo+vl,vs):
        count,ptr=u16(p+25),u32(p+27)
        first=byaddr[u32(u32(ptr)+2)]['name']
        last=byaddr[u32(u32(ptr+(count-1)*ts)+6)]['name']
        code='K%04X.mp3'%u16(p+23)
        if code in actual:raise ValueError('Powielony kod kierunku RJ')
        actual[code]=norm(first)+'|'+norm(last)
    starts={j['file']:'|'.join(norm(s) for s in j['name'].split('>')) for j in plan['directionJobs']}
    if starts!=actual:raise ValueError('Kody kierunków GRG nie pasują do RJ')
    for j in jobs:
        name=j['file']
        if not re.fullmatch(r'[PK][0-9A-F]{4}\.mp3',name):raise ValueError('Nieprawidłowa nazwa MP3')
        raw=(ROOT/'app/src/main/assets/audio/grg'/name).read_bytes();saved=state[name]
        fingerprint=hashlib.sha256((plan['voice']+'|'+plan['rate']+'|'+j['text']).encode()).hexdigest()
        if len(raw)<1000 or not(raw.startswith(b'ID3') or raw[0]==255):raise ValueError('Nieprawidłowy MP3 '+name)
        if saved['sha256']!=hashlib.sha256(raw).hexdigest() or saved['textHash']!=fingerprint:raise ValueError('Niezgodny SHA256 '+name)
    payload={'stops':{str(j['id']):{'name':j['name'],'file':j['file']} for j in plan['jobs']},'starts':{v:k for k,v in starts.items()}}
    (ROOT/'app/src/main/assets/grg-audio-data.js').write_text('window.SRGGRGAudioData='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
    print('GRG: 110 przystanków, 11 kierunków; SHA256 i zgodność z RJ poprawne.')
if __name__=='__main__':prepare()
