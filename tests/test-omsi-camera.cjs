const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const js=fs.readFileSync('app/src/main/assets/omsi.js','utf8');
const section=js.slice(js.indexOf('let cameraRequest='),js.indexOf('function omsiRoad(data,stop){'));
function node(){return {children:[],style:{},hidden:true,textContent:'',src:'',removeAttribute(k){delete this[k]},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]}}}
const nodes=new Map(),$=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key)};
let tick,calls=[];const window={SRGOmsiNative:{cameraPage:(...args)=>calls.push(args)}};
const app={state:{view:'omsiCameras'}};
const context=vm.createContext({$,window,app,enabled:true,request:0,config:{transport:'usb'},document:{createElement:node},setInterval:fn=>{tick=fn},Date});
vm.runInContext(section,context);tick();assert.equal(calls.length,1);assert.equal(calls[0][2],0);
const feeds=[16,17,18,19].map(channel=>({channel,label:'Camera '+channel}));
window.SRGOmsiCameraResult(calls[0][3],{ok:true,data:{page:0,pages:2,total:5,feeds,frames:feeds.map(f=>({...f,image:'data:image/jpeg;base64,test'}))}});
assert.equal($('#omsiCameraGrid').children.length,4);assert.equal(vm.runInContext('[...cameraTiles.values()].filter(t=>!t.img.hidden).length',context),4);
$('#omsiCameraNext').onclick();tick();assert.equal(calls.at(-1)[2],1);
window.SRGOmsiCameraResult(calls.at(-1)[3],{ok:true,data:{page:1,pages:2,total:5,feeds:[{channel:20,label:'Fifth'}],frames:[{channel:20,image:'data:image/jpeg;base64,test'}]}});
assert.equal($('#omsiCameraGrid').children.length,1);assert.equal($('#omsiCameraNext').disabled,true);
vm.runInContext('for(const tile of cameraTiles.values())tile.seen=Date.now()-3000',context);tick();assert.equal(vm.runInContext('[...cameraTiles.values()].filter(t=>!t.img.hidden).length',context),0);
app.state.view='omsiCourse';window.SRGOmsiCameraResult(calls.at(-1)[3],{ok:true,data:{page:1,pages:2,total:5,feeds:[],frames:[]}});assert.equal($('#omsiCameraGrid').children.length,1);tick();assert.equal($('#omsiCameraGrid').children.length,0);
console.log('PASS four live camera tiles, fifth feed on next page, stale clearing and stopping outside camera view');
