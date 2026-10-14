'use strict';
/* SRG LCD v4.1: transfers until actual next-stop announcement after departure; then ads. */
const el = id => document.getElementById(id);
let currentState=null, ads=[], adsSignature='', adTimer=null, adNumber=-1, routeSignature='', pollInFlight=false;
let lastMode='', transferSignature='', stopSignature='';
const previewParams=new URLSearchParams(location.search);
const forcedPreview=previewParams.get('preview');
const weekFormat=new Intl.DateTimeFormat('pl-PL',{weekday:'long'});
const dateFormat=new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'long',year:'numeric'});
function tickClock(){
 const d=new Date();el('time').textContent=`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
 el('weekday').textContent=weekFormat.format(d);
 el('longDate').textContent=dateFormat.format(d);
}
function isActive(d){return Boolean(d && d.kursAktywny===true && d.kursId && Array.isArray(d.przystanki) && d.przystanki.length)}
function show(panel){if(lastMode===panel)return;lastMode=panel;el('clockPanel').hidden=panel!=='clock';el('routePanel').hidden=panel!=='route';el('stopPanel').hidden=panel!=='stop'}
function routeText(stops){return stops.map(x=>x.nazwa||'').filter(Boolean).join('  –  ')}
function setRoute(d){
 const key=JSON.stringify([d.kursId,d.linia,d.kierunek,d.aktualnyIndeks,d.przystanki.map(x=>x.nazwa)]);
 if(key===routeSignature)return;routeSignature=key;
 // Numer linii i kolejność przystanków pochodzą z aktywnego wariantu wczytanego z pliku RJ.
 el('routeLine').textContent=d.linia||'—';el('routeDirection').textContent='→ '+(d.kierunek||d.przystanki.at(-1)?.nazwa||'—').toLocaleUpperCase('pl-PL');
 el('routeText').textContent=routeText(d.przystanki.slice(Math.max(0,d.aktualnyIndeks||0))).toLocaleUpperCase('pl-PL');
 const r=el('routeText');setTimeout(()=>fitMarquee(r,r.parentElement,'route'),0);
}
function setStop(label,name,note){
 const n=String(name||'—').toLocaleUpperCase('pl-PL');
 const sig=JSON.stringify([label,n,note||'']);
 if(sig===stopSignature)return;stopSignature=sig;el('stopLabel').textContent=label;el('stopName').textContent=n;
 el('stopName').classList.toggle('small',n.length>23);el('stopName').classList.toggle('tiny',n.length>31);
 el('stopNote').textContent=note||'';el('stopPanel').classList.toggle('next-mode',label.startsWith('NASTĘPNY'));setTimeout(()=>fitMarquee(el('stopName'),el('stopPanel'),'stop'),0);
}
function fitMarquee(node,holder,type){
 if(!node||!holder)return;
 const available=type==='route'?holder.clientWidth:holder.clientWidth*0.96;
 node.classList.remove('scrolling');holder.classList.remove('moving');node.style.removeProperty('--start-x');node.style.removeProperty('--end-x');
 if(type!=='route' && node.scrollWidth<=available+4)return;
 const start=type==='stop'?(node.scrollWidth+32):holder.clientWidth;
 const distance=type==='stop'?(node.scrollWidth+holder.clientWidth+64):(node.scrollWidth+holder.clientWidth+64);
 node.style.setProperty('--start-x',start+'px');node.style.setProperty('--end-x',(start-distance)+'px');
 node.style.setProperty(type==='route'?'--marquee-duration':'--stop-duration',(Math.max(12,Math.round(distance/48)+8))+'s');
 if(type==='route')holder.classList.add('moving');else node.classList.add('scrolling');
}
const configuredCycle=window.SRGLcdCycle.create();
let configuredMode='',manualScreenSignature='';
function paintConfigured(d){
 const now=Date.now(),manual=d.lcdManual,validManual=isActive(d)&&manual&&Number.isFinite(manual.expiresAt)&&manual.expiresAt>now&&['next','current'].includes(manual.type);
 if(validManual){
  const sig=JSON.stringify([manual.id,manual.type,manual.index,manual.name,manual.expiresAt]);
  if(sig!==manualScreenSignature){manualScreenSignature=sig;configuredCycle.reset()}
  configuredMode=manual.type;show('stop');
  const label=manual.type==='next'?'NASTĘPNY PRZYSTANEK:':'PRZYSTANEK:';
  const terminal=manual.type==='next'?manual.index>=d.przystanki.length-1:manual.index>=d.przystanki.length-1;
  setStop(label,manual.name||'—',terminal?'PRZYSTANEK KOŃCOWY':manual.naZadanie?'NA ŻĄDANIE':'');paintLower();return;
 }
 manualScreenSignature='';
 const step=configuredCycle.pick(d.lcdConfig,d,now);configuredMode=step.type;
 if(step.type==='route'){show('route');setRoute(d)}
 else if(step.type==='next'||step.type==='current'){
  const next=step.type==='next',st=next?d.nastepny:d.aktualny;
  const terminal=next?d.koncowyNastepny:d.koniecKursu;
  show('stop');setStop(next?'NASTĘPNY PRZYSTANEK:':'PRZYSTANEK:',st?.nazwa||'—',terminal?'PRZYSTANEK KOŃCOWY':st?.naZadanie?'NA ŻĄDANIE':'');
 }else show('clock');
 paintLower();
}
// Pokazujemy aktualny przystanek tylko w czasie dojazdu/postoju.
// Zmiana indeksu ręcznie lub przez GPS natychmiast zmienia nazwę.
let lastStopIndex=-1, stopVisibleUntil=0, lastCourse='';
function paint(){
 const d=currentState;
 if(!isActive(d)){configuredCycle.reset();configuredMode='';manualScreenSignature='';lastStopIndex=-1;lastCourse='';show('clock');paintLower();return}
 if(d.lcdConfig&&!forcedPreview){paintConfigured(d);return;}
 configuredMode='';
 const now=Date.now(), idx=Number(d.aktualnyIndeks)||0;
 if(d.kursId!==lastCourse){lastCourse=d.kursId;lastStopIndex=-1;stopVisibleUntil=0}
 if(idx!==lastStopIndex){lastStopIndex=idx;stopVisibleUntil=now+14000;routeSignature=''}
 // GPS 50 m przed przystankiem: sterownik może przekazać odległość do następnego.
 const nearNext=Number.isFinite(Number(d.odlegloscDoNastepnegoM)) && d.odlegloscDoNastepnegoM!==null && Number(d.odlegloscDoNastepnegoM)<=50 && Number(d.odlegloscDoNastepnegoM)>=0;
 const arrived=d.phase==='ARRIVAL' && now<=Number(d.phaseUntil||0);
 const onStop=arrived || now<stopVisibleUntil;
 const requested=forcedPreview;
 if(requested==='clock'){show('clock');paintLower();return}
 if(requested==='route'){show('route');setRoute(d);paintLower();return}
 if(requested==='next' || (!onStop&&nearNext)){
  const st=d.nastepny;
  setStop('NASTĘPNY PRZYSTANEK:',st?.nazwa||(d.koniecKursu?'====================':'—'),d.koncowyNastepny?'PRZYSTANEK KOŃCOWY':(st?.naZadanie?'NA ŻĄDANIE':''));show('stop');paintLower();return;
 }
 if(requested==='current' || onStop){
  const st=d.aktualny;
  setStop('PRZYSTANEK:',st?.nazwa||'—',d.koniecKursu?'PRZYSTANEK KOŃCOWY':(st?.naZadanie?'NA ŻĄDANIE':''));show('stop');paintLower();return;
 }
 // W czasie jazdy: zegar i stale przesuwająca się trasa.
 if(Math.floor(now/9000)%2===0){show('route');setRoute(d)}else show('clock');
 paintLower();
}
function setTransfer(data){
 const box=el('transferCarriers');box.replaceChildren();
 el('transferStop').textContent=String(data.przystanek||'').toLocaleUpperCase('pl-PL');
 for(const name of (data.przewoznicy||[])){
  const chip=document.createElement('span');chip.className='transfer-carrier';chip.textContent=name;box.append(chip);
 }
}
function paintLower(){
 const d=currentState, useCycle=!!d?.lcdConfig&&!forcedPreview;
 const data=isActive(d)&&(useCycle?configuredMode==='transfers':d.reklamyPoZapowiedzi!==true)?d.przesiadka:null;
 const sig=data?JSON.stringify([d.kursId,d.aktualnyIndeks,data]):'';
 if(sig!==transferSignature){transferSignature=sig;if(data)setTransfer(data)}
 // Przesiadki az do rzeczywistej zapowiedzi nastepnego przystanku po odjezdzie.
 // Pozniejsze cykliczne widoki 'next' NIE sa wyzwalaczem; sterownik przesyla nextStopAnnounced.
 // Nowy przystanek zeruje znacznik i moze ponownie pokazac przesiadki.
 const showTransfer=Boolean(data);
 el('transfer').hidden=!showTransfer;
 el('adMedia').style.visibility=showTransfer?'hidden':'visible';
}
async function pollState(){
 if(pollInFlight)return;pollInFlight=true;
 try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error(String(r.status));currentState=await r.json()}
 catch(e){currentState={kursAktywny:false}}
 finally{pollInFlight=false;paint()}
}
function chooseAd(){if(ads.length<2)return 0;let k=Math.floor(Math.random()*(ads.length-1));if(k>=adNumber)k++;return k}
function nextAd(){
 if(adTimer)clearTimeout(adTimer);const box=el('adMedia');box.replaceChildren();if(!ads.length){adNumber=-1;return}
 adNumber=chooseAd();const entry=ads[adNumber],isVideo=entry.typ==='video';
 const item=document.createElement(isVideo?'video':'img');item.className='aditem';item.src=entry.url;
 if(isVideo){item.muted=true;item.autoplay=true;item.playsInline=true;item.addEventListener('ended',nextAd,{once:true});item.addEventListener('error',nextAd,{once:true});box.append(item);adTimer=setTimeout(nextAd,60000);item.play().catch(()=>{clearTimeout(adTimer);adTimer=setTimeout(nextAd,1500)})}
 else{item.alt='';item.addEventListener('error',nextAd,{once:true});box.append(item);adTimer=setTimeout(nextAd,12000)}
}
async function pollAds(){try{const r=await fetch('/api/reklamy',{cache:'no-store'});if(!r.ok)throw Error(String(r.status));const a=await r.json();if(!Array.isArray(a))throw Error('bad list');const sig=JSON.stringify(a);if(sig!==adsSignature){adsSignature=sig;ads=a;nextAd()}}catch(e){}}
tickClock();show('clock');pollState();pollAds();
setInterval(tickClock,1000);setInterval(pollState,750);setInterval(paint,500);setInterval(pollAds,8000);
window.SRGLcdPreview={paint,tickClock,show,setState(d){currentState=d;paint()}};

window.addEventListener('resize',()=>{routeSignature='';stopSignature='';paint()});
