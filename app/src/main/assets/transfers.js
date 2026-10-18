(function(root){'use strict';
 const stations=[
 {key:'sedziszow-grunwaldzka',ids:[21,49],name:'SĘDZISZÓW MAŁOPOLSKI GRUNWALDZKA'},
 {key:'debica-da',ids:[1,68],name:'DĘBICA DWORZEC AUTOBUSOWY'},
 {key:'ropczyce-da',ids:[14,56],name:'ROPCZYCE DWORZEC AUTOBUSOWY'},
 {key:'sedziszow-mlodych',ids:[18,52],name:'SĘDZISZÓW MAŁOPOLSKI OSIEDLE MŁODYCH'},
 {key:'rzeszow-lokalny',ids:[33,41],name:'RZESZÓW DWORZEC LOKALNY'}];
 const dateFmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'});
 const timeFmt=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function forStop(stop,feed=root.SRGTransferData,now=Date.now()){
  const station=stations.find(s=>s.ids.includes(stop?.id)&&s.name===String(stop?.name||'').trim().toUpperCase());
  if(!station||!feed||feed.verified!==true||!Array.isArray(feed.departures)||!Number.isFinite(now))return null;
  const day=dateFmt.format(now),seen=new Set();
  const rows=feed.departures.filter(r=>r.station===station.key&&['FlixBus','POLREGIO'].includes(r.carrier)&&typeof r.direction==='string'&&r.direction.trim()&&!r.cancelled&&typeof r.departure==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(r.departure)).map(r=>({...r,epoch:Date.parse(r.departure)}))
   .filter(r=>Number.isFinite(r.epoch)&&r.epoch>now&&dateFmt.format(r.epoch)===day)
   .sort((a,b)=>a.epoch-b.epoch).filter(r=>{const k=JSON.stringify([r.carrier,r.train||'',r.direction,r.epoch]);if(seen.has(k))return false;seen.add(k);return true})
   .map(r=>({carrier:r.carrier,direction:r.direction,time:timeFmt.format(r.epoch),train:r.train||null,railStation:r.railStation||null}));
  // User-confirmed daily departures, compared in Warsaw civil time (also after DST changes).
  const localTime=timeFmt.format(now);
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  for(const r of (Array.isArray(feed.daily)?feed.daily:[])){
   if(r.station!==station.key||!['FlixBus','POLREGIO'].includes(r.carrier)||r.cancelled||typeof r.direction!=='string'||!r.direction.trim()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))continue;
   if(Array.isArray(r.weekdays)&&!r.weekdays.includes(weekday))continue;
   if(r.time<=localTime)continue;
   if(!rows.some(x=>x.carrier===r.carrier&&x.direction===r.direction&&x.time===r.time&&(x.train||null)===(r.train||null)))rows.push({carrier:r.carrier,direction:r.direction,time:r.time,train:r.train||null,railStation:r.railStation||null});
  }
  rows.sort((a,b)=>a.time.localeCompare(b.time));
  return rows.length?{przystanek:stop.name,stop:stop.name,time:timeFmt.format(now),rows}:null;
 }
 root.SRGTransfers={stations,forStop};
 if(typeof module==='object'&&module.exports)module.exports=root.SRGTransfers;
})(typeof window==='object'?window:globalThis);
