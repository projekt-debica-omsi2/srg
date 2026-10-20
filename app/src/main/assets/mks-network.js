(function(root){'use strict';
 // Physical MKS stop IDs; opposite sides are deliberately kept separate.
 const map={1:[171],68:[171],2:[241],3:[243],4:[244],5:[576],6:[252],7:[253],8:[254],9:[123,308],61:[123,308],62:[61],63:[60],64:[59],65:[575],66:[87],67:[89],39:[88]};
 const expected={1:'DĘBICA DWORZEC AUTOBUSOWY',68:'DĘBICA DWORZEC AUTOBUSOWY',2:'ZURT',3:'DĘBICA RZESZOWSKA TECHNIKUM',4:'DĘBICA RZESZOWSKA RAJ',5:'DĘBICA RZESZOWSKA MKS',6:'DĘBICA RZESZOWSKA NADLEŚNICTWO',7:'NAGAWCZYNA 1',8:'NAGAWCZYNA 2',9:'ZAWADA E4',61:'ZAWADA E4',62:'NAGAWCZYNA 2',63:'NAGAWCZYNA 1',64:'DĘBICA RZESZOWSKA NADLEŚNICTWO',65:'DĘBICA RZESZOWSKA MKS',66:'DĘBICA RZESZOWSKA RAJ',67:'DĘBICA RZESZOWSKA TECHNIKUM',39:'DĘBICA RZESZOWSKA PLAC GRYFITÓW'};
 function valid(f){return f?.schema===1&&f.calendar&&Object.keys(f.calendar).length>0&&Object.keys(f.calendar).length<=730&&Object.entries(f.calendar).every(([d,p])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&typeof p==='string')&&f.stops&&[...new Set(Object.values(map).flat())].every(id=>{const s=f.stops[id];return s&&typeof s.name==='string'&&s.profiles&&Object.values(s.profiles).every(rows=>Array.isArray(rows)&&rows.length<=2000&&rows.every(r=>/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)&&r.stopId===String(id)&&typeof r.direction==='string'&&r.direction.length<300&&/^MKS \d+$/.test(r.carrier)&&Array.isArray(r.notes)&&r.notes.every(n=>typeof n==='string'&&n.length<300)));});}
 function easterDelta(day){const date=new Date(day+'T12:00:00Z'),y=date.getUTCFullYear(),a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return Math.round((date-Date.UTC(y,Math.floor(n/31)-1,n%31+1,12))/86400000);}
 function runs(note,day){
  if(!note.startsWith('NIE KURS'))return true;
  let s=note.replace(/^NIE KURS(?:UJE|JJE)\s*/,''),delta=easterDelta(day),md=day.slice(5),blocked=false,recognized=false;
  const remove=(re,test)=>{s=s.replace(re,()=>{recognized=true;if(test)blocked=true;return '';});};
  remove(/W WIELKI PIĄTEK/g,delta===-2);remove(/W WIELKĄ SOBOT[ĘE]/g,delta===-1);
  remove(/ŚW\.?\s*WIELKANOCNE/g,delta===0||delta===1);remove(/BOŻE CIAŁO/g,delta===60);
  remove(/31 GRUDNIA/g,md==='12-31');remove(/24 GRUDNIA/g,md==='12-24');
  const months={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:12}; // Source has "26XIII" for line 18's Christmas exclusion.
  s=s.replace(/(\d{1,2}(?:\s*[,iI]\s*\d{1,2})*)\s*(XIII|VIII|XII|VII|III|XI|IX|VI|IV|II|X|V|I)(?=\s|;|$|[.,])/g,(_,days,month)=>{recognized=true;for(const d of days.match(/\d+/g))if(md===String(months[month]).padStart(2,'0')+'-'+d.padStart(2,'0'))blocked=true;return '';});
  // New, unrecognised calendar restrictions are not silently treated as daily.
  return recognized&&!blocked&&s.replace(/[\s;,.iI]/g,'')==='';
 }
 function destination(row){let name=row.direction;const extra=[];for(const note of row.notes){if(note.startsWith('NIE KURS'))continue;const m=note.match(/^KURS (?:WY[DŁ]+UŻONY|SKRÓCONY|SKRÓCNY) DO (.+)$/);if(m)name=({'DWORCA PKP':'DWORZEC PKP','ZAJEZDNI MKS':'ZAJEZDNIA MKS','ZAJEZDNI':'ZAJEZDNIA MKS','LASKOWEJ':'LASKOWA','LIPIN':'LIPINY'})[m[1]]||m[1];else extra.push(note.replace(/^KURS /,''));}return name+(extra.length?' · '+extra.join('; '):'');}
 function rowsFor(stop,day,time,feed=root.SRGMKSNetwork){
  if(expected[stop?.id]!==String(stop?.name||'').trim().toUpperCase()||!map[stop?.id]||!feed)return null;
  const profile=feed.calendar?.[day];if(!profile)return [];
  const rows=map[stop.id].flatMap(id=>(feed.stops?.[id]?.profiles?.[profile]||[])).filter(r=>r.time>time&&r.notes.every(n=>runs(n,day))).map(r=>({...r,direction:destination(r)}));
  const seen=new Set();return rows.sort((a,b)=>a.time.localeCompare(b.time)||a.carrier.localeCompare(b.carrier)||a.direction.localeCompare(b.direction)).filter(r=>{const k=JSON.stringify([r.time,r.carrier,r.direction]);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,8);
 }
 root.SRGMKS={map,expected,valid,rowsFor,runs,destination};
})(typeof window==='object'?window:globalThis);
