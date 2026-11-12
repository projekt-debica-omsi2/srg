"""Package only explicit SRG files; never sweep an installed/user game directory."""
import argparse,hashlib,json,struct,zipfile,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ENGINE_SHA='26fd1ad7fb3f4a12025f7c53ff1bf1c25f30e12ce7447c516a758ba542f4ffde'
REVISION='c24a86d0a79f2fb377212d96c0181d7beca9e16d'
SCRIPTS=['common.ps1','setup.ps1','run.ps1','runtime-source.json','README-PL.md','INSTALUJ.cmd','URUCHOM-MOSTEK.cmd','URUCHOM-GRE.cmd','USB.cmd','DIAGNOSTYKA.cmd']
def digest(data):return hashlib.sha256(data).hexdigest()
def machine(data):
 if data[:2]!=b'MZ' or len(data)<64:raise ValueError('Not Windows PE')
 p=struct.unpack_from('<I',data,0x3c)[0]
 if p+6>len(data) or data[p:p+4]!=b'PE\0\0':raise ValueError('Bad PE header')
 return struct.unpack_from('<H',data,p+4)[0]
def build(bridge,engine,output):
 bridge=Path(bridge);engine=Path(engine);output=Path(output)
 if digest(engine.read_bytes())!=ENGINE_SHA:raise ValueError('Wrong engine ZIP SHA256')
 if output.exists() and any(output.iterdir()):raise ValueError('Output must be a fresh empty directory')
 output.mkdir(parents=True,exist_ok=True)
 for name in SCRIPTS:shutil.copy2(ROOT/'omsi-pc'/name,output/name)
 for name in ['SRG-OMSI-Bridge.exe','plugins/SRGBridge.dll','plugins/SRGBridge.opl','plugins/SRGOpenOMSI.lua']:
  src=bridge/name
  if name.endswith(('.dll','.exe')) and machine(src.read_bytes())!=0x14c:raise ValueError('Bridge/plugin must be x86')
  dst=output/'bridge'/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 with zipfile.ZipFile(engine) as z:
  if z.testzip():raise ValueError('Corrupt engine archive')
  if z.read('UPSTREAM-REVISION.txt').decode().strip()!=REVISION:raise ValueError('Wrong engine upstream')
  for name in ['openomsi-srg-camera.exe','openomsi-srg.patch','LICENSE-openOMSI','UPSTREAM-REVISION.txt']:
   data=z.read(name)
   if name.endswith('.exe') and machine(data)!=0x8664:raise ValueError('Camera engine must be x64')
   dst=output/'engine'/name;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data)
 try:commit=subprocess.check_output(['git','-c','safe.directory='+str(ROOT).replace('\\','/'),'rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 except subprocess.CalledProcessError:raise ValueError('Cannot record source commit')
 (output/'SOURCES.md').write_text('# Sources and provenance\n\nSRG source commit: '+commit+'\nhttps://github.com/projekt-debica-omsi2/srg/tree/'+commit+'\n\nCamera engine: GPL-3.0, upstream '+REVISION+' plus included openomsi-srg.patch.\nhttps://github.com/openOMSI-org/openOMSI/tree/'+REVISION+'\nEngine ZIP SHA256: '+ENGINE_SHA+'\n\nRuntime downloaded only by end-user setup: official openOMSI 0.3.45 ZIP, pinned URL/SHA256 in runtime-source.json. No runtime/game-content copied from the author PC.\n\nADB: optional user-installed Google Android Platform Tools; not redistributed.\nhttps://developer.android.com/tools/releases/platform-tools\n',encoding='utf-8')
 files={p.relative_to(output).as_posix():digest(p.read_bytes()) for p in output.rglob('*') if p.is_file()}
 (output/'payload-sha256.json').write_text(json.dumps(files,indent=2)+'\n',encoding='utf-8')
 archive=Path(str(output)+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p in output.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(output).as_posix())
 with zipfile.ZipFile(archive) as z:
  if z.testzip():raise ValueError('Corrupt output ZIP')
  forbidden=['config.json','logs/','downloads/','backups/','engine-runtime/','camera-request.json','.011','.apk']
  for name in z.namelist():
   if any(name==f or name.startswith(f) or name.endswith(f) for f in forbidden):raise ValueError('User data in package: '+name)
 archive.with_suffix('.zip.sha256').write_text(digest(archive.read_bytes())+'  '+archive.name+'\n',encoding='ascii')
 print('Portable PC ZIP:',archive,'files:',len(files)+1)
 return archive
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--bridge',required=True);p.add_argument('--engine',required=True);p.add_argument('--output',required=True);a=p.parse_args();build(a.bridge,a.engine,a.output)
