const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const w={},ctx={window:w,Intl,Date};for(const file of ['transfers-data.js','mks-debica-data.js','transfers.js','timetable-sync.js'])vm.runInNewContext(fs.readFileSync('app/src/main/assets/'+file,'utf8'),ctx);
const f=w.SRGMKSDebica,p=f.profiles;
assert.equal(p.Roboczy.length,250);assert.equal(p['Roboczy wakacyjny/feryjny'].length,233);assert.equal(p.Sobota.length,86);assert.equal(p['Niedziele i święta'].length,50);
for(const [day,profile] of [['2026-10-20','Roboczy'],['2026-10-24','Sobota'],['2026-10-25','Niedziele i święta'],['2026-12-24','Niedziele i święta'],['2027-01-20','Roboczy wakacyjny/feryjny']]){
 const rows=w.SRGTimetableCache.mksRows(f,day,'05:00');assert.equal(rows.length,8);assert.deepEqual(JSON.parse(JSON.stringify(rows)),JSON.parse(JSON.stringify(p[profile].filter(r=>r.time>'05:00').sort((a,b)=>a.time.localeCompare(b.time)||a.carrier.localeCompare(b.carrier)).slice(0,8))));
}
for(const id of [1,68]){const page=w.SRGTransfers.forStop({id,name:'DĘBICA DWORZEC AUTOBUSOWY'},w.SRGTransferData,Date.parse('2026-10-20T05:00:00+02:00')).pages[1];assert.equal(page.rows.length,8);assert(page.rows.every(r=>r.carrier.startsWith('MKS ')));}
assert.equal(w.SRGTimetableCache.mksRows(f,'2026-10-20','23:59').length,0);
console.log('PASS MKS: 23 relations, four calendars, holiday/vacation, both DA IDs, 8 next departures');
