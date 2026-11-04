(function(root){'use strict';
 function name(stop){return String(stop?.name||'').trim().replace(/\s+(?:N\.?\s*Ż\.?|NZ|NA ŻĄDANIE)\s*$/i,'').replace(/\s+\d{2,4}(?=\s*(?:\([^)]*\))?\s*$)/,'').replace(/[.\s]+$/,'');}
 function arrival(stop){return name(stop)+(/(?:N\.?\s*Ż\.?|NZ|NA ŻĄDANIE)\s*$/i.test(String(stop?.name||''))?'. Na żądanie.':'');}
 function next(stop,terminal){return 'Następny przystanek: '+arrival(stop).replace(/[.\s]+$/,'')+(terminal?'. Przystanek końcowy.':'.');}
 function start(variant){return 'Kierunek: '+name(variant?.stops?.at(-1)||{name:variant?.direction||''});}
 function texts(rj){
  const items=new Set();
  for(const v of rj?.variants||[]){if(!v.stops?.length)continue;items.add(start(v));for(const [i,s] of v.stops.entries()){if(!name(s))continue;items.add(arrival(s));items.add(next(s,i===v.stops.length-1));}}
  if(items.size>5000)throw Error('Maksymalnie 5000 różnych zapowiedzi w komplecie.');
  return [...items];
 }
 root.SRGLocalSpeech={name,arrival,next,start,texts};
})(typeof window==='object'?window:globalThis);
