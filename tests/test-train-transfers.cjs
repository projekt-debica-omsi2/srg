const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const t=require('../app/src/main/assets/transfers.js'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('app/src/main/assets/transfers-data.js','utf8'),ctx);const feed=JSON.parse(JSON.stringify(ctx.window.SRGTransferData));
const at=s=>Date.parse(s+'+02:00');
for(const id of [21,49]){
 const stop={id,name:'SĘDZISZÓW MAŁOPOLSKI GRUNWALDZKA'};
 assert.equal(t.forStop(stop,feed,at('2026-10-19T00:00:00')).rows.length,45);
 assert.equal(t.forStop(stop,feed,at('2026-10-18T00:00:00')),null);
 assert.equal(t.forStop(stop,feed,at('2026-10-20T00:00:00')).rows.length,45);
 assert.equal(t.forStop(stop,feed,at('2026-10-23T00:00:00')).rows.length,45);
 assert.equal(t.forStop(stop,feed,at('2026-10-24T00:00:00')),null);
 assert.equal(t.forStop(stop,feed,at('2026-10-25T00:00:00')),null);
 assert.equal(t.forStop(stop,feed,Date.parse('2026-10-26T00:00:00+01:00')).rows.length,45);
 assert.equal(t.forStop(stop,feed,at('2026-10-19T04:35:00')).rows.length,44);
 const before=t.forStop(stop,feed,at('2026-10-19T20:44:59')).rows.filter(r=>r.time==='20:45');
 assert.deepEqual(before.map(r=>r.direction).sort(),['Rzeszów Główny','Tarnów']);
 assert.equal(t.forStop(stop,feed,at('2026-10-19T20:45:00')).rows.length,4);
 assert.equal(t.forStop(stop,feed,at('2026-10-19T23:01:00')),null);
 assert.equal(t.forStop({...stop,id:18},feed,at('2026-10-19T00:00:00')),null);
}
assert.equal(feed.daily.filter(r=>r.carrier==='FlixBus').length,7);assert.equal(new Set(feed.daily.filter(r=>r.carrier==='POLREGIO').map(r=>r.train)).size,45);
console.log('PASS 45 trains, both stop IDs, date validity, two simultaneous directions and expiry');
