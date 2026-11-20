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
    if plan['directionCodeConflicts']:raise ValueError('Konflikt kodów kierunków GRG')
    files=list((ROOT/'rj').glob('*.011'))
    if len(files)!=1:raise ValueError('Wymagany jeden RJ')
    data=files[0].read_bytes();stops,sections=inspect(data)
    planned_stops={j['id']:norm(j['name']) for j in plan['jobs']}
    if any(planned_stops.get(s['id'])!=norm(s['name']) for s in stops):raise ValueError('Przystanki GRG nie pasują do aktywnego RJ')
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
    if any(starts.get(code)!=value for code,value in actual.items()):raise ValueError('Kody kierunków GRG nie pasują do aktywnego RJ')
    # The user explicitly postponed a new .011 export. Extra recordings must still
    # match the editable AutoEdit project exactly, rather than bypassing validation.
    if len(planned_stops)>len(stops) or len(starts)>len(actual):
        try:
            from .autoedit_table import Table
        except ImportError:
            from autoedit_table import Table
        folder=ROOT/'autoedit/MONIS_DEBICA'
        native_stops=Table(folder/'stops.db'); native_variants=Table(folder/'variants.db'); native_routes=Table(folder/'route.db')
        registry={int(native_stops.get(row,7)):norm(native_stops.get(row,1)) for row in native_stops.rows}
        if registry!=planned_stops:raise ValueError('Plan GRG nie pasuje do wszystkich przystanków projektu AutoEdit')
        expected={}
        for row in native_variants.rows:
            number=int(native_variants.get(row,0));code='K%04X.mp3'%int(native_variants.get(row,3))
            route=sorted((r for r in native_routes.rows if int(native_routes.get(r,8))==number),key=lambda r:native_routes.get(r,0))
            if not route or code in expected:raise ValueError('Nieprawidłowy wariant AutoEdit')
            first=int(native_routes.get(route[0],1));last=int(native_routes.get(route[-1],1))
            expected[code]=registry[first]+'|'+registry[last]
        if starts!=expected:raise ValueError('Kody GRG nie pasują do wariantów projektu AutoEdit')
    for j in jobs:
        name=j['file']
        if not re.fullmatch(r'[PK][0-9A-F]{4}\.mp3',name):raise ValueError('Nieprawidłowa nazwa MP3')
        raw=(ROOT/'app/src/main/assets/audio/grg'/name).read_bytes();saved=state[name]
        fingerprint=hashlib.sha256((plan['voice']+'|'+plan['rate']+'|'+j['text']).encode()).hexdigest()
        if len(raw)<1000 or not(raw.startswith(b'ID3') or raw[0]==255):raise ValueError('Nieprawidłowy MP3 '+name)
        if saved['sha256']!=hashlib.sha256(raw).hexdigest() or saved['textHash']!=fingerprint:raise ValueError('Niezgodny SHA256 '+name)
    payload={'stops':{str(j['id']):{'name':j['name'],'file':j['file'],'containsOnRequest':bool(j.get('onRequest'))} for j in plan['jobs']},'starts':{v:k for k,v in starts.items()}}
    (ROOT/'app/src/main/assets/grg-audio-data.js').write_text('window.SRGGRGAudioData='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
    print(f"GRG: {len(plan['jobs'])} przystanków, {len(plan['directionJobs'])} kierunków; SHA256 i zgodność RJ/projektu AutoEdit poprawne.")
if __name__=='__main__':prepare()
