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
        self.token = secrets.token_hex(12)
        self.lock = threading.Lock()
        self.session = None
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
    def status(self):
        data = read_telemetry(self.root)
        return dict(schema=1, computer=socket.gethostname(), **{k:data.get(k) for k in ('session','plugin_running','variables')},
                    capabilities=dict(timetable=False, position=False, announcements=False, cameras=False, mirror=False),
                    events=list(self.events))
    def monitor(self, stop):
        while not stop.wait(.5):
            data = read_telemetry(self.root)
            sid = data.get('session') if data.get('plugin_running') else None
            if sid != self.session:
                if self.session:
                    self.event('telemetry_contact_lost', session=self.session)
                if sid:
                    self.event('telemetry_contact_started', session=sid)
                self.session = sid

def handler(state):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log credentials or request headers.
        def do_GET(self):
            auth = self.headers.get('Authorization', '')
            if not secrets.compare_digest(auth, 'Bearer ' + state.token):
                self.send_error(401); return
            if self.path != '/api/status':
                self.send_error(404); return
            body = json.dumps(state.status(), ensure_ascii=False, allow_nan=False).encode('utf-8')
            self.send_response(200)
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
    server = ThreadingHTTPServer(('0.0.0.0', 8765), handler(state))
    thread = threading.Thread(target=state.monitor, args=(stop,), daemon=True)
    thread.start()
    print('SRG OMSI Bridge 0.1 — odczyt danych; nie pelna integracja tras i kamer.')
    print('Komputer:', socket.gethostname())
    addresses = sorted(set(socket.gethostbyname_ex(socket.gethostname())[2]))
    print('Wi-Fi: w aplikacji wpisz IPv4 komputera:', ', '.join(addresses))
    print('USB: uruchom USB.cmd, w aplikacji wybierz USB (127.0.0.1).')
    print('Kod parowania:', state.token)
    print('Logi:', state.root)
    print('Pozwol na dostep w Zaporze Windows tylko w sieci prywatnej. Ctrl+C konczy.')
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set(); server.server_close(); thread.join(timeout=2)
        state.event('bridge_stopped')
if __name__ == '__main__':
    main()
