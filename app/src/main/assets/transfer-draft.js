/* Layout prepared for future verified transfer data. Disabled in production. */
window.SRGTransferDraft={
 enabled:false,
 render(data){
  const host=document.getElementById('transferDraft');if(!host)return;
  host.replaceChildren();
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e};
  const meta=make('div','td-meta','');meta.append(make('span','','Aktualny przystanek: '+data.stop),make('span','','Godzina: '+data.time));host.append(meta);
  host.append(make('h2','','PRZESIADKI'));
  const table=make('div','td-table','');const head=make('div','td-row td-head','');head.append(make('span','','Przewoźnik / kierunek'),make('span','','Planowy odjazd'));table.append(head);
  for(const row of data.rows){const line=make('div','td-row',''),clip=make('div','td-clip',''),label=make('span','td-text',row.carrier+' / '+row.direction);clip.append(label);line.append(clip,make('span','td-time',row.time));table.append(line)}
  host.append(table);host.hidden=false;
  requestAnimationFrame(()=>host.querySelectorAll('.td-clip').forEach(clip=>{const label=clip.firstChild,overflow=label.scrollWidth-clip.clientWidth;if(overflow>2){label.classList.add('td-moving');label.style.setProperty('--td-end',-overflow+'px');label.style.setProperty('--td-duration',Math.max(10,overflow/35+5)+'s')}}));
 },
 hide(){document.getElementById('transferDraft').hidden=true}
};
