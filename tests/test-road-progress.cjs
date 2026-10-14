const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const h=fs.readFileSync('app/src/main/assets/index.html','utf8');
const el={};const state={variant:{stops:[{lat:50,lon:21},{lat:50.009,lon:21},{lat:50.018,lon:21},{lat:50.027,lon:21}]},routeIndex:0};
const ctx={state,$:()=>el};vm.createContext(ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/auto-gps.js','utf8'),ctx);vm.runInContext(h.slice(h.indexOf('function roadMeters('),h.indexOf('// GPS/GNSS:')),ctx);
const tracker=ctx.SRGAutoGPS.createTracker();let now=100000;
function fix(m){now+=1000;state.gpsLast={lat:50+m/111195,lon:21,acc:5,speed:10,ts:now};const res=tracker.evaluate({enabled:true,courseActive:true,fix:state.gpsLast,stops:state.variant.stops,index:state.routeIndex,courseKey:'test',pending:null,now});if(res.advance)state.routeIndex=res.nextIndex;ctx.renderRoad(now);return Number(el.textContent.match(/^~(\d+)/)?.[1]);}
assert.equal(fix(0),0);fix(55);assert(Math.abs(fix(70)-70)<3);assert.equal(state.routeIndex,1);assert(Math.abs(fix(300)-300)<3);assert(Math.abs(fix(700)-700)<3);
fix(1000);fix(1020);fix(1055);assert(Math.abs(fix(1075)-74)<4);assert.equal(state.routeIndex,2);assert(Math.abs(fix(1500)-499)<4);
fix(2000);fix(2020);fix(2055);fix(2075);assert.equal(state.routeIndex,3);assert(Math.abs(fix(2500)-498)<5);
ctx.renderRoad(now+31000);assert(el.textContent.startsWith('GPS —'));state.gpsLast.acc=150;ctx.renderRoad(now);assert(el.textContent.startsWith('GPS NIEDOKŁ.'));
state.gpsLast.acc=5;state.routeIndex=1;state.gpsLast.lat=50.0045;ctx.renderRoad(now);assert(Math.abs(Number(el.textContent.match(/^~(\d+)/)[1])-500)<3);
console.log('PASS: real GPS departure transitions + intermediate/last segment, manual selection, stale and inaccurate GPS');
