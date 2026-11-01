const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const js=fs.readFileSync('app/src/main/assets/omsi.js','utf8');
const start=js.indexOf('function omsiRoad(data,stop){'),end=js.indexOf('\nfunction paintTheme()',start);
assert(start>0&&end>start);
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)};
const events=[];
const context=vm.createContext({$,manualStop:null,signKey:'',clockText:v=>v===32400?'09:00':'09:01',selectedStop:d=>d.stops[0],window:{dispatchEvent:e=>events.push(e)},CustomEvent:function(type,options){this.type=type;this.detail=options.detail;}});
vm.runInContext(js.slice(start,end),context);
context.data={plugin_running:true,session:'s',route:'r',vehicle_number:'123',clock:32400,distance:25,duty:{line:'76',tour:'1',trip:21,terminus:'Hospital',delay:0},stops:[{number:1,name:'A',departure:32400},{number:2,name:'B',departure:32460}]};
vm.runInContext('renderCourse(data);renderCourse(data)',context);
assert.equal($('#omsiUicourseLine').textContent,'76');assert.equal($('#omsiUicourseCurrent').textContent,'09:00 A');assert.equal($('#omsiUicourseNext1').textContent,'09:01 B');assert.equal(events.length,1);assert.equal(events[0].detail.source,'omsi');
vm.runInContext('renderCourse(null)',context);assert.equal($('#omsiUicourseLine').textContent,'—');
console.log('PASS classic OMSI course rendering, live-only values and deduplicated R&G course event');

const road={plugin_running:true,position:{x:50,y:0},stops:[{number:1,x:0,y:0},{number:2,x:100,y:0},{number:3,x:200,y:0}]};context.road=road;
assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'~50 / ~100 (-50)');
road.position.x=100;assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'~100 / ~100 (0)');
road.position.x=120;assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'~120 / ~100 (+20)');
road.position={x:150,y:0};assert.equal(vm.runInContext('omsiRoad(road,road.stops[2])',context),'~50 / ~100 (-50)');
road.position.y=500;assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'POZA ODCINKIEM / ~100');
road.position=null;assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'— / ~100 (—)');
road.plugin_running=false;assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'—');
road.plugin_running=true;road.stops[1].x=0;assert.equal(vm.runInContext('omsiRoad(road,road.stops[1])',context),'BRAK DŁUGOŚCI ODCINKA');
console.log('PASS OMSI road progress, arrival, overshoot, next segment, missing/stale position and zero-length segment');

context.data.duty.delay=61;vm.runInContext('renderCourse(data)',context);assert.equal($('#omsiUicourseDelay').textContent,'−1:01');
context.data.duty.delay=-61;vm.runInContext('renderCourse(data)',context);assert.equal($('#omsiUicourseDelay').textContent,'+1:01');
context.data.duty.delay=0;vm.runInContext('renderCourse(data)',context);assert.equal($('#omsiUicourseDelay').textContent,'0:00');
console.log('PASS late is negative, early is positive and on-time has no sign');

context.data.clock=23*3600+59*60+58;vm.runInContext('renderCourse(data)',context);assert.equal($('#omsiUiClock').textContent,'Gra: 23:59:58');
context.data.clock=2*3600+3*60+4;vm.runInContext('renderCourse(data)',context);assert.equal($('#omsiUiClock').textContent,'Gra: 02:03:04');
assert.match($('#omsiRealClock').textContent,/^Rzeczywisty: \d{2}:\d{2}:\d{2}$/);
assert.equal(vm.runInContext('formatClock24(86400+5)',context),'00:00:05');
assert.equal(vm.runInContext('formatClock24(null)',context),'—');
assert(js.includes("omsiClock.className='omsiClockGroup'"));
console.log('PASS 24-hour game clock follows time jumps and shows separate real clock');

