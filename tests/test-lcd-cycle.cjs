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
