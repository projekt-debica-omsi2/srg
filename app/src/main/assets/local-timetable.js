(function(root){'use strict';
 const MAX=2*1024*1024;
 function parse(text){
  if(typeof text!=='string'||text.length>MAX)throw Error('Plik jest za duży (maks. 2 MB).');
  const duties=[],registry=new Map();let duty=null,trip=null;
  const fail=(line,msg)=>{throw Error('Wiersz '+line+': '+msg)};
  for(const [i,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
   const line=raw.trim();if(!line||line.startsWith('#'))continue;
   const cells=line.split('|').map(s=>s.trim());
   if(cells[0]==='KURSÓWKA'||cells[0]==='KURSOWKA'){
    if(trip)fail(i+1,'Zamknij kurs słowem KONIEC.');
    if(cells.length!==2||!cells[1]||cells[1].length>100)fail(i+1,'KURSOWKA | nazwa');
    if(duties.some(d=>d.label===cells[1]))fail(i+1,'Powtórzona nazwa kursówki.');
    duty={id:'local-'+duties.length,label:cells[1],localTimetable:true,trips:[]};duties.push(duty);
   }else if(cells[0]==='KURS'){
    if(!duty||trip||cells.length!==3||!cells[1]||cells[1].length>16||!['CODZIENNIE','DN','SX','SOB','ND'].includes(cells[2]))fail(i+1,'KURS | numer linii | CODZIENNIE / DN / SX / SOB / ND');
    trip={line:cells[1],calendarCode:cells[2],stops:[],times:[]};
   }else if(line==='KONIEC'){
    if(!trip||trip.stops.length<2)fail(i+1,'Kurs potrzebuje co najmniej dwóch przystanków.');
    let previous=null,elapsed=0;
    for(const time of trip.times){const [h,m]=time.split(':').map(Number),minute=h*60+m;if(previous!==null)elapsed+=(minute-previous+1440)%1440;previous=minute;}
    if(elapsed>=1440)fail(i+1,'Godziny przystanków obejmują pełną dobę lub są w złej kolejności.');
    duty.trips.push(trip);trip=null;
   }else{
    if(!trip||cells.length<3||cells.length>6)fail(i+1,'HH:MM | ID | nazwa | ulica | szerokość GPS | długość GPS');
    const [time,idstr,name,street='',latstr='',lonstr='']=cells;
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail(i+1,'Nieprawidłowa godzina (HH:MM).');
    const id=Number(idstr);if(!/^\d+$/.test(idstr)||!Number.isInteger(id)||id<1||id>65535||!name||name.length>200||street.length>200)fail(i+1,'Nieprawidłowe ID lub nazwa przystanku.');
    const stop={id,name,street,referenceCompatible:false};
    if(Boolean(latstr)!==Boolean(lonstr))fail(i+1,'Wpisz obie współrzędne GPS albo zostaw obie puste.');
    if(latstr){const lat=Number(latstr.replace(',','.')),lon=Number(lonstr.replace(',','.'));if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)fail(i+1,'Nieprawidłowe GPS.');Object.assign(stop,{lat,lon,gpsRadius:50,gpsVerified:true});}
    const prev=registry.get(id);if(prev&&JSON.stringify(prev)!==JSON.stringify(stop))fail(i+1,'To samo ID ma inną nazwę, ulicę lub GPS. Użyj osobnego ID dla przeciwnego stanowiska.');
    registry.set(id,stop);trip.stops.push({...stop});trip.times.push(time);
    if(trip.stops.length>500)fail(i+1,'Maksymalnie 500 przystanków w kursie.');
   }
  }
  if(trip)throw Error('Brakuje KONIEC na końcu kursu.');
  if(!duties.length||duties.some(d=>!d.trips.length))throw Error('Każda kursówka musi zawierać przynajmniej jeden kurs.');
  const variants=[],courses=[];
  for(const d of duties)d.trips=d.trips.map((t,i)=>{
   const variantIndex=variants.length,index='local-'+d.id+'-'+i;
   variants.push({index:variantIndex,code:variantIndex+1,variantNo:i+1,line:t.line,localTimetable:true,stops:t.stops,direction:t.stops.at(-1).name});
   const c={index,variantIndex,line:t.line,courseNo:i+1,task:d.id,taskLabel:d.label,tripNo:i+1,startTime:t.times[0],endTime:t.times.at(-1),localStopTimes:t.times,calendarCode:t.calendarCode,manualDuty:true,localTimetable:true,raw:[]};courses.push(c);return c;
  });
  if(courses.length>1000)throw Error('Maksymalnie 1000 kursów.');
  return {duties,rj:{header:{date:'lokalny TXT'},stops:[...registry.values()],variants,courses,referenceVariants:{},signature:text,localTimetable:true,bytes:new TextEncoder().encode(text).length}};
 }
 const example='# SRG Mobile — lokalna kursówka, UTF-8\n# Przystanek: HH:MM | ID | nazwa | ulica | GPS szerokość | GPS długość\n# GPS jest opcjonalny. Zachowaj ID tego samego stanowiska.\nKURSOWKA | Moja kursówka\nKURS | 12 | CODZIENNIE\n07:00 | 1 | Dworzec | Kolejowa\n07:15 | 2 | Centrum | Rynek\nKONIEC\nKURS | 12 | CODZIENNIE\n07:30 | 3 | Centrum powrót | Rynek\n07:45 | 4 | Dworzec powrót | Kolejowa\nKONIEC\n';
 function validateRJ(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length>MAX)throw Error('Maksymalnie 2 MB.');
  const h=root.RJParser.parseHeader(bytes);
  if(!h.lengthMatches||h.headerLen<189||h.ttr.offset+h.ttr.len>bytes.length)throw Error('Uszkodzony nagłówek RJ.');
  for(const [name,s] of Object.entries(h.sections))if(s.offset+s.len>bytes.length||(s.recSize&&s.len%s.recSize))throw Error('Uszkodzona sekcja RJ: '+name);
  const parsed=root.RJParser.parse(bytes);
  if(!parsed.stops.length||!parsed.variants.length||parsed.variants.some(v=>v.stops.length<2))throw Error('RJ nie zawiera pełnych tras. Wybierz RJ, a nie plik LG.');
  return parsed;
 }
 root.SRGLocalTimetable={parse,validateRJ,example,MAX};
})(typeof window==='object'?window:globalThis);
