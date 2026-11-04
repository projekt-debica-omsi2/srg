(function(root){'use strict';
 function key(name){return String(name||'').toUpperCase().replace(/[^\p{L}\p{N}_]+/gu,' ').trim()}
 function stopPath(stop){return root.SRGBerdechowAudioData?.stops?.[key(stop?.name)]||null}
 function startPath(variant){const ss=variant?.stops||[];return root.SRGBerdechowAudioData?.starts?.[key(ss[0]?.name)+'|'+key(ss.at(-1)?.name)]||null}
 function play(path,mode,webAudio,chime){
  if(!path)return false;
  if(root.SRGNativeAudio?.announceBerdechow){try{root.SRGNativeAudio.announceBerdechow(path.slice('berdechow/'.length),mode);return true}catch(e){}}
  webAudio([chime(),...(mode==='next'||mode==='terminal'?['next.mp3']:[]),path,...(mode==='terminal'?['terminal.mp3']:[])]);return true;
 }
 root.SRGBerdechowAudio={key,stopPath,startPath,playStop:(stop,mode,webAudio,chime)=>play(stopPath(stop),mode,webAudio,chime),playStart:(variant,webAudio,chime)=>play(startPath(variant),'start',webAudio,chime)};
})(typeof window==='object'?window:globalThis);
