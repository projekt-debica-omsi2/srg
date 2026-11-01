(() => {
'use strict';
const $=s=>document.querySelector(s), app=window.__srg;
let enabled=false, request=0, pending=null, pendingAt=0, lastGood=0, localState=null, current=null;
let config;try{config=JSON.parse(localStorage.getItem('srgOmsiConfig')||'{}')}catch(_){config={}}
const logKey='srgOmsiEvents';
let events;try{events=JSON.parse(localStorage.getItem(logKey)||'[]')}catch(_){events=[]}
function log(event){events.push({time:new Date().toISOString(),event});events=events.slice(-500);localStorage.setItem(logKey,JSON.stringify(events));}
const style=document.createElement('style');style.textContent=`
body.omsi-mode #omsiCourse .dest,body.omsi-mode #omsiCourse .bar{background:linear-gradient(#258ce0,#124f91)!important;border-color:#4cafff!important}body.omsi-mode #omsiCourse .controls button{background:linear-gradient(#185e9b,#103859)!important;border-color:#4cafff!important}body.omsi-mode #omsiCourse .logout{background:linear-gradient(#258ce0,#124f91)!important}.omsiClockGroup{display:flex;flex-direction:column;align-items:flex-end;line-height:1.25;font-family:monospace;letter-spacing:.08em;white-space:nowrap}.omsiRealClock{font:12px system-ui;letter-spacing:0;color:#a9c7e4}.omsiCameraNav{display:flex;align-items:center;justify-content:center;gap:18px}.omsiPanel [hidden]{display:none!important}.omsiPanel{flex:1;min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.omsiPanel label{display:flex;flex-direction:column;gap:6px}.omsiPanel input,.omsiPanel select,.omsiPanel button{font:inherit;padding:12px;min-height:44px;color:#fff;background:#123d65;border:1px solid #4099e0;border-radius:5px}.omsiPanel p{margin:0;line-height:1.4}.omsiPanel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.omsiNumbers{display:grid;grid-template-columns:1fr 1fr;gap:12px}.omsiNumber{background:#10314e;padding:16px;border:1px solid #307ab0}.omsiNumber b{display:block;font-size:26px;margin-top:8px}.omsiBlack{flex:1;min-height:120px;background:#000;border:1px solid #555}.omsiPanel .omsiWarning{color:#f5d279}
`;document.head.append(style);
const main=$('main.content');main.insertAdjacentHTML('beforeend',`
<section id="omsiSettings" class="view"><div class="top">OMSI 2</div><div class="omsiPanel">
<p>Połączenie z komputerem przez Wi-Fi lub USB. Wersja testowa: odczyt zmiennych autobusu. openOMSI udostępnia kurs, przystanki i pozycję przez dodatek SRGOpenOMSI. Zakres danych OMSI 2 zależy od wtyczki.</p>
<label>Tryb OMSI 2<select id="omsiEnabled"><option value="off">Wyłączony</option><option value="on">Włączony</option></select></label>
<label>Połączenie<select id="omsiTransport"><option value="wifi">Wi-Fi / sieć lokalna</option><option value="usb">USB (ADB)</option></select></label>
<label>IPv4 komputera<input id="omsiHost" placeholder="192.168.1.10" inputmode="decimal"></label>
<label>Kod Wi-Fi (4 cyfry)<input id="omsiToken" autocomplete="off" inputmode="numeric" pattern="[0-9]{4}" maxlength="4"></label>
<button id="omsiSave">Zapisz i połącz</button><p id="omsiStatus" role="status">Tryb wyłączony</p>
<button id="omsiShowLive">Dane z gry</button><button id="omsiShowLogs">Historia połączeń</button><button id="omsiBack">Wróć</button>
</div></section>
<section id="omsiLive" class="view"><div class="top">OMSI 2 · DANE Z GRY</div><div class="omsiPanel"><p id="omsiLiveStatus">Brak połączenia</p><div class="omsiNumbers"><div class="omsiNumber">Prędkość (km/h)<b id="omsiSpeed">—</b></div><div class="omsiNumber">Kod linii IBIS (surowy)<b id="omsiLine">—</b></div><div class="omsiNumber">Kod trasy IBIS<b id="omsiRoute">—</b></div><div class="omsiNumber">Kod kierunku IBIS<b id="omsiDestination">—</b></div></div><p class="omsiWarning">Dane kursu pochodzą z gry. Brakujące wartości są oznaczone kreską. Zwykłe kursówki pozostają zapisane.</p><button id="omsiLiveBack">Ustawienia OMSI</button></div></section>
<section id="omsiCameras" class="view"><div class="top">OMSI 2 · KAMERA / LUSTERKO</div><div class="omsiPanel"><div class="omsiCameraNav"><button id="omsiCameraPrev">◀</button><span id="omsiCameraPage">Strona 1/1</span><button id="omsiCameraNext">▶</button></div><div class="cameraGrid" id="omsiCameraGrid"></div><p id="omsiCameraStatus" role="status">Oczekiwanie na niezależny obraz z gry</p><button id="omsiCameraBack">Wróć</button></div></section>
<section id="omsiLogs" class="view"><div class="top">OMSI 2 · HISTORIA</div><div class="omsiPanel"><p>Historia kontaktu z mostkiem. Utrata kontaktu nie oznacza pewnego zakończenia gry. Pełne logi komputera: %LOCALAPPDATA%\\SRG-OMSI.</p><pre id="omsiLogText"></pre><button id="omsiLogsBack">Wróć</button></div></section>`);
const tile=document.createElement('button');tile.className='settingTile';tile.innerHTML='<b>OMSI 2</b><span>Połączenie z grą</span>';tile.onclick=()=>app.go('omsiSettings');$('.settingsTiles').append(tile);
const courseView=$('#course').cloneNode(true);courseView.id='omsiCourse';courseView.classList.remove('active','extraCourse');
for(const button of courseView.querySelectorAll('.controls button'))button.disabled=false;
for(const el of courseView.querySelectorAll('[id]'))el.id='omsiUi'+el.id;
for(const el of courseView.querySelectorAll('[data-clock]'))el.removeAttribute('data-clock');
courseView.querySelector('.top span').textContent='OMSI · Linia / Kierunek:';
const omsiClock=courseView.querySelector('.clock');omsiClock.className='omsiClockGroup';omsiClock.innerHTML='<span id="omsiUiClock">Gra: —</span><small id="omsiRealClock" class="omsiRealClock"></small>';
main.append(courseView);
$('#omsiUilogoutCourse').textContent='Wybierz kurs';$('#omsiUilogoutCourse').onclick=()=>{renderPicker();app.go('omsiPicker');};
$('#omsiUicourseCurrent').onclick=()=>speakStop(selectedStop(current));
$('#omsiUiprevStop').onclick=()=>$('#omsiPrevStop').onclick();$('#omsiUinextStop').onclick=()=>$('#omsiNextStop').onclick();
$('#omsiUicancelStop').onclick=()=>$('#omsiAutoStop').onclick();
$('#omsiUiconfirmStop').onclick=()=>{const stop=selectedStop(current);if(stop)sendCommand({action:'skip_to',stop:stop.number});};
$('#omsiUicourseAutoState').onclick=()=>app.go('omsiLive');$('#omsiUicourseAutoState').style.cursor='pointer';
main.insertAdjacentHTML('beforeend',`<section class="view" id="omsiPicker"><div class="top">OMSI · WYBÓR KURSÓWKI</div><div class="omsiPanel">
<label>Linia / brygada z gry<select id="omsiDutyChoice"></select></label><button id="omsiLoadTrips">Pokaż kursy</button>
<label>Kurs<select id="omsiTripChoice"></select></label><label><input type="checkbox" id="omsiAlignTime" checked> Dopasuj czas gry do odjazdu wybranego kursu</label><button id="omsiStartDuty">Wybierz kurs i ustaw tablice w grze</button><button id="omsiSyncSigns">Ustaw tablice według bieżącego kursu</button>
<button id="omsiPhysicalSign">Tablica R&G · USB–RS485</button><p id="omsiCommandStatus" role="status">Wybierz kursówkę z uruchomionej gry.</p>
<button id="omsiPickerBack">Powrót do kursówki</button><button id="omsiPickerSettings">Połączenie OMSI</button></div></section>`);
let commandRequest=null,commandAt=0,queuedCommand=null,pickerCatalog='',pickerTrips='',signKey='';
function commandStatus(text){$('#omsiCommandStatus').textContent=text;}
function sendCommand(payload){
 if(!enabled||!current?.plugin_running||!current.commands||!lastGood){commandStatus('Brak świeżego połączenia ze sterowaniem gry.');return;}
 if(commandRequest||queuedCommand){commandStatus('Oczekiwanie na potwierdzenie poprzedniego polecenia.');return;}
 commandRequest='cmd'+(++request);commandAt=Date.now();commandStatus('Wysyłanie do gry…');
 window.SRGOmsiNative.command(config.transport==='usb'?'127.0.0.1':config.host||'',config.token||'',JSON.stringify(payload),commandRequest);
}
window.SRGOmsiCommandResult=(id,result)=>{if(id!==commandRequest)return;commandRequest=null;if(!result.ok){commandStatus('Nie wysłano: '+result.error);return;}queuedCommand=result.data.id;commandStatus('Polecenie przyjęte przez mostek. Czekam na grę…');};
function dutyChoice(){try{return JSON.parse($('#omsiDutyChoice').value)}catch(_){return null}}
$('#omsiLoadTrips').onclick=()=>{const pair=dutyChoice();if(pair)sendCommand({action:'preview',line:pair[0],tour:pair[1]});};
$('#omsiDutyChoice').onchange=()=>{$('#omsiTripChoice').replaceChildren();pickerTrips='';};
$('#omsiStartDuty').onclick=()=>{const pair=dutyChoice(),trip=Number($('#omsiTripChoice').value);if(pair&&trip>0)sendCommand({action:'select_duty',line:pair[0],tour:pair[1],trip,align_time:$('#omsiAlignTime').checked});else commandStatus('Najpierw pobierz i wybierz kurs.');};
$('#omsiSyncSigns').onclick=()=>sendCommand({action:'sync_signs'});
$('#omsiPhysicalSign').onclick=()=>app.go('rgSettings');
$('#omsiPickerBack').onclick=()=>app.go('omsiCourse');$('#omsiPickerSettings').onclick=()=>app.go('omsiSettings');
function renderPicker(){
 const data=current?.plugin_running?current:null;
 const cat=data?.catalog||[],key=JSON.stringify(cat);if(key!==pickerCatalog){pickerCatalog=key;const select=$('#omsiDutyChoice'),saved=select.value;select.replaceChildren();for(const entry of cat){const opt=document.createElement('option');opt.value=JSON.stringify([String(entry.line),String(entry.tour)]);opt.textContent=`Linia ${entry.line} · Brygada ${entry.tour}${entry.today===false?' · poza dniem kursowania':''}`;select.append(opt);}if([...select.options].some(o=>o.value===saved))select.value=saved;}
 const pair=dutyChoice(),wanted=pair?pair.join('|'):null,available=data?.trip_key===wanted;
 const trips=available?(data?.trips||[]):[],tk=JSON.stringify([data?.trip_key,trips]);if(tk!==pickerTrips){pickerTrips=tk;const select=$('#omsiTripChoice'),saved=select.value;select.replaceChildren();for(const trip of trips){const opt=document.createElement('option');opt.value=String(trip.number);opt.textContent=`${clockText(trip.departure)} → ${clockText(trip.arrival)} · ${trip.terminus||trip.name||''}`;select.append(opt);}if([...select.options].some(o=>o.value===saved))select.value=saved;}
 $('#omsiStartDuty').disabled=!available||!trips.length||!data?.commands;
 const ack=data?.command_result;if(queuedCommand&&ack?.id===queuedCommand){queuedCommand=null;commandStatus(ack.message||'Potwierdzenie z gry');if(ack.ok&&data.duty){manualStop=null;renderCourse(data);}}
 if((queuedCommand||commandRequest)&&Date.now()-commandAt>10000){queuedCommand=null;commandRequest=null;commandStatus('Brak potwierdzenia z gry. Sprawdź aktualny kurs przed ponowieniem.');}
}
let cameraRequest=null,cameraAt=0,cameraPage=0,cameraPages=1,cameraTiles=new Map();
const cameraGrid=$('#omsiCameraGrid');
function clearCamera(text){for(const tile of cameraTiles.values()){tile.img.hidden=true;tile.img.removeAttribute('src');tile.note.hidden=false;tile.note.textContent=text;}$('#omsiCameraStatus').textContent=text;}
function changeCameraPage(delta){cameraPage=Math.max(0,Math.min(cameraPages-1,cameraPage+delta));cameraRequest=null;cameraTiles.clear();cameraGrid.replaceChildren();$('#omsiCameraPage').textContent=`Strona ${cameraPage+1}/${cameraPages}`;}
$('#omsiCameraPrev').onclick=()=>changeCameraPage(-1);$('#omsiCameraNext').onclick=()=>changeCameraPage(1);
window.SRGOmsiCameraResult=(id,result)=>{
 if(id!==cameraRequest)return;cameraRequest=null;
 if(!enabled||app.state.view!=='omsiCameras')return;
 const data=result.ok?result.data:null;
 if(!data){clearCamera('Brak połączenia z kamerami');return;}
 if(Number.isInteger(data.page)&&data.page!==cameraPage){cameraPage=data.page;cameraTiles.clear();cameraGrid.replaceChildren();}
 cameraPages=Math.max(1,Number(data.pages)||1);if(cameraPage>=cameraPages){cameraPage=cameraPages-1;cameraTiles.clear();cameraGrid.replaceChildren();return;}
 $('#omsiCameraPage').textContent=`Strona ${cameraPage+1}/${cameraPages} · kamer: ${data.total||0}`;
 $('#omsiCameraPrev').disabled=cameraPage===0;$('#omsiCameraNext').disabled=cameraPage>=cameraPages-1;
 const feeds=Array.isArray(data.feeds)?data.feeds.slice(0,4):[];
 const wanted=feeds.map(f=>f.channel).join(',');
 if(wanted!==[...cameraTiles.keys()].join(',')){cameraTiles.clear();cameraGrid.replaceChildren();for(const feed of feeds){const tile=document.createElement('div');tile.className='cam';tile.style.cssText='display:flex;align-items:center;justify-content:center;min-height:0';const label=document.createElement('div');label.className='camLabel';label.textContent=feed.label;const img=document.createElement('img');img.hidden=true;img.alt=feed.label;img.style.cssText='max-width:100%;max-height:100%;object-fit:contain';const note=document.createElement('div');note.className='camEmpty';note.textContent='Oczekiwanie na obraz';tile.append(img,label,note);cameraGrid.append(tile);cameraTiles.set(feed.channel,{img,note,seen:0});}}
 for(const frame of data.frames||[]){const tile=cameraTiles.get(frame.channel);if(!tile)continue;if(frame.image?.startsWith('data:image/jpeg;base64,')){tile.img.src=frame.image;tile.img.hidden=false;tile.note.hidden=true;tile.seen=Date.now();}else{tile.img.hidden=true;tile.img.removeAttribute('src');tile.note.hidden=false;tile.note.textContent=frame.error||'Brak świeżego obrazu';}}
 $('#omsiCameraStatus').textContent=data.total?'Niezależny podgląd z gry · cztery kamery na stronę':(data.error||'Oczekiwanie na listę kamer z testowej wersji openOMSI');
};
setInterval(()=>{
 if(!enabled||app.state.view!=='omsiCameras'){if(cameraTiles.size){clearCamera('Podgląd zatrzymany');cameraTiles.clear();cameraGrid.replaceChildren();}return;}
 for(const tile of cameraTiles.values())if(tile.seen&&Date.now()-tile.seen>2500){tile.img.hidden=true;tile.img.removeAttribute('src');tile.note.hidden=false;tile.note.textContent='Obraz nieaktualny';}
 if(cameraRequest&&Date.now()-cameraAt<4000)return;
 cameraAt=Date.now();cameraRequest='camera'+(++request);
 window.SRGOmsiNative?.cameraPage?.(config.transport==='usb'?'127.0.0.1':config.host||'',config.token||'',cameraPage,cameraRequest);
},350);
function omsiRoad(data,stop){
 if(!data?.plugin_running)return '—';
 const list=Array.isArray(data.stops)?data.stops:[],pos=data.position;
 if(list.length<2||!stop)return 'BRAK ODCINKA';
 const index=list.findIndex(s=>s.number===stop.number);if(index<0)return 'BRAK ODCINKA';
 const target=Math.max(1,index),a=list[target-1],b=list[target];
 if(![a?.x,a?.y,b?.x,b?.y].every(Number.isFinite))return 'BRAK POZYCJI PRZYSTANKÓW';
 const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy,length=Math.round(Math.sqrt(length2));
 if(length<2)return 'BRAK DŁUGOŚCI ODCINKA';
 if(![pos?.x,pos?.y].every(Number.isFinite))return `— / ~${length} (—)`;
 const px=pos.x-a.x,py=pos.y-a.y,projection=(px*dx+py*dy)/length2;
 const lateral=Math.abs(px*dy-py*dx)/Math.sqrt(length2);
 if(lateral>Math.max(300,length*.35))return `POZA ODCINKIEM / ~${length}`;
 const fraction=Math.max(0,Math.min(index===list.length-1?2:1.25,projection));
 const travelled=Math.round(length*fraction),delta=travelled-length;
 return `~${travelled} / ~${length} (${delta>0?'+':''}${delta})`;
}
function formatClock24(seconds){
 if(!Number.isFinite(seconds))return '—';
 const total=((Math.floor(seconds)%86400)+86400)%86400;
 return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(v=>String(v).padStart(2,'0')).join(':');
}
function renderRealClock(){const now=new Date();$('#omsiRealClock').textContent='Rzeczywisty: '+[now.getHours(),now.getMinutes(),now.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');}
function renderCourse(data){
 const live=Boolean(data?.plugin_running),d=live?data.duty:null,list=live&&Array.isArray(data.stops)?data.stops:[],stop=live?selectedStop(data):null;
 const put=(id,text)=>$('#omsiUi'+id).textContent=text;
 put('courseLine',d?.line??'—');put('courseDest',d?.terminus||'BRAK KURSU Z GRY');put('courseTask',d?`${d.line}/${d.tour}/${d.trip}`:'—');put('vehicleNo',live?(data.vehicle_number||'—'):'—');
 put('courseStopCount',stop?`${stop.number}/${list.length||'—'}`:'—');put('courseAutoState',live?(manualStop===null?'AUTO OMSI':'PODGLĄD'):'BRAK DANYCH');
 put('courseRoad',omsiRoad(data,stop));$('#omsiUicourseRoad').title='Przebyte / długość odcinka (różnica), w metrach. ~ = szacunek z pozycji gry w linii prostej między przystankami.';put('courseCurrent',stop?`${clockText(stop.departure??stop.arrival)} ${stop.name}`:'Wybierz kursówkę OMSI');
 const idx=stop?list.findIndex(s=>s.number===stop.number):-1;
 for(let n=1;n<=2;n++){const next=idx>=0?list[idx+n]:null;put('courseNext'+n,next?`${clockText(next.departure??next.arrival)} ${next.name}`:'');}
 put('courseDelay',Number.isFinite(d?.delay)?`${d.delay>0?'−':d.delay<0?'+':''}${Math.floor(Math.abs(d.delay)/60)}:${String(Math.floor(Math.abs(d.delay))%60).padStart(2,'0')}`:'—');
 $('#omsiUiClock').textContent='Gra: '+(live?formatClock24(data.clock):'—');renderRealClock();
 const key=d?`${data.session}|${d.line}|${d.terminus}`:'';
 if(key&&key!==signKey){signKey=key;window.dispatchEvent(new CustomEvent('srg-course-selected',{detail:{direction:d.terminus,line:d.line,additional:true,showLine:true,source:'omsi'}}));}
 if(!live)signKey='';
}
function paintTheme(){
 const out=[];
 const replaceColors=value=>value.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,(all,r,g,b)=>{r=+r;g=+g;b=+b;return g>r*1.15&&g>b*1.1?`rgb(${r}, ${Math.round((r+g)/2)}, ${g})`:all});
 function walk(rules){for(const rule of rules){if(rule.selectorText&&rule.style){let decl='';for(const prop of rule.style){const original=rule.style.getPropertyValue(prop),next=replaceColors(original);if(original!==next)decl+=prop+':'+next+' !important;';}if(decl){const selectors=rule.selectorText.split(',').map(s=>'body.omsi-mode '+s.trim()+':not(.calendarCard):not(.calendarCard *)');out.push(selectors.join(',')+'{'+decl+'}');}}else if(rule.cssRules)walk(rule.cssRules);}}
 for(const sheet of [...document.styleSheets]){try{walk(sheet.cssRules)}catch(_){}}
 const theme=document.createElement('style');theme.textContent=out.join('\n');document.head.append(theme);
}
paintTheme();
window.SRGOmsi={get enabled(){return enabled},route(id){if(!enabled)return id;if(['course','idle'].includes(id))return 'omsiCourse';if(['dutySelect','tripSelect','extraLines','extraGate','timetableSettings'].includes(id))return 'omsiPicker';if(id==='cameras')return 'omsiCameras';return id;}};
function clearReadings(){for(const id of ['Speed','Line','Route','Destination'])$('#omsi'+id).textContent='—';}
function status(text){$('#omsiStatus').textContent=text;$('#omsiLiveStatus').textContent=text;}
function setEnabled(on){
 if(on===enabled)return;
 enabled=on;request++;pending=null;lastGood=0;current=null;clearReadings();document.body.classList.toggle('omsi-mode',enabled);
 if(on){localState={course:app.state.course,variant:app.state.variant,routeIndex:app.state.routeIndex};app.stopGps();app.state.course=null;app.state.variant=null;app.go('omsiCourse');log('Tryb OMSI włączony');}
 else{if(localState)Object.assign(app.state,localState);localState=null;log('Tryb OMSI wyłączony');app.go('omsiSettings');}
 status(on?'Oczekiwanie na połączenie':'Tryb wyłączony');
}
$('#omsiHost').value=config.host||'';$('#omsiToken').value=config.token||'';$('#omsiTransport').value=config.transport||'wifi';$('#omsiEnabled').value=config.enabled?'on':'off';
function transportFields(){const usb=$('#omsiTransport').value==='usb';$('#omsiHost').parentElement.hidden=usb;$('#omsiToken').parentElement.hidden=usb;}
$('#omsiTransport').onchange=transportFields;transportFields();
$('#omsiSave').onclick=()=>{config={host:$('#omsiHost').value.trim(),token:$('#omsiTransport').value==='usb'?'':$('#omsiToken').value.trim(),transport:$('#omsiTransport').value,enabled:$('#omsiEnabled').value==='on'};localStorage.setItem('srgOmsiConfig',JSON.stringify(config));request++;pending=null;lastGood=0;clearReadings();setEnabled(config.enabled);poll();};
for(const id of ['omsiLiveBack','omsiLogsBack','omsiCameraBack'])$('#'+id).onclick=()=>app.go('omsiSettings');
$('#omsiBack').onclick=()=>app.go('settings');$('#omsiShowLive').onclick=()=>{if(enabled)app.go('omsiCourse');else status('Najpierw włącz tryb OMSI i zapisz.');};
$('#omsiShowLogs').onclick=()=>{$('#omsiLogText').textContent=JSON.stringify({tablet:events,computer:current?.events||[]},null,2);app.go('omsiLogs');};
function poll(){if(!enabled)return;if(pending&&Date.now()-pendingAt>6500)pending=null;if(pending)return;if(!window.SRGOmsiNative){status('Połączenie wymaga nowej wersji APK z obsługą OMSI.');return;}pending=String(++request);pendingAt=Date.now();window.SRGOmsiNative.poll(config.transport==='usb'?'127.0.0.1':config.host||'',config.token||'',pending);}
let manualStop=null, routeKey=null, lastSpoken=null;
const tripPanel=document.createElement('div');tripPanel.id='omsiTripPanel';tripPanel.innerHTML=`
<div class="omsiNumbers"><div class="omsiNumber">Linia / brygada<b id="omsiDutyLine">—</b></div><div class="omsiNumber">Kierunek<b id="omsiDutyDest">—</b></div></div>
<p id="omsiTripInfo">Oczekiwanie na kurs z gry</p><p id="omsiPosition">Pozycja: —</p>
<p id="omsiStopTitle">Przystanek: —</p>
<button id="omsiPrevStop">◀ Poprzedni (podgląd)</button><button id="omsiAutoStop">Śledź przystanek z gry</button><button id="omsiNextStop">Następny (podgląd) ▶</button>
<label>Zapowiedzi nazw przystanków<select id="omsiVoice"><option value="off">Wyłączone</option><option value="on">Automatyczne (głos systemowy)</option></select></label>
<label>Język głosu<select id="omsiVoiceLang"><option value="de">Deutsch</option><option value="pl">Polski</option><option value="en">English</option></select></label><button id="omsiSpeak">Zapowiedz wybrany przystanek</button><p id="omsiSpeechStatus"></p>
<div id="omsiStops"></div>`;
$('#omsiLive .omsiPanel').prepend(tripPanel);
$('#omsiVoice').value=localStorage.getItem('srgOmsiVoice')||'off';$('#omsiVoiceLang').value=localStorage.getItem('srgOmsiVoiceLang')||'de';
$('#omsiVoice').onchange=()=>{localStorage.setItem('srgOmsiVoice',$('#omsiVoice').value);lastSpoken=null;};
$('#omsiVoiceLang').onchange=()=>localStorage.setItem('srgOmsiVoiceLang',$('#omsiVoiceLang').value);
const clockText=v=>Number.isFinite(v)?`${String(Math.floor(v/3600)%24).padStart(2,'0')}:${String(Math.floor(v/60)%60).padStart(2,'0')}`:'—';
function selectedStop(data){const list=data?.stops||[];return manualStop===null?(data?.duty?.next_stop||null):list[manualStop]||null;}
function speakStop(stop){if(!stop?.name||!lastGood||!current?.plugin_running)return;window.SRGOmsiNative?.speak?.(String(stop.name),$('#omsiVoiceLang').value);}
window.SRGOmsiSpeechStatus=text=>{$('#omsiSpeechStatus').textContent=text;};
$('#omsiSpeak').onclick=()=>speakStop(selectedStop(current));
for(const [id,delta] of [['omsiPrevStop',-1],['omsiNextStop',1]])$('#'+id).onclick=()=>{const list=current?.stops||[];if(!list.length)return;const idx=manualStop===null?Math.max(0,list.findIndex(s=>s.number===current?.duty?.next_stop?.number)):manualStop;manualStop=Math.max(0,Math.min(list.length-1,idx+delta));renderTrip(current);};
$('#omsiAutoStop').onclick=()=>{manualStop=null;renderTrip(current);};
function renderTrip(data){
 const fresh=Boolean(data?.plugin_running), d=fresh?data.duty:null, list=fresh&&Array.isArray(data.stops)?data.stops:[];
 const key=fresh?data.session+'|'+data.route:null;if(key!==routeKey){routeKey=key;manualStop=null;lastSpoken=null;}
 renderCourse(data);renderPicker();
 $('#omsiDutyLine').textContent=d?`${d.line??'—'} / ${d.tour??'—'}`:'—';$('#omsiDutyDest').textContent=d?.terminus||'—';
 const delay=Number.isFinite(d?.delay)?`${d.delay>0?'−':d.delay<0?'+':''}${Math.floor(Math.abs(d.delay)/60)}:${String(Math.floor(Math.abs(d.delay))%60).padStart(2,'0')}`:'—';
 $('#omsiTripInfo').textContent=fresh?`${data.game==='openomsi'?'openOMSI':'OMSI'} · ${data.map||'—'} · ${[data.vehicle?.manufacturer,data.vehicle?.model].filter(Boolean).join(' ')||'autobus: —'} · czas gry ${clockText(data.clock)}${data.paused?' · PAUZA':''} · kurs ${d?.trip??'—'} · odchyłka ${delay}`:'Brak świeżych danych z gry';
 const pos=fresh?data.position:null;$('#omsiPosition').textContent=pos&&Number.isFinite(pos.x)?`Pozycja mapy: ${pos.x.toFixed(1)}, ${Number(pos.y).toFixed(1)} · do przystanku ${Number.isFinite(data.distance)?Math.round(data.distance)+' m':'—'}`:'Pozycja: —';
 const chosen=fresh?selectedStop(data):null;$('#omsiStopTitle').textContent=`${manualStop===null?'Z gry':'Podgląd ręczny'}: ${chosen?.name||'—'}${d?.at_stop&&manualStop===null?' · NA PRZYSTANKU':''}${d?.trip_done?' · KONIEC KURSU':''}`;
 const body=$('#omsiStops');body.replaceChildren();
 for(const stop of list){const row=document.createElement('div');row.className='omsiNumber';row.style.marginBottom='6px';if(stop.number===chosen?.number)row.style.borderColor='#ffe066';row.textContent=`${stop.number??''}. ${stop.name||'—'} · ${clockText(stop.departure??stop.arrival)}${stop.closed?' · zamknięty':''}${stop.passed?' · minięty':''}`;body.append(row);}
 if(!list.length)body.textContent=d?'Pobieranie listy przystanków…':'Wybierz linię i brygadę w grze. Podstawowa wtyczka OMSI 2 nie udostępnia pełnego kursu.';
 if(fresh&&d?.next_stop&&manualStop===null){const marker=key+'|'+d.next_stop.number;if(lastSpoken===null)lastSpoken=marker;else if(marker!==lastSpoken){lastSpoken=marker;if($('#omsiVoice').value==='on')speakStop(d.next_stop);}}
}
window.SRGOmsiResult=(id,result)=>{if(!enabled||id!==pending)return;pending=null;if(!result.ok){if(lastGood)log('Utrata połączenia');lastGood=0;clearReadings();renderTrip(null);status('Brak połączenia: '+result.error);return;}if(!lastGood)log('Połączono z komputerem '+result.data.computer);lastGood=Date.now();current=result.data;renderTrip(current);status('Komputer: '+current.computer+' · '+(current.plugin_running?'wtyczka przesyła dane':'brak świeżych danych z OMSI')+' · '+(config.transport==='usb'?'USB':'Wi-Fi'));const v=current.variables||{};for(const [id,key] of [['Speed','Velocity'],['Line','IBIS_Linie'],['Route','IBIS_Route'],['Destination','IBIS_Ziel']])$('#omsi'+id).textContent=current.plugin_running&&Number.isFinite(v[key])?String(Math.round(v[key]*10)/10):'—';};
setInterval(()=>{renderRealClock();if(lastGood&&Date.now()-lastGood>5000){clearReadings();renderTrip(null);status('Utrata połączenia — dane nieaktualne');}poll();},1000);
if(config.enabled)setEnabled(true);
})();
