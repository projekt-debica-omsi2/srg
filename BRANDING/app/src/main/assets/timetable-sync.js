(function(root){'use strict';
 const native=root.SRGTimetables;
 const originalMonis=(root.SRGPKSRzeszow?.departures||[]).filter(r=>r.carrier==='Monis');
 const bundledKeys=['SRGStationRail','SRGPKSRzeszow','SRGMKSDebica','SRGMKSNetwork'];
 const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 const bundled=Object.fromEntries(bundledKeys.map(k=>[k,clone(root[k])]));
 function restoreBundled(){for(const k of bundledKeys){if(bundled[k]===undefined)delete root[k];else root[k]=clone(bundled[k]);}}
 let last='';
 const rowOK=r=>r&&typeof r.direction==='string'&&r.direction.length<300&&typeof r.carrier==='string'&&r.carrier.length<100&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time);
 function mksValid(feed){return feed?.stopId==='171'&&['Roboczy','Roboczy wakacyjny/feryjny','Sobota','Niedziele i święta'].every(k=>Array.isArray(feed.profiles?.[k])&&feed.profiles[k].length<=2000&&feed.profiles[k].every(r=>rowOK(r)&&r.stopId==='171'&&/^MKS \d+$/.test(r.carrier)))&&feed.profiles.Roboczy.length>0;}
 function mksRows(feed,day,time){
  if(!mksValid(feed))return [];
  const date=new Date(day+'T12:00:00Z'),y=date.getUTCFullYear(),wd=date.getUTCDay(),md=day.slice(5);
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
  const easter=new Date(Date.UTC(y,Math.floor(n/31)-1,n%31+1,12));const delta=Math.round((date-easter)/86400000);
  const holiday=['01-01','01-06','05-01','05-03','08-15','11-01','11-11','12-24','12-25','12-26'].includes(md)||[0,1,49,60].includes(delta);
  let profile=holiday||wd===0?'Niedziele i święta':wd===6?'Sobota':null;
  if(!profile){
   if(day<'2026-09-01'||day>'2027-08-31')return [];
   const between=(a,b)=>day>=a&&day<=b;
   const vacation=between('2026-12-23','2026-12-31')||between('2027-01-18','2027-01-31')||between('2027-03-25','2027-03-30')||between('2027-06-26','2027-08-31')||md==='10-14';
   profile=vacation?'Roboczy wakacyjny/feryjny':'Roboczy';
  }
  return feed.profiles[profile].filter(r=>r.time>time).sort((a,b)=>a.time.localeCompare(b.time)||a.carrier.localeCompare(b.carrier)).slice(0,8);
 }
 function apply(data){
  if(!data||typeof data!=='object')return false;
  if(data.useBundled===true){restoreBundled();return true;}
  const allowed=['rzeszow-da','debica-da','sedziszow-grunwaldzka'];
  for(const key of allowed){
   const feeds=data.stationRail?.[key];if(!feeds||typeof feeds!=='object')continue;
   for(const [day,feed] of Object.entries(feeds)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||feed?.calendar?.mode!=='dates'||feed.calendar.dates?.length!==1||feed.calendar.dates[0]!==day||!Array.isArray(feed.departures)||feed.departures.length>1000||!feed.departures.every(rowOK))continue;
    root.SRGStationRail??={};root.SRGStationRail[key]??={};root.SRGStationRail[key][day]=feed;
   }
  }
  if(root.SRGMKS?.valid(data.mksNetwork))root.SRGMKSNetwork=data.mksNetwork;
  if(mksValid(data.mks))root.SRGMKSDebica=data.mks;
  const pks=data.pks;
  if(pks&&/^\d{4}-\d{2}-\d{2}$/.test(pks.validFrom)&&/^\d{4}-\d{2}-\d{2}$/.test(pks.validTo)&&Array.isArray(pks.departures)&&pks.departures.length>0&&pks.departures.length<=5000&&pks.departures.every(r=>rowOK(r)&&r.carrier==='PKS Rzeszów'&&Array.isArray(r.dates)&&r.dates.every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))){
   // Monis has its own calendar and must not be relabelled or replaced by PKS data.
   root.SRGPKSRzeszow={...pks,departures:[...pks.departures,...originalMonis]};
  }
  return true;
 }
 function poll(){
  if(!native)return;
  try{
   const raw=native.snapshot();if(raw!==last){apply(JSON.parse(raw));last=raw;}
   const status=root.document?.getElementById('timetableSyncStatus');
   if(status){const d=JSON.parse(raw),checked=Object.values(d.checked||{}).filter(Number.isFinite),newest=checked.length?Math.max(...checked):0,errors=Object.entries(d.errors||{});
    if(d.useBundled){status.textContent=native.status();return;}
    status.textContent=native.status()+(newest?'\nOstatnie poprawne sprawdzenie: '+new Date(newest).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'}):'\nBrak pobranych aktualizacji — używany rozkład z aplikacji.')+'\nMKS Dębica: '+(d.mksNetwork||d.mks?'pobrana kopia online.':'baza z przesłanego pliku.')+(d.mksApi?'\nAPI MKS ('+(d.mksApi.transport==='proxy'?'proxy':'bezpośrednio')+'): pobrano '+d.mksApi.format+' ('+d.mksApi.bytes+' bajtów). '+(d.mksApi.applied?'Odjazdy z bazy są aktywne.':'Baza nie została zastosowana.'):'\nAPI MKS: oczekiwanie na pobranie bazy z rj.mks.debica.pl.')+(errors.length?'\nNie pobrano: '+errors.slice(0,4).map(([k,v])=>k+': '+v).join('; '):'');
   }
  }catch(e){const el=root.document?.getElementById('timetableSyncStatus');if(el)el.textContent='Nie udało się odczytać aktualizacji. Zachowano poprzedni rozkład.';}
 }
 root.SRGTimetableCache={apply,poll,mksRows};
 if(native){poll();root.setInterval(poll,15000);root.document?.addEventListener('visibilitychange',()=>{if(!root.document.hidden){native.check();poll();}});}
 for(const [id,flag] of [['restoreBundledTimetable',true],['resumeTimetableUpdates',false]]){
  const el=root.document?.getElementById(id);if(el)el.addEventListener('click',()=>{
   const status=root.document.getElementById('timetableSyncStatus');
   if(!native?.useBundled){if(status)status.textContent='Ta funkcja wymaga aplikacji Android.';return;}
   if(native.useBundled(flag)){last='';poll();}else if(status)status.textContent='Nie udało się zapisać ustawienia rozkładu.';
  });
 }
 const proxyInput=root.document?.getElementById('mksProxyUrl');if(proxyInput&&native?.mksProxy)proxyInput.value=native.mksProxy();
 const proxySave=root.document?.getElementById('mksSaveProxy');if(proxySave)proxySave.addEventListener('click',()=>{if(native?.setMksProxy){const message=native.setMksProxy(proxyInput.value.trim());root.document.getElementById('timetableSyncStatus').textContent=message;}});
 const exportBtn=root.document?.getElementById('mksExport');if(exportBtn)exportBtn.addEventListener('click',()=>root.SRGMksExport?.exportFile());
 const input=root.document?.getElementById('mksSourceUrl');if(input&&native?.mksSource)input.value=native.mksSource();
 const save=root.document?.getElementById('mksSaveSource');if(save)save.addEventListener('click',()=>{if(native?.setMksSource){const message=native.setMksSource(input.value.trim());root.document.getElementById('timetableSyncStatus').textContent=message;}});
 const button=root.document?.getElementById('timetableCheck');if(button)button.addEventListener('click',()=>{if(native){native.check();poll();}else{const el=root.document.getElementById('timetableSyncStatus');if(el)el.textContent='Pobieranie przez Wi-Fi działa w aplikacji Android.';}});
})(typeof window==='object'?window:globalThis);
