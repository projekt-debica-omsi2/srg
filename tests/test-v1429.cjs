const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const h=fs.readFileSync('app/src/main/assets/index.html','utf8');
const data=JSON.parse(fs.readFileSync('route_data.json','utf8'));
function fn(name){let start=h.indexOf('function '+name+'('),brace=h.indexOf('{',start),depth=1,i=brace+1;for(;depth;i++){if(h[i]==='{')depth++;else if(h[i]==='}')depth--;}return h.slice(start,i)}
const elements={};function element(){return {children:[],appendChild(b){this.children.push(b)},classList:{toggle(){}},set innerHTML(v){this.children=[]},textContent:''}}
const ctx={state:{rj:{courses:[],variants:data.variants.map(v=>({...v,stops:v.stopIds.map(id=>data.stops.find(s=>s.id===id))}))}},document:{createElement:element},$:s=>elements[s]??=element(),$$:()=>[],finalDirection:v=>v.stops.at(-1).name};vm.createContext(ctx);
vm.runInContext(h.match(/const PHOTO_STOP_TIMES_BY_COURSE=.*?;/)[0]+h.match(/const MANUAL_DUTIES=\[[\s\S]*?\n\];/)[0]+['manualCourseEntries','plannedTimeInfo','hhmmToMinutes','allIndividualCourses','renderDutySelect','nextTripSameDuty','dutyEntries'].map(fn).join('\n'),ctx);
vm.runInContext(`state.course=manualCourseEntries().find(c=>c.task==='S-27'&&c.tripNo===3);state.variant=state.rj.variants[0]`,ctx);
const at=id=>vm.runInContext(`plannedTimeInfo(state.variant.stops.findIndex(s=>s.id===${id}))`,ctx);
assert.equal(ctx.state.course.endTime,'09:35');assert.equal(at(33).time,'09:30');assert.equal(at(34).time,'09:35');assert.equal(at(5).time,null);assert.equal(at(7).time,'08:26');assert.equal(at(8).time,'08:27');assert.equal(ctx.state.variant.stops.at(-1).id,34);
assert.equal(vm.runInContext('nextTripSameDuty().tripNo',ctx),4);ctx.state.course.individualSelection=true;assert.equal(vm.runInContext('nextTripSameDuty()',ctx),null);
ctx.state.taskTab='special';vm.runInContext('renderDutySelect()',ctx);assert.equal(elements['#taskItems'].children.length,0);assert.equal(elements['#dutyConfirm'].disabled,true);
ctx.state.taskTab='manual';vm.runInContext('renderDutySelect()',ctx);assert.equal(elements['#taskItems'].children.length,11);assert.equal(elements['#dutyConfirm'].disabled,false);assert(elements['#taskItems'].children.some(b=>b.textContent.includes('10:10')));
vm.runInContext(`state.course=manualCourseEntries().find(c=>c.standalone);state.variant=state.rj.variants[1]`,ctx);assert.equal(at(40).time,'10:10');assert.equal(at(68).time,'11:29');assert.equal(at(47).time,null);assert.equal(vm.runInContext('nextTripSameDuty()',ctx),null);
for(const key of ['S-27:3','VIDEO:1010']){let prev=0;const idx=key==='S-27:3'?0:1;for(const id of data.variants[idx].stopIds){const time=vm.runInContext(`PHOTO_STOP_TIMES_BY_COURSE['${key}'][${id}]`,ctx);if(!time)continue;const [a,b]=time.split(':').map(Number);assert(a*60+b>=prev);prev=a*60+b;}}
console.log('PASS: exact timetable, unknown times blank, terminal, manual tabs, independent course, no next duty trip');
