const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8'),data=JSON.parse(fs.readFileSync('app/src/main/assets/kursowki_godziny_z_fotografii.json','utf8')).kursy['S-27:4'];
const map=JSON.parse(html.match(/const PHOTO_STOP_TIMES_BY_COURSE=(\{[^;]+\});/)[1])['S-27:4'];
assert.equal(data.przystanki_z_ekranu.length,32);assert.deepEqual(map,data.godziny_wg_id_RJ);
assert.equal(map[40],'10:45');assert.equal(map[41],'10:50');assert.equal(map[49],'11:20');assert.equal(map[56],'11:37');assert.equal(map[68],'12:04');assert.equal(data.brak_mapowania.length,0);assert.equal(map[35],'10:59');assert.equal(map[66],'11:58');assert.equal(Object.keys(map).length,32);
const valid=new Set(JSON.parse(fs.readFileSync('route_data.json')).variants[1].stopIds);for(const id of Object.keys(map))assert(valid.has(+id));
const times=data.przystanki_z_ekranu.map(x=>x.godzina);assert.deepEqual(times,[...times].sort());
assert(html.includes("{tripNo:4,variantIndex:1,startTime:'10:45',endTime:'12:04',photoTimesKey:'S-27:4',exactTimesOnly:true}"));assert(!html.includes('stopGridPicker'));
console.log('PASS S-27/4 10:45–12:04, video times, valid IDs, no guessed missing times, grid reverted');
