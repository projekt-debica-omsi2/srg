"""SRG OMSI LAN bridge. Read-only, token-authenticated; no external dependencies."""
import datetime as dt
import base64
import re
import json
import os
from pathlib import Path
import secrets
import socket
import threading
import time
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'SRG-OMSI'
NAMES = ('Velocity', 'IBIS_Linie', 'IBIS_Route', 'IBIS_Ziel')

def read_telemetry(root=ROOT, now=None):
    now = time.time() if now is None else now
    empty = dict(plugin_running=False, session=None, variables={k: None for k in NAMES})
    try:
        path = root / 'telemetry.json'
        if now - path.stat().st_mtime > 3:
            return empty
        data = json.loads(path.read_text(encoding='utf-8'))
        if data.get('schema') != 1 or not data.get('plugin_running'):
            return empty
        return data
    except (OSError, ValueError, AttributeError):
        return empty

class State:
    def __init__(self, root=ROOT, allowed_plugin_dirs=()):
        self.root = root
        self.allowed_plugin_dirs = tuple(Path(p).resolve() for p in allowed_plugin_dirs)
        root.mkdir(parents=True, exist_ok=True)
        self.token = f'{secrets.randbelow(10000):04d}'
        self.auth_failures = []
        self.lock = threading.Lock()
        self.session = None
        self.rich = None
        self.rich_seen = 0
        self.parts = {}
        self.route_stops = []
        self.catalog = []
        self.trips = []
        self.trip_key = None
        self.camera_seen = 0
        self.camera_feeds = []
        self.list_parts = {}
        self.events = []
        self.log_path = root / ('bridge-' + dt.datetime.now().strftime('%Y%m%d-%H%M%S') + '.jsonl')
        self.event('bridge_started')
    def event(self, kind, **fields):
        record = dict(time=dt.datetime.now().astimezone().isoformat(), event=kind, **fields)
        with self.lock:
            self.events.append(record)
            self.events = self.events[-200:]
            with self.log_path.open('a', encoding='utf-8') as f:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
    def ingest(self, packet):
        try:
            data = json.loads(packet, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            if data.get('schema') != 2 or not isinstance(data.get('session'), str): return
            if len(data['session']) > 200 or not isinstance(data.get('route'), str): return
            key = (data['session'], data['route'])
            with self.lock:
                if data.get('kind') in ('catalog','trips'):
                    if not self.rich or data['session'] != self.rich['session']: return
                    part, total, items = data.get('part'), data.get('total'), data.get('stops')
                    if type(part) is not int or type(total) is not int or not 1 <= part <= total <= 100: return
                    if not isinstance(items,list) or len(items)>10 or not all(isinstance(i,dict) for i in items): return
                    slot=data['kind']
                    entry=self.list_parts.get(slot)
                    if entry is None or entry['key']!=key or entry['total']!=total:
                        entry={'key':key,'total':total,'parts':{}};self.list_parts[slot]=entry
                    entry['parts'][part]=items
                    if all(i in entry['parts'] for i in range(1,total+1)):
                        result=[v for i in range(1,total+1) for v in entry['parts'][i]]
                        if slot=='catalog': self.catalog=result
                        else: self.trips=result;self.trip_key=data['route']
                elif data.get('kind') == 'status':
                    if not isinstance(data.get('variables'), dict): return
                    context_changed=self.rich is None or data.get('map')!=self.rich.get('map') or (data.get('vehicle') or {}).get('file')!=(self.rich.get('vehicle') or {}).get('file')
                    if context_changed or key != (self.rich['session'], self.rich['route']):
                        self.parts = {}; self.route_stops = []
                    if context_changed or data['session']!=self.rich['session']:
                        self.catalog=[];self.trips=[];self.trip_key=None;self.list_parts={}
                    self.rich = data; self.rich_seen = time.monotonic()
                elif data.get('kind') == 'stops' and self.rich and key == (self.rich['session'], self.rich['route']):
                    part, total, stops = data.get('part'), data.get('total'), data.get('stops')
                    if type(part) is not int or type(total) is not int or not 1 <= part <= total <= 100: return
                    if not isinstance(stops, list) or len(stops) > 10 or not all(isinstance(s,dict) for s in stops): return
                    self.parts[part] = stops
                    if all(i in self.parts for i in range(1, total+1)):
                        self.route_stops = [s for i in range(1,total+1) for s in self.parts[i]]
        except (ValueError, TypeError, AttributeError):
            return
    @staticmethod
    def camera_channel(channel):
        return type(channel) is int and (0 <= channel <= 3 or 16 <= channel < 272)
    def camera_request(self, channels):
        temp=self.root/'camera-request.tmp'
        with self.lock:
            temp.write_text(json.dumps(dict(channel=channels[0],channels=channels,updated=time.time())),encoding='utf-8')
            temp.replace(self.root/'camera-request.json')
    def camera_frame(self, channel):
        now=time.time()
        empty=dict(schema=1,channel=channel,image=None,source=None,error='Oczekiwanie na niezależną kamerę z testowej wersji openOMSI.')
        try:
            meta_file=self.root/f'camera-{channel}.json'
            if meta_file.stat().st_size>65536: return empty
            meta=json.loads(meta_file.read_text(encoding='utf-8'))
            updated=meta.get('updated')
            if not isinstance(updated,(float,int)) or not -1 <= now-updated <= 2 or meta.get('channel')!=channel: return empty
            feeds=meta.get('feeds')
            if isinstance(feeds,list) and len(feeds)<=257:
                self.camera_feeds=[dict(channel=f['channel'],label=str(f.get('label','Kamera'))[:100]) for f in feeds if isinstance(f,dict) and self.camera_channel(f.get('channel'))]
            elif isinstance(meta.get('available'),list):
                labels={3:'Lusterko wewnętrzne',0:'Wnętrze',1:'Lewe lusterko',2:'Prawe lusterko'}
                self.camera_feeds=[dict(channel=c,label=labels.get(c,f'Kamera / lusterko {c-15}')) for c in [3,0,1,2]+list(range(16,272)) if c in meta['available']]
            if meta.get('error'): return dict(empty,error=str(meta['error'])[:300])
            path=self.root/f'camera-{channel}.jpg'
            if path.stat().st_size>160000: return empty
            jpeg=path.read_bytes()
            if not jpeg.startswith(b'\xff\xd8') or not jpeg.endswith(b'\xff\xd9'): return empty
            self.camera_seen=time.monotonic()
            return dict(schema=1,channel=channel,updated=updated,source=str(meta.get('source','Kamera'))[:120],error=None,image='data:image/jpeg;base64,'+base64.b64encode(jpeg).decode('ascii'))
        except (OSError,ValueError,TypeError,AttributeError): return empty
    def camera(self, channel):
        if not self.camera_channel(channel): raise ValueError('Unknown camera')
        self.camera_request([channel]);return self.camera_frame(channel)
    def camera_page(self, page):
        if type(page) is not int or not 0<=page<=256: raise ValueError('Unknown camera page')
        # Ask for discovery while no renderer metadata is available yet.
        if not self.camera_feeds:
            self.camera_request([3,0,1,2])
            for channel in (3,0,1,2): self.camera_frame(channel)
        total=len(self.camera_feeds);pages=max(1,(total+3)//4);page=min(page,pages-1)
        feeds=self.camera_feeds[page*4:page*4+4]
        if feeds: self.camera_request([f['channel'] for f in feeds])
        frames=[self.camera_frame(f['channel']) for f in feeds]
        return dict(schema=1,page=page,pages=pages,total=total,feeds=feeds,frames=frames,error=None if total else 'Oczekiwanie na listę kamer z testowej wersji openOMSI')
    def command(self, command):
        data=self.telemetry()
        if not data.get('commands') or data.get('game')!='openomsi': raise ValueError('Gra nie udostępnia sterowania')
        action=command.get('action')
        if action not in ('preview','select_duty','sync_signs','skip_to'): raise ValueError('Nieznane polecenie')
        safe=dict(action=action,session=data['session'],id=secrets.token_hex(8))
        if action in ('preview','select_duty'):
            for key in ('line','tour'):
                value=command.get(key)
                if not isinstance(value,str) or not 1<=len(value)<=80: raise ValueError('Niepoprawna linia lub brygada')
                safe[key]=value
            if not any(str(c.get('line'))==safe['line'] and str(c.get('tour'))==safe['tour'] for c in self.catalog): raise ValueError('Wybierz brygadę z gry')
        if action in ('select_duty','skip_to'):
            key='trip' if action=='select_duty' else 'stop';value=command.get(key)
            if type(value) is not int or not 1<=value<=10000: raise ValueError('Niepoprawny numer kursu/przystanku')
            safe[key]=value
        if action=='select_duty': safe['align_time']=command.get('align_time') is True
        base=Path(os.environ.get('LOCALAPPDATA',str(Path.home())))
        candidates=[base/'Programs/openOMSI/Plugins/SRGOpenOMSI.data',Path(os.environ.get('ProgramFiles(x86)',r'C:\Program Files (x86)'))/'Steam/steamapps/common/OMSI 2/plugins/SRGOpenOMSI.data']
        candidates.extend(self.allowed_plugin_dirs)
        reported=str(Path(data.get('files_dir','')).resolve()).casefold()
        folder=next((p for p in candidates if str(p.resolve()).casefold()==reported),None)
        if folder is None: raise ValueError('Nieznany katalog dodatku openOMSI')
        folder.mkdir(parents=True,exist_ok=True)
        temp=folder/'command.tmp';target=folder/'command.json'
        with self.lock:
            temp.write_text(json.dumps(safe),encoding='utf-8');temp.replace(target)
        return dict(schema=1,queued=True,id=safe['id'])
    def receive(self, stop, sock):
        sock.settimeout(.5)
        while not stop.is_set():
            try:
                packet, _ = sock.recvfrom(8193)
                if len(packet) <= 8192: self.ingest(packet)
            except socket.timeout: pass
            except OSError: break
    def telemetry(self):
        with self.lock:
            if self.rich and time.monotonic() - self.rich_seen <= 3:
                return dict(self.rich, plugin_running=True, stops=list(self.route_stops),catalog=list(self.catalog),trips=list(self.trips),trip_key=self.trip_key)
        return read_telemetry(self.root)
    def status(self):
        data = self.telemetry()
        return dict(schema=1, computer=socket.gethostname(), **{k:data.get(k) for k in ('session','plugin_running','variables','game','map','clock','paused','duty','position','distance','stops','route','commands','command_result','catalog','trips','trip_key','vehicle_number','vehicle','game_version')},
                    capabilities=dict(timetable=bool(data.get('duty')), position=bool(data.get('position',{}).get('x') is not None), announcements=False, cameras=time.monotonic()-self.camera_seen<3, mirror=time.monotonic()-self.camera_seen<3),
                    events=list(self.events))
    def monitor(self, stop):
        while not stop.wait(.5):
            data = self.telemetry()
            sid = data.get('session') if data.get('plugin_running') else None
            if sid != self.session:
                if self.session:
                    self.event('telemetry_contact_lost', session=self.session)
                if sid:
                    self.event('telemetry_contact_started', session=sid)
                self.session = sid

def handler(state, usb=False):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log credentials or request headers.
        def authorized(self):
            auth = self.headers.get('Authorization', '')
            if not usb:
                now = time.monotonic()
                with state.lock:
                    state.auth_failures = [t for t in state.auth_failures if now - t < 60]
                    limited = len(state.auth_failures) >= 5
                    valid = secrets.compare_digest(auth, 'Bearer ' + state.token)
                    if not valid and not limited:
                        state.auth_failures.append(now)
                if limited:
                    self.send_error(429); return False
                if not valid:
                    self.send_error(401); return False
            return True
        def do_POST(self):
            if not self.authorized(): return
            if self.path != '/api/command': self.send_error(404); return
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0 < length <= 2048: raise ValueError('Rozmiar polecenia')
                command=json.loads(self.rfile.read(length))
                result=state.command(command)
            except (ValueError,TypeError,AttributeError) as e:
                self.json_response(dict(schema=1,error=str(e)),400); return
            self.json_response(result)
        def do_GET(self):
            if not self.authorized(): return
            page=re.fullmatch(r'/api/cameras/page/([0-9]{1,3})',self.path)
            if page:
                try: self.json_response(state.camera_page(int(page.group(1))))
                except ValueError: self.json_response(dict(schema=1,error='Unknown camera page'),400)
                return
            camera=re.fullmatch(r'/api/camera/([0-9]{1,3})',self.path)
            if camera:
                try: self.json_response(state.camera(int(camera.group(1))))
                except ValueError: self.json_response(dict(schema=1,error='Unknown camera'),400)
                return
            if self.path != '/api/status':
                self.send_error(404); return
            self.json_response(state.status())
        def json_response(self, result, status=200):
            body = json.dumps(result, ensure_ascii=False, allow_nan=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        def setup(self):
            super().setup()
            self.connection.settimeout(3)
    return Handler

def main():
    parser=argparse.ArgumentParser(description='SRGMobile / SRGMobile Public: wspolny mostek OMSI')
    parser.add_argument('--omsi-root',type=Path,help='Wlasny folder OMSI 2: takze inny dysk lub biblioteka Steam')
    args=parser.parse_args()
    allowed=[]
    if args.omsi_root:
        folder=args.omsi_root.resolve()
        if not (folder/'maps').is_dir() or not (folder/'Vehicles').is_dir():parser.error('Folder OMSI musi zawierac maps i Vehicles')
        allowed=[folder/'plugins/SRGOpenOMSI.data']
    state = State(allowed_plugin_dirs=allowed)
    stop = threading.Event()
    udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp.bind(('127.0.0.1', 47851))
    receiver = threading.Thread(target=state.receive, args=(stop, udp), daemon=True)
    receiver.start()
    server = ThreadingHTTPServer(('0.0.0.0', 8765), handler(state))
    usb_server = ThreadingHTTPServer(('127.0.0.1', 8766), handler(state, usb=True))
    usb_thread = threading.Thread(target=usb_server.serve_forever, daemon=True)
    usb_thread.start()
    thread = threading.Thread(target=state.monitor, args=(stop,), daemon=True)
    thread.start()
    print('SRG OMSI Bridge 0.8 — SRGMobile i SRGMobile Public')
    if args.omsi_root: print('Folder OMSI:',args.omsi_root.resolve())
    print('Komputer:', socket.gethostname())
    try: addresses = sorted(set(socket.gethostbyname_ex(socket.gethostname())[2]))
    except OSError: addresses = []
    if not addresses: addresses=['sprawdz IPv4 w ustawieniach sieci Windows']
    print('Wi-Fi: w aplikacji wpisz IPv4 komputera:', ', '.join(addresses))
    print('USB: uruchom USB.cmd, w aplikacji wybierz USB bez kodu (127.0.0.1:8766).')
    print('Kod parowania:', state.token)
    print('Logi:', state.root)
    print('Pozwol na dostep w Zaporze Windows tylko w sieci prywatnej. Ctrl+C konczy.',flush=True)
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set(); udp.close(); receiver.join(timeout=2); server.server_close(); usb_server.shutdown(); usb_server.server_close(); usb_thread.join(timeout=2); thread.join(timeout=2)
        state.event('bridge_stopped')
if __name__ == '__main__':
    try: main()
    except OSError as error: raise SystemExit('Nie uruchomiono mostka: '+str(error)+'. Sprawdz uprawnienia folderu i czy porty 8765, 8766 lub 47851 nie sa zajete przez inny mostek.')
