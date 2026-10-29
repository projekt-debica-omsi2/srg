(function(root){'use strict';
 const df=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}),tf=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const holidays=new Set(['2026-01-01','2026-01-06','2026-04-05','2026-04-06','2026-05-01','2026-05-03','2026-05-24','2026-06-04','2026-08-15','2026-11-01','2026-11-11','2026-12-24','2026-12-25','2026-12-26']);
 function calendar(day){if(!/^2026-\d\d-\d\d$/.test(day))return null;const d=new Date(day+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==day)return null;const weekday=d.getUTCDay(),holiday=holidays.has(day),work=weekday>0&&weekday<6&&!holiday;const between=(a,b)=>day>=a&&day<=b;
 const vacation=between('2026-02-16','2026-03-01')||between('2026-04-02','2026-04-07')||between('2026-06-27','2026-08-31')||between('2026-12-23','2026-12-31');
 return {weekday,holiday,work,vacation,school:work&&!vacation&&day!=='2026-10-14'};}
 function runs(row,day){const c=calendar(day);if(!c||day<(row.validFrom||'2026-01-01')||(row.validTo&&day>row.validTo)||day>=(row.reviewAfter||'2027-01-01'))return false;
 const code=row.code,md=day.slice(5);let base=false;
 if(code==='daily')return true;
 // Composite base symbols are not independent alternatives: DH/HD require holidays,
 // while 7E explicitly combines Sundays with Mon–Sat excluding public holidays.
 if(code.startsWith('7E'))base=c.weekday===0||(c.weekday>=1&&c.weekday<=6&&!c.holiday);
 else if(code.startsWith('BS'))base=c.work&&!c.school;
 else if(/^(H|DH)/.test(code))base=c.work&&c.vacation;
 else if(code.startsWith('S'))base=c.school;
 else if(code.startsWith('D'))base=c.work;
 else if(code.startsWith('A'))base=c.weekday>=1&&c.weekday<=5;
 else if(code.startsWith('6'))base=c.weekday===6;
 if(!base)return false;
 if(/[mn]/.test(code)&&['12-24','12-31'].includes(md))return false;
 if(code.includes('n')&&day==='2026-04-04')return false;
 if(code.includes('w')&&day==='2026-06-04')return false;
 if(/[zxp]/.test(code)&&day==='2026-06-05')return false;
 if(/[xp]/.test(code)&&['05-02','10-14'].includes(md))return false;
 return true;}
 function rowsFor(day,time,feed=root.SRGRopczyceData){if(!feed||!Array.isArray(feed.departures)||day>=feed.reviewAfter||!calendar(day))return [];const seen=new Set();return feed.departures.filter(r=>runs(r,day)&&r.time>time).sort((a,b)=>a.time.localeCompare(b.time)||a.carrier.localeCompare(b.carrier)||a.direction.localeCompare(b.direction)).filter(r=>{const k=JSON.stringify([r.carrier,r.direction,r.time,r.via]);if(seen.has(k))return false;seen.add(k);return true}).slice(0,8).map(r=>({carrier:r.carrier,direction:r.direction,time:r.time,code:r.code,via:r.via}));}
 function forStop(stop,now){if(!Number.isFinite(now))return null;const day=df.format(now),time=tf.format(now),rows=rowsFor(day,time);return {przystanek:stop.name,stop:stop.name,time,rows,rowsPerPage:8,pages:[{title:'PRZESIADKI',rows,emptyText:day>=(root.SRGRopczyceData?.reviewAfter||'2027-01-01')?'Rozkład wymaga aktualizacji':'Brak dalszych odjazdów w rozkładzie na dziś'}]};}
 root.SRGRopczyce={calendar,runs,rowsFor,forStop};
})(typeof window==='object'?window:globalThis);
