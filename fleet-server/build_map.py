import argparse,json,sys
from pathlib import Path
sys.path.insert(0,r'C:\srg mobile\diagnostyka-omsi\video-tools')
import osmium
class Extract(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.roads=[];self.places=[]
 def inside(self,x,y):return True
 def node(self,n):
  if n.location.valid() and self.inside(n.location.lon,n.location.lat) and n.tags.get('place') in ('city','town','village') and n.tags.get('name'):self.places.append([n.location.lat,n.location.lon,n.tags['name'],n.tags['place']])
 def way(self,w):
  k=w.tags.get('highway')
  if k not in ('motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified','living_street','service'):return
  try:p=[[round(n.lat,6),round(n.lon,6)] for n in w.nodes]
  except osmium.InvalidLocationError:return
  if len(p)>1 and any(self.inside(q[1],q[0]) for q in p):self.roads.append([k,w.tags.get('name',''),p])
a=argparse.ArgumentParser();a.add_argument('source');a.add_argument('output');args=a.parse_args();h=Extract();h.apply_file(args.source,locations=True,idx='flex_mem');Path(args.output).write_text('window.SRGOfflineMap='+json.dumps({'bbox':[min(p[1] for r in h.roads for p in r[2]),min(p[0] for r in h.roads for p in r[2]),max(p[1] for r in h.roads for p in r[2]),max(p[0] for r in h.roads for p in r[2])],'roads':h.roads,'places':h.places,'license':'OpenStreetMap contributors, ODbL 1.0'},ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8');print('roads',len(h.roads),'places',len(h.places))
