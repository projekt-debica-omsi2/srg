import unittest, tempfile, importlib.util, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('public_assets',ROOT/'tools/prepare_public.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PublicAssets(unittest.TestCase):
 def test_public_contains_no_driver_data(self):
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp);m.prepare(out);names={p.name for p in out.iterdir()}
   self.assertFalse(any(n.endswith('.011') for n in names))
   audio=[p.relative_to(out).as_posix() for p in out.rglob('*.mp3')]
   self.assertEqual(set(audio),set(m.GENERIC_AUDIO))
   self.assertNotIn('bundled-rj.js',names);self.assertNotIn('reviewed-gps.js',names);self.assertNotIn('rg-replay-data.js',names)
   h=(out/'index.html').read_text(encoding='utf-8')
   self.assertIn('const MANUAL_DUTIES=[];',h);self.assertIn("const BUILTIN_RJ_B64='';",h)
   self.assertNotIn('BRZEZINY BERDECHÓW',h)
   for src in re.findall(r'(?:src|href)="([^"]+)"',h):
    if not src.startswith(('http','#')):self.assertTrue((out/src).exists(),src)
   self.assertIn('public:true',(out/'edition.js').read_text())
 def test_common_omsi_module_identical(self):
  with tempfile.TemporaryDirectory() as tmp:
   m.prepare(tmp)
   for name in ['omsi.js','ibis.js','rg-usb.js','lcd.html']:
    self.assertEqual((Path(tmp)/name).read_bytes(),(m.ASSETS/name).read_bytes())
if __name__=='__main__':unittest.main()
