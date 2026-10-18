const assert=require('node:assert/strict');const {frames}=require('../app/src/main/assets/rg-usb.js');
assert.deepEqual(frames({profile:'ascii',frame:'02 {addr} {text} 03'},'AB'),['02 11 41 42 03','02 12 41 42 03']);
assert.deepEqual(frames({profile:'utf8',frame:'{addr} {text}'},'Ł'),['11 C5 81','12 C5 81']);
assert.deepEqual(frames({profile:'hex',frame:'00 ff'},''),['00 FF']);
for(const c of [{profile:'utf8',frame:''},{profile:'utf8',frame:'AA {text}'},{profile:'hex',frame:'F'},{profile:'hex',frame:'GG'},{profile:'hex',frame:'{addr}'}])assert.throws(()=>frames(c,'X'));
assert.throws(()=>frames({profile:'ascii',frame:'{addr} {text}'},'Ł'));
assert.throws(()=>frames({profile:'utf8',frame:'{addr} {text}'},'a'.repeat(5000)));
console.log('RG frame validation OK (no hardware test)');
