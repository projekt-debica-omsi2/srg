"""SRG OMSI LAN bridge. Read-only, token-authenticated; no external dependencies."""
import datetime as dt
import json
import os
from pathlib import Path
import secrets
import socket
import threading
import time
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
    def __init__(self, root=ROOT):
        self.root = root
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
                    if self.rich is None or key != (self.rich['session'], self.rich['route']):
                        self.parts = {}; self.route_stops = []
                    if self.rich is None or data['session']!=self.rich['session']:
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
        return dict(schema=1, computer=socket.gethostname(), **{k:data.get(k) for k in ('session','plugin_running','variables','game','map','clock','paused','duty','position','distance','stops','route','commands','command_result','catalog','trips','trip_key','vehicle_number')},
                    capabilities=dict(timetable=bool(data.get('duty')), position=bool(data.get('position',{}).get('x') is not None), announcements=False, cameras=False, mirror=False),
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
    state = State()
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
    print('SRG OMSI Bridge 0.4 — odczyt danych; nie pelna integracja tras i kamer.')
    print('Komputer:', socket.gethostname())
    addresses = sorted(set(socket.gethostbyname_ex(socket.gethostname())[2]))
    print('Wi-Fi: w aplikacji wpisz IPv4 komputera:', ', '.join(addresses))
    print('USB: uruchom USB.cmd, w aplikacji wybierz USB bez kodu (127.0.0.1:8766).')
    print('Kod parowania:', state.token)
    print('Logi:', state.root)
    print('Pozwol na dostep w Zaporze Windows tylko w sieci prywatnej. Ctrl+C konczy.')
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set(); udp.close(); receiver.join(timeout=2); server.server_close(); usb_server.shutdown(); usb_server.server_close(); usb_thread.join(timeout=2); thread.join(timeout=2)
        state.event('bridge_stopped')
if __name__ == '__main__':
    main()
