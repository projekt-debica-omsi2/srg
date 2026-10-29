(function(root){'use strict';
 const stations=[
 {key:'rzeszow-da',ids:[34,40],name:'RZESZÓW DWORZEC AUTOBUSOWY'},
 {key:'sedziszow-grunwaldzka',ids:[21,49],name:'SĘDZISZÓW MAŁOPOLSKI GRUNWALDZKA'},
 {key:'debica-da',ids:[1,68],name:'DĘBICA DWORZEC AUTOBUSOWY'},
 {key:'ropczyce-da',ids:[14,56],name:'ROPCZYCE DWORZEC AUTOBUSOWY'},
 {key:'sedziszow-mlodych',ids:[18,52],name:'SĘDZISZÓW MAŁOPOLSKI OSIEDLE MŁODYCH'},
 {key:'rzeszow-lokalny',ids:[33,41],name:'RZESZÓW DWORZEC LOKALNY'}];
 const dateFmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'});
 const timeFmt=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function forStop(stop,feed=root.SRGTransferData,now=Date.now()){
  const station=stations.find(s=>s.ids.includes(stop?.id)&&s.name===String(stop?.name||'').trim().toUpperCase());
  if(station?.key==='ropczyce-da'&&root.SRGRopczyce)return root.SRGRopczyce.forStop(stop,now);
  const networkRows=Number.isFinite(now)?root.SRGMKS?.rowsFor(stop,dateFmt.format(now),timeFmt.format(now)):null;
  if(networkRows&&station?.key!=='debica-da'){const time=timeFmt.format(now);return {przystanek:stop.name,stop:stop.name,time,rows:networkRows,rowsPerPage:8,pages:[{title:'PRZESIADKI',rows:networkRows,emptyText:'Brak odjazdów MKS w dostępnym kalendarzu na dziś'}]};}
  if(station?.key==='rzeszow-da')return hubForStop(stop,now);
  if(!station||!feed||feed.verified!==true||!Array.isArray(feed.departures)||!Number.isFinite(now))return null;
  const day=dateFmt.format(now),seen=new Set();
  const dated=root.SRGStationRail?.[station.key]?.[day];
  if(station.key==='sedziszow-grunwaldzka'&&dated){
   const time=timeFmt.format(now),rows=railRows(dated,day,time);
   return rows.length?{przystanek:stop.name,stop:stop.name,time,rows,rowsPerPage:8}:null;
  }
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
  if(station.key==='debica-da'){
   const feeds=root.SRGDebicaTransfers||{};
   const rail=dated?railRows(dated,day,localTime):rows.filter(r=>['PKP Intercity','POLREGIO','Leo Express'].includes(r.carrier));
   rail.push(...railRows(feeds.rail,day,localTime));
   rail.sort((a,b)=>a.time.localeCompare(b.time));
   const busSeen=new Set();
   const combinedBus=[...rows.filter(r=>!['PKP Intercity','POLREGIO','Leo Express'].includes(r.carrier)),...railRows(feeds.monis,day,localTime)].sort((a,b)=>a.time.localeCompare(b.time)||a.carrier.localeCompare(b.carrier)).filter(r=>{const key=JSON.stringify([r.time,r.carrier,r.direction]);if(busSeen.has(key))return false;busSeen.add(key);return true;}).slice(0,8);
   const pages=[
    {title:'PRZESIADKI',rows:rail.slice(0,8),emptyText:'Brak dostępnych odjazdów kolejowych'},
    {title:'PRZESIADKI',rows:networkRows??(root.SRGTimetableCache?.mksRows(root.SRGMKSDebica,day,localTime)||railRows(feeds.mks,day,localTime)),emptyText:'Brak dostępnych odjazdów MKS'},
    {title:'PRZESIADKI',rows:combinedBus,emptyText:'Brak dostępnych odjazdów autobusów'}
   ];
   return {przystanek:stop.name,stop:stop.name,time:localTime,rows:rows.slice(0,8),rowsPerPage:8,pages};
  }
  return rows.length?{przystanek:stop.name,stop:stop.name,time:timeFmt.format(now),rows:rows.slice(0,8),rowsPerPage:8}:null;
 }
 function hubForStop(stop,now){
  if(!Number.isFinite(now))return null;
  const day=dateFmt.format(now),time=timeFmt.format(now),bus=pksForStop(stop,root.SRGPKSRzeszow,now);
  const feed=root.SRGMPKRzeszow,weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const holiday=['2026-11-01','2026-11-11'].includes(day);
  const profile=holiday||weekday===0?'NS':weekday===6?'SS':day==='2026-10-14'?'PW':'PS';
  const mpk=feed&&day>=feed.effectiveFrom&&day<feed.reviewAfter?feed.departures.filter(r=>r.profile===profile&&r.time>time).sort((a,b)=>a.time.localeCompare(b.time)||a.carrier.localeCompare(b.carrier)).slice(0,8):[];
  const rail=railRows(root.SRGStationRail?.['rzeszow-da']?.[day]||root.SRGRailRzeszow,day,time);
  if(!bus&&!mpk.length&&!rail.length)return null;
  const pages=[
   {title:'PRZESIADKI',rows:bus?.rows||[],emptyText:'Brak dalszych odjazdów w rozkładzie na dziś'},
   {title:'PRZESIADKI',rows:rail,emptyText:'Rozkład kolejowy niedostępny'},
   {title:'PRZESIADKI',rows:mpk,emptyText:'Brak dostępnych odjazdów'}
  ];
  return {przystanek:stop.name,stop:stop.name,time,rows:bus?.rows||[],rowsPerPage:8,pages};
 }
 function railRows(feed,day,time){
  if(!feed||!Array.isArray(feed.departures)||!feed.calendar)return [];
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const matches=c=>c.mode==='dates'&&Array.isArray(c.dates)&&c.dates.includes(day)||c.mode==='weekly'&&(!c.validFrom||day>=c.validFrom)&&(!c.validTo||day<=c.validTo)&&Array.isArray(c.weekdays)&&c.weekdays.includes(weekday);
  if(!matches(feed.calendar))return [];
  return feed.departures.filter(r=>(!r.calendar||matches(r.calendar))&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)&&r.time>time&&r.carrier&&r.direction)
   .sort((a,b)=>a.time.localeCompare(b.time)).slice(0,8).map(r=>({carrier:r.carrier,direction:r.direction,time:r.time}));
 }
 function pksForStop(stop,feed,now){
  if(!feed||!Number.isFinite(now)||!Array.isArray(feed.departures))return null;
  const day=dateFmt.format(now),time=timeFmt.format(now);
  const pksValid=day>=feed.validFrom&&day<=feed.validTo;
  const seen=new Set();
  const rows=feed.departures.filter(r=>(pksValid||r.carrier==='Monis')&&r.time>time&&r.dates.includes(day))
   .sort((a,b)=>a.time.localeCompare(b.time)||a.direction.localeCompare(b.direction,'pl'))
   .filter(r=>{const k=JSON.stringify([r.carrier,r.time,r.direction,r.platform]);if(seen.has(k))return false;seen.add(k);return true;})
   .slice(0,8).map(r=>({carrier:r.carrier,direction:r.direction,time:r.time,platform:r.platform}));
  return rows.length?{przystanek:stop.name,stop:stop.name,time,rows,rowsPerPage:8}:null;
 }
 root.SRGTransfers={stations,forStop,railRows};
 if(typeof module==='object'&&module.exports)module.exports=root.SRGTransfers;
})(typeof window==='object'?window:globalThis);
