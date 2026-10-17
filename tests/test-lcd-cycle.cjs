const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/lcd-cycle.js','utf8'),ctx);
const api=ctx.SRGLcdCycle,clock=api.create();
const config={steps:[{type:'route',seconds:2},{type:'next',seconds:3},{type:'current',seconds:4},{type:'transfers',seconds:5},{type:'route',seconds:6}]};
const state={kursId:'s27',aktualnyIndeks:0,nastepny:{nazwa:'B'},przesiadka:{przewoznicy:['TEST']}};
const pick=t=>clock.pick(config,state,t).type;
assert.equal(pick(0),'route');assert.equal(pick(1999),'route');assert.equal(pick(2000),'transfers');assert.equal(pick(6999),'transfers');assert.equal(pick(7000),'route');assert.equal(pick(13000),'route');assert.equal(pick(15000),'transfers');
state.aktualnyIndeks=1;assert.equal(pick(23000),'route');assert.equal(pick(25000),'transfers');
state.przesiadka=null;assert.equal(pick(26000),'route');assert.equal(pick(34000),'route'); // skips unavailable transfers
state.nastepny=null;assert(!api.available(config,state).some(s=>s.type==='next'));assert(!api.available(config,state).some(s=>s.type==='current'));assert.equal(api.duration(config,'next'),3);assert.equal(api.duration(config,'current'),4);
const disabled={steps:[{type:'route',seconds:0},{type:'clock',seconds:5}]};assert.equal(api.available(disabled,state).length,1);assert.equal(clock.pick(disabled,state,36000).type,'clock');
const allOff={steps:[{type:'route',seconds:0},{type:'next',seconds:0},{type:'current',seconds:0}]};assert.equal(api.duration(allOff,'next'),0);assert.equal(api.duration(allOff,'current'),0);assert.equal(api.available(allOff,state).length,0);
assert(api.normalize({steps:[{type:'invalid',seconds:5}]}).steps.length>0);
const saved=JSON.parse(JSON.stringify(api.normalize(config)));assert.equal(saved.steps[4].seconds,6);
// Real renderer: settings select panels and transfers, independently of polling.
const nodes={};function element(){return {textContent:'',hidden:false,style:{setProperty(){},removeProperty(){}},classList:{toggle(){},add(){},remove(){}},clientWidth:1000,scrollWidth:1600,parentElement:{clientWidth:1000,classList:{add(){},remove(){}}},replaceChildren(){},append(){}}}
let now=1000;class MockDate extends Date{static now(){return now}}
const ui={window:{addEventListener(){}},document:{getElementById:id=>nodes[id]??=element(),createElement:element},location:{search:''},URLSearchParams,Intl,Date:MockDate,setTimeout:()=>0,clearTimeout(){},setInterval(){},fetch:()=>new Promise(()=>{})};vm.createContext(ui);
for(const f of ['lcd-cycle.js','app.js'])vm.runInContext(fs.readFileSync('app/src/main/assets/'+f,'utf8'),ui);
const preview=ui.window.SRGLcdPreview;const payload={kursAktywny:true,kursId:'s27',aktualnyIndeks:0,przystanki:[{nazwa:'A'},{nazwa:'B'}],aktualny:{nazwa:'A'},nastepny:{nazwa:'B'},przesiadka:{przystanek:'A',przewoznicy:['TEST']},lcdConfig:config,lcdManual:{id:1,type:'next',index:1,name:'B',expiresAt:4000}};
preview.setState(payload);assert.equal(nodes.stopName.textContent,'B');assert.equal(nodes.routePanel.hidden,true);
now=3000;preview.setState(payload);assert.equal(nodes.stopName.textContent,'B');assert.equal(nodes.transfer.hidden,true);
now=4000;preview.paint();assert.equal(nodes.routePanel.hidden,false);
now=5500;preview.paint();assert.equal(nodes.routePanel.hidden,false);
now=6500;preview.paint();assert.equal(nodes.transfer.hidden,false);assert.equal(nodes.adMedia.style.visibility,'hidden');
now=12000;preview.paint();assert.equal(nodes.routePanel.hidden,false);assert.equal(nodes.transfer.hidden,true);
preview.setState({kursAktywny:false,lcdConfig:config});assert.equal(nodes.clockPanel.hidden,false);
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');const gps=html.slice(html.indexOf('id="gps"'),html.indexOf('id="lcdSettings"'));
assert(!gps.includes('id="lcdUrl"'));assert(html.includes('data-go="lcdSettings"'));assert(html.includes("localStorage.setItem('srgLcdCycleV1'"));
const java=fs.readFileSync('app/src/main/java/pl/srgmobile/classic/LocalPanelServer.java','utf8');assert(java.includes('field.equals("lcdConfig")'));assert(java.includes('field.equals("lcdManual")'));assert(java.includes('route.equals("/lcd-cycle.js")'));
console.log('PASS LCD cycle: timed route/transfer loop; next/current durations reserved for manual arrows; LAN event transport');
// Announcement event overrides the cycle, expires, and cannot leak to a new stop/course.
now=20000;
const arrival={...payload,lcdManual:{id:10,type:'current',index:0,name:'A',courseKey:'s27',anchorIndex:0,expiresAt:30000}};
preview.setState(arrival);assert.equal(nodes.stopName.textContent,'A');assert.equal(nodes.stopLabel.textContent,'PRZYSTANEK:');
now=21000;preview.setState({...arrival,aktualnyIndeks:1,lcdManual:{id:11,type:'next',index:1,name:'B',courseKey:'s27',anchorIndex:1,expiresAt:24000},przesiadka:null});
assert.equal(nodes.stopName.textContent,'B');assert.equal(nodes.stopLabel.textContent,'NASTĘPNY PRZYSTANEK:');assert.equal(nodes.transfer.hidden,true);
now=24000;preview.paint();assert.equal(nodes.stopPanel.hidden,true);
preview.setState({...arrival,aktualnyIndeks:1,przesiadka:null});assert.equal(nodes.stopPanel.hidden,true);
preview.setState({...arrival,kursId:'different',przesiadka:null});assert.equal(nodes.stopPanel.hidden,true);
// Exercise real driver event hooks, including native early returns.
function driverFunction(name){const start=html.indexOf('function '+name+'('),brace=html.indexOf('{',start);let end=brace+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}return html.slice(start,end)}
const A={id:1,name:'A',referenceCompatible:true},B={id:2,name:'B',referenceCompatible:true};
const driver={state:{course:{},variant:{stops:[A,B]},routeIndex:0,pendingStop:null,rj:{}},lcdConfig:config,lcdManualScreen:null,lcdManualCounter:0,transferAdState:'',voiceEnabled:true,autoGpsEnabled:true,window:{SRGLcdCycle:api,SRGNativeAudio:{announceStop(){},announceTerminal(){},announceName(){}}},Date:MockDate,courseSessionKey:()=> 's27',lcdPublish(){},markLcdPhase(){},isStopOnRequest:()=>false,autoGpsTracker:{evaluate:()=>({advance:true,nextIndex:1,departure:true})},refreshCourse(){},refreshAutoGpsIndicator(){},toast(){},autoGpsMessage:''};vm.createContext(driver);
vm.runInContext(['markManualLcdScreen','playNextStopAudio','playArrivalAudio','processAutoGpsFix'].map(driverFunction).join('\n'),driver);
now=25000;driver.playArrivalAudio(A);assert.equal(driver.lcdManualScreen.type,'current');assert.equal(driver.lcdManualScreen.expiresAt,29000);
now=25500;driver.processAutoGpsFix({});assert.equal(driver.lcdManualScreen.type,'next');assert.equal(driver.lcdManualScreen.name,'B');assert.equal(driver.lcdManualScreen.anchorIndex,1);assert.equal(driver.lcdManualScreen.expiresAt,28500);
console.log('PASS LCD announcement synchronization, GPS interruption, configured duration, stale event rejection');
let transferVisible=false;ui.window.SRGTransferDraft={render(){transferVisible=true},hide(){transferVisible=false}};
now=40000;
const withRows={...payload,lcdManual:null,przesiadka:{rows:[{carrier:'FlixBus',direction:'Paryż',time:'09:37'}]}};
preview.setState(withRows);assert(transferVisible);assert.equal(nodes.adMedia.style.visibility,'hidden');
preview.setState({...withRows,aktualnyIndeks:1,przesiadka:null});assert(!transferVisible);assert.equal(nodes.adMedia.style.visibility,'visible');
preview.setState({...withRows,lcdConfig:{steps:[{type:'route',seconds:10},{type:'transfers',seconds:0}]}});assert(!transferVisible);assert.equal(nodes.adMedia.style.visibility,'visible');
console.log('PASS confirmed transfers disappear on stop change; disabled transfers show ads');