context.data.duty.next_stop=context.data.stops[0];context.data.duty.at_stop=true;context.data.duty.delay=75;
vm.runInContext('renderCameraDuty(data)',context);
assert.equal($('#omsiCameraDelay').textContent,'−1:15');assert.equal($('#omsiCameraStopLabel').textContent,'AKTUALNY PRZYSTANEK');assert.equal($('#omsiCameraStop').textContent,'A');assert.equal($('#omsiCameraFollowing').textContent,'B');
context.data.duty.at_stop=false;context.data.duty.next_stop=context.data.stops[1];context.data.duty.delay=-60;
vm.runInContext('renderCameraDuty(data)',context);
assert.equal($('#omsiCameraDelay').textContent,'+1:00');assert.equal($('#omsiCameraStopLabel').textContent,'NASTĘPNY PRZYSTANEK');assert.equal($('#omsiCameraStop').textContent,'B');assert.equal($('#omsiCameraFollowing').textContent,'---------');
context.data.duty.next_stop=null;vm.runInContext('renderCameraDuty(data)',context);assert.equal($('#omsiCameraStop').textContent,'---------');
vm.runInContext('renderCameraDuty(null)',context);for(const id of ['omsiCameraDelay','omsiCameraStop','omsiCameraFollowing'])assert.equal($('#'+id).textContent,'---------');
console.log('PASS camera duty strip: live deviation, current/next stop, following stop, last stop and disconnected placeholders');

context.enabled=true;context.lastGood=Date.now();context.current={plugin_running:true,session:'game',route:'map|bus|76|1|3',clock:23*3600+5*60,duty:{line:'76',tour:'1',trip:3,terminus:'C',at_stop:false,next_stop:{number:2,name:'B'}},stops:[{number:1,name:'A'},{number:2,name:'B'},{number:3,name:'C'}]};
let lcd=vm.runInContext('omsiLcdState({steps:[]})',context);assert.equal(lcd.kursAktywny,true);assert.equal(lcd.linia,'76');assert.equal(lcd.clock,'23:05:00');assert.equal(lcd.aktualny.nazwa,'A');assert.equal(lcd.nastepny.nazwa,'B');assert.equal(lcd.following,'C');
context.current.duty.at_stop=true;lcd=vm.runInContext('omsiLcdState({})',context);assert.equal(lcd.aktualny.nazwa,'B');assert.equal(lcd.nastepny.nazwa,'C');assert.equal(lcd.koncowyNastepny,true);
context.current.duty.next_stop=context.current.stops[2];lcd=vm.runInContext('omsiLcdState({})',context);assert.equal(lcd.koniecKursu,true);assert.equal(lcd.nastepny,null);
context.lastGood=Date.now()-6000;lcd=vm.runInContext('omsiLcdState({})',context);assert.equal(lcd.kursAktywny,false);assert.equal(lcd.przystanki.length,0);assert.equal(lcd.clock,undefined);
context.enabled=false;assert.equal(vm.runInContext('omsiLcdState({}).active',context),false);
console.log('PASS LCD OMSI live route, game clock, movement/arrival, terminal and stale isolation');

context.enabled=true;context.lastGood=Date.now();context.current.duty.at_stop=false;context.current.duty.next_stop=context.current.stops[1];
lcd=vm.runInContext("omsiLcdState({steps:[{type:'next',seconds:7},{type:'current',seconds:7}]})",context);assert.equal(lcd.lcdManual.type,'next');assert.equal(lcd.lcdManual.name,'B');const expires=lcd.lcdManual.expiresAt;
assert.equal(vm.runInContext("omsiLcdState({steps:[{type:'next',seconds:7}]}).lcdManual.expiresAt",context),expires);
context.current.duty.at_stop=true;assert.equal(vm.runInContext("omsiLcdState({steps:[{type:'current',seconds:7}]}).lcdManual.type",context),'current');
console.log('PASS LCD stop events follow game movement/arrival and do not restart on every poll');
