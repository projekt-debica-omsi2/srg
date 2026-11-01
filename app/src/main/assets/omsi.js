(() => {
'use strict';
const $=s=>document.querySelector(s), app=window.__srg;
let enabled=false, request=0, pending=null, pendingAt=0, lastGood=0, localState=null, current=null;
let config;try{config=JSON.parse(localStorage.getItem('srgOmsiConfig')||'{}')}catch(_){config={}}
const logKey='srgOmsiEvents';
let events;try{events=JSON.parse(localStorage.getItem(logKey)||'[]')}catch(_){events=[]}
function log(event){events.push({time:new Date().toISOString(),event});events=events.slice(-500);localStorage.setItem(logKey,JSON.stringify(events));}
const style=document.createElement('style');style.textContent=`
.omsiPanel [hidden]{display:none!important}.omsiPanel{flex:1;min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.omsiPanel label{display:flex;flex-direction:column;gap:6px}.omsiPanel input,.omsiPanel select,.omsiPanel button{font:inherit;padding:12px;min-height:44px;color:#fff;background:#123d65;border:1px solid #4099e0;border-radius:5px}.omsiPanel p{margin:0;line-height:1.4}.omsiPanel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.omsiNumbers{display:grid;grid-template-columns:1fr 1fr;gap:12px}.omsiNumber{background:#10314e;padding:16px;border:1px solid #307ab0}.omsiNumber b{display:block;font-size:26px;margin-top:8px}.omsiBlack{flex:1;min-height:120px;background:#000;border:1px solid #555}.omsiPanel .omsiWarning{color:#f5d279}
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
<section id="omsiCameras" class="view"><div class="top">OMSI 2 · KAMERA / LUSTERKO</div><div class="omsiPanel"><div class="omsiBlack"></div><p>Obraz kamery i lusterka nie jest jeszcze dostępny w tym mostku.</p><button id="omsiCameraBack">Wróć</button></div></section>
<section id="omsiLogs" class="view"><div class="top">OMSI 2 · HISTORIA</div><div class="omsiPanel"><p>Historia kontaktu z mostkiem. Utrata kontaktu nie oznacza pewnego zakończenia gry. Pełne logi komputera: %LOCALAPPDATA%\\SRG-OMSI.</p><pre id="omsiLogText"></pre><button id="omsiLogsBack">Wróć</button></div></section>`);
const tile=document.createElement('button');tile.className='settingTile';tile.innerHTML='<b>OMSI 2</b><span>Połączenie z grą</span>';tile.onclick=()=>app.go('omsiSettings');$('.settingsTiles').append(tile);
function paintTheme(){
 const out=[];
 const replaceColors=value=>value.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,(all,r,g,b)=>{r=+r;g=+g;b=+b;return g>r*1.15&&g>b*1.1?`rgb(${r}, ${Math.round((r+g)/2)}, ${g})`:all});
 function walk(rules){for(const rule of rules){if(rule.selectorText&&rule.style){let decl='';for(const prop of rule.style){const original=rule.style.getPropertyValue(prop),next=replaceColors(original);if(original!==next)decl+=prop+':'+next+' !important;';}if(decl){const selectors=rule.selectorText.split(',').map(s=>'body.omsi-mode '+s.trim()+':not(.calendarCard):not(.calendarCard *)');out.push(selectors.join(',')+'{'+decl+'}');}}else if(rule.cssRules)walk(rule.cssRules);}}
 for(const sheet of [...document.styleSheets]){try{walk(sheet.cssRules)}catch(_){}}
 const theme=document.createElement('style');theme.textContent=out.join('\n');document.head.append(theme);
}
paintTheme();
window.SRGOmsi={get enabled(){return enabled},route(id){if(!enabled)return id;if(['course','dutySelect','tripSelect','extraLines','extraGate','timetableSettings'].includes(id))return 'omsiLive';if(id==='cameras')return 'omsiCameras';return id;}};
function clearReadings(){for(const id of ['Speed','Line','Route','Destination'])$('#omsi'+id).textContent='—';}
function status(text){$('#omsiStatus').textContent=text;$('#omsiLiveStatus').textContent=text;}
function setEnabled(on){
 if(on===enabled)return;
 enabled=on;request++;pending=null;lastGood=0;current=null;clearReadings();document.body.classList.toggle('omsi-mode',enabled);
 if(on){localState={course:app.state.course,variant:app.state.variant,routeIndex:app.state.routeIndex};app.stopGps();app.state.course=null;app.state.variant=null;app.go('omsiSettings');log('Tryb OMSI włączony');}
 else{if(localState)Object.assign(app.state,localState);localState=null;log('Tryb OMSI wyłączony');app.go('omsiSettings');}
 status(on?'Oczekiwanie na połączenie':'Tryb wyłączony');
}
$('#omsiHost').value=config.host||'';$('#omsiToken').value=config.token||'';$('#omsiTransport').value=config.transport||'wifi';$('#omsiEnabled').value=config.enabled?'on':'off';
function transportFields(){const usb=$('#omsiTransport').value==='usb';$('#omsiHost').parentElement.hidden=usb;$('#omsiToken').parentElement.hidden=usb;}
$('#omsiTransport').onchange=transportFields;transportFields();
$('#omsiSave').onclick=()=>{config={host:$('#omsiHost').value.trim(),token:$('#omsiTransport').value==='usb'?'':$('#omsiToken').value.trim(),transport:$('#omsiTransport').value,enabled:$('#omsiEnabled').value==='on'};localStorage.setItem('srgOmsiConfig',JSON.stringify(config));request++;pending=null;lastGood=0;clearReadings();setEnabled(config.enabled);poll();};
for(const id of ['omsiLiveBack','omsiLogsBack','omsiCameraBack'])$('#'+id).onclick=()=>app.go('omsiSettings');
$('#omsiBack').onclick=()=>app.go('settings');$('#omsiShowLive').onclick=()=>{if(enabled)app.go('omsiLive');else status('Najpierw włącz tryb OMSI i zapisz.');};
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
 $('#omsiDutyLine').textContent=d?`${d.line??'—'} / ${d.tour??'—'}`:'—';$('#omsiDutyDest').textContent=d?.terminus||'—';
 const delay=Number.isFinite(d?.delay)?`${d.delay>=0?'+':'−'}${Math.floor(Math.abs(d.delay)/60)}:${String(Math.floor(Math.abs(d.delay))%60).padStart(2,'0')}`:'—';
 $('#omsiTripInfo').textContent=fresh?`${data.game==='openomsi'?'openOMSI':'OMSI'} · ${data.map||'—'} · czas gry ${clockText(data.clock)}${data.paused?' · PAUZA':''} · kurs ${d?.trip??'—'} · odchyłka ${delay}`:'Brak świeżych danych z gry';
 const pos=fresh?data.position:null;$('#omsiPosition').textContent=pos&&Number.isFinite(pos.x)?`Pozycja mapy: ${pos.x.toFixed(1)}, ${Number(pos.y).toFixed(1)} · do przystanku ${Number.isFinite(data.distance)?Math.round(data.distance)+' m':'—'}`:'Pozycja: —';
 const chosen=fresh?selectedStop(data):null;$('#omsiStopTitle').textContent=`${manualStop===null?'Z gry':'Podgląd ręczny'}: ${chosen?.name||'—'}${d?.at_stop&&manualStop===null?' · NA PRZYSTANKU':''}${d?.trip_done?' · KONIEC KURSU':''}`;
 const body=$('#omsiStops');body.replaceChildren();
 for(const stop of list){const row=document.createElement('div');row.className='omsiNumber';row.style.marginBottom='6px';if(stop.number===chosen?.number)row.style.borderColor='#ffe066';row.textContent=`${stop.number??''}. ${stop.name||'—'} · ${clockText(stop.departure??stop.arrival)}${stop.closed?' · zamknięty':''}${stop.passed?' · minięty':''}`;body.append(row);}
 if(!list.length)body.textContent=d?'Pobieranie listy przystanków…':'Wybierz linię i brygadę w grze. Podstawowa wtyczka OMSI 2 nie udostępnia pełnego kursu.';
 if(fresh&&d?.next_stop&&manualStop===null){const marker=key+'|'+d.next_stop.number;if(lastSpoken===null)lastSpoken=marker;else if(marker!==lastSpoken){lastSpoken=marker;if($('#omsiVoice').value==='on')speakStop(d.next_stop);}}
}
window.SRGOmsiResult=(id,result)=>{if(!enabled||id!==pending)return;pending=null;if(!result.ok){if(lastGood)log('Utrata połączenia');lastGood=0;clearReadings();renderTrip(null);status('Brak połączenia: '+result.error);return;}if(!lastGood)log('Połączono z komputerem '+result.data.computer);lastGood=Date.now();current=result.data;renderTrip(current);status('Komputer: '+current.computer+' · '+(current.plugin_running?'wtyczka przesyła dane':'brak świeżych danych z OMSI')+' · '+(config.transport==='usb'?'USB':'Wi-Fi'));const v=current.variables||{};for(const [id,key] of [['Speed','Velocity'],['Line','IBIS_Linie'],['Route','IBIS_Route'],['Destination','IBIS_Ziel']])$('#omsi'+id).textContent=current.plugin_running&&Number.isFinite(v[key])?String(Math.round(v[key]*10)/10):'—';};
setInterval(()=>{if(lastGood&&Date.now()-lastGood>5000){clearReadings();renderTrip(null);status('Utrata połączenia — dane nieaktualne');}poll();},1000);
if(config.enabled)setEnabled(true);
})();
