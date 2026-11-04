"""Build an allowlisted asset tree: no driver's RJ, courses, GPS, captures or voices."""
from pathlib import Path
import argparse,re,shutil
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'app/src/main/assets'
COMMON=['index.html','phone-layout.css','phone-layout.js','course-layout.css','local-timetable.js','auto-gps.js','voice-gps.js','schedule-deviation.js','lcd-cycle.js','rg-usb.js','ibis.js','omsi.js','lcd.html']
GENERIC_AUDIO=['audio/chimes/'+str(i)+'.mp3' for i in range(1,5)]+['audio/'+n+'.mp3' for n in ['next','terminal','inspection','na_zadanie']]
def replace_constant(source,name,value):
    m=re.search(r'\bconst '+name+r'\s*=',source)
    if not m:raise ValueError('Missing constant '+name)
    i=m.end();depth=0;quote=None;comment=None
    while i<len(source):
        c=source[i];pair=source[i:i+2]
        if comment=='line':
            if c=='\n':comment=None
        elif comment=='block':
            if pair=='*/':comment=None;i+=1
        elif quote:
            if c=='\\':i+=1
            elif c==quote:quote=None
        elif pair=='//':comment='line';i+=1
        elif pair=='/*':comment='block';i+=1
        elif c in "'\"`":quote=c
        elif c in '[{(':depth+=1
        elif c in ']})':depth-=1
        elif c==';' and depth==0:return source[:m.end()]+value+source[i:]
        i+=1
    raise ValueError('Unclosed constant '+name)
def prepare(output):
    out=Path(output);out.mkdir(parents=True,exist_ok=True)
    # Refuse stale generated files rather than accidentally shipping driver data.
    if any(out.iterdir()):
        allowed=set(COMMON+['edition.js','transfers.js']+GENERIC_AUDIO)
        if any(p.relative_to(out).as_posix() not in allowed for p in out.rglob('*') if p.is_file()):raise ValueError('Unexpected files in public output')
    for name in COMMON:shutil.copy2(ASSETS/name,out/name)
    for name in GENERIC_AUDIO:
        target=out/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ASSETS/name,target)
    s=(out/'index.html').read_text(encoding='utf-8')
    for name,value in [('BUILTIN_RJ_B64',"''"),('BUILTIN_RJ_NAME',"''"),('BUILTIN_STOP_GPS','{}'),('PHOTO_STOP_TIMES_BY_COURSE','{}'),('MANUAL_DUTIES','[]'),('TRANSFER_BY_ID','{}')]:s=replace_constant(s,name,value)
    keep=set(COMMON+['edition.js','transfers.js'])
    s=re.sub(r'<script src="([^"]+)"\s*></script>',lambda m:m[0] if m[1] in keep else '',s)
    s=s.replace("let vehicleNumber='75'","let vehicleNumber=''").replace("selectedDuty:'S-25'","selectedDuty:''")
    # Public copy has no built-in, stand-alone demonstration course.
    a=s.index("out.push({index:'video-1010'");b=s.index(';return out.flatMap',a)
    s=s[:a]+s[b:]
    (out/'index.html').write_text(s,encoding='utf-8')
    (out/'edition.js').write_text("window.SRGEdition={public:true,name:'Public'};\n",encoding='utf-8')
    (out/'transfers.js').write_text('window.SRGTransfers={forStop:()=>null,stations:[],railRows:()=>[]};\n',encoding='utf-8')
    print('Public assets ready: no bundled RJ, stop/direction recordings, GPS or captures; generic sounds retained')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);prepare(p.parse_args().output)
