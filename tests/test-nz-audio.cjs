const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const matcher=html.match(/function isStopOnRequest\(stop\)\{[\s\S]*?\n \}/);
assert(matcher,'Missing separate on-request logic');
const ctx={};vm.runInNewContext(matcher[0]+'\nthis.isStopOnRequest=isStopOnRequest',ctx);
for(const s of ['ŚWILCZA NOWY DWÓR 71 N.Ż.','ŚWILCZA OSIEDLE 73 N.Ż.','ŚWILCZA 75 NZ','ŚWILCZA 75 NA ŻĄDANIE'])
 assert.equal(ctx.isStopOnRequest({name:s}),true,s);
for(const s of ['DĘBICA DWORZEC AUTOBUSOWY','NAGAWCZYNA 1','ŚWILCZA 58'])
 assert.equal(ctx.isStopOnRequest({name:s}),false,s);
assert(html.includes("'stops/'+stop.id+'.mp3',...(isStopOnRequest(stop)?['na_zadanie.mp3']:[])"),
 'Missing separate on-request MP3 in browser audio path');
assert(html.includes('announceTerminal(stop.id,isStopOnRequest(stop))'));
assert(html.includes('announceName(stop.id,isStopOnRequest(stop))'));
const java=fs.readFileSync('app/src/main/java/pl/srgmobile/classic/MainActivity.java','utf8');
assert(java.includes('"na_zadanie.mp3", "terminal.mp3"'));
assert(java.includes('boolean onRequest'));
console.log('PASS: on-request stop names split into name MP3 + na_zadanie MP3; terminal separately');
