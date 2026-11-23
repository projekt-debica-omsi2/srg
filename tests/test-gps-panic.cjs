const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const values=new Map(),calls=[];let button;const state={gpsRequested:true,gpsLast:{lat:50},gpsWatch:null};let config={enabled:true,server:'http://example.test',display:''};
const element=()=>({classList:{toggle(){}},setAttribute(){},after(e){button=e}});
const native={config:()=>JSON.stringify(config),configure:(on)=>{config.enabled=on;calls.push(['network',on])}};
const api={state,stopGps:()=>{calls.push(['stop']);state.gpsRequested=false;state.gpsLast=null},startGps:()=>{assert.notEqual(values.get('srgGpsPanic'),'1');calls.push(['start']);state.gpsRequested=true}};
const context={window:{__srg:api,SRGFleetNative:native},document:{createElement:element,getElementById:element,head:{append(){}}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},setInterval(){}};
const code=fs.readFileSync('app/src/main/assets/gps-panic.js','utf8');vm.runInNewContext(code,context);button.onclick();assert.equal(values.get('srgGpsPanic'),'1');assert.equal(config.enabled,false);assert.equal(state.gpsRequested,false);assert.equal(state.gpsLast,null);assert.deepEqual(calls.slice(-2),[['network',false],['stop']]);
// Persisted cut-off survives script restart; it never opts networking back in.
vm.runInNewContext(code,context);assert.equal(config.enabled,false);button.onclick();assert.equal(values.get('srgGpsPanic'),'0');assert.equal(state.gpsRequested,true);assert.equal(config.enabled,true);
// Enabling GPS with server consent previously off must keep networking off.
config.enabled=false;button.onclick();button.onclick();assert.equal(config.enabled,false);
console.log('PASS: GPS cut-off, persistence, explicit resume and preserved network consent');
