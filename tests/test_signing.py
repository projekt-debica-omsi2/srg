import contextlib, importlib.util, io, os, runpy, unittest, re, json
from unittest.mock import patch
from pathlib import Path
class SigningChecks(unittest.TestCase):
 def verify(self, certificate='ab'*32, package='pl.srgmobile.classic.lcd23', code=None):
  if code is None:code=re.search(r'versionCode\s+(\d+)',Path('app/build.gradle').read_text()).group(1)
  name=re.search(r"versionName\s+'([^']+)'",Path('app/build.gradle').read_text()).group(1)
  with patch.dict(os.environ, {'ANDROID_HOME':'/sdk','SRG_SIGNING_CERT_SHA256':'ab'*32}), patch('subprocess.check_output',side_effect=[f'Signer #1 certificate SHA-256 digest: {certificate}',f"package: name='{package}' versionCode='{code}' versionName='{name}'"]),contextlib.redirect_stdout(io.StringIO()):runpy.run_path('tools/verify_release.py',run_name='__main__')
 def test_correct_apk(self):self.verify()
 def test_different_certificate(self):
  with self.assertRaises(SystemExit):self.verify(certificate='cd'*32)
 def test_wrong_package(self):
  with self.assertRaises(SystemExit):self.verify(package='other.app')
 def test_wrong_version(self):
  with self.assertRaises(SystemExit):self.verify(code='11464')
 def test_do_not_overwrite_existing_signing_secrets(self):
  spec=importlib.util.spec_from_file_location('setup_signing','tools/setup_signing.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  responses=[b'',json.dumps([{'name':k} for k in m.KEYS]).encode()]
  with patch.object(m.shutil,'which',return_value='/tool'),patch.object(m,'run',side_effect=responses) as calls,contextlib.redirect_stdout(io.StringIO()):m.main()
  self.assertEqual(calls.call_count,2)
  self.assertFalse(any('set' in c.args[0] for c in calls.call_args_list))
if __name__=='__main__':unittest.main()
