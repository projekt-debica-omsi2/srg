import importlib.util,unittest,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_rj',ROOT/'tools/prepare_rj.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class UserRJ(unittest.TestCase):
    def test_existing_native_file(self):
        data=(ROOT/'app/src/main/assets/rj261014.011').read_bytes();stops,sections=m.inspect(data);self.assertEqual(len(stops),68);self.assertEqual(stops[0]['id'],1)
    def test_truncated_and_bad_routes(self):
        original=(ROOT/'app/src/main/assets/rj261014.011').read_bytes()
        with self.assertRaises(ValueError):m.inspect(original[:-1])
        data=bytearray(original);stops,sections=m.inspect(data);offset=sections['Vtr'][0];data[offset+27:offset+31]=b'\xff'*4
        with self.assertRaises(ValueError):m.inspect(data)
    def test_empty(self):
        with self.assertRaises(ValueError):m.inspect(b'')
    def test_missing_ambiguous_and_old_project_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            with self.assertRaises(ValueError):m.prepare(folder,require=True)
            data=(ROOT/'app/src/main/assets/rj261014.011').read_bytes()
            (folder/'old.011').write_bytes(data)
            with self.assertRaises(ValueError):m.prepare(folder,require=True)
            (folder/'another.011').write_bytes(data)
            with self.assertRaises(ValueError):m.prepare(folder,require=True)
if __name__=='__main__':unittest.main()
