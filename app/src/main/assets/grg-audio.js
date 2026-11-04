(function(root){'use strict';
 const key=s=>String(s||'').toUpperCase().replace(/[^\p{L}\p{N}_]+/gu,' ').trim();
 function stopFile(stop){const row=root.SRGGRGAudioData?.stops?.[stop?.id];return row&&key(row.name)===key(stop?.name)?row.file:null}
 function startFile(variant){const ss=variant?.stops||[];return root.SRGGRGAudioData?.starts?.[key(ss[0]?.name)+'|'+key(ss.at(-1)?.name)]||null}
 function play(file,mode,onRequest,webAudio,chime){
  if(!file)return false;
  if(root.SRGNativeAudio?.announceGRG){try{root.SRGNativeAudio.announceGRG(file,mode,onRequest);return true}catch(e){}}
  webAudio([chime(),...(mode==='next'||mode==='terminal'?['next.mp3']:[]),'grg/'+file,...(onRequest?['na_zadanie.mp3']:[]),...(mode==='terminal'?['terminal.mp3']:[])]);return true;
 }
 root.SRGGRGAudio={stopFile,startFile,playStop:(stop,mode,onRequest,webAudio,chime)=>play(stopFile(stop),mode,onRequest,webAudio,chime),playStart:(variant,webAudio,chime)=>play(startFile(variant),'start',false,webAudio,chime)};
})(typeof window==='object'?window:globalThis);
