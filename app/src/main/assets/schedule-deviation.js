(function(root){
'use strict';
function parseHHMM(value){
 const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value||''));
 return m?Number(m[1])*60+Number(m[2]):null;
}
function formatClockMinute(mins){
 const m=((Math.round(mins)%1440)+1440)%1440;
 return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
}
function calculate({now=new Date(),plannedTime,startTime,courseDepartureAt}={}){
 const planned=parseHHMM(plannedTime),start=parseHHMM(startTime);
 if(planned===null||start===null||!Number.isFinite(courseDepartureAt)){
  return {kind:'unknown',text:'—',label:'BRAK GODZINY',title:'Nie ma wiarygodnej godziny tego przystanku.'};
 }
 // Używamy dnia startu wybranego kursu, a nie domyślnej daty tabletu.
 // Przystanek po północy należy do następnego dnia tego samego kursu.
 let offset=planned-start;if(offset<0)offset+=1440;
 const plannedAt=courseDepartureAt+offset*60000;
 if(!Number.isFinite(plannedAt))return {kind:'unknown',text:'—',label:'BRAK GODZINY',title:'Nieznany czas kursu'};
 // Zegar działa co sekundę, a planowana godzina jest początkiem wskazanej minuty.
 // Spóźnienie ma znak minus, przyspieszenie plus; exact = 0:00.
 const delta=Math.round((now.getTime()-plannedAt)/1000);
 const kind=delta===0?'ontime':delta>0?'late':'early';
 const abs=Math.abs(delta);
 const text=delta===0?'0:00':(delta>0?'-':'+')+Math.floor(abs/60)+':'+String(abs%60).padStart(2,'0');
 const label=delta===0?'O CZASIE':delta>0?'OPÓŹNIENIE':'PRZYSPIESZENIE';
 const title=delta===0?'Zgodnie z planem':delta>0?'Spóźnienie względem rozkładu':'Przed czasem względem rozkładu';
 return {kind,text,label,title,deltaSeconds:delta,deltaMinutes:Math.trunc(delta/60),plannedAt};
}
function dist(a,b){
 if(!a||!b||a.length<2||b.length<2)return null;
 const [aLat,aLon]=a,[bLat,bLon]=b;
 if(![aLat,aLon,bLat,bLon].every(Number.isFinite))return null;
 const p=Math.PI/180,R=6371000,dLat=(bLat-aLat)*p,dLon=(bLon-aLon)*p;
 const h=Math.sin(dLat/2)**2+Math.cos(aLat*p)*Math.cos(bLat*p)*Math.sin(dLon/2)**2;
 return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function estimateTimes({startTime,endTime,stops,positions}={}){
 const start=parseHHMM(startTime),end=parseHHMM(endTime);
 if(start===null||end===null||!Array.isArray(stops)||!stops.length)return [];
 let duration=end-start;if(duration<0)duration+=1440;
 if(stops.length===1)return [formatClockMinute(start)];
 const weights=[];
 for(let i=1;i<stops.length;i++){
  const a=positions?.[String(stops[i-1]?.id)],b=positions?.[String(stops[i]?.id)];
  const meters=dist(a,b);
  // Minimum 200 m postoju/manewrów i 250 m dystansu na odcinek;
  // limit chroni przed pomylonymi współrzędnymi.
  weights.push(meters===null?750:(Math.max(250,Math.min(12000,meters))+200));
 }
 const sum=weights.reduce((x,y)=>x+y,0);
 let cumulative=0;
 return stops.map((s,i)=>{
  if(i>0)cumulative+=weights[i-1];
  return formatClockMinute(start+Math.round(duration*cumulative/sum));
 });
}
root.SRGScheduleDeviation={parseHHMM,calculate,estimateTimes,formatClockMinute};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SRGScheduleDeviation;
})(typeof window!=='undefined'?window:globalThis);
