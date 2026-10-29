/* SRG Mobile 1.4.22 — announce the CURRENT stop's NAME on ARRIVAL.
 * Departure announcement is triggered by SRGAutoGPS in index.html:
 * separate "Następny przystanek" MP3 + next stop name MP3.
 */
(function(root){
 'use strict';
 const distance=(a,b)=>root.SRGAutoGPS.distance(a,b);
 function createTracker(){
  let key=null,spoken=false,votes=0,lastVote=0,lastFix=null;
  function reset(){key=null;spoken=false;votes=0;lastVote=0;lastFix=null;}
  function evaluate({enabled,courseActive,courseKey,fix,stops,index,pending,now=Date.now()}){
   if(!enabled){reset();return{status:'WYŁĄCZONE'};}
   if(!courseActive||!Array.isArray(stops)||!Number.isInteger(index)||index<0||index>=stops.length){reset();return{status:'BRAK KURSU'};}
   const k=String(courseKey)+':'+index;
   if(k!==key){reset();key=k;}
   // First stop is spoken in the course-start/direction announcement.
   if(index===0)return{status:'PRZYSTANEK POCZĄTKOWY'};
   if(Number.isInteger(pending)){votes=0;return{status:'WYBÓR RĘCZNY'};}
   const current=stops[index];
   if(!Number.isInteger(current?.id)||![current?.lat,current?.lon,fix?.lat,fix?.lon].every(Number.isFinite))return{status:'BRAK WSPÓŁRZĘDNYCH'};
   const accuracy=Number(fix.acc);
   if(!Number.isFinite(accuracy)||accuracy<0||accuracy>90){votes=0;return{status:'GPS NIEDOKŁADNY'};}
   if(spoken)return{status:'NAZWA PRZYSTANKU JUŻ ZAPOWIEDZIANA'};
   const d=distance(fix,current);
   const zone=Math.min(85,Math.max(40,36+accuracy*0.65));
   const prev=lastFix;
   const sample={lat:fix.lat,lon:fix.lon,acc:accuracy,now};
   lastFix=sample;
   const crossed=prev&&root.SRGAutoGPS.trackPass(prev,sample,current,Math.max(accuracy,prev.acc))&&
    (Number.isFinite(fix.speed)?fix.speed>=1.5:true);
   if(d>zone&&!crossed){votes=0;return{status:`DO PRZYSTANKU ${current.name||''}: ${Math.round(d)} m (ZAPOWIEDŹ NA MIEJSCU)`,distance:d};}
   if(!lastVote||now<lastVote||now-lastVote>8500){votes=1;lastVote=now;}
   else if(now-lastVote>=650){votes++;lastVote=now;}
   // A crossed stop can be reported on one fix; otherwise 2 fixes confirm arrival.
   if(crossed||votes>=2){
    spoken=true;
    return{status:'DOJECHANO — ZAPOWIEDŹ NAZWY: '+(current.name||''),arrival:true,
      stopId:current.id,stopName:current.name||'',distance:d};
   }
   return{status:`POTWIERDZANIE DOJAZDU ${votes}/2 · ${Math.round(d)} m`,distance:d};
  }
  return{reset,evaluate};
 }
 root.SRGVoiceGPS={createTracker,distance};
})(typeof window!=='undefined'?window:globalThis);
