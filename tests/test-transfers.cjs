const assert=require('assert/strict'),t=require('../app/src/main/assets/transfers.js');
const now=Date.parse('2026-10-16T12:00:00+02:00'),stop={id:18,name:'SĘDZISZÓW MAŁOPOLSKI OSIEDLE MŁODYCH'};
const row=(departure,direction='Kraków')=>({station:'sedziszow-mlodych',carrier:'FlixBus',direction,departure});
const feed={verified:true,departures:[row('2026-10-16T11:00:00+02:00'),row('2026-10-16T12:00:00+02:00'),row('2026-10-16T13:00:00+02:00'),row('2026-10-17T01:00:00+02:00'),row('2026-10-16T14:00:00+02:00','Rzeszów')]};
assert.deepEqual(t.forStop(stop,feed,now).rows.map(r=>r.time),['13:00','14:00']);
assert.equal(t.forStop(stop,feed,Date.parse('2026-10-16T14:00:00+02:00')),null);
assert.equal(t.forStop({...stop,id:52},feed,now).rows.length,2);
assert.equal(t.forStop({...stop,name:'INNY'},feed,now),null);
assert.equal(t.forStop(stop,{...feed,verified:false},now),null);
assert.equal(t.forStop(stop,feed,Date.parse('2026-10-17T00:00:00+02:00')).rows[0].time,'01:00');
assert.equal(t.forStop(stop,{verified:true,departures:[row('invalid'),row('2026-10-16T16:00:00'),{...row('2026-10-16T16:00:00+02:00'),cancelled:true}]},now),null);
console.log('PASS transfers: RJ IDs, names, Warsaw date, expiry, later same-direction trips, midnight, invalid/cancelled data');
const fs=require('fs'),vm=require('vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('app/src/main/assets/transfers-data.js','utf8'),ctx);const daily=JSON.parse(JSON.stringify(ctx.window.SRGTransferData));
assert.equal(daily.daily.filter(r=>r.carrier==='FlixBus').length,7);
for(const station of t.stations.filter(s=>s.key!=='sedziszow-grunwaldzka')){for(const id of station.ids){
 const st={id,name:station.name};const result=t.forStop(st,daily,Date.parse('2026-10-16T00:00:00+02:00'));
 assert.equal(result.rows.length,station.key==='rzeszow-lokalny'?1:2);
 for(const row of result.rows){const at=Date.parse('2026-10-16T'+row.time+':00+02:00');assert(!t.forStop(st,daily,at)?.rows.some(r=>r.time===row.time));}
 assert.equal(t.forStop(st,daily,Date.parse('2026-10-16T23:59:59+02:00')),null);
 assert.equal(t.forStop(st,daily,Date.parse('2026-10-17T00:00:00+02:00')).rows.length,result.rows.length);
 assert.equal(t.forStop(st,daily,Date.parse('2026-12-01T00:00:00+01:00')).rows.length,result.rows.length);
}}
assert.deepEqual(t.forStop(stop,daily,Date.parse('2026-10-16T08:56:59+02:00')).rows.map(r=>r.time),['08:57','21:32']);
assert.equal(t.forStop(stop,daily,Date.parse('2026-10-16T08:57:00+02:00')).rows[0].time,'21:32');
console.log('PASS daily user schedule: all 8 RJ IDs, 7 departures, exact expiry, midnight reset and winter timezone');
