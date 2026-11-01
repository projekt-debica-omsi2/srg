const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/omsi.js','utf8');
const section=source.slice(source.indexOf('let manualStop='),source.indexOf('window.SRGOmsiResult='));
const nodes=new Map();function node(){return {style:{},children:[],textContent:'',value:'off',replaceChildren(){this.children=[]},append(n){this.children.push(n)},prepend(){}}}
const $=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key)};
let said=[];
const context=vm.createContext({$,document:{createElement:node},localStorage:{getItem:()=>null,setItem(){}},window:{SRGOmsiNative:{speak:(...args)=>said.push(args)}},lastGood:1,current:null,renderCourse:()=>{},renderPicker:()=>{},Number,Math,String,Boolean});
vm.runInContext(section,context);
const data={plugin_running:true,session:'s',route:'r',game:'openomsi',clock:32400,duty:{line:'76',tour:'2',terminus:'Hospital',next_stop:{name:'A',number:1},delay:61},position:{x:0,y:2},stops:[{number:1,name:'A',departure:32400},{number:2,name:'B',departure:32520}]};
context.current=data;context.data=data;vm.runInContext('renderTrip(data)',context);
assert.equal($('#omsiDutyLine').textContent,'76 / 2');assert.equal($('#omsiStops').children.length,2);assert($('#omsiTripInfo').textContent.includes('−1:01'));assert.equal(said.length,0);
$('#omsiVoice').value='on';data.duty.next_stop={name:'B',number:2};vm.runInContext('renderTrip(data);renderTrip(data)',context);assert.equal(said.length,1);
vm.runInContext('renderTrip(null)',context);assert.equal($('#omsiStops').children.length,0);assert.equal($('#omsiDutyLine').textContent,'—');assert.equal(said.length,1);
console.log('PASS OMSI route rendering, freshness clearing and deduplicated stop speech');
