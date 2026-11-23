(function(root){'use strict';
// Text equivalent of the LCD header. No advertisements or transfer cards.
const cycle=root.SRGLcdCycle.create();let manualSignature='';
function header(d,now=Date.now()){
 const clock=(typeof d.clock==='string'&&/^([01]\d|2[0-3]):[0-5]\d/.test(d.clock)?d.clock.slice(0,5):new Date(now).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}));
 if(!d.kursAktywny||!d.kursId){cycle.reset();manualSignature='';return {type:'clock',text:clock};}
 const manual=d.lcdManual,valid=manual&&manual.expiresAt>now&&(manual.anchorIndex==null||manual.anchorIndex===d.aktualnyIndeks)&&(manual.courseKey==null||manual.courseKey===d.kursId)&&['next','current'].includes(manual.type);
 if(valid){const signature=JSON.stringify([manual.id,manual.type,manual.index,manual.name,manual.expiresAt]);if(signature!==manualSignature){manualSignature=signature;cycle.reset();}}else manualSignature='';
 const type=valid?manual.type:d.additional?'route':cycle.pick(d.lcdConfig,d,now).type;
 if(type==='route'){
  const streets=(d.przystanki||[]).slice(Math.max(0,d.aktualnyIndeks||0)).map(x=>String(x.ulica||x.nazwa||'').trim()).filter((s,i,a)=>s&&s!==a[i-1]);
  return {type,text:[d.linia,d.kierunek,d.additional?'':'TRASA: '+streets.join(' — ')].filter(Boolean).join(' · ')};
 }
 if(type==='next'||type==='current'){
  const stop=valid?manual:type==='next'?d.nastepny:d.aktualny;
  const terminal=valid?manual.index>=(d.przystanki||[]).length-1:type==='next'?d.koncowyNastepny:d.koniecKursu;
  return {type,text:(type==='next'?'NASTĘPNY PRZYSTANEK: ':'PRZYSTANEK: ')+(stop?.nazwa||stop?.name||'—')+(terminal?' · PRZYSTANEK KOŃCOWY':stop?.naZadanie?' · NA ŻĄDANIE':'')};
 }
 return {type:'clock',text:clock};
}
root.SRGLcdLed={header};
})(typeof window!=='undefined'?window:globalThis);
