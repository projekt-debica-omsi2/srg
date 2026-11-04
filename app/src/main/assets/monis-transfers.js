(function(root){'use strict';
 const df=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'});
 const tf=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function runs(code,day){
  const c=root.SRGRopczyce?.calendar(day);if(!c)return false;
  const special=['2026-05-02','2026-06-05','2026-10-14'].includes(day);
  let base=code==='Dn'?c.work:code==='Sx'?c.school&&!special:code==='Hnp'?(c.work&&c.vacation)||special:code==='6n'?c.weekday===6:false;
  if(code.includes('n')&&['2026-12-24','2026-12-31','2026-04-04'].includes(day))base=false;
  return base;
 }
 function forStop(stop,now,feed=root.SRGMonisTransfersData){
  if(!Number.isFinite(now)||feed?.verified!==true||!Array.isArray(feed.stops))return null;
  const station=feed.stops.find(s=>s.ids.includes(stop?.id)&&s.name===String(stop?.name||'').trim().toUpperCase());if(!station)return null;
  const day=df.format(now),time=tf.format(now),seen=new Set(),expired=day>=feed.reviewAfter;
  const rows=expired?[]:station.departures.filter(r=>/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)&&r.time>time&&runs(r.code,day))
   .sort((a,b)=>a.time.localeCompare(b.time)||a.direction.localeCompare(b.direction,'pl'))
   .filter(r=>{const key=JSON.stringify([r.time,r.direction,r.carrier]);if(seen.has(key))return false;seen.add(key);return true})
   .map(r=>({time:r.time,direction:r.direction,carrier:r.carrier,code:r.code}));
  const pages=[];for(let i=0;i<rows.length;i+=8)pages.push({title:'PRZESIADKI',rows:rows.slice(i,i+8)});
  if(!pages.length)pages.push({title:'PRZESIADKI',rows:[],emptyText:expired?'Rozkład wymaga aktualizacji':'Brak dalszych odjazdów Monis na dziś'});
  return {przystanek:stop.name,stop:stop.name,time,rows:rows.slice(0,8),rowsPerPage:8,pages};
 }
 root.SRGMonisTransfers={runs,forStop};
})(typeof window==='object'?window:globalThis);
