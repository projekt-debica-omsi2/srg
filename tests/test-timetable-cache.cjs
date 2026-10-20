const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const monis={time:'08:45',direction:'Dębica',carrier:'Monis',dates:['2026-10-24']};
const w={SRGPKSRzeszow:{departures:[monis]},SRGStationRail:{}};vm.runInNewContext(fs.readFileSync('app/src/main/assets/timetable-sync.js','utf8'),{window:w});
const feed={calendar:{mode:'dates',dates:['2026-10-24']},departures:[{time:'06:00',direction:'Przemyśl',carrier:'PKP Intercity'}]};
w.SRGTimetableCache.apply({stationRail:{'debica-da':{'2026-10-24':feed}}});assert.equal(w.SRGStationRail['debica-da']['2026-10-24'],feed);
w.SRGTimetableCache.apply({stationRail:{'debica-da':{'2026-10-24':{...feed,departures:[{time:'wrong'}]}}}});assert.equal(w.SRGStationRail['debica-da']['2026-10-24'],feed);
w.SRGTimetableCache.apply({pks:{validFrom:'2026-10-24',validTo:'2026-11-01',departures:[{time:'06:10',carrier:'PKS Rzeszów',direction:'Ropczyce',dates:['2026-10-24']}]}});
assert.equal(w.SRGPKSRzeszow.departures.length,2);assert.equal(w.SRGPKSRzeszow.departures[1],monis);
w.SRGTimetableCache.apply({pks:{validFrom:'2026-10-24',validTo:'2026-11-01',departures:[]}});assert.equal(w.SRGPKSRzeszow.departures.length,2);
console.log('PASS cache: dated updates, malformed data rejected, previous snapshot retained, Monis preserved');

const transfers=require('../app/src/main/assets/transfers.js');
global.SRGPKSRzeszow={validFrom:'2026-10-19',validTo:'2026-10-20',departures:[{time:'08:45',carrier:'Monis',direction:'Dębica',dates:['2026-10-24']},{time:'08:50',carrier:'PKS Rzeszów',direction:'Ropczyce',dates:['2026-10-24']}]};
const hub=transfers.forStop({id:34,name:'RZESZÓW DWORZEC AUTOBUSOWY'},null,Date.parse('2026-10-24T06:00:00+02:00'));
assert.deepEqual(hub.pages[0].rows.map(r=>r.carrier),['Monis']);
delete global.SRGPKSRzeszow;
console.log('PASS Monis independent validity after downloaded PKS expiry');
// Rollback must remove downloaded days and restore all built-in carriers, across repeated restores.
w.SRGTimetableCache.apply({useBundled:true});
assert.equal(Object.keys(w.SRGStationRail).length,0);
assert.equal(w.SRGPKSRzeszow.departures.length,1);assert.equal(w.SRGPKSRzeszow.departures[0].carrier,'Monis');
w.SRGPKSRzeszow.departures.length=0;
w.SRGTimetableCache.apply({useBundled:true});assert.equal(w.SRGPKSRzeszow.departures.length,1);
w.SRGTimetableCache.apply({stationRail:{'debica-da':{'2026-10-24':feed}}});assert.equal(w.SRGStationRail['debica-da']['2026-10-24'],feed);
console.log('PASS rollback: clean bundled snapshot, repeatable restore, updates can be applied again');
