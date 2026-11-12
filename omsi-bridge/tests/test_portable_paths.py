import json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import bridge
class PortablePaths(unittest.TestCase):
 def test_explicit_custom_library_allowed_without_accepting_packet_paths(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);folder=root/'Library with spaces/OMSI 2/plugins/SRGOpenOMSI.data'
   state=bridge.State(root/'bridge',allowed_plugin_dirs=[folder])
   state.ingest(json.dumps(dict(schema=2,kind='status',session='test',route='r',game='openomsi',commands=True,variables={},files_dir=str(folder))))
   state.command(dict(action='sync_signs'))
   self.assertTrue((folder/'command.json').is_file())
   state.rich['files_dir']=str(root/'arbitrary')
   with self.assertRaises(ValueError):state.command(dict(action='sync_signs'))
   self.assertFalse((root/'arbitrary').exists())
if __name__=='__main__':unittest.main()
