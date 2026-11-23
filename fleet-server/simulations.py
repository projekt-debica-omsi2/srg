"""Clearly labelled schedule estimates; never invent a GPS observation."""
import json,math,re,unicodedata
from datetime import datetime,date,timedelta
from zoneinfo import ZoneInfo
WARSAW=ZoneInfo('Europe/Warsaw')

def easter(year):
 a=year%19;b=year//100;c=year%100;d=b//4;e=b%4;f=(b+8)//25;g=(b-f+1)//3;h=(19*a+b-d-g+15)%30;i=c//4;k=c%4;l=(32+2*e+2*i-h-k)%7;m=(a+11*h+22*l)//451;n=h+l-7*m+114
 return date(year,n//31,n%31+1)

def runs_on(trip,day):
 code=trip.get('serviceCode','');upper=code.upper();e=easter(day.year)
 holidays={(1,1),(1,6),(5,1),(5,3),(8,15),(11,1),(11,11),(12,25),(12,26)}
 if day.year>=2025:holidays.add((12,24))
 work=day.weekday()<5 and (day.month,day.day) not in holidays and day not in {e,e+timedelta(days=1),e+timedelta(days=49),e+timedelta(days=60)}
 if upper.startswith(('D','S')) and not work:return False
 if 'n' in code and ((day.month,day.day) in {(12,24),(12,31)} or day==e-timedelta(days=1)):return False
 if 'x' in code and ((day.month,day.day) in {(5,2),(10,14)} or day==e+timedelta(days=61)):return False
 if upper.startswith('S'):
  if not date(2026,9,1)<=day<=date(2027,6,25):return False
  if any(a<=day<=b for a,b in [(date(2026,12,23),date(2027,1,1)),(date(2027,1,18),date(2027,1,31)),(date(2027,3,25),date(2027,3,30))]):return False
 return True

def minutes(value):
 try:
  h,m=map(int,value.split(':'))
  return h*60+m if 0<=h<24 and 0<=m<60 else None
 except (ValueError,AttributeError):return None

def distance(a,b):
 y1,y2=math.radians(a['lat']),math.radians(b['lat']);dy=y2-y1;dx=math.radians(b['lon']-a['lon']);h=math.sin(dy/2)**2+math.cos(y1)*math.cos(y2)*math.sin(dx/2)**2
 return 6371000*2*math.asin(min(1,math.sqrt(h)))

def materialize(trip,day,now):
 if not runs_on(trip,day):return None
 start=minutes(trip.get('departure'));end=minutes(trip.get('arrival'))
 if start is None or end is None:return None
 if end<start:end+=1440
 midnight=datetime.combine(day,datetime.min.time(),WARSAW)
 departure=midnight+timedelta(minutes=start);arrival=midnight+timedelta(minutes=end)
 if not departure<=now<arrival:return None
 points=[];last=start
 for i,s in enumerate(trip['route']):
  t=minutes(s.get('time'))
  if i==0:t=start
  elif i==len(trip['route'])-1:t=end
  if t is not None:
   while t<last:t+=1440
   last=t
  if not all(isinstance(s.get(k),(int,float)) and math.isfinite(s[k]) for k in ('lat','lon')):continue
  points.append(dict(s,plannedAt=(midnight+timedelta(minutes=t)).timestamp()*1000 if t is not None else None))
 anchors=[i for i,p in enumerate(points) if p['plannedAt'] is not None]
 if len(anchors)<2:return None
 at=now.timestamp()*1000
 if not points[anchors[0]]['plannedAt']<=at<=points[anchors[-1]]['plannedAt']:return None
 for left,right in zip(anchors,anchors[1:]):
  a,b=points[left],points[right]
  if a['plannedAt']<=at<=b['plannedAt']:
   lengths=[distance(points[i],points[i+1]) for i in range(left,right)];total=sum(lengths);fraction=(at-a['plannedAt'])/max(1,b['plannedAt']-a['plannedAt']);remaining=total*fraction
   for offset,length in enumerate(lengths):
    if remaining<=length or offset==len(lengths)-1:
     first,second=points[left+offset],points[left+offset+1];f=max(0,min(1,remaining/length)) if length else 0
     point={'lat':first['lat']+(second['lat']-first['lat'])*f,'lon':first['lon']+(second['lon']-first['lon'])*f,'nextStop':second['name']};break
    remaining-=length
   else:point={'lat':a['lat'],'lon':a['lon'],'nextStop':b['name']}
   return dict(point,route=points,direction=trip['direction'],duty=trip['duty'],tripNo=trip['tripNo'],departure=trip['departure'],arrival=trip['arrival'],serviceCode=trip.get('serviceCode',''),delay=None,stopMode=None,calendarNote=None if trip.get('serviceCode') else 'Dni kursowania nieokreślone; symulacja godzin rozkładu')
 return None

def claims(vehicle,trip,day):
 p=vehicle.get('payload') or {}
 for stop in p.get('route') or []:
  if isinstance(stop.get('plannedAt'),(int,float)):
   if datetime.fromtimestamp(stop['plannedAt']/1000,WARSAW).date()!=day:return False
   break
 if p.get('duty') and p.get('tripNo') is not None:
  if p.get('departure') and p['departure']!=trip['departure']:return False
  if any(str(p['duty']) in {str(a['duty']),str(a['label'])} and str(p['tripNo'])==str(a['tripNo']) for a in trip['aliases']):return True
  # S-24 and S-24! are alternative routings of the same scheduled run.
  # An online controller running one alternative also replaces the other estimate.
  def family(value):return re.sub(r'[^A-Z0-9]','',unicodedata.normalize('NFKC',str(value)).upper())
  if p.get('departure')==trip['departure'] and p.get('arrival')==trip['arrival']:
   if any(family(p['duty'])==family(a['duty']) and str(p['tripNo'])==str(a['tripNo']) for a in trip['aliases']):return True
 route=p.get('route') or [];expected=trip['route']
 if len(route)<2 or not expected or route[0].get('name')!=expected[0].get('name') or route[-1].get('name')!=expected[-1].get('name'):return False
 try:first=datetime.fromtimestamp(route[0]['plannedAt']/1000,WARSAW)
 except (ValueError,TypeError,KeyError,OSError):return False
 return first.date()==day and first.strftime('%H:%M')==trip['departure']

def merge_scheduled(real,trips,now=None):
 now=now or datetime.now(WARSAW);now=now.astimezone(WARSAW);virtual=[];hidden={v['number'] for v in real if not v.get('online') and (v.get('payload') or {}).get('direction') not in (None,'','Bez kursu')}
 for day in [now.date()-timedelta(days=1),now.date()]:
  for trip in trips:
   p=materialize(trip,day,now)
   if p is None:continue
   matching=[v for v in real if claims(v,trip,day)]
   if any(v.get('online') for v in matching):continue
   hidden.update(v['number'] for v in matching)
   virtual.append({'number':'SIM-'+trip['id'],'display':'','online':False,'simulation':True,'sharing':False,'lastSeen':None,'gpsSeen':None,'gpsFresh':False,'stopMode':None,'payload':p,'aliases':trip['aliases']})
 return [v for v in real if v['number'] not in hidden]+virtual
