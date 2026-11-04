(function(root){'use strict';
 const key=s=>String(s||'').toUpperCase().replace(/[^\p{L}\p{N}_]+/gu,' ').trim();
 function bytes(fallback){const b=root.SRGBundledRJ;if(!b?.base64)return fallback();const raw=atob(b.base64),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a.buffer}
 function attachGPS(r){const registry=root.SRGReviewedGPS||[];for(const stop of r.stops){const source=registry.find(s=>s.id===stop.id&&key(s.name)===key(stop.name));if(source){stop.lat=source.lat;stop.lon=source.lon;stop.gpsRadius=50;stop.gpsVerified=true;if(source.street)stop.street=source.street}}}
 root.SRGUserRJ={bytes,attachGPS};
})(typeof window==='object'?window:globalThis);
