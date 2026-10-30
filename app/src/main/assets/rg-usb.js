(function(root){
'use strict';
function frames(cfg,text){
 const template=String(cfg.frame||'').trim();if(!template)throw Error('Wpisz udokumentowaną ramkę HEX.');
 let bytes=[];const content=(cfg.font||'')+text;
 if(cfg.profile==='ascii'){if(/[^\x20-\x7e]/.test(content))throw Error('ASCII nie obsługuje polskich liter.');bytes=Array.from(content,c=>c.charCodeAt(0));}
 else bytes=Array.from(new TextEncoder().encode(content));
 if(cfg.profile!=='hex'&&(!template.includes('{addr}')||!template.includes('{text}')))throw Error('Ramka tekstowa wymaga {addr} i {text}.');
 if(cfg.profile==='hex'&&/[{}]/.test(template))throw Error('Surowe HEX nie przyjmuje znaczników.');
 const hex=bytes.map(x=>x.toString(16).padStart(2,'0')).join(' ');
 return (cfg.profile==='hex'?[null]:[17,18]).map(addr=>{const s=template.replaceAll('{addr}',addr===null?'':addr.toString(16)).replaceAll('{text}',hex).replace(/\s/g,'');if(!s||s.length%2||!/^[\da-f]+$/i.test(s)||s.length>8192)throw Error('Niepoprawna ramka HEX.');return s.match(/../g).join(' ').toUpperCase();});
}
if(typeof module!=='undefined')module.exports={frames};if(!root.document)return;
const $=id=>document.getElementById('rg'+id),bridge=root.SRGRgUsb;
let connected=false,verified='',saved={},replayToken=0,replayRunning=false,captureRunning=false,rawMode=false,diagToken=0,diagRunning=false,lastStats={};
const log=t=>{$('Log').textContent=($('Log').textContent+'\n'+new Date().toLocaleTimeString()+' '+t).slice(-30000);$('Log').scrollTop=$('Log').scrollHeight;};
function config(){return {profile:$('Profile').value,frame:$('Frame').value,font:$('Font').value,baud:+$('Baud').value,data:+$('Data').value,stop:+$('Stop').value,parity:+$('Parity').value,device:$('Device').value};}
function signature(c){return JSON.stringify(c);}
function guard(fn){return ()=>{try{fn();}catch(e){log('BŁĄD: '+e.message);}};}
function send(c,text){if(!connected||!bridge)throw Error('Najpierw połącz konwerter USB.');frames(c,text).forEach(h=>bridge.send(h));log('Zlecono zapis USB.');}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function captureList(){try{return JSON.parse(localStorage.getItem('srgCapturedExtraLines')||'[]');}catch(e){return [];}}

function renderCaptureList(){
 const box=$('CaptureList');if(!box)return;const list=captureList();box.innerHTML='';
 if(!list.length){box.textContent='Brak zapisanych przechwytów.';return;}
 for(const item of list.slice(0,15)){const d=document.createElement('div');d.style.cssText='padding:6px 0;border-bottom:1px solid #31533d;font-size:14px';d.textContent=(item.label||'BEZ NAZWY')+' · '+(item.bytes||0)+' B · '+(item.rxMode||'?')+' · DTR '+item.dtr+' RTS '+item.rts+' · '+(item.path||item.file||'');box.appendChild(d);}
}
function updateStats(raw){
 let s={};try{s=typeof raw==='string'?JSON.parse(raw):raw||{};}catch(e){}lastStats=s;
 if($('RxBytes'))$('RxBytes').textContent=String(s.bytes??0);
 if($('RxChunks'))$('RxChunks').textContent=String(s.chunks??0);
 if($('RxErrors'))$('RxErrors').textContent=String(s.errors??0);
 if($('RxLast'))$('RxLast').textContent=s.lastRxAt?new Date(s.lastRxAt).toLocaleTimeString():'—';
 if($('RxMode'))$('RxMode').textContent=s.raw?'RAW':'CALLBACK';
 if($('RxPort'))$('RxPort').textContent=s.connected?'OTWARTY':'ZAMKNIĘTY';
 if($('RxCtrl'))$('RxCtrl').textContent='DTR '+(s.dtr?'ON':'OFF')+' / RTS '+(s.rts?'ON':'OFF');
 if($('RxParams'))$('RxParams').textContent=(s.baud||'?')+'/'+(s.dataBits||'?')+'/'+(s.stopBits||'?')+' P'+(s.parity??'?');
 if($('RxCtrlErr'))$('RxCtrlErr').textContent=s.controlError||'—';
 rawMode=!!s.raw;
}
function getStats(){try{return JSON.parse(bridge.rxStats()||'{}');}catch(e){return {};}}
function setDiagRow(text,state){if(!$('DiagNow'))return;$('DiagNow').textContent=text;$('DiagNow').dataset.state=state||'';}
function addResult(text,ok){
 const box=$('DiagResults');if(!box)return;const d=document.createElement('div');d.style.cssText='padding:5px 0;border-bottom:1px solid #294737;font-size:14px';d.textContent=(ok?'✓ ':'– ')+text;box.prepend(d);
}

function buildPlan(){
 const extensive=$('DiagExtensive')?.checked;
 const plan=[];
 const bauds=extensive?[9600,4800,19200,38400]:[9600];
 const pars=extensive?[0,2,1]:[0];
 const stops=extensive?[1,2]:[1];
 const modes=[false,true];
 for(const baud of bauds)for(const parity of pars)for(const stop of stops)for(const raw of modes)for(const dtr of [false,true])for(const rts of [false,true]){
  plan.push({baud,data:8,stop,parity,dtr,rts,raw,purge:true});
 }
 return plan;
}
async function runAutoDiag(){
 if(diagRunning)throw Error('Automatyczna diagnostyka już trwa.');
 if(!bridge||!connected)throw Error('Najpierw połącz USB.');
 diagRunning=true;const token=++diagToken;
 $('DiagAuto').disabled=true;$('DiagStop').disabled=false;$('DiagResults').innerHTML='';
 const plan=buildPlan(), waitMs=Math.max(1200,Math.min(8000,+$('DiagSeconds').value*1000||3000));
 log('AUTO DIAG START · '+plan.length+' kombinacji · '+waitMs+' ms każda');
 for(let i=0;i<plan.length;i++){
  if(token!==diagToken)break;
  const p=plan[i],label=`${i+1}/${plan.length} · ${p.baud}/8/${p.stop} P${p.parity} · DTR ${p.dtr?'ON':'OFF'} · RTS ${p.rts?'ON':'OFF'} · ${p.raw?'RAW':'CALLBACK'}`;
  setDiagRow(label,'testing');bridge.diagnosticConfig(p.baud,p.data,p.stop,p.parity,p.dtr,p.rts,p.raw,p.purge);
  await sleep(650);let before=getStats().bytes||0;
  await sleep(waitMs);let after=getStats().bytes||0;
  const got=after>before;
  addResult(label+' · '+(after-before)+' B',got);
  if(got){
   setDiagRow('ZNALEZIONO ODBIÓR: '+label+' · '+(after-before)+' B','ok');
   log('AUTO DIAG SUKCES: '+label+' · '+(after-before)+' B');
   diagRunning=false;$('DiagAuto').disabled=false;$('DiagStop').disabled=true;
   return;
  }
 }
 if(token===diagToken){setDiagRow('Brak RX we wszystkich sprawdzonych kombinacjach.','fail');log('AUTO DIAG: brak RX w całym planie.');}
 diagRunning=false;$('DiagAuto').disabled=false;$('DiagStop').disabled=true;
}
function stopAutoDiag(){diagToken++;diagRunning=false;if($('DiagAuto'))$('DiagAuto').disabled=false;if($('DiagStop'))$('DiagStop').disabled=true;setDiagRow('Diagnostyka zatrzymana.','');}

function initCapture(){
 const replay=$('Diag');if(!replay||$('Capture'))return;
 const d=document.createElement('details');d.id='rgCapture';d.open=true;d.style.cssText='margin-top:12px;border:1px solid #50745a;padding:10px';
 d.innerHTML='<summary><b>Diagnostyka automatyczna RS-485 — 1.4.73</b></summary>'+
 '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0">'+
 '<div>PORT<br><b id="rgRxPort">—</b></div><div>TRYB<br><b id="rgRxMode">—</b></div><div>BAJTY RX<br><b id="rgRxBytes">0</b></div>'+
 '<div>PORCJE<br><b id="rgRxChunks">0</b></div><div>BŁĘDY<br><b id="rgRxErrors">0</b></div><div>OSTATNI RX<br><b id="rgRxLast">—</b></div>'+
 '<div>RTS/DTR<br><b id="rgRxCtrl">—</b></div><div>PARAMETRY<br><b id="rgRxParams">—</b></div><div>BŁĄD CTRL<br><b id="rgRxCtrlErr">—</b></div></div>'+
 '<p><b>AUTO:</b> aplikacja sama przechodzi do następnej kombinacji, jeżeli nie widzi żadnych bajtów. Gdy wykryje RX, zatrzymuje się na działającym ustawieniu.</p>'+
 '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0"><label>Czas testu [s] <input id="rgDiagSeconds" type="number" min="1.2" max="8" step="0.5" value="3" style="width:90px"></label>'+
 '<label><input id="rgDiagExtensive" type="checkbox"> Rozszerzony test: także 4800/19200/38400, parity i 2 stop</label></div>'+
 '<div class="transButtons"><button id="rgDiagAuto" type="button">START AUTO DIAGNOZA</button><button id="rgDiagStop" type="button">STOP DIAGNOZY</button><button id="rgRxRefresh" type="button">ODŚWIEŻ</button></div>'+
 '<p id="rgDiagNow">Gotowe do testu.</p><div id="rgDiagResults" style="max-height:220px;overflow:auto;border-top:1px solid #31533d"></div>'+
 '<hr style="border-color:#31533d;margin:12px 0">'+
 '<div class="transButtons"><button id="rgRawStart" type="button">RĘCZNIE RAW RX</button><button id="rgRawStop" type="button">RĘCZNIE CALLBACK RX</button></div>'+
 '<label>Nazwa / kierunek<input id="rgCaptureName" value="" placeholder="np. DĘBICA" maxlength="120"></label>'+
 '<label>Folder w Pobrane<input id="rgCaptureFolder" value="SRG-Captures" maxlength="60"></label>'+
 '<div class="transButtons"><button id="rgCaptureStart" type="button">START — przechwyć</button><button id="rgCaptureStop" type="button">STOP i zapisz</button></div>'+
 '<p id="rgCaptureStatus">Oryginalny SRG ma być podłączony do magistrali podczas nasłuchu.</p>'+
 '<div><b>Zapisane przechwyty:</b><div id="rgCaptureList"></div></div>';
 replay.parentNode.insertBefore(d,replay);
 try{$('CaptureFolder').value=localStorage.getItem('srgCaptureFolder')||'SRG-Captures';}catch(e){}
 $('CaptureStop').disabled=true;$('DiagStop').disabled=true;
 $('DiagAuto').onclick=()=>runAutoDiag().catch(e=>{stopAutoDiag();log('AUTO DIAG BŁĄD: '+e.message);});
 $('DiagStop').onclick=stopAutoDiag;
 $('RawStart').onclick=guard(()=>bridge.startRawRx());
 $('RawStop').onclick=guard(()=>bridge.stopRawRx());
 $('RxRefresh').onclick=guard(()=>updateStats(bridge.rxStats()));
 $('CaptureStart').onclick=guard(()=>{
  if(!bridge||!connected)throw Error('Najpierw połącz USB.');
  const name=$('CaptureName').value.trim()||$('Text').value.trim()||'BEZ_NAZWY',folder=$('CaptureFolder').value.trim()||'SRG-Captures';
  localStorage.setItem('srgCaptureFolder',folder);captureRunning=true;$('CaptureStart').disabled=true;$('CaptureStop').disabled=false;$('CaptureStatus').textContent='Nasłuch trwa…';
  bridge.startCapture(name,folder);
 });
 $('CaptureStop').onclick=guard(()=>{if(!captureRunning)throw Error('Przechwytywanie nie jest uruchomione.');bridge.stopCapture();});
 renderCaptureList();if(bridge)updateStats(bridge.rxStats());
}
root.rgUsbCaptureSaved=item=>{
 const list=captureList();list.unshift(item);try{localStorage.setItem('srgCapturedExtraLines',JSON.stringify(list.slice(0,50)));}catch(e){}
 captureRunning=false;if($('CaptureStart'))$('CaptureStart').disabled=false;if($('CaptureStop'))$('CaptureStop').disabled=true;if($('CaptureStatus'))$('CaptureStatus').textContent='Zapisano: '+(item.path||item.file);renderCaptureList();
};

function initReplay(){
 const sel=$('ReplaySelect');if(!sel)return;sel.replaceChildren();
 for(const c of(root.SRGRgReplayCaptures||[])){const o=document.createElement('option');o.value=c.id;o.textContent=c.label;sel.appendChild(o);}
 $('ReplayStop').disabled=true;$('ReplayStart').onclick=()=>startReplay().catch(e=>{replayRunning=false;$('ReplayStart').disabled=false;$('ReplayStop').disabled=true;$('ReplayStatus').textContent='BŁĄD: '+e.message;log('REPLAY BŁĄD: '+e.message);});
 $('ReplayStop').onclick=()=>{replayToken++;replayRunning=false;$('ReplayStart').disabled=false;$('ReplayStop').disabled=true;$('ReplayStatus').textContent='Zatrzymano.';};
}
async function startReplay(){
 if(replayRunning)throw Error('Odtwarzanie już trwa.');if(!connected||!bridge)throw Error('Najpierw połącz USB.');if(!$('ReplaySafe').checked)throw Error('Potwierdź odłączenie oryginalnego sterownika.');
 const cap=(root.SRGRgReplayCaptures||[]).find(c=>c.id===$('ReplaySelect').value);if(!cap)throw Error('Brak danych przechwytu.');
 const token=++replayToken;replayRunning=true;$('ReplayStart').disabled=true;$('ReplayStop').disabled=false;
 for(let i=0;i<cap.chunks.length;i++){if(token!==replayToken)return;const[delay,hex]=cap.chunks[i];if(delay)await sleep(delay);if(token!==replayToken)return;bridge.send(hex);}
 if(token!==replayToken)return;replayRunning=false;$('ReplayStart').disabled=false;$('ReplayStop').disabled=true;$('ReplayStatus').textContent='Odtwarzanie zakończone.';
}
root.rgUsbEvent=(type,msg)=>{
 if(type==='connected')connected=true;if(['error','disconnected'].includes(type)){connected=false;stopAutoDiag();}
 if(type==='capture_started'){captureRunning=true;if($('CaptureStatus'))$('CaptureStatus').textContent=msg;}
 if(type==='capture_saved'){captureRunning=false;if($('CaptureStart'))$('CaptureStart').disabled=false;if($('CaptureStop'))$('CaptureStop').disabled=true;if($('CaptureStatus'))$('CaptureStatus').textContent=msg;}
 if(type==='capture_error'&&$('CaptureStatus'))$('CaptureStatus').textContent='BŁĄD: '+msg;
 if(type==='rx_stats')updateStats(msg);
 if(type==='diag_config')log('DIAG: '+msg);
 if(type==='diag_error')log('DIAG BŁĄD: '+msg);
 if(type==='raw_rx_status')log(msg);
 if(type==='raw_rx_error')log('RAW BŁĄD: '+msg);
 if(['connected','error','disconnected','info'].includes(type))$('Status').textContent=msg;
 log(type.toUpperCase()+': '+msg);
};
function scan(){const old=$('Device').value;$('Device').replaceChildren();if(!bridge){$('Status').textContent='Transport USB dostępny w APK.';return;}for(const d of JSON.parse(bridge.devices())){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;$('Device').appendChild(o);}if([...$('Device').options].some(o=>o.value===old))$('Device').value=old;if(!$('Device').options.length)$('Status').textContent='Nie wykryto obsługiwanego konwertera USB.';}
try{saved=JSON.parse(localStorage.getItem('srgRgUsb')||'{}');}catch(e){}
for(const key of['profile','frame','font','baud','data','stop','parity'])if(saved[key]!=null)$(key[0].toUpperCase()+key.slice(1)).value=saved[key];
$('Scan').onclick=guard(scan);$('Connect').onclick=guard(()=>{if(!bridge||!$('Device').value)throw Error('Brak konwertera USB.');connected=false;const c=config();bridge.connect(+c.device,c.baud,c.data,c.stop,c.parity);});
$('Disconnect').onclick=()=>{stopAutoDiag();replayToken++;replayRunning=false;captureRunning=false;connected=false;if(bridge)bridge.disconnect();};
$('Course').onclick=guard(()=>{const a=root.__srg;if(!a?.state.variant)throw Error('Wybierz kurs.');$('Text').value=a.finalDirection(a.state.variant);if($('CaptureName'))$('CaptureName').value=$('Text').value;});
$('Preview').onclick=guard(()=>log('PODGLĄD:\n'+frames(config(),$('Text').value).join('\n')));$('Send').onclick=guard(()=>send(config(),$('Text').value));
$('Profile').addEventListener('change',()=>{$('Send').textContent=$('Profile').value==='hex'?'Wyślij surowe HEX jeden raz':'Wyślij test na 17 i 18';});
$('Send').textContent=$('Profile').value==='hex'?'Wyślij surowe HEX jeden raz':'Wyślij test na 17 i 18';
$('Verified').onchange=()=>{verified=$('Verified').checked?signature(config()):'';};
for(const key of['Device','Profile','Frame','Font','Baud','Data','Stop','Parity'])$(key).addEventListener('change',()=>{verified='';$('Verified').checked=false;$('Auto').checked=false;if(['Device','Baud','Data','Stop','Parity'].includes(key)&&connected){connected=false;bridge.disconnect();}});
$('Save').onclick=guard(()=>{const c=config();if($('Auto').checked&&(!$('Verified').checked||verified!==signature(c)||c.profile==='hex'))throw Error('Automatyka wymaga potwierdzonej ramki tekstowej.');localStorage.setItem('srgRgUsb',JSON.stringify(c));});
initCapture();initReplay();
root.addEventListener('srg-course-selected',e=>{if(!$('Auto').checked)return;try{const c=config();if(c.profile==='hex'||verified!==signature(c))throw Error('Profil niepotwierdzony.');send(c,root.SRGExternalText?root.SRGExternalText(e.detail):e.detail.direction);}catch(err){log('AUTO: '+err.message);}});
scan();
})(typeof window==='undefined'?globalThis:window);
