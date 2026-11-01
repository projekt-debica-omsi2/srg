const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes={};function node(){return {textContent:'',hidden:false,style:{setProperty(){},removeProperty(){}},classList:{flags:{},toggle(name,on){this.flags[name]=!!on},add(){},remove(){}},clientWidth:1000,scrollWidth:1600,parentElement:{clientWidth:1000,classList:{add(){},remove(){}}},replaceChildren(){},append(){}}}
const ctx={document:{getElementById:id=>nodes[id]??=node(),createElement:node},window:{addEventListener(){}},location:{search:''},URLSearchParams,Intl,Date,setTimeout:()=>0,clearTimeout(){},setInterval(){},fetch:()=>new Promise(()=>{})};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app/src/main/assets/lcd-cycle.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('app/src/main/assets/app.js','utf8'),ctx);
const api=ctx.window.SRGLcdPreview;
const stops=[{nazwa:'START',ulica:'GŁOWACKIEGO'},{nazwa:'DWORZEC LOKALNY',ulica:'TOWARNICKIEGO'},{nazwa:'KRAKOWSKA GALERIA',ulica:'KRAKOWSKA'},{nazwa:'KRAKOWSKA SZPITAL',ulica:'KRAKOWSKA'}];
const state={kursAktywny:true,kursId:'S27',linia:'1',przystanki:stops,aktualnyIndeks:1,aktualny:stops[1],nastepny:stops[2],koniecKursu:false,koncowyNastepny:true};api.setState(state);
assert.equal(nodes.stopName.textContent,'DWORZEC LOKALNY');assert.equal(nodes.stopNote.textContent,'');
vm.runInContext('setRoute(currentState)',ctx);assert.equal(nodes.routeText.textContent,'TOWARNICKIEGO  –  KRAKOWSKA');
api.setState({...state,aktualnyIndeks:3,aktualny:stops[3],nastepny:null,koniecKursu:true,koncowyNastepny:false});assert.equal(nodes.stopNote.textContent,'PRZYSTANEK KOŃCOWY');
api.setState({kursAktywny:false});assert.equal(nodes.clockPanel.hidden,false);
const server=fs.readFileSync('app/src/main/java/pl/srgmobile/classic/LocalPanelServer.java','utf8');assert(server.includes('new ServerSocket(47283)'));assert(server.includes('route.equals("/api/state")'));
console.log('PASS LCD: remaining stops, intermediate/terminal, clock, LAN endpoint');

api.setState({...state,clock:'23:47:00'});api.tickClock();assert.equal(nodes.time.textContent,'23:47');
api.setState({...state,clock:'02:03:00'});api.tickClock();assert.equal(nodes.time.textContent,'02:03');
console.log('PASS LCD clock follows OMSI time changes in 24-hour format');

vm.runInContext('setRoute({...currentState,linia:"1234",kierunek:"DŁUGI KIERUNEK NA DWÓCH WIERSZACH"})',ctx);assert.equal(nodes.routeLine.textContent,'1234');assert.equal(nodes.routeLine.hidden,false);assert.equal(nodes.routeDirection.textContent,'DŁUGI KIERUNEK NA DWÓCH WIERSZACH');
vm.runInContext('setRoute({...currentState,linia:""})',ctx);assert.equal(nodes.routeLine.hidden,true);
const lcdHtml=fs.readFileSync('app/src/main/assets/lcd.html','utf8');assert(lcdHtml.indexOf('id="routeLine"')<lcdHtml.indexOf('id="routeArrow"'));assert(lcdHtml.includes('aria-hidden="true">→'));
console.log('PASS LCD four-digit line before separate arrow and destination, optional line');

for(const line of ['1','12','123','1234']){ctx.testLine=line;vm.runInContext('setRoute({...currentState,linia:testLine})',ctx);assert.equal(nodes.routePanel.classList.flags['four-digit-line'],line.length===4);assert.equal(nodes.routeLine.textContent,line);assert.equal(nodes.routePanel.classList.flags['no-line'],false);}
console.log('PASS LCD one/two/three characters use centered three-slot field; four expands');
