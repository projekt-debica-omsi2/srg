const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const ctx={window:{}};
for(const file of ['mks-network-data.js','mks-network.js'])vm.runInNewContext(fs.readFileSync('app/src/main/assets/'+file,'utf8'),ctx);
const api=ctx.window.SRGMKS,feed=ctx.window.SRGMKSNetwork;
assert(api.valid(feed));assert.equal(Object.keys(feed.stops).length,38);
const pairs=[[139,157,692,690],[140,156,685,686],[141,155,474,469],[143,153,235,40],[144,152,236,100],[145,151,237,65],[146,150,238,64],[147,149,239,66]];
for(const [inbound,outbound,mksIn,mksOut] of pairs){
 assert.equal(api.map[inbound][0],mksIn);assert.equal(api.map[outbound][0],mksOut);assert.notEqual(mksIn,mksOut);
 for(const id of [inbound,outbound]){
  const rows=api.rowsFor({id,name:api.expected[id]},'2026-11-23','00:00',feed);
  assert(rows.every(r=>api.map[id].includes(Number(r.stopId))));
  assert.equal(api.rowsFor({id,name:'INNY PRZYSTANEK'},'2026-11-23','00:00',feed),null);
 }
}
for(const id of [139,140,141,156,157])assert(api.rowsFor({id,name:api.expected[id]},'2026-11-23','00:00').some(r=>r.line==='14'));
for(const id of [155,158])assert.equal(api.rowsFor({id,name:api.expected[id]},'2026-11-23','00:00').length,0,'Inactive physical side must not borrow opposite-side departures');
assert.equal(api.rowsFor({id:139,name:api.expected[139]},'2026-11-22','00:00').length,0);
const java=fs.readFileSync('app/src/main/java/pl/srgmobile/classic/MksDatabase.java','utf8');const ids=java.match(/static final String IDS="([\d,]+)"/)[1].split(',').map(Number);
assert(Object.values(api.map).flat().every(id=>ids.includes(id)),'Android updates must include every mapped stop');
assert.equal(api.rowsFor({id:139,name:api.expected[139]},'2027-01-01','00:00').length,0);
console.log('PASS Grudna transfers: distinct physical sides, line 14, source calendar, name guards, inactive stops, native update coverage');
