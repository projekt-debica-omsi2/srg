const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8'),data=JSON.parse(fs.readFileSync(path.join(root,'route_data.json'),'utf8')),ctx={};
vm.runInNewContext(html.match(/const MANUAL_DUTIES=\[[\s\S]*?\n\];/)[0]+html.match(/const BUILTIN_STOP_GPS=.*?;/)[0]+html.match(/const PHOTO_STOP_TIMES_BY_COURSE=.*?;/)[0]+';this.duties=MANUAL_DUTIES;this.gps=BUILTIN_STOP_GPS;this.photos=PHOTO_STOP_TIMES_BY_COURSE;',ctx);
const trips=[],registry=new Map();
for(const duty of ctx.duties)for(const c of duty.trips){
 const stops=c.routeStops||data.variants[c.variantIndex]?.stopIds.map(id=>({...data.stops.find(s=>s.id===id),lat:data.stops.find(s=>s.id===id)?.lat??ctx.gps[id]?.[0],lon:data.stops.find(s=>s.id===id)?.lon??ctx.gps[id]?.[1]}))||[];
 if(stops.length<2)continue;
 const exact={...(ctx.photos[c.photoTimesKey]||{}),...(c.stopTimes||{})};
 const route=stops.map((s,i)=>({id:s.id,name:s.name,lat:Number.isFinite(s.lat)?s.lat:null,lon:Number.isFinite(s.lon)?s.lon:null,time:s.timeUnknown?null:i===0?c.startTime:i===stops.length-1?c.endTime:exact[s.id]||null}));
 const key=crypto.createHash('sha256').update(JSON.stringify([c.startTime,c.endTime,c.serviceCode||'',route])).digest('hex').slice(0,20),alias={duty:duty.id,label:duty.label||duty.id,tripNo:c.tripNo};
 if(registry.has(key)){registry.get(key).aliases.push(alias);continue;}
 const t={id:key,duty:duty.id,tripNo:c.tripNo,aliases:[alias],departure:c.startTime,arrival:c.endTime,serviceCode:c.serviceCode||'',direction:stops.at(-1).name,route};registry.set(key,t);trips.push(t);
}
const out=process.argv[2]||path.join(root,'fleet-server/schedules.json');fs.writeFileSync(out,JSON.stringify({format:'SRGFleetSchedules/1',source:'Current bundled duties and confirmed stop times; no route-editor drafts',trips},null,2));console.log(`${trips.length} distinct trips, ${ctx.duties.length} duties exported`);
