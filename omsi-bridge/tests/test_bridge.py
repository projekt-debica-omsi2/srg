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
if __name__=='__main__':unittest.main()
