const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes={};function node(){return {textContent:'',hidden:false,style:{setProperty(){},removeProperty(){}},classList:{toggle(){},add(){},remove(){}},clientWidth:1000,scrollWidth:1600,parentElement:{clientWidth:1000,classList:{add(){},remove(){}}},replaceChildren(){},append(){}}}
const ctx={document:{getElementById:id=>nodes[id]??=node(),createElement:node},window:{addEventListener(){}},location:{search:''},URLSearchParams,Intl,Date,setTimeout:()=>0,clearTimeout(){},setInterval(){},fetch:()=>new Promise(()=>{})};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app/src/main/assets/lcd-cycle.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('app/src/main/assets/app.js','utf8'),ctx);
const api=ctx.window.SRGLcdPreview;
const stops=[{nazwa:'START'},{nazwa:'DWORZEC LOKALNY'},{nazwa:'DWORZEC AUTOBUSOWY'}];
const state={kursAktywny:true,kursId:'S27',przystanki:stops,aktualnyIndeks:1,aktualny:stops[1],nastepny:stops[2],koniecKursu:false,koncowyNastepny:true};api.setState(state);
assert.equal(nodes.stopName.textContent,'DWORZEC LOKALNY');assert.equal(nodes.stopNote.textContent,'');
vm.runInContext('setRoute(currentState)',ctx);assert.equal(nodes.routeText.textContent,'DWORZEC LOKALNY  –  DWORZEC AUTOBUSOWY');assert.equal(nodes.routeLine.textContent,'→');
api.setState({...state,aktualnyIndeks:2,aktualny:stops[2],nastepny:null,koniecKursu:true,koncowyNastepny:false});assert.equal(nodes.stopNote.textContent,'PRZYSTANEK KOŃCOWY');
api.setState({kursAktywny:false});assert.equal(nodes.clockPanel.hidden,false);
const server=fs.readFileSync('app/src/main/java/pl/srgmobile/classic/LocalPanelServer.java','utf8');assert(server.includes('new ServerSocket(47283)'));assert(server.includes('route.equals("/api/state")'));
console.log('PASS LCD: remaining stops, intermediate/terminal, clock, LAN endpoint');
