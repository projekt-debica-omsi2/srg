const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ctx={window:{},Intl,Date};
for(const f of ['transfers-data.js','rail-rzeszow-data.js','station-rail-data.js','transfers.js'])vm.runInNewContext(fs.readFileSync('app/src/main/assets/'+f,'utf8'),ctx);
const root=ctx.window,t=root.SRGTransfers,st=key=>t.stations.find(s=>s.key===key);
function result(key,date,time='05:00',offset='+02:00'){const s=st(key);return t.forStop({id:s.ids[0],name:s.name},root.SRGTransferData,Date.parse(date+'T'+time+':00'+offset));}
for(const [key,dates] of Object.entries(root.SRGStationRail))for(const [day,feed] of Object.entries(dates)){
 const rows=feed.departures;assert(rows.length>0);assert.equal(new Set(rows.map(r=>JSON.stringify(r))).size,rows.length);
 assert(rows.every((r,i)=>!i||rows[i-1].time<=r.time));
 const offset=day>='2026-10-25'?'+01:00':'+02:00';const r=result(key,day,'05:00',offset);
 const page=key==='rzeszow-da'?r.pages[1]:key==='debica-da'?r.pages[0]:r;
 assert.equal(page.rows.length,8);assert(page.rows.every(r=>r.time>'05:00'));
 assert.equal(t.railRows(feed,'2027-01-01','00:00').length,0);
}
const sat=root.SRGStationRail['sedziszow-grunwaldzka']['2026-10-24'].departures;
const sun=root.SRGStationRail['sedziszow-grunwaldzka']['2026-10-25'].departures;
assert(sat.some(r=>r.time==='05:33'&&r.direction==='Przemyśl Główny'));
assert(!sat.some(r=>r.time==='05:42'));assert(sun.some(r=>r.time==='05:42'&&r.direction==='Rzeszów Główny'));
assert(!result('sedziszow-grunwaldzka','2026-10-24','23:59'));
const deb=result('debica-da','2026-10-19');assert.equal(deb.pages[1].rows.length,0);assert.equal(deb.pages[2].rows.length,0);
console.log('PASS dated station feeds: weekend differences, expiry, 8 rows, Warsaw DST, empty MKS/Monis');
