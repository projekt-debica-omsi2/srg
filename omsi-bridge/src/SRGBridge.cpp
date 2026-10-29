#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#include <cstdio>
#include <cmath>
#include <string>
#include <cstdint>

static SRWLOCK lock = SRWLOCK_INIT;
static float values[4]{};
static ULONGLONG seen[4]{};
static HANDLE stopEvent=nullptr,worker=nullptr;
static std::wstring folder;
static std::string session;
static const char* names[]={"Velocity","IBIS_Linie","IBIS_Route","IBIS_Ziel"};
static void publish(bool running) {
    float copy[4]; ULONGLONG stamps[4];
    AcquireSRWLockShared(&lock);
    for(int i=0;i<4;++i){copy[i]=values[i];stamps[i]=seen[i];}
    ReleaseSRWLockShared(&lock);
    auto now=GetTickCount64();
    std::string json="{\"schema\":1,\"session\":\""+session+"\",\"plugin_running\":"+(running?"true":"false")+",\"variables\":{";
    for(int i=0;i<4;++i){
        if(i)json+=",";
        json+="\""+std::string(names[i])+"\":";
        if(running&&stamps[i]&&now-stamps[i]<2000&&std::isfinite(copy[i])) {
            char b[64];sprintf_s(b,"%.6g",copy[i]);json+=b;
        } else json+="null";
    }
    json+="}}";
    auto tmp=folder+L"\\telemetry.tmp",dest=folder+L"\\telemetry.json";
    HANDLE f=CreateFileW(tmp.c_str(),GENERIC_WRITE,0,nullptr,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,nullptr);
    if(f==INVALID_HANDLE_VALUE)return;
    DWORD written=0;BOOL ok=WriteFile(f,json.data(),(DWORD)json.size(),&written,nullptr);CloseHandle(f);
    if(ok&&written==json.size())MoveFileExW(tmp.c_str(),dest.c_str(),MOVEFILE_REPLACE_EXISTING);
}
static DWORD WINAPI loop(void*) {
    while(WaitForSingleObject(stopEvent,250)==WAIT_TIMEOUT)publish(true);
    publish(false);return 0;
}
extern "C" void __stdcall PluginStart(void*) {
    if(worker)return;
    wchar_t base[MAX_PATH];
    if(FAILED(SHGetFolderPathW(nullptr,CSIDL_LOCAL_APPDATA,nullptr,SHGFP_TYPE_CURRENT,base)))return;
    folder=std::wstring(base)+L"\\SRG-OMSI";
    if(!CreateDirectoryW(folder.c_str(),nullptr)&&GetLastError()!=ERROR_ALREADY_EXISTS)return;
    FILETIME ft;GetSystemTimeAsFileTime(&ft);
    session=std::to_string(GetCurrentProcessId())+"-"+std::to_string((uint64_t(ft.dwHighDateTime)<<32)|ft.dwLowDateTime);
    AcquireSRWLockExclusive(&lock);for(int i=0;i<4;++i){seen[i]=0;values[i]=0;}ReleaseSRWLockExclusive(&lock);
    stopEvent=CreateEventW(nullptr,TRUE,FALSE,nullptr);
    if(!stopEvent)return;
    worker=CreateThread(nullptr,0,loop,nullptr,0,nullptr);
    if(!worker){CloseHandle(stopEvent);stopEvent=nullptr;}
}
extern "C" void __stdcall PluginFinalize() {
    if(!worker)return;
    SetEvent(stopEvent);WaitForSingleObject(worker,INFINITE);
    CloseHandle(worker);CloseHandle(stopEvent);worker=nullptr;stopEvent=nullptr;
}
extern "C" void __stdcall AccessVariable(unsigned short index,float* value,unsigned char* write) {
    if(write)*write=0;
    if(index>=4||!value)return;
    AcquireSRWLockExclusive(&lock);values[index]=*value;seen[index]=GetTickCount64();ReleaseSRWLockExclusive(&lock);
}
extern "C" void __stdcall AccessSystemVariable(unsigned short,float*,unsigned char* write){if(write)*write=0;}
extern "C" void __stdcall AccessStringVariable(unsigned short,wchar_t*,unsigned char* write){if(write)*write=0;}
extern "C" void __stdcall AccessTrigger(unsigned short,unsigned char* active){if(active)*active=0;}
