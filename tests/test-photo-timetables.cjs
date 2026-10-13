const assert = require('node:assert/strict');
const fs = require('node:fs');
const raw=fs.readFileSync('app/src/main/assets/index.html','utf8');
const d=JSON.parse(fs.readFileSync('app/src/main/assets/kursowki_godziny_z_fotografii.json','utf8'));
const route=JSON.parse(fs.readFileSync('route_data.json','utf8'));
const first=d.kursy['S-25:1'];const last=d.kursy['S-27:6'];
assert.equal(first.wariant_RJ,0);assert.equal(last.wariant_RJ,1);
assert.equal(first.odjazd,'16:00');assert.equal(first.koniec,'17:20');
assert.equal(last.odjazd,'14:20');assert.equal(last.koniec,'15:45');
for(const k of ['S-25:1','S-27:6']) {
 const c=d.kursy[k];assert.equal(c.przystanki_z_ekranu.length,32);
 const ids=new Set(route.variants[c.wariant_RJ].stopIds);
 for(const [id,time] of Object.entries(c.godziny_wg_id_RJ)) {
  assert(ids.has(Number(id)),`Nieznany ID: ${id} w ${k}`);
  assert.match(time,/^\d\d:\d\d$/);
 }
 assert(c.brak_mapowania.length>0,`Musi być zaznaczone niepewne mapowanie: ${k}`);
 assert.equal(c.przystanki_z_ekranu[0].godzina,c.odjazd);
 assert.equal(c.przystanki_z_ekranu.at(-1).godzina,c.koniec);
}
assert(raw.includes("{tripNo:1,variantIndex:0,startTime:'16:00',endTime:'17:20',photoTimesKey:'S-25:1'}"));
assert(raw.includes("{tripNo:6,variantIndex:1,startTime:'14:20',endTime:'15:45',photoTimesKey:'S-27:6'}"));
assert(raw.indexOf("{tripNo:5,variantIndex:0,startTime:'12:45',endTime:'14:05'}")<raw.indexOf("{tripNo:6,variantIndex:1,startTime:'14:20',endTime:'15:45',photoTimesKey:'S-27:6'}"));
assert(raw.includes('if(c.photoTimesKey)'));
assert(raw.includes("const noTime=state.course?.photoTimesKey?'--:--':null"));
assert(raw.includes("photoTimesKey:t.photoTimesKey||null"));
const obj=raw.match(/const PHOTO_STOP_TIMES_BY_COURSE=(\{[^;]+\});/);
assert(obj,'Brak mapy godzin w JS');assert.deepEqual(JSON.parse(obj[1]),{
 'S-25:1':first.godziny_wg_id_RJ,'S-27:6':last.godziny_wg_id_RJ
});
console.log(`PASS: S-25/1: ${Object.keys(first.godziny_wg_id_RJ).length}/32 godzin w RJ, S-27/6: ${Object.keys(last.godziny_wg_id_RJ).length}/32 godzin w RJ; 64 oryginalne godziny zachowane`);
