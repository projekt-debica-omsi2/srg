const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const route = JSON.parse(fs.readFileSync('route_data.json','utf8'));
const state = JSON.parse(fs.readFileSync('.tts_status.json','utf8'));
const files = ['next.mp3','terminal.mp3','inspection.mp3','na_zadanie.mp3',
  ...route.stops.map(s=>`stops/${s.id}.mp3`), ...route.variants.map(v=>`start/${v.index}.mp3`)];
assert.equal(files.length,79,'Expected 79 separate recordings');
assert.equal(new Set(files).size,79,'Duplicate RJ IDs in audio mapping');
const manifest=JSON.parse(fs.readFileSync('NAGRANIA_79_SHA256.json','utf8'));
for(const f of files) {
  const path='app/src/main/assets/audio/'+f;
  assert(state[f]&&/^[0-9a-f]{64}$/.test(state[f]),'Missing recorded TTS text hash: '+f);
  assert(fs.existsSync(path),'Missing TTS MP3: '+path);
  const data=fs.readFileSync(path);
  assert(data.length>1000,'MP3 too small: '+f);
  assert((data[0]===0x49&&data[1]===0x44&&data[2]===0x33)||
         (data[0]===0xff&&(data[1]&0xe0)===0xe0),'MP3 header invalid: '+f);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),manifest[f],
    'MP3 contents changed from uploaded bundle: '+f);
}
const chime=fs.readFileSync('app/src/main/assets/audio/chimes/1.mp3');
assert.equal(crypto.createHash('sha256').update(chime).digest('hex'),manifest['chimes/1.mp3'],
  'Selected B2 E4 C4 chime changed');
console.log('PASS: 79 MP3 Marek Neural from user + user-selected B2 E4 C4 piano chime; immutable SHA256');
