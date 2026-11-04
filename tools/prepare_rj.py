"""Validate the user-generated AutoEdit RJ, then embed it without rewriting it."""
from __future__ import annotations
import argparse, base64, hashlib, json, re, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SECTIONS=['Txt','Vtr','Czs','Prz','Odc','Trs','Obo','Krs','Krw','Kwi','Cnz','Cnw','Cnt','Tpd','Kal','Rwsk','TKW']
def norm(s):return re.sub(r'\W+',' ',s.upper()).strip()
def inspect(data):
    if len(data)<189 or len(data)>32*1024*1024:raise ValueError('Nieprawidłowy rozmiar RJ')
    u16=lambda p:struct.unpack_from('>H',data,p)[0]
    u32=lambda p:struct.unpack_from('>I',data,p)[0]
    if u32(3)!=len(data):raise ValueError('Długość pliku nie zgadza się z nagłówkiem RJ')
    header=u16(7)
    if not 189<=header<=len(data):raise ValueError('Nieprawidłowy nagłówek RJ')
    sections={}
    for i,name in enumerate(SECTIONS):
        p=19+10*i;offset,length,size=u32(p),u32(p+4),u16(p+8)
        if offset+length>len(data) or (size and length%size):raise ValueError('Uszkodzona sekcja '+name)
        sections[name]=(offset,length,size)
    for name,minsize in [('Prz',24),('Vtr',32),('Trs',4),('Odc',10)]:
        offset,length,size=sections[name]
        if size<minsize or length<size:raise ValueError('Pusty lub uszkodzony rozkład: '+name)
    ttr,end=u32(11),u32(11)+u32(15)
    if not header<=ttr<end<=len(data):raise ValueError('Nieprawidłowa tablica tekstów')
    def text(ref):
        offset,length,size=sections['Txt']
        if size>=4 and offset<=ref and ref+4<=offset+length:ref=u32(ref)
        if not ttr<=ref<end:return ''
        z=data.find(b'\0',ref,end)
        if z<0:raise ValueError('Niepełna nazwa przystanku')
        return data[ref:z].decode('cp852')
    offset,length,size=sections['Prz'];stops=[]
    for p in range(offset,offset+length,size):stops.append({'id':u16(p),'name':text(u32(p+2))})
    if len({s['id'] for s in stops})!=len(stops) or any(not s['name'] for s in stops):raise ValueError('Powielone ID lub pusta nazwa przystanku')
    addresses=set(range(offset,offset+length,size))
    vo,vl,vs=sections['Vtr'];to,tl,ts=sections['Trs'];oo,ol,os=sections['Odc']
    for p in range(vo,vo+vl,vs):
        count,pointer=u16(p+25),u32(p+27)
        if not count or pointer<to or pointer+count*ts>to+tl or (pointer-to)%ts:raise ValueError('Uszkodzony przebieg wariantu')
        for j in range(count):
            odc=u32(pointer+j*ts)
            if odc<oo or odc+os>oo+ol or (odc-oo)%os:raise ValueError('Nieprawidłowy odcinek trasy')
            if u32(odc+2) not in addresses or u32(odc+6) not in addresses:raise ValueError('Odcinek wskazuje nieistniejący przystanek')
    return stops,sections
def prepare(folder=None,require=False):
    folder=Path(folder) if folder else ROOT/'rj';files=list(folder.glob('*.011'))
    if not files:
        if require:raise ValueError('Wygeneruj RJ w AutoEdit i włóż JEDEN plik .011 do folderu rj. LG nie jest RJ.')
        return None
    if len(files)!=1:raise ValueError('Folder rj ma zawierać dokładnie jeden aktywny .011. Przenieś starsze pliki poza rj.')
    source=files[0];data=source.read_bytes();stops,sections=inspect(data)
    registry=json.loads((ROOT/'GPS_BERDECHOW_ZATWIERDZONY.json').read_text(encoding='utf-8'))
    if require:
        vo,vl,vs=sections['Vtr'];expected=registry.get('expectedVariantCount',11)
        if vl//vs<expected:raise ValueError('RJ zawiera tylko '+str(vl//vs)+' wariantów. Wygeneruj wszystkie '+str(expected)+' ze wspólnego projektu MONIS_DEBICA.')
        actual={s['id']:norm(s['name']) for s in stops}
        for s in registry['requiredStops']:
            if actual.get(s['id'])!=norm(s['name']):raise ValueError('RJ nie pasuje do wspólnego projektu v16: ID '+str(s['id'])+' '+s['name'])
    payload={'name':source.name,'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode(),'stops':len(stops)}
    (ROOT/'app/src/main/assets/bundled-rj.js').write_text('window.SRGBundledRJ='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
    print('RJ do APK:',source.name,'przystanki:',len(stops),'SHA256:',payload['sha256'])
    return payload
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--require',action='store_true');args=ap.parse_args()
    try:prepare(require=args.require)
    except (ValueError,OSError) as e:raise SystemExit(str(e))
