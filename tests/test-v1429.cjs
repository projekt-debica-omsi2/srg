const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const h=fs.readFileSync('app/src/main/assets/index.html','utf8');
const data=JSON.parse(fs.readFileSync('route_data.json','utf8'));
function fn(name){let start=h.indexOf('function '+name+'('),brace=h.indexOf('{',start),depth=1,i=brace+1;for(;depth;i++){if(h[i]==='{')depth++;else if(h[i]==='}')depth--;}return h.slice(start,i)}
const elements={};function element(){return {children:[],dataset:{},replaceChildren(){this.children=[]},appendChild(b){this.children.push(b)},classList:{toggle(){}},set innerHTML(v){this.children=[]},textContent:''}}
const ctx={state:{rj:{referenceVariants:{0:0,1:1},courses:[],variants:data.variants.map(v=>({...v,stops:v.stopIds.map(id=>data.stops.find(s=>s.id===id))}))}},document:{createElement:element},$:s=>elements[s]??=element(),$$:()=>[],finalDirection:v=>v.stops.at(-1).name};vm.createContext(ctx);
vm.runInContext(h.match(/const PHOTO_STOP_TIMES_BY_COURSE=.*?;/)[0]+h.match(/const MANUAL_DUTIES=\[[\s\S]*?\n\];/)[0]+['activeDuties','manualCourseEntries','plannedTimeInfo','hhmmToMinutes','allIndividualCourses','renderDutySelect','nextTripSameDuty','dutyEntries'].map(fn).join('\n'),ctx);
vm.runInContext(`state.course=manualCourseEntries().find(c=>c.task==='S-27'&&c.tripNo===3);state.variant=state.rj.variants[0]`,ctx);
const at=id=>vm.runInContext(`plannedTimeInfo(state.variant.stops.findIndex(s=>s.id===${id}))`,ctx);
assert.equal(ctx.state.course.endTime,'09:35');assert.equal(at(33).time,'09:30');assert.equal(at(34).time,'09:35');assert.equal(at(5).time,null);assert.equal(at(7).time,'08:26');assert.equal(at(8).time,'08:27');assert.equal(ctx.state.variant.stops.at(-1).id,34);
assert.equal(vm.runInContext('nextTripSameDuty().tripNo',ctx),4);ctx.state.course.individualSelection=true;assert.equal(vm.runInContext('nextTripSameDuty()',ctx),null);
ctx.state.taskTab='special';vm.runInContext('renderDutySelect()',ctx);assert.equal(elements['#taskItems'].children.length,0);assert.equal(elements['#dutyConfirm'].disabled,true);
ctx.state.taskTab='manual';vm.runInContext('renderDutySelect()',ctx);assert.equal(elements['#taskItems'].children.length,15);assert.equal(elements['#dutyConfirm'].disabled,false);assert(elements['#taskItems'].children.some(b=>b.textContent.includes('10:10')));
vm.runInContext(`state.course=manualCourseEntries().find(c=>c.standalone);state.variant=state.rj.variants[1]`,ctx);assert.equal(at(40).time,'10:10');assert.equal(at(68).time,'11:29');assert.equal(at(47).time,null);assert.equal(vm.runInContext('nextTripSameDuty()',ctx),null);
for(const key of ['S-27:3','VIDEO:1010']){let prev=0;const idx=key==='S-27:3'?0:1;for(const id of data.variants[idx].stopIds){const time=vm.runInContext(`PHOTO_STOP_TIMES_BY_COURSE['${key}'][${id}]`,ctx);if(!time)continue;const [a,b]=time.split(':').map(Number);assert(a*60+b>=prev);prev=a*60+b;}}
console.log('PASS: exact timetable, unknown times blank, terminal, manual tabs, independent course, no next duty trip');

const bCourses=vm.runInContext("dutyEntries('B')",ctx);
assert.deepEqual(Array.from(bCourses,c=>[c.startTime,c.endTime,c.serviceCode]),[
 ['07:10','07:40','DN'],['07:40','08:30','DN'],['13:18','14:05','SX'],['14:05','14:50','SX']]);
const expectedEnds=[['Ropczyce Dworzec Autobusowy','Brzeziny Berdechów'],['Brzeziny Berdechów','Ropczyce Mickiewicza'],['Ropczyce Mickiewicza','Brzeziny Berdechów'],['Brzeziny Berdechów','Ropczyce Dworzec Autobusowy']];
const count=ctx.state.rj.variants.length;
vm.runInContext('manualCourseEntries();manualCourseEntries()',ctx);
assert.equal(ctx.state.rj.variants.length,count);
bCourses.forEach((c,i)=>{
 ctx.state.course=c;ctx.state.variant=ctx.state.rj.variants.find(v=>v.index===c.variantIndex);
 assert.deepEqual([ctx.state.variant.stops[0].name,ctx.state.variant.stops.at(-1).name],expectedEnds[i]);
 assert.equal(vm.runInContext('plannedTimeInfo(0).time',ctx),c.startTime);
 assert.equal(vm.runInContext('plannedTimeInfo(state.variant.stops.length-1).time',ctx),c.endTime);
 assert.equal(vm.runInContext('plannedTimeInfo(1).time',ctx),i===0?'07:13':i===2?'13:20':null);
 assert.equal(vm.runInContext('nextTripSameDuty()?.tripNo',ctx),i===3?undefined:i+2);
});
assert.notEqual(bCourses[0].variantIndex,bCourses[2].variantIndex);
console.log('PASS: Kursowka B exact endpoints, DN/SX, four individual courses and ordered transitions');

