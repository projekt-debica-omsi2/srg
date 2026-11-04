const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/local-speech.js','utf8'),ctx);
const api=ctx.SRGLocalSpeech;
assert.equal(api.name({name:'Wielopole Skrzyńskie 1 02'}),'Wielopole Skrzyńskie 1');
assert.equal(api.name({name:'Brzeziny Berdechów 1 03 (Nowa Wieś)'}),'Brzeziny Berdechów 1 (Nowa Wieś)');
assert.equal(api.name({name:'Chechły 1'}),'Chechły 1');
const stop={id:7,name:'Centrum 04 N.Ż.'},end={id:8,name:'Dworzec'};
const rj={variants:[{stops:[stop,end]},{stops:[end,stop]}]};
const texts=Array.from(api.texts(rj));assert.equal(new Set(texts).size,texts.length);
for(const v of rj.variants){assert(texts.includes(api.start(v)));for(const [i,s] of v.stops.entries()){assert(texts.includes(api.arrival(s)));assert(texts.includes(api.next(s,i===v.stops.length-1)));}}
assert(texts.includes('Następny przystanek: Centrum. Na żądanie. Przystanek końcowy.'));
const changed=JSON.parse(JSON.stringify(rj));changed.variants[0].stops[0].name='Nowa nazwa';assert(api.texts(changed).includes('Nowa nazwa'));
console.log('Offline speech: playback texts match generated plan, terminal/NZ, names and changed routes OK');
