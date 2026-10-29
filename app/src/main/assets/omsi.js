(() => {
'use strict';
const $=s=>document.querySelector(s), app=window.__srg;
let enabled=false, request=0, pending=null, pendingAt=0, lastGood=0, localState=null, current=null;
let config;try{config=JSON.parse(localStorage.getItem('srgOmsiConfig')||'{}')}catch(_){config={}}
const logKey='srgOmsiEvents';
let events;try{events=JSON.parse(localStorage.getItem(logKey)||'[]')}catch(_){events=[]}
function log(event){events.push({time:new Date().toISOString(),event});events=events.slice(-500);localStorage.setItem(logKey,JSON.stringify(events));}
const style=document.createElement('style');style.textContent=`
.omsiPanel{flex:1;min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.omsiPanel label{display:flex;flex-direction:column;gap:6px}.omsiPanel input,.omsiPanel select,.omsiPanel button{font:inherit;padding:12px;min-height:44px;color:#fff;background:#123d65;border:1px solid #4099e0;border-radius:5px}.omsiPanel p{margin:0;line-height:1.4}.omsiPanel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.omsiNumbers{display:grid;grid-template-columns:1fr 1fr;gap:12px}.omsiNumber{background:#10314e;padding:16px;border:1px solid #307ab0}.omsiNumber b{display:block;font-size:26px;margin-top:8px}.omsiBlack{flex:1;min-height:120px;background:#000;border:1px solid #555}.omsiPanel .omsiWarning{color:#f5d279}
`;document.head.append(style);
const main=$('main.content');main.insertAdjacentHTML('beforeend',`
<section id="omsiSettings" class="view"><div class="top">OMSI 2</div><div class="omsiPanel">
<p>Połączenie z komputerem przez Wi-Fi lub USB. Wersja testowa: odczyt zmiennych autobusu. Kursy, pozycja, zapowiedzi i obraz wymagają dalszej integracji.</p>
<label>Tryb OMSI 2<select id="omsiEnabled"><option value="off">Wyłączony</option><option value="on">Włączony</option></select></label>
<label>Połączenie<select id="omsiTransport"><option value="wifi">Wi-Fi / sieć lokalna</option><option value="usb">USB (ADB)</option></select></label>
<label>IPv4 komputera<input id="omsiHost" placeholder="192.168.1.10" inputmode="decimal"></label>
<label>Kod parowania z programu na komputerze<input id="omsiToken" autocomplete="off" maxlength="24"></label>
<button id="omsiSave">Zapisz i połącz</button><p id="omsiStatus" role="status">Tryb wyłączony</p>
<button id="omsiShowLive">Dane z gry</button><button id="omsiShowLogs">Historia połączeń</button><button id="omsiBack">Wróć</button>
</div></section>
<section id="omsiLive" class="view"><div class="top">OMSI 2 · DANE Z GRY</div><div class="omsiPanel"><p id="omsiLiveStatus">Brak połączenia</p><div class="omsiNumbers"><div class="omsiNumber">Prędkość (km/h)<b id="omsiSpeed">—</b></div><div class="omsiNumber">Kod linii IBIS (surowy)<b id="omsiLine">—</b></div><div class="omsiNumber">Kod trasy IBIS<b id="omsiRoute">—</b></div><div class="omsiNumber">Kod kierunku IBIS<b id="omsiDestination">—</b></div></div><p class="omsiWarning">Ta wersja mostka nie przekazuje jeszcze rozkładu i przystanków. Zwykłe kursówki pozostają zapisane, lecz są ukryte w trybie OMSI.</p><button id="omsiLiveBack">Ustawienia OMSI</button></div></section>
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
$('#omsiSave').onclick=()=>{config={host:$('#omsiHost').value.trim(),token:$('#omsiToken').value.trim().toLowerCase(),transport:$('#omsiTransport').value,enabled:$('#omsiEnabled').value==='on'};localStorage.setItem('srgOmsiConfig',JSON.stringify(config));request++;pending=null;lastGood=0;clearReadings();setEnabled(config.enabled);poll();};
for(const id of ['omsiLiveBack','omsiLogsBack','omsiCameraBack'])$('#'+id).onclick=()=>app.go('omsiSettings');
$('#omsiBack').onclick=()=>app.go('settings');$('#omsiShowLive').onclick=()=>{if(enabled)app.go('omsiLive');else status('Najpierw włącz tryb OMSI i zapisz.');};
$('#omsiShowLogs').onclick=()=>{$('#omsiLogText').textContent=JSON.stringify({tablet:events,computer:current?.events||[]},null,2);app.go('omsiLogs');};
function poll(){if(!enabled)return;if(pending&&Date.now()-pendingAt>6500)pending=null;if(pending)return;if(!window.SRGOmsiNative){status('Połączenie wymaga nowej wersji APK z obsługą OMSI.');return;}pending=String(++request);pendingAt=Date.now();window.SRGOmsiNative.poll(config.transport==='usb'?'127.0.0.1':config.host||'',config.token||'',pending);}
window.SRGOmsiResult=(id,result)=>{if(!enabled||id!==pending)return;pending=null;if(!result.ok){if(lastGood)log('Utrata połączenia');lastGood=0;clearReadings();status('Brak połączenia: '+result.error);return;}if(!lastGood)log('Połączono z komputerem '+result.data.computer);lastGood=Date.now();current=result.data;status('Komputer: '+current.computer+' · '+(current.plugin_running?'wtyczka przesyła dane':'brak świeżych danych z OMSI')+' · '+(config.transport==='usb'?'USB':'Wi-Fi'));const v=current.variables||{};for(const [id,key] of [['Speed','Velocity'],['Line','IBIS_Linie'],['Route','IBIS_Route'],['Destination','IBIS_Ziel']])$('#omsi'+id).textContent=current.plugin_running&&Number.isFinite(v[key])?String(Math.round(v[key]*10)/10):'—';};
setInterval(()=>{if(lastGood&&Date.now()-lastGood>5000){clearReadings();status('Utrata połączenia — dane nieaktualne');}poll();},1000);
if(config.enabled)setEnabled(true);
})();
