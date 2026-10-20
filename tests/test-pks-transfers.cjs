const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const ctx={window:{},Intl,Date,Set};
for(const file of ['pks-rzeszow-data.js','mpk-rzeszow-data.js','transfers.js'])vm.runInNewContext(fs.readFileSync('app/src/main/assets/'+file,'utf8'),ctx);
const t=ctx.window.SRGTransfers,feed=ctx.window.SRGPKSRzeszow;
const stop={id:34,name:'RZESZÓW DWORZEC AUTOBUSOWY'};
const get=(date)=>t.forStop(stop,undefined,Date.parse(date));
assert.equal(feed.departures.length,936);
const before=get('2026-10-19T06:09:59+02:00');assert.equal(before.rows.length,8);assert.equal(before.rows[0].time,'06:10');
const after=get('2026-10-19T06:10:00+02:00');assert.equal(after.rows.length,8);assert(after.rows.every(r=>r.time>'06:10'));
assert.equal(t.forStop({...stop,id:40},undefined,Date.parse('2026-10-19T06:10:00+02:00')).rows.length,8);
assert.equal(t.forStop({...stop,id:33},undefined,Date.parse('2026-10-19T06:10:00+02:00')),null);
assert.equal(get('2026-10-19T23:59:00+02:00'),null);
assert.equal(get('2027-01-01T06:00:00+01:00'),null);
assert.equal(get('2026-10-13T06:00:00+02:00').pages[0].rows.length,0);
assert.equal(get('2026-10-02T06:00:00+02:00'),null);
for(const r of feed.departures){
 if(r.codes.includes('S')&&!r.codes.some(c=>['D','+','6ś','(D)'].includes(c))){assert(!r.dates.includes('2026-10-17'));assert(!r.dates.includes('2026-12-23'));}
 if(r.codes.includes('D')&&!r.codes.some(c=>['+','6ś'].includes(c))){assert(!r.dates.includes('2026-11-11'));assert(!r.dates.includes('2026-12-24'));}
 if(r.codes.includes('l')||r.codes.includes('m')||r.codes.includes('n'))assert(!r.dates.includes('2026-12-31'));
}
assert.equal(get('2026-10-26T06:09:59+01:00').rows[0].time,'06:10');
assert(get('2026-10-18T08:00:00+02:00').rows.length<=8);
assert(fs.readFileSync('app/src/main/assets/index.html','utf8').indexOf('pks-rzeszow-data.js')<fs.readFileSync('app/src/main/assets/index.html','utf8').indexOf('src="transfers.js"'));
console.log('PASS PKS: 936 entries, nearest eight, exact expiry, both DA IDs, separate Localny, operating dates, DST, validity');

const monis=feed.departures.filter(r=>r.carrier==='Monis');assert.equal(monis.length,32);
const hnp=monis.find(r=>r.time==='05:45');assert.equal(hnp.codes[0],'Hnp');
assert(hnp.dates.includes('2026-10-14'));assert(hnp.dates.includes('2026-12-23'));
assert(!hnp.dates.includes('2026-10-19'));assert(!hnp.dates.includes('2026-12-24'));assert(!hnp.dates.includes('2026-12-31'));
const hub=get('2026-10-19T06:00:00+02:00');assert.equal(hub.pages.length,3);assert.equal(hub.pages[0].rows.length,8);
assert.equal(hub.pages[1].rows.length,0);assert.equal(hub.pages[2].rows.length,8);
assert(hub.pages[2].rows.every(r=>['MPK 0A','MPK 0B'].includes(r.carrier)));
assert(hub.pages[2].rows.every(r=>r.profile==='PS'));
assert(get('2026-10-17T06:00:00+02:00').pages[2].rows.every(r=>r.profile==='SS'));
assert(get('2026-11-11T06:00:00+01:00').pages[2].rows.every(r=>r.profile==='NS'));
console.log('PASS hub: Hnp calendar, 32 Monis trips, three pages, eight rows, MPK day profiles, explicit missing rail data');
