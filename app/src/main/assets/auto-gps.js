/* SRG Mobile 1.4.19 — testowalna logika automatycznego przełączania przystanków.
 * Pozycja i kolejność przystanków pochodzą WYŁĄCZNIE z aktywnego wariantu RJ.
 * Nie oblicza kierunku trasy z całej listy i nigdy nie kończy kursu automatycznie.
 */
(function (root) {
  'use strict';
  const EARTH = 6371000, DEG = Math.PI / 180;
  function distance(a,b) {
    if (![a?.lat,a?.lon,b?.lat,b?.lon].every(Number.isFinite)) return Infinity;
    const lat=(b.lat-a.lat)*DEG,lon=(b.lon-a.lon)*DEG;
    const q=Math.sin(lat/2)**2+Math.cos(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.sin(lon/2)**2;
    return 2*EARTH*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));
  }
  function createTracker() {
    let target=-1, confirmations=0, firstAt=0, lastAt=0, lastAdvanceAt=-Infinity;
    function clear() {target=-1; confirmations=0; firstAt=0; lastAt=0;}
    return {
      reset(clearCooldown=true) {clear();if(clearCooldown)lastAdvanceAt=-Infinity;},
      evaluate({enabled,courseActive,fix,stops,index,pending,now=Date.now()}) {
        if (!enabled) {clear();return {status:'WYŁĄCZONY'};}
        if (!courseActive || !Array.isArray(stops) || !stops.length) {clear();return {status:'WYBIERZ KURS'};}
        if (Number.isInteger(pending)) {clear();return {status:'WYBÓR RĘCZNY'};}
        if (index>=stops.length-1) {clear();return {status:'OSTATNI PRZYSTANEK'};}
        const current=stops[index],next=stops[index+1];
        if (!next || ![current?.lat,current?.lon,next.lat,next.lon].every(Number.isFinite)) {
          clear();return {status:'BRAK WSPÓŁRZĘDNYCH RJ'};
        }
        if (!fix) {clear();return {status:'OCZEKIWANIE NA GPS'};}
        const accuracy=Number(fix.acc);
        if (!Number.isFinite(accuracy) || accuracy<0 || accuracy>65) {
          clear();return {status:'GPS NIEDOKŁADNY',accuracy};
        }
        if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) {
          clear();return {status:'BRAK POPRAWNEJ POZYCJI'};
        }
        const dNext=distance(fix,next), dCurrent=distance(fix,current);
        const zone=Math.max(35,Math.min(65,(Number.isFinite(next.gpsRadius)?next.gpsRadius:50)+Math.min(15,accuracy*0.33)));
        const result={status:`DO NASTĘPNEGO: ${Math.round(dNext)} m`, distance:dNext, zone, stopName:next.name || ''};
        // Nie wolno przełączyć przystanku, jeżeli wciąż jesteśmy bliżej poprzedniego.
        if (dNext>zone || dNext+12>=dCurrent) {clear();return result;}
        // Nie przełączamy kilku przystanków na podstawie jednego miejsca lub fiksu.
        if (now-lastAdvanceAt<5000) {clear();return {...result,status:'CHWILA PO ZMIANIE'};}
        if (target!==index+1 || now-lastAt>7000 || now<lastAt) {
          clear();target=index+1;firstAt=now;lastAt=now;confirmations=1;
        } else if (now-lastAt>=700) {
          confirmations+=1;lastAt=now;
        }
        if (confirmations>=3 && now-firstAt>=2200) {
          lastAdvanceAt=now;clear();
          return {...result,status:`PRZEŁĄCZONO: ${next.name||index+2}`,advance:true,nextIndex:index+1};
        }
        return {...result,status:`POTWIERDZANIE ${confirmations}/3 · ${Math.round(dNext)} m`,confirmations};
      }
    };
  }
  root.SRGAutoGPS={createTracker,distance};
})(typeof window!=='undefined'?window:globalThis);
