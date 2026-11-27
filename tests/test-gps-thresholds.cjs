const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c={};for(const f of ['auto-gps.js','voice-gps.js'])vm.runInNewContext(fs.readFileSync('app/src/main/assets/'+f,'utf8'),c);
const p=m=>({lat:50,lon:21+m/71600}),stops=[{...p(0),id:1},{...p(500),id:2}],fix=m=>({...p(m),acc:5,speed:8});
const a=c.SRGAutoGPS.createTracker(),b=c.SRGAutoGPS.createTracker();
const run=(t,m,n,meters)=>t.evaluate({enabled:true,courseActive:true,stops,index:0,courseKey:'c',fix:fix(m),now:n,departureMeters:meters});
run(a,0,1000,30);run(b,0,1000,120);run(a,35,2100,30);run(b,35,2100,120);
assert.equal(run(a,45,3200,30).advance,true);assert.equal(run(b,45,3200,120).advance,undefined);run(b,125,4300,120);assert.equal(run(b,135,5400,120).advance,true);
const approach=c.SRGAutoGPS.createTracker();for(const [i,m] of [-39,-35,-30,-25].entries())assert.equal(run(approach,m,1000+i*1100,10).advance,undefined,'approaching is not departing');
const arrival=c.SRGVoiceGPS.createTracker();const e=(m,n)=>arrival.evaluate({enabled:true,courseActive:true,stops,index:1,courseKey:'c',fix:fix(m),now:n,arrivalMeters:150});assert.equal(e(360,1000).arrival,undefined);assert.equal(e(370,2100).arrival,true);
console.log('PASS independent departure thresholds, early arrival and no advancement while approaching');
