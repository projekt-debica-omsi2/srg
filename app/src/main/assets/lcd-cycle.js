(function(root){
 'use strict';
 const kinds=['route','next','current','transfers','clock'];
 const defaults=()=>({steps:[{type:'route',seconds:12},{type:'next',seconds:7},{type:'current',seconds:7},{type:'transfers',seconds:8},{type:'route',seconds:12}]});
 function normalize(raw){
  if(!raw||!Array.isArray(raw.steps))return defaults();
  const steps=raw.steps.slice(0,12).filter(s=>s&&kinds.includes(s.type)).map(s=>({type:s.type,seconds:Number.isFinite(Number(s.seconds))?Math.max(0,Math.min(300,Math.round(Number(s.seconds)))):0}));
  return steps.some(s=>s.seconds>0)?{steps}:defaults();
 }
 function available(config,state){return normalize(config).steps.filter(s=>s.seconds>0&&(s.type!=='next'||state.nastepny)&&(s.type!=='transfers'||(state.przesiadka&&Array.isArray(state.przesiadka.przewoznicy)&&state.przesiadka.przewoznicy.length)));}
 function create(){let key='',started=0;return {reset(){key='';},pick(config,state,now){
  const steps=available(config,state);const signature=JSON.stringify([state.kursId,state.aktualnyIndeks,normalize(config),steps]);
  if(signature!==key){key=signature;started=now;}
  if(now<started)started=now;
  const total=steps.reduce((n,s)=>n+s.seconds*1000,0);if(!total)return {type:'clock',seconds:0};
  let elapsed=(now-started)%total;for(const s of steps){if(elapsed<s.seconds*1000)return s;elapsed-=s.seconds*1000;}
  return steps[0];
 }}}
 root.SRGLcdCycle={defaults,normalize,available,create};
})(typeof window!=='undefined'?window:globalThis);
