import ctypes as c, json, os, pathlib, time
assert c.sizeof(c.c_void_p)==4, 'Use x86 Python to load the OMSI DLL'
dll=c.WinDLL(str(pathlib.Path('plugins/SRGBridge.dll').resolve()))
dll.PluginStart.argtypes=[c.c_void_p];dll.PluginStart.restype=None
dll.PluginFinalize.argtypes=[];dll.PluginFinalize.restype=None
dll.AccessVariable.argtypes=[c.c_ushort,c.POINTER(c.c_float),c.POINTER(c.c_ubyte)];dll.AccessVariable.restype=None
for name in ['AccessTrigger','AccessSystemVariable','AccessStringVariable']:assert getattr(dll,name)
dll.PluginStart(None)
try:
    v=c.c_float(23.5);write=c.c_ubyte(1)
    dll.AccessVariable(0,c.byref(v),c.byref(write));assert write.value==0 and v.value==23.5
    time.sleep(.6)
    path=pathlib.Path(os.environ['LOCALAPPDATA'])/'SRG-OMSI/telemetry.json'
    data=json.loads(path.read_text());assert data['variables']['Velocity']==23.5;assert data['variables']['IBIS_Linie'] is None
    time.sleep(2.1);data=json.loads(path.read_text());assert data['variables']['Velocity'] is None
finally:dll.PluginFinalize()
assert json.loads(path.read_text())['plugin_running'] is False
print('Native x86 ABI, read-only callback, missing/stale values and shutdown: PASS')
