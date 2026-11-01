import unittest, tempfile, json, time, os, threading, urllib.request, urllib.error
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bridge
class Tests(unittest.TestCase):
    def test_missing_stale_and_stopped(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d); self.assertFalse(bridge.read_telemetry(p)['plugin_running'])
            f=p/'telemetry.json';f.write_text(json.dumps(dict(schema=1,plugin_running=True,session='test',variables={'Velocity':12})))
            self.assertTrue(bridge.read_telemetry(p)['plugin_running'])
            self.assertFalse(bridge.read_telemetry(p, time.time()+10)['plugin_running'])
            f.write_text('{');self.assertFalse(bridge.read_telemetry(p)['plugin_running'])
            f.write_text(json.dumps(dict(schema=1,plugin_running=False)));self.assertFalse(bridge.read_telemetry(p)['plugin_running'])
    def test_auth_endpoint_and_capabilities(self):
        with tempfile.TemporaryDirectory() as d:
            s=bridge.State(Path(d));server=bridge.ThreadingHTTPServer(('127.0.0.1',0),bridge.handler(s))
            t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
            url='http://127.0.0.1:%s/api/status'%server.server_port
            try:
                with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(url)
                self.assertEqual(e.exception.code,401)
                req=urllib.request.Request(url,headers={'Authorization':'Bearer '+s.token})
                data=json.load(urllib.request.urlopen(req));self.assertFalse(data['capabilities']['cameras']);self.assertFalse(data['plugin_running'])
                self.assertNotIn(s.token,s.log_path.read_text())
                req=urllib.request.Request(url+'/../secret',headers={'Authorization':'Bearer '+s.token})
                with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(req)
                self.assertEqual(e.exception.code,404)
            finally:server.shutdown();server.server_close();t.join()
    def test_wifi_pin_rate_limit_and_usb_isolation(self):
        with tempfile.TemporaryDirectory() as d:
            state=bridge.State(Path(d))
            self.assertRegex(state.token, r'^[0-9]{4}$')
            for usb in (False, True):
                server=bridge.ThreadingHTTPServer(('127.0.0.1',0), bridge.handler(state,usb=usb))
                thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
                url=f'http://127.0.0.1:{server.server_port}/api/status'
                try:
                    if usb:
                        self.assertEqual(urllib.request.urlopen(url).status,200)
                    else:
                        for _ in range(5):
                            with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(url)
                            self.assertEqual(e.exception.code,401)
                        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(url)
                        self.assertEqual(e.exception.code,429)
                finally:
                    server.shutdown();server.server_close();thread.join()
    def test_rich_route_chunks_freshness_and_bad_packets(self):
        with tempfile.TemporaryDirectory() as d:
            state=bridge.State(Path(d))
            def send(**fields): state.ingest(json.dumps(dict(schema=2,session='run',route='76|2|1',**fields)))
            send(kind='status',variables={'Velocity':12},game='openomsi',duty={'line':'76'},position={'x':0,'y':1})
            send(kind='stops',part=2,total=2,stops=[{'number':2,'name':'B'}])
            self.assertEqual(state.status()['stops'],[])
            send(kind='stops',part=1,total=2,stops=[{'number':1,'name':'A'}])
            result=state.status();self.assertEqual([s['name'] for s in result['stops']],['A','B'])
            self.assertTrue(result['capabilities']['timetable']);self.assertTrue(result['capabilities']['position'])
            for packet in ['[]','{','{"schema":2,"variables":NaN}']:
                state.ingest(packet)
            state.rich_seen-=4
            self.assertFalse(state.status()['plugin_running'])
            send(kind='status',variables={},duty=None,position={})
            state.ingest(json.dumps(dict(schema=2,kind='status',session='new',route='new',variables={})))
            self.assertEqual(state.status()['stops'],[])
    def test_commands_are_bound_to_known_game_folder_and_catalog(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            state=bridge.State(Path(d)/'state')
            folder=Path(d)/'Programs/openOMSI/Plugins/SRGOpenOMSI.data'
            state.ingest(json.dumps(dict(schema=2,kind='status',session='test',route='r',game='openomsi',commands=True,variables={},files_dir=str(folder))))
            state.catalog=[dict(line='76',tour='1')]
            with patch.dict(os.environ,{'LOCALAPPDATA':d}):
                response=state.command(dict(action='select_duty',line='76',tour='1',trip=11))
                record=json.loads((folder/'command.json').read_text())
                self.assertEqual(record['session'],'test');self.assertEqual(record['id'],response['id'])
                self.assertEqual(record['trip'],11)
                for invalid in [dict(action='shell'),dict(action='select_duty',line='bad',tour='1',trip=1),dict(action='skip_to',stop=-1)]:
                    with self.assertRaises(ValueError):state.command(invalid)
                state.rich['files_dir']=str(Path(d)/'somewhere')
                with self.assertRaises(ValueError):state.command(dict(action='sync_signs'))
    def test_map_or_vehicle_change_clears_previous_route_and_catalog(self):
        with tempfile.TemporaryDirectory() as d:
            state=bridge.State(Path(d))
            for map_name,vehicle in [('Map A','bus-a.bus'),('Map B','bus-a.bus'),('Map B','bus-b.bus')]:
                state.ingest(json.dumps(dict(schema=2,kind='status',session='same',route='same',map=map_name,vehicle={'file':vehicle},variables={})))
                self.assertEqual(state.status()['stops'],[])
                self.assertEqual(state.status()['catalog'],[])
                state.route_stops=[{'name':'previous stop'}];state.catalog=[{'line':'old'}]
if __name__=='__main__':unittest.main()
