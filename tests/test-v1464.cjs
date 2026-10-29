const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const ibis=require('../app/src/main/assets/ibis.js');
// Independently calculated wire vectors, including CR in the XOR checksum.
assert.equal(ibis.frame('line','1'),'6C 30 30 31 0D 2F');
assert.equal(ibis.frame('time','',new Date(2026,9,29,12,34)),'75 31 32 33 34 0D 03');
assert.equal(ibis.frame('date','',new Date(2026,9,29,12,34)),ibis.telegram('d29106'));
const bytes=ibis.frame('destination','Dębica').split(' ').map(x=>parseInt(x,16));assert.equal(String.fromCharCode(...bytes.slice(0,-2)),'zA1DEBICA          ');assert.equal(bytes.reduce((a,b)=>a^b,0),127);
assert.throws(()=>ibis.frame('line','ABC'));assert.throws(()=>ibis.frame('validator','123'));assert.throws(()=>ibis.telegram('a\rBAD'));assert.throws(()=>ibis.frame('stop','x'.repeat(61)));
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
function fn(name){const start=html.indexOf('function '+name+'('),brace=html.indexOf('{',start);assert(start>=0);let i=brace+1,n=1;for(;n;i++){if(html[i]==='{')n++;if(html[i]==='}')n--;}return (html.slice(start-6,start)==='async '?'async ':'')+html.slice(start,i)}
const data=new Map(),nodes={};const $=id=>nodes[id]??=( {value:'',checked:false,disabled:false,textContent:'',classList:{toggle(){}}} );
const ctx={crypto:webcrypto,TextEncoder,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},$,state:{rj:{signature:'test'},routeIndex:0},document:{},window:{},closeCourseStarted(){},resetAutoGpsCandidate(){},lcdManualScreen:null,lcdPhase:'',lcdPhaseUntil:0,go(){},CustomEvent:class{constructor(type,x){this.type=type;this.detail=x.detail}},events:[]};
ctx.window.dispatchEvent=e=>ctx.events.push(e);vm.createContext(ctx);
for(const n of ['extraEntries','readExtraDraft','passwordHash','checkExtraPassword','finalDirection','courseSessionKey','persistSession','activateExtra','restoreSession','processAutoGpsFix','processVoiceGpsFix','preview','updateDepartureUI'])vm.runInContext(fn(n),ctx);
ctx.refreshCourse=()=>ctx.persistSession();ctx.extraEditingId='';
(async()=>{
 assert.equal(await ctx.checkExtraPassword('wrong'),false);
 data.set('srgExtraPasswordHash',await ctx.passwordHash('nowe-testowe'));
 assert.equal(await ctx.checkExtraPassword('nowe-testowe'),true);assert.equal(await ctx.checkExtraPassword('wrong'),false);
 $('#extraDirection').value=' Rzeszów → Dębica ';$('#extraLine').value='27';$('#extraShowLine').checked=false;
 const e=ctx.readExtraDraft();assert.equal(e.direction,'Rzeszów → Dębica');ctx.activateExtra(e);assert.equal(ctx.state.variant.line,'');assert.equal(ctx.state.variant.stops.length,0);assert.equal(ctx.finalDirection(ctx.state.variant),'Rzeszów → Dębica');assert.equal(ctx.events.at(-1).detail.showLine,false);
 ctx.processAutoGpsFix({});ctx.processVoiceGpsFix({});ctx.preview(1);assert.equal(ctx.state.pendingStop,null);ctx.updateDepartureUI();assert.equal($('#courseDelay').textContent,'—');
 ctx.state.course=null;ctx.state.variant=null;assert.equal(ctx.restoreSession(),true);assert.equal(ctx.state.course.direction,e.direction);assert.equal(ctx.state.variant.line,'');
 $('#extraShowLine').checked=true;ctx.activateExtra(ctx.readExtraDraft());assert.equal(ctx.state.variant.line,'27');assert.equal(ctx.events.at(-1).detail.showLine,true);
 ctx.state.course=null;ctx.state.variant=null;ctx.persistSession();assert.equal(data.has('srgCourseSession1420'),false);
 vm.runInContext(fs.readFileSync('app/src/main/assets/lcd-cycle.js','utf8'),ctx);const cycle=ctx.window.SRGLcdCycle;
 for(const [speed,expected] of [[0,10],[48,48],[1000,200]]){const c=cycle.normalize({steps:[{type:'route',seconds:12}],scrollEnabled:false,scrollSpeed:speed});assert.equal(c.scrollSpeed,expected);assert.equal(c.scrollEnabled,false);assert.equal(cycle.normalize(JSON.parse(JSON.stringify(c))).scrollSpeed,expected)}
 assert.equal(cycle.normalize({steps:[{type:'route',seconds:12}]}).scrollSpeed,48);
 console.log('PASS IBIS checksum and limits, password verification, additional course/restore/GPS guards, LCD scroll settings');
})().catch(e=>{console.error(e);process.exitCode=1});
