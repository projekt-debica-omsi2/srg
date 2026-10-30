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
 return (cfg.profile==='hex'?[null]:[17,18]).map(addr=>{
 const s=template.replaceAll('{addr}',addr===null?'':addr.toString(16)).replaceAll('{text}',hex).replace(/\s/g,'');
 if(!s||s.length%2||!/^[\da-f]+$/i.test(s)||s.length>8192)throw Error('Niepoprawna ramka HEX (maks. 4096 bajtów).');return s.match(/../g).join(' ').toUpperCase();});
}
if(typeof module!=='undefined')module.exports={frames};if(!root.document)return;
const $=id=>document.getElementById('rg'+id),bridge=root.SRGRgUsb;let connected=false,verified='',saved={},replayToken=0,replayRunning=false;
const log=t=>{ $('Log').textContent=($('Log').textContent+'\n'+new Date().toLocaleTimeString()+' '+t).slice(-18000);$('Log').scrollTop=$('Log').scrollHeight;};
function config(){return {profile:$('Profile').value,frame:$('Frame').value,font:$('Font').value,baud:+$('Baud').value,data:+$('Data').value,stop:+$('Stop').value,parity:+$('Parity').value,device:$('Device').value};}
function signature(c){return JSON.stringify(c);}
function guard(fn){return ()=>{try{fn();}catch(e){log('BŁĄD: '+e.message);}};}
function send(c,text){if(!connected||!bridge)throw Error('Najpierw połącz konwerter USB w APK.');const batch=frames(c,text);batch.forEach(h=>bridge.send(h));log('Zlecono zapis USB — sprawdź fizyczną tablicę.');}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function initReplay(){
 const sel=$('ReplaySelect');if(!sel)return;sel.replaceChildren();
 for(const c of (root.SRGRgReplayCaptures||[])){const o=document.createElement('option');o.value=c.id;o.textContent=c.label;sel.appendChild(o);}
 $('ReplayStop').disabled=true;
 $('ReplayStart').onclick=()=>{startReplay().catch(e=>{replayRunning=false;$('ReplayStart').disabled=false;$('ReplayStop').disabled=true;$('ReplayStatus').textContent='BŁĄD: '+e.message;log('REPLAY BŁĄD: '+e.message);});};
 $('ReplayStop').onclick=()=>{replayToken++;replayRunning=false;$('ReplayStart').disabled=false;$('ReplayStop').disabled=true;$('ReplayStatus').textContent='Zatrzymano.';log('REPLAY: zatrzymano przez użytkownika');};
}
async function startReplay(){
 if(replayRunning)throw Error('Odtwarzanie już trwa.');if(!connected||!bridge)throw Error('Najpierw połącz konwerter USB.');
 if(!$('ReplaySafe').checked)throw Error('Najpierw potwierdź odłączenie oryginalnego sterownika RS-485.');
 const cap=(root.SRGRgReplayCaptures||[]).find(c=>c.id===$('ReplaySelect').value);if(!cap)throw Error('Brak danych przechwytu.');
 const token=++replayToken;replayRunning=true;$('ReplayStart').disabled=true;$('ReplayStop').disabled=false;
 log('REPLAY START: '+cap.label+' · '+cap.chunks.length+' porcji · '+cap.bytes+' B');
 for(let i=0;i<cap.chunks.length;i++){if(token!==replayToken) return;const [delay,hex]=cap.chunks[i];if(delay)await sleep(delay);if(token!==replayToken)return;bridge.send(hex);if(i===0||i===cap.chunks.length-1||(i+1)%25===0)$('ReplayStatus').textContent=`Wysyłanie ${i+1}/${cap.chunks.length} · ${cap.bytes} B`;}
 if(token!==replayToken)return;replayRunning=false;$('ReplayStart').disabled=false;$('ReplayStop').disabled=true;$('ReplayStatus').textContent='Odtwarzanie zakończone — sprawdź tablicę.';log('REPLAY KONIEC: '+cap.label);
}
root.rgUsbEvent=(type,msg)=>{if(type==='connected')connected=true;if(['error','disconnected'].includes(type))connected=false;if(['connected','error','disconnected','info'].includes(type))$('Status').textContent=msg;log(type.toUpperCase()+': '+msg);};
function scan(){const old=$('Device').value;$('Device').replaceChildren();if(!bridge){$('Status').textContent='Transport USB dostępny w APK; w przeglądarce tylko podgląd ramek.';return;}for(const d of JSON.parse(bridge.devices())){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;$('Device').appendChild(o);}if([...$('Device').options].some(o=>o.value===old))$('Device').value=old;if(!$('Device').options.length)$('Status').textContent='Nie wykryto obsługiwanego konwertera USB.';}
try{saved=JSON.parse(localStorage.getItem('srgRgUsb')||'{}');}catch(e){}
for(const key of ['profile','frame','font','baud','data','stop','parity'])if(saved[key]!=null)$(key[0].toUpperCase()+key.slice(1)).value=saved[key];
// Verification is session-only: reconfirm after restart or device/profile change.
$('Scan').onclick=guard(scan);$('Connect').onclick=guard(()=>{if(!bridge||!$('Device').value)throw Error('Brak konwertera USB.');connected=false;const c=config();bridge.connect(+c.device,c.baud,c.data,c.stop,c.parity);});
$('Disconnect').onclick=()=>{replayToken++;replayRunning=false;connected=false;if(bridge)bridge.disconnect();};
$('Course').onclick=guard(()=>{const a=root.__srg;if(!a?.state.variant)throw Error('Wybierz kurs.');$('Text').value=a.finalDirection(a.state.variant);});
$('Preview').onclick=guard(()=>log('PODGLĄD:\n'+frames(config(),$('Text').value).join('\n')));
$('Send').onclick=guard(()=>send(config(),$('Text').value));
$('Profile').addEventListener('change',()=>{$('Send').textContent=$('Profile').value==='hex'?'Wyślij surowe HEX jeden raz':'Wyślij test na 17 i 18';});
$('Send').textContent=$('Profile').value==='hex'?'Wyślij surowe HEX jeden raz':'Wyślij test na 17 i 18';
$('Verified').onchange=()=>{verified=$('Verified').checked?signature(config()):'';};
for(const key of ['Device','Profile','Frame','Font','Baud','Data','Stop','Parity'])$(key).addEventListener('change',()=>{verified='';$('Verified').checked=false;$('Auto').checked=false;if(['Device','Baud','Data','Stop','Parity'].includes(key)&&connected){connected=false;bridge.disconnect();}});
$('Save').onclick=guard(()=>{const c=config();if($('Auto').checked&&(!$('Verified').checked||verified!==signature(c)||c.profile==='hex'))throw Error('Automatyka wymaga potwierdzonej ramki tekstowej.');localStorage.setItem('srgRgUsb',JSON.stringify(c));log('Zapisano profil. Automatyka wymaga ponownego potwierdzenia po restarcie.');});
initReplay();
root.addEventListener('srg-course-selected',e=>{if(!$('Auto').checked)return;try{const c=config();if(c.profile==='hex'||verified!==signature(c))throw Error('Profil niepotwierdzony.');send(c,root.SRGExternalText?root.SRGExternalText(e.detail):e.detail.direction);}catch(err){log('AUTO: '+err.message);}});scan();
})(typeof window==='undefined'?globalThis:window);
