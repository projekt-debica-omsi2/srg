const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('app/src/main/assets/phone-layout.js','utf8');
function context(width,height,native){const root={innerWidth:width,innerHeight:height,addEventListener:(name,callback)=>root.resize=callback};if(native!==undefined)root.SRGApp={isPhone:()=>native};const doc={documentElement:{dataset:{}}};vm.runInNewContext(source,{window:root,document:doc});return {root,doc};}
for(const [w,h] of [[320,568],[360,640],[390,844],[412,915],[844,390]])assert.equal(context(w,h).doc.documentElement.dataset.device,'phone');
for(const [w,h] of [[600,960],[800,1280],[1280,800]])assert.equal(context(w,h).doc.documentElement.dataset.device,'tablet');
const tablet=context(800,1280,false);tablet.root.innerHeight=380;tablet.root.resize();assert.equal(tablet.doc.documentElement.dataset.device,'tablet');
const phone=context(390,844,true);phone.root.innerWidth=844;phone.root.innerHeight=390;phone.root.resize();assert.equal(phone.doc.documentElement.dataset.device,'phone');
assert.equal(context(450,300,false).doc.documentElement.dataset.device,'tablet');
const css=fs.readFileSync('app/src/main/assets/phone-layout.css','utf8');
// Every added selector is explicitly scoped: no global change to tablet/LCD styles.
for(const selector of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)){
 const s=selector[1].trim();if(s.startsWith('@media'))continue;
 for(const part of s.split(','))assert(part.trim().startsWith('html[data-device="phone"]'),part);
}
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');assert(html.includes('href="phone-layout.css"'));assert(html.includes('src="phone-layout.js"'));
assert(!fs.readFileSync('app/src/main/assets/lcd.html','utf8').includes('phone-layout'));
console.log('PASS phone/tablet selection, rotation, keyboard resize and tablet CSS isolation');