const getStop=(trip,name)=>bCourses[trip-1].routeStops.find(s=>s.name===name);
assert.equal(getStop(1,'Ropczyce Dworzec Autobusowy').id,56);
assert.equal(getStop(3,'Ropczyce Dworzec Autobusowy').id,56);
assert.equal(getStop(3,'Ropczyce Mickiewicza').id,55);
assert.equal(getStop(2,'Ropczyce Dworzec Autobusowy').id,14);
assert.equal(getStop(4,'Ropczyce Dworzec Autobusowy').id,14);
assert.equal(getStop(2,'Ropczyce Mickiewicza').id,15);
console.log('PASS directional shared stop IDs match the original Debica/Rzeszow routes');

ctx.state.course=bCourses[2];ctx.state.variant=ctx.state.rj.variants.find(v=>v.index===bCourses[2].variantIndex);assert.equal(ctx.state.variant.stops[1].id,56);assert.equal(vm.runInContext('plannedTimeInfo(1).estimated',ctx),false);console.log('PASS school course 13:18 Mickiewicza / 13:20 Dworzec / 14:05 Berdechow');

for(const [trip,time] of [[1,'07:13'],[3,'13:23']]){
 ctx.state.course=bCourses[trip-1];ctx.state.variant=ctx.state.rj.variants.find(v=>v.index===ctx.state.course.variantIndex);
 const index=ctx.state.variant.stops.findIndex(s=>s.id===69);
 assert.equal(vm.runInContext(`plannedTimeInfo(${index}).time`,ctx),time);
 assert.equal(vm.runInContext(`plannedTimeInfo(${index}).estimated`,ctx),false);
}
assert.equal(bCourses[1].stopTimes?.['69'],undefined);assert.equal(bCourses[3].stopTimes?.['69'],undefined);
console.log('PASS Chechly 1 only outbound Berdechow 07:13 / 13:23, no invented return times');

for(const [trip,time] of [[1,'07:29'],[3,'13:39']]){
 ctx.state.course=bCourses[trip-1];ctx.state.variant=ctx.state.rj.variants.find(v=>v.index===ctx.state.course.variantIndex);
 const index=ctx.state.variant.stops.findIndex(s=>s.name==='Broniszów');assert(index>=0);
 assert.equal(vm.runInContext(`plannedTimeInfo(${index}).time`,ctx),time);
 assert.equal(vm.runInContext(`plannedTimeInfo(${index}).estimated`,ctx),false);
}
console.log('PASS Broniszow outbound 07:29 / 13:39 only');

for(const [trip,name,time] of [[3,'Brzeziny Klub 13','13:58'],[2,'Brzeziny Klub 08','07:46'],[4,'Brzeziny Klub 08','14:11']]){
 ctx.state.course=bCourses[trip-1];ctx.state.variant=ctx.state.rj.variants.find(v=>v.index===ctx.state.course.variantIndex);
 const index=ctx.state.variant.stops.findIndex(s=>s.name===name);assert(index>=0);assert.equal(vm.runInContext(`plannedTimeInfo(${index}).time`,ctx),time);
}
assert(!Object.values(bCourses[0].stopTimes).includes('07:48'));
console.log('PASS Brzeziny Klub three compatible times; conflicting morning time withheld');

const gpsById=new Map();for(const c of bCourses){for(const s of c.routeStops){assert(Number.isFinite(s.lat)&&Number.isFinite(s.lon));assert.equal(s.gpsVerified,true);const pair=JSON.stringify([s.lat,s.lon]);if(gpsById.has(s.id))assert.equal(gpsById.get(s.id),pair,'One ID must have one GPS pair');else gpsById.set(s.id,pair);}}
assert.notEqual(bCourses[0].routeStops.find(s=>s.name==='3-Maja Chechły 1').id,bCourses[1].routeStops.find(s=>s.name==='3-Maja Chechły 1').id);
console.log('PASS approved GPS on all B courses and independent directional coordinates');

for(const c of bCourses){assert(c.routeStops.every(s=>s.street&&s.street.trim()));assert.equal(c.routeStops.find(s=>s.name==='3-Maja Chechły 1').street,'3-MAJA');assert.equal(c.routeStops.find(s=>s.name==='Glinik OSP').street,'GLINIK');assert.equal(c.routeStops.find(s=>s.name==='Brzeziny Berdechów').street,'BRZEZINY');}
console.log('PASS B street/locality fields in every course and both directions');
