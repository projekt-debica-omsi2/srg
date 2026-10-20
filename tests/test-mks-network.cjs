const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const w={},ctx={window:w,Intl,Date};
for(const f of ['transfers-data.js','mks-debica-data.js','transfers.js','mks-network-data.js','mks-network.js','timetable-sync.js'])vm.runInNewContext(fs.readFileSync('app/src/main/assets/'+f,'utf8'),ctx);
const api=w.SRGMKS,feed=w.SRGMKSNetwork;
assert(api.valid(feed));
const stop=id=>({id,name:api.expected[id]});
for(const id of Object.keys(api.map).map(Number))for(const day of ['2026-10-20','2026-10-24','2026-10-25']){
 const expectedIds=api.map[id].map(String),rows=api.rowsFor(stop(id),day,'05:00');assert(rows.length<=8);assert(rows.every(r=>expectedIds.includes(r.stopId)&&r.time>'05:00'));
 const panel=w.SRGTransfers.forStop(stop(id),w.SRGTransferData,Date.parse(day+'T05:00:00+02:00'));
 assert(panel);const page=panel.pages.find(p=>p.title.includes('MKS'));assert.equal(JSON.stringify(page.rows),JSON.stringify(rows));
}
assert.equal(api.rowsFor(stop(9),'2026-10-20','05:00').map(r=>r.direction).includes('STOBIERNA'),true);
assert.equal(api.rowsFor(stop(9),'2026-10-20','05:00').map(r=>r.direction).includes('BRACIEJOWA'),true);
assert(api.rowsFor(stop(9),'2026-10-20','05:00').some(r=>r.direction.includes('GŁOBIKOWA')));
assert(api.rowsFor(stop(9),'2026-10-20','05:00').some(r=>r.direction==='KRAKOWSKA SZPITAL'));
assert.equal(api.rowsFor(stop(9),'2026-10-20','05:03').some(r=>r.time==='05:03'),false);
assert.equal(api.rowsFor(stop(9),'2027-01-01','05:00').length,0);
assert.equal(api.rowsFor({id:3,name:'INNY PRZYSTANEK'},'2026-10-20','05:00'),null);
for(const [n,d] of [['NIE KURSUJE 31 GRUDNIA','2026-12-31'],['NIE KURSUJE 24,25,26 XII; 1,6 I; ŚW. WIELKANOCNE','2026-12-25'],['NIE KURSUJE 1 i 3V; 15 VIII; 11XI i BOŻE CIAŁO','2026-11-11'],['NIE KURSUJE W WIELKI PIĄTEK','2027-03-26'],['NIE KURSUJE W WIELKĄ SOBOTE','2027-03-27']])assert.equal(api.runs(n,d),false,n);
const notes=new Set(Object.values(feed.stops).flatMap(s=>Object.values(s.profiles).flat()).flatMap(r=>r.notes));for(const n of notes)assert(api.runs(n,'2026-10-20'),n);
assert.equal(api.runs('NIE KURSUJE W NIEZNANY DZIEŃ','2026-10-20'),false);
const changed=JSON.parse(JSON.stringify(feed));changed.stops[171].name='TEST';w.SRGTimetableCache.apply({mksNetwork:changed});assert.equal(w.SRGMKSNetwork.stops[171].name,'TEST');
w.SRGTimetableCache.apply({mksNetwork:{schema:1}});assert.equal(w.SRGMKSNetwork.stops[171].name,'TEST');
w.SRGTimetableCache.apply({useBundled:true});assert.equal(w.SRGMKSNetwork.stops[171].name,'DWORZEC PKP');
console.log('PASS MKS SQLite: 17 physical stops, both directions, variants, calendar, eight departures, rollback');
