/* SRG Mobile 1.4.22 — departure-based progression.
 * Advance the active RJ stop about 50 m AFTER leaving the CURRENT stop,
 * not on ARRIVAL at the next stop. Only one stop at a time; GPS quality,
 * movement and route direction guard against stationary GNSS drift.
 */
(function(root){
 'use strict';
 const R=Math.PI/180,EARTH=6371000;
 const valid=p=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 function distance(a,b){
  if(!valid(a)||!valid(b))return Infinity;
  const dlat=(b.lat-a.lat)*R,dlon=(b.lon-a.lon)*R;
  const q=Math.sin(dlat/2)**2+Math.cos(a.lat*R)*Math.cos(b.lat*R)*Math.sin(dlon/2)**2;
  return 2*EARTH*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));
 }
 function trackPass(a,b,stop,accuracy){
  if(!valid(a)||!valid(b)||!valid(stop))return false;
  const elapsed=b.now-a.now;
  if(elapsed<700||elapsed>20000)return false;
  const traveled=distance(a,b);
  if(traveled<20||traveled>Math.min(350,elapsed*45))return false;
  const sx=Math.cos(stop.lat*R)*111320,sy=111195;
  const ax=(a.lon-stop.lon)*sx,ay=(a.lat-stop.lat)*sy;
  const bx=(b.lon-stop.lon)*sx,by=(b.lat-stop.lat)*sy;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  if(den<400)return false;
  const t=-(ax*dx+ay*dy)/den;
  if(t<0||t>1)return false;
  return Math.hypot(ax+t*dx,ay+t*dy)<=Math.min(90,Math.max(36,accuracy+20));
 }
 function createTracker(){
  let courseKey=null,activeIndex=-1,near=false,armNextDistance=Infinity;
  let votes=0,lastVote=0,lastFix=null,lastAdvance=-Infinity;
  function clearCandidate(){votes=0;lastVote=0;}
  function reset(){courseKey=null;activeIndex=-1;near=false;armNextDistance=Infinity;clearCandidate();lastFix=null;lastAdvance=-Infinity;}
  function evaluate({enabled,courseActive,fix,stops,index,pending,courseKey:key,now=Date.now()}){
   if(!enabled){reset();return{status:'WYŁĄCZONY'};}
   if(!courseActive||!Array.isArray(stops)||!stops.length||!Number.isInteger(index)||index<0){reset();return{status:'BRAK AKTYWNEGO KURSU'};}
   const signature=String(key);
   if(signature!==courseKey){reset();courseKey=signature;}
   if(index!==activeIndex){activeIndex=index;near=false;armNextDistance=Infinity;clearCandidate();lastFix=null;}
   if(Number.isInteger(pending)){clearCandidate();lastFix=null;return{status:'ZATWIERDŹ LUB ANULUJ RĘCZNY WYBÓR'};}
   if(index>=stops.length-1){clearCandidate();return{status:'OSTATNI PRZYSTANEK — BEZ AUTOMATYCZNEGO KOŃCZENIA'};}
   const current=stops[index],next=stops[index+1];
   if(!valid(current)||!valid(next)){clearCandidate();return{status:'BRAK WSPÓŁRZĘDNYCH RJ'};}
   if(!fix||!valid(fix)){clearCandidate();return{status:'OCZEKIWANIE NA GPS'};}
   const acc=Number(fix.acc);
   if(!Number.isFinite(acc)||acc<0||acc>90){clearCandidate();return{status:'GPS NIEDOKŁADNY (MAKS. 90 m)'};}
   const d=distance(current,fix),nextDist=distance(next,fix);
   const stopSpacing=distance(current,next);
   const nearZone=Math.min(75,Math.max(40,acc+15));
   const departZone=Math.max(50,Math.min(65,acc*0.9));
   const result={distance:d,targetIndex:index+1,stopName:next.name||'',status:`OD ${index+1}/${stops.length} ${current.name||''}: ${Math.round(d)} m · NASTĘPNY: ${next.name||''}`};
   const sample={lat:fix.lat,lon:fix.lon,acc,now};
   const previous=lastFix;
   lastFix=sample;
   if(previous&&now<previous.now){clearCandidate();near=false;armNextDistance=Infinity;}
   if(d<=nearZone){
    if(!near){near=true;armNextDistance=nextDist;clearCandidate();}
    else armNextDistance=Math.max(armNextDistance,nextDist);
   }
   if(!near){
    clearCandidate();
    return{...result,status:`OCZEKIWANIE NA AKTUALNY PRZYSTANEK · ${Math.round(d)} m (GPS ±${Math.round(acc)} m)`};
   }
   if(now-lastAdvance<3500){clearCandidate();return{...result,status:'GPS: CHWILA PO ZMIANIE PRZYSTANKU'};}
   const speed=Number(fix.speed);
   const moving=Number.isFinite(speed)?speed>=1.5:!!previous&&
    (now-previous.now>=700&&now-previous.now<=10000)&&
    distance(previous,sample)>Math.max(18,(previous.acc+acc)*0.7);
   const headingOk=(armNextDistance-nextDist>=14);
   const farLimit=Math.max(80,Math.min(250,stopSpacing*0.65));
   const leaving=d>=departZone&&d<=farLimit&&moving&&headingOk;
   if(!leaving){clearCandidate();return{...result,status:!moving?`POSTÓJ — CZEKAM NA ODJAZD (OD PRZYSTANKU ${Math.round(d)} m)`:
    !headingOk?`CZEKAM NA RUCH W KIERUNKU NASTĘPNEGO (OD ${Math.round(d)} m)`:
    `ODJAZD: ${Math.round(d)} m / ${Math.round(departZone)} m`};}
   if(!lastVote||now-lastVote>7500||now<lastVote){votes=1;lastVote=now;}
   else if(now-lastVote>=650){votes++;lastVote=now;}
   if(votes>=2){
    lastAdvance=now;clearCandidate();near=false;armNextDistance=Infinity;
    return{...result,advance:true,nextIndex:index+1,departure:true,
      status:`ODJAZD +50 m → PRZYSTANEK ${index+2}/${stops.length}: ${next.name||''}`};
   }
   return{...result,status:`POTWIERDZANIE ODJAZDU ${votes}/2 · ${Math.round(d)} m`,confirmations:votes};
  }
  return{evaluate,reset};
 }
 root.SRGAutoGPS={createTracker,distance,trackPass};
})(typeof window!=='undefined'?window:globalThis);
