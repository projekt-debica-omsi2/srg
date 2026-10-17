const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const h=fs.readFileSync('app/src/main/assets/index.html','utf8');
function fn(n){const start=h.indexOf('function '+n+'('),brace=h.indexOf('{',start);let i=brace+1,depth=1;for(;depth;i++){if(h[i]==='{')depth++;else if(h[i]==='}')depth--;}return h.slice(start,i)}
let events=[];const ctx={state:{routeIndex:1,pendingStop:null},lcdConfig:{manualControl:false},autoGpsTracker:{reset(){}},autoGpsMessage:'',refreshAutoGpsIndicator(){},stops:()=>[{id:40},{id:41},{id:42}],markManualLcdScreen:(...x)=>events.push(x),refreshCourse(){}};vm.createContext(ctx);vm.runInContext(fn('preview'),ctx);
ctx.preview(1);assert.equal(events.length,0);ctx.state.pendingStop=null;ctx.lcdConfig.manualControl=true;ctx.preview(-1);assert.deepEqual(events.pop(),['next',0]);ctx.preview(1);assert.deepEqual(events.pop(),['next',1]);
const nodes={};ctx.$=id=>nodes[id]??={};ctx.transferAdState='';ctx.resetAutoGpsCandidate=()=>{};ctx.toast=()=>{};ctx.finishCurrentTrip=()=>{};
const start=h.indexOf("$('#confirmStop').onclick=()=>");vm.runInContext(h.slice(start,h.indexOf('\n',start)),ctx);
nodes['#confirmStop'].onclick();assert.deepEqual(events.pop(),['current',1]);assert.equal(ctx.state.pendingStop,null);
ctx.lcdConfig.manualControl=false;ctx.state.pendingStop=0;nodes['#confirmStop'].onclick();assert.equal(events.length,0);
const assignment=h.split('\n').find(x=>x.includes("$('#courseStopCount').textContent=ss.length"));
for(const [shown,expected] of [[0,'1/3'],[2,'3/3']]){ctx.shown=shown;ctx.ss=[{id:68},{id:67},{id:66}];vm.runInContext(assignment,ctx);assert.equal(nodes['#courseStopCount'].textContent,expected)}
vm.runInContext(fs.readFileSync('app/src/main/assets/lcd-cycle.js','utf8'),ctx);const c=ctx.SRGLcdCycle.normalize({manualControl:true,steps:[{type:'next',seconds:7}]});assert(ctx.SRGLcdCycle.normalize(JSON.parse(JSON.stringify(c))).manualControl);assert.equal(ctx.SRGLcdCycle.defaults().manualControl,false);
console.log('PASS manual LCD toggle, both arrows, confirm, reverse-route ordinal and saved setting');
