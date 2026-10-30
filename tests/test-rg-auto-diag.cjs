const fs=require('fs'),assert=require('assert');
const j=fs.readFileSync('app/src/main/java/pl/srgmobile/classic/RgUsbBridge.java','utf8');
const u=fs.readFileSync('app/src/main/assets/rg-usb.js','utf8');
const g=fs.readFileSync('app/build.gradle','utf8');
for(const s of ['diagnosticConfig','setDTR','setRTS','purgeHwBuffers','port.read(buf,150)','appVersion","1.4.73'])assert(j.includes(s),s);
for(const s of ['START AUTO DIAGNOZA','buildPlan()','DTR','RTS','Rozszerzony test','runAutoDiag'])assert(u.includes(s),s);
assert(g.includes("versionName '1.4.73'"));
assert(g.includes('versionCode 11473'));
console.log('SRG 1.4.73 auto RX diagnostics OK');
