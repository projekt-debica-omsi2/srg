"""SRG fleet test server. HTTP transport is unencrypted; use only test credentials."""
import argparse,hashlib,hmac,json,secrets,sqlite3,time,threading,gzip
from pathlib import Path
from simulations import merge_scheduled
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler

class Connection(sqlite3.Connection):
 def __exit__(self,*args):
  try:return super().__exit__(*args)
  finally:self.close()

class Fleet:
 def __init__(self,directory):
  self.directory=Path(directory);self.directory.mkdir(parents=True,exist_ok=True);self.db=self.directory/'fleet.sqlite';self.sessions={};self.lock=threading.Lock();self.attempts={}
  with self.connect() as c:c.executescript('CREATE TABLE IF NOT EXISTS vehicles(device TEXT PRIMARY KEY,secret_hash TEXT NOT NULL,number TEXT NOT NULL UNIQUE,display TEXT NOT NULL DEFAULT "",last_seen REAL,sharing INTEGER NOT NULL DEFAULT 0,payload TEXT);CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);')
  with self.connect() as c:
   if 'position_seen' not in {r[1] for r in c.execute('PRAGMA table_info(vehicles)')}:c.execute('ALTER TABLE vehicles ADD COLUMN position_seen REAL')
  with self.connect() as c:
   if 'stop_mode' not in {r[1] for r in c.execute('PRAGMA table_info(vehicles)')}:c.execute('ALTER TABLE vehicles ADD COLUMN stop_mode TEXT')
  with self.connect() as c:
   if not c.execute('SELECT value FROM settings WHERE key="admin_hash"').fetchone():
    password=secrets.token_urlsafe(20);c.execute('INSERT INTO settings VALUES("admin_hash",?)',(self.digest(password),));(self.directory/'LOGOWANIE.txt').write_text('Panel lokalny: http://127.0.0.1:8790\nLogin: admin\nHasło: '+password+'\nNie publikuj tego pliku ani bazy SQL.\n',encoding='utf-8')
 def connect(self):
  c=sqlite3.connect(self.db,timeout=10,factory=Connection);c.row_factory=sqlite3.Row;return c
 @staticmethod
 def digest(s):return hashlib.sha256(s.encode()).hexdigest()
 def auth_device(self,c,d):
  row=c.execute('SELECT * FROM vehicles WHERE device=?',(d.get('device'),)).fetchone()
  if not row or not hmac.compare_digest(row['secret_hash'],self.digest(str(d.get('secret','')))):raise ValueError('Nieprawidłowy klucz sterownika')
  return row
 def reserve(self,d):
  number=str(d.get('number','')).lstrip('0');device=str(d.get('device',''));secret=str(d.get('secret',''));display=str(d.get('display','')).strip()
  if not number.isascii() or not number.isdigit() or len(number)>64 or not 16<=len(device)<=128 or len(secret)<32 or len(display)>100:raise ValueError('Nieprawidłowy numer, profil lub klucz')
  with self.connect() as c:
   c.execute('BEGIN IMMEDIATE');old=c.execute('SELECT * FROM vehicles WHERE device=?',(device,)).fetchone()
   if old:
    self.auth_device(c,d)
    if old['number']!=number:raise ValueError('Ten sterownik ma już numer '+old['number']+'. Administrator może zwolnić rezerwację.')
   try:c.execute('INSERT INTO vehicles(device,secret_hash,number,display) VALUES(?,?,?,?) ON CONFLICT(device) DO UPDATE SET display=excluded.display',(device,self.digest(secret),number,display))
   except sqlite3.IntegrityError:raise FileExistsError('Numer jest już zarezerwowany, także gdy pojazd jest offline')
  return {'number':number,'display':display,'reserved':True}
 def telemetry(self,d):
  p=d.get('payload',{});lat=p.get('lat');lon=p.get('lon');accuracy=p.get('accuracy');age=p.get('ageMs')
  if not isinstance(p,dict) or not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not -90<=lat<=90 or not -180<=lon<=180 or not isinstance(accuracy,(int,float)) or not 0<=accuracy<=10000 or not isinstance(age,(int,float)) or not 0<=age<=30000:raise ValueError('Brak świeżej prawidłowej pozycji GPS')
  if len(json.dumps(p))>40000:raise ValueError('Zbyt duża trasa')
  with self.connect() as c:
   self.auth_device(c,d);c.execute('UPDATE vehicles SET payload=?,last_seen=?,position_seen=?,sharing=1 WHERE device=?',(json.dumps(p,ensure_ascii=False),time.time(),time.time(),d['device']))
  return {'ok':True}
 def heartbeat(self,d):
  with self.connect() as c:
   self.auth_device(c,d);mode=d.get('stopMode');c.execute('UPDATE vehicles SET last_seen=?,sharing=1,stop_mode=COALESCE(?,stop_mode) WHERE device=?',(time.time(),mode if mode in ('auto','manual') else None,d['device']))
  return {'ok':True}
 def vehicles(self,device=None):
  with self.connect() as c:rows=c.execute('SELECT * FROM vehicles'+(' WHERE device=?' if device else ''),(device,) if device else ()).fetchall()
  return [{'number':r['number'],'display':r['display'],'sharing':bool(r['sharing']),'online':bool(r['sharing'] and r['last_seen'] and time.time()-r['last_seen']<75),'stopMode':r['stop_mode'],'lastSeen':r['last_seen'],'gpsFresh':bool(r['position_seen'] and time.time()-r['position_seen']<30),'gpsSeen':r['position_seen'],'payload':json.loads(r['payload']) if r['sharing'] and r['payload'] else None} for r in rows]

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def answer(self,status,data,headers=None):
  raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
  for k,v in (headers or {}).items():self.send_header(k,v)
  self.end_headers();self.wfile.write(raw)
 def session(self):
  cookie=self.headers.get('Cookie','');token=next((x.strip()[4:] for x in cookie.split(';') if x.strip().startswith('srg=')),'');session=self.server.fleet.sessions.get(token)
  return session if session and session['expires']>time.time() else None
 def do_GET(self):
  if self.path=='/api/vehicles':
   return self.answer(200,{'vehicles':merge_scheduled(self.server.fleet.vehicles(),self.server.schedules),'role':'viewer'})
  if self.path in ('/SRGMobile-TestGPS.apk','/SRGMobile-TestGPS-1.4.91.apk','/SRGMobile-TestGPS-1.4.92.apk'):
   file=self.server.assets/self.path.lstrip('/')
   if not file.is_file():return self.answer(404,{'error':'APK unavailable'})
   self.send_response(200);self.send_header('Content-Type','application/vnd.android.package-archive');self.send_header('Content-Disposition','attachment; filename="'+file.name+'"');self.send_header('Content-Length',str(file.stat().st_size));self.end_headers()
   with file.open('rb') as source:
    import shutil
    shutil.copyfileobj(source,self.wfile)
   return
  files={'/':'index.html','/leaflet.js':'leaflet.js','/leaflet.css':'leaflet.css','/offline-roads.js':'offline-roads.js'}
  if self.path not in files:return self.answer(404,{'error':'Nie znaleziono'})
  # Read-only fleet map is public by owner request.
  file=self.server.assets/files[self.path]
  if not file.is_file():return self.answer(404,{'error':'Brak zasobu mapy'})
  raw=file.read_bytes();compressed=False
  if self.path=='/offline-roads.js' and 'gzip' in self.headers.get('Accept-Encoding',''):
   with self.server.map_lock:
    stamp=file.stat().st_mtime_ns
    if self.server.map_cache is None or self.server.map_cache[0]!=stamp:self.server.map_cache=(stamp,gzip.compress(raw,compresslevel=5))
    raw=self.server.map_cache[1];compressed=True
  self.send_response(200)
  if compressed:self.send_header('Content-Encoding','gzip');self.send_header('Vary','Accept-Encoding')
  self.send_header('Content-Length',str(len(raw)));self.send_header('Content-Type','text/html; charset=utf-8' if self.path=='/' else 'text/css' if self.path.endswith('.css') else 'application/javascript');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(raw)
 def do_POST(self):
  origin=self.headers.get('Origin')
  if origin and origin!='http://'+self.headers.get('Host',''):return self.answer(403,{'error':'Obce pochodzenie żądania'})
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<=60000:raise ValueError('Nieprawidłowy rozmiar')
   d=json.loads(self.rfile.read(size));f=self.server.fleet
   if self.path=='/api/login':
    key=self.client_address[0];now=time.time();hits=[t for t in f.attempts.get(key,[]) if now-t<60]
    if len(hits)>=15:return self.answer(429,{'error':'Odczekaj minutę'})
    f.attempts[key]=hits+[now]
    if d.get('login')=='admin':
     with f.connect() as c:stored=c.execute('SELECT value FROM settings WHERE key="admin_hash"').fetchone()[0]
     if not hmac.compare_digest(stored,f.digest(str(d.get('password','')))):return self.answer(401,{'error':'Błędny login lub hasło'})
     s={'role':'admin','expires':now+28800}
    else:
     with f.connect() as c:row=c.execute('SELECT * FROM vehicles WHERE number=?',(str(d.get('login','')).lstrip('0'),)).fetchone()
     if not row or not hmac.compare_digest(row['secret_hash'],f.digest(str(d.get('password','')))):return self.answer(401,{'error':'Błędny numer lub klucz kierowcy'})
     s={'role':'driver','device':row['device'],'expires':now+28800}
    token=secrets.token_urlsafe(32);f.sessions[token]=s;return self.answer(200,{'ok':True},{'Set-Cookie':'srg='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'})
   if self.path=='/api/reserve':return self.answer(200,f.reserve(d))
   if self.path=='/api/heartbeat':return self.answer(200,f.heartbeat(d))
   if self.path=='/api/telemetry':return self.answer(200,f.telemetry(d))
   if self.path=='/api/stop':
    with f.connect() as c:f.auth_device(c,d);c.execute('UPDATE vehicles SET sharing=0,payload=NULL WHERE device=?',(d['device'],))
    return self.answer(200,{'ok':True})
   if self.path=='/api/release':
    s=self.session()
    if not s or s['role']!='admin':return self.answer(403,{'error':'Tylko administrator'})
    with f.connect() as c:c.execute('DELETE FROM vehicles WHERE number=?',(str(d.get('number','')),))
    return self.answer(200,{'ok':True})
   return self.answer(404,{'error':'Nie znaleziono'})
  except FileExistsError as e:self.answer(409,{'error':str(e)})
  except (ValueError,TypeError,KeyError) as e:self.answer(400,{'error':str(e)})
  except Exception:self.answer(500,{'error':'Błąd serwera'})

def serve(directory,assets,port=8790,host="127.0.0.1"):
 server=ThreadingHTTPServer((host,port),Handler);server.fleet=Fleet(directory);server.assets=Path(assets);server.map_lock=threading.Lock();server.map_cache=None;feed=Path(assets)/'schedules.json';server.schedules=json.loads(feed.read_text(encoding='utf-8-sig')).get('trips',[]) if feed.exists() else [];return server
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--data',required=True);a.add_argument('--assets',required=True);a.add_argument('--port',type=int,default=8790);a.add_argument('--host',default='127.0.0.1');args=a.parse_args();serve(args.data,args.assets,args.port,args.host).serve_forever()
