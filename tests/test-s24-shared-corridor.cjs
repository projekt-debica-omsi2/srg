const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const h=fs.readFileSync('app/src/main/assets/index.html','utf8'),data=JSON.parse(fs.readFileSync('route_data.json','utf8')),ctx={};
vm.runInNewContext(h.match(/const MANUAL_DUTIES=\[[\s\S]*?\n\];/)[0]+';this.duties=MANUAL_DUTIES;',ctx);
const byId=new Map(data.stops.map(s=>[s.id,s]));
for(const d of ctx.duties.filter(d=>d.id.startsWith('S-24'))){for(const c of d.trips){assert(c.nativeVariantNo,'S-24 route must come from native RJ');assert(!c.routeStops,'No separate hardcoded S-24 stop list');const v=data.variants.find(v=>v.variantNo===c.nativeVariantNo);assert(v);for(const id of v.stopIds){const s=byId.get(id);assert(Number.isFinite(s.lat)&&Number.isFinite(s.lon),d.id+'/'+c.tripNo+': missing GPS '+id);}if(c.tripNo===2)assert.deepEqual(v.stopIds,data.variants[0].stopIds);if(c.tripNo===3)assert.deepEqual(v.stopIds,data.variants[1].stopIds);assert(!v.stopIds.some(id=>id>=186&&id<=192),'No duplicate unlocated aliases on shared corridor');}}
const evalCtx={};vm.createContext(evalCtx);evalCtx.state={rj:{variants:data.variants.map(v=>({...v,stops:v.stopIds.map(id=>byId.get(id))})),referenceVariants:Object.fromEntries(data.variants.map(v=>[v.index,v.index]))}};evalCtx.activeDuties=()=>ctx.duties;
const fn=h.slice(h.indexOf('function manualCourseEntries(){'),h.indexOf('function renderNoActiveCourse(){'));vm.runInContext(fn,evalCtx);const courses=evalCtx.manualCourseEntries();assert.equal(courses.filter(c=>c.task.startsWith('S-24')).length,8);
for(const id of ['S-24','S-24!']){const c=courses.find(c=>c.task===id&&c.tripNo===2);assert.equal(c.startTime,'12:20');assert.equal(c.stopTimes[3],'12:24');assert(!c.stopTimes[187]);assert(c.unmatchedSourceTimes[187]);}
console.log('PASS: S-24 corridor identity, directional GPS, native RJ binding and isolated course times');
const parserScript=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('root.RJParser='));
const nativeCtx={window:{}};vm.createContext(nativeCtx);vm.runInContext(parserScript,nativeCtx);
for(const file of ['reviewed-gps.js','user-rj.js'])vm.runInContext(fs.readFileSync('app/src/main/assets/'+file,'utf8'),nativeCtx);
const activeFiles=fs.readdirSync('rj').filter(n=>n.endsWith('.011'));assert.equal(activeFiles.length,1);
const native=nativeCtx.window.RJParser.parse(new Uint8Array(fs.readFileSync('rj/'+activeFiles[0])));nativeCtx.window.SRGUserRJ.attachGPS(native);
assert.equal(native.variants.length,16);assert.equal(native.stops.length,185);
native.referenceVariants=Object.fromEntries(native.variants.map(v=>[v.index,v.index]));evalCtx.state.rj=native;
const nativeCourses=evalCtx.manualCourseEntries();assert.equal(nativeCourses.filter(c=>c.task.startsWith('S-24')).length,8);
for(const c of nativeCourses.filter(c=>c.task.startsWith('S-24'))){const v=native.variants.find(v=>v.index===c.variantIndex);for(const stop of v.stops)assert(Number.isFinite(stop.lat)&&Number.isFinite(stop.lon),c.task+'/'+c.tripNo+' lacks GPS '+stop.id);}
console.log('PASS: real AutoEdit export, 16 native variants, 185 stops and GPS on all S-24 courses');
