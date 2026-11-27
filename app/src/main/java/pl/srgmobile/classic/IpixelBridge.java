package pl.srgmobile.classic;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import org.json.*;
import java.util.*;

/** Optional BLE display; never touches audio profiles, pairing or fleet consent. */
final class IpixelBridge implements AutoCloseable {
    private static UUID uuid(String id){return UUID.fromString(id+"-0000-1000-8000-00805f9b34fb");}
    private static final UUID SERVICE=uuid("000000fa"),WRITE=uuid("0000fa02"),NOTIFY=uuid("0000fa03"),CCC=uuid("00002902");
    private final Context context;
    private java.lang.ref.WeakReference<Activity> activity;
    void attach(Activity a){activity=new java.lang.ref.WeakReference<>(a);}
    private final LedCycle cycle=new LedCycle();
    private long reconnectAt=0;
    private final SharedPreferences prefs;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Map<String,String> devices=new LinkedHashMap<>();
    private BluetoothGatt gatt;private BluetoothGattCharacteristic writer;
    private BluetoothLeScanner scanner;private int chunkSize=20,offset=0,page=0;
    private byte[] packet;private boolean ready=false,waitingAck=false,closed=false;
    private int retries=0;
    private long txSerial=0;private long nextPage=0;private String shown="",courseKey="",status="Wyłączona",deviceInfo="";
    private volatile JSONObject lcd=new JSONObject();
    IpixelBridge(Activity activity){this.context=activity.getApplicationContext();attach(activity);prefs=context.getSharedPreferences("ipixel",Context.MODE_PRIVATE);handler.post(tick);if(prefs.getBoolean("enabled",false)&&!prefs.getString("address","").isEmpty())handler.postDelayed(()->connect(prefs.getString("address","")),1500);}
    private BluetoothAdapter adapter(){BluetoothManager m=(BluetoothManager)context.getSystemService(Context.BLUETOOTH_SERVICE);return m==null?null:m.getAdapter();}
    private boolean permitted(){return Build.VERSION.SDK_INT<31||context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED&&context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED;}
    @JavascriptInterface public void requestAccess(){handler.post(()->{Activity a=activity.get();if(a==null)return;if(Build.VERSION.SDK_INT>=31&&!permitted())a.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},731);else if(Build.VERSION.SDK_INT<31&&context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)a.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION},731);});}
    @JavascriptInterface public String state(){try{JSONObject j=new JSONObject();j.put("enabled",prefs.getBoolean("enabled",false));j.put("seconds",prefs.getInt("seconds",5));j.put("address",prefs.getString("address",""));j.put("status",status);j.put("connected",ready);j.put("text",shown);j.put("info",deviceInfo);j.put("access",permitted());JSONArray a=new JSONArray();synchronized(devices){for(Map.Entry<String,String> e:devices.entrySet())a.put(new JSONObject().put("address",e.getKey()).put("name",e.getValue()));}j.put("devices",a);return j.toString();}catch(Exception e){return "{}";}}
    @JavascriptInterface public void configure(boolean enabled,int seconds){prefs.edit().putBoolean("enabled",enabled).putInt("seconds",seconds==10?10:5).apply();handler.post(()->{nextPage=0;try{LedDisplayService.enabled(context,enabled&&permitted());}catch(Exception e){status="Usługa LED: "+e.getMessage();}if(!enabled){disconnect();status="Wyłączona";}else status="Wybierz tablicę i połącz";});}
    @JavascriptInterface public void scan(){handler.post(()->{try{if(!permitted()){status="Przyznaj dostęp Bluetooth";return;}BluetoothAdapter a=adapter();if(a==null||!a.isEnabled()){status="Włącz Bluetooth na urządzeniu";return;}stopScan();synchronized(devices){devices.clear();}scanner=a.getBluetoothLeScanner();scanner.startScan(scanCallback);status="Szukam tablic przez 10 sekund…";handler.postDelayed(this::stopScan,10000);}catch(Exception e){status="Skanowanie: "+e.getMessage();}});}
    private final ScanCallback scanCallback=new ScanCallback(){@Override public void onScanResult(int type,ScanResult result){BluetoothDevice d=result.getDevice();String name=result.getScanRecord()==null?null:result.getScanRecord().getDeviceName();List<android.os.ParcelUuid> services=result.getScanRecord()==null?null:result.getScanRecord().getServiceUuids();if(name!=null&&(name.toUpperCase(Locale.ROOT).contains("LED")||name.toLowerCase(Locale.ROOT).contains("ipixel"))||services!=null&&services.contains(new android.os.ParcelUuid(SERVICE))){synchronized(devices){devices.put(d.getAddress(),name==null?"Tablica iPixel":name);}}}@Override public void onScanFailed(int code){status="Błąd skanowania "+code;}};
    private void stopScan(){if(scanner!=null){try{scanner.stopScan(scanCallback);}catch(Exception ignored){}scanner=null;}}
    @JavascriptInterface public void connect(String address){handler.post(()->{if(!prefs.getBoolean("enabled",false)){status="Najpierw włącz tablicę";return;}try{if(!permitted()){status="Brak dostępu Bluetooth";return;}stopScan();disconnect();BluetoothAdapter a=adapter();if(a==null||!a.isEnabled()){status="Bluetooth wyłączony";return;}BluetoothDevice d=a.getRemoteDevice(address);prefs.edit().putString("address",address).apply();status="Łączenie z tablicą…";LedDisplayService.enabled(context,true);gatt=d.connectGatt(context,false,callback,BluetoothDevice.TRANSPORT_LE);BluetoothGatt attempt=gatt;handler.postDelayed(()->{if(!ready&&gatt==attempt){status="Nie połączono. Zamknij iPixel i spróbuj ponownie.";disconnect();}},15000);}catch(Exception e){status="Połączenie: "+e.getMessage();}});}
    @JavascriptInterface public void test(){handler.post(()->{testUntil=System.currentTimeMillis()+15000;send("SRG TEST — DĘBICA");});}
    void publish(String json){try{lcd=new JSONObject(json);}catch(Exception ignored){}}
    boolean enabled(){return prefs.getBoolean("enabled",false);}
    private final BluetoothGattCallback callback=new BluetoothGattCallback(){
        @Override public void onConnectionStateChange(BluetoothGatt g,int code,int state){handler.post(()->{if(g!=gatt)return;if(code==BluetoothGatt.GATT_SUCCESS&&state==BluetoothProfile.STATE_CONNECTED){status="Odczytywanie usług…";g.discoverServices();}else{android.util.Log.i("SRG-iPixel","DISCONNECTED code="+code+" state="+state);status="Rozłączono ("+code+") — ponawiam połączenie";disconnect();retry();}});}
        @Override public void onServicesDiscovered(BluetoothGatt g,int code){handler.post(()->{if(g!=gatt)return;BluetoothGattService s=g.getService(SERVICE);BluetoothGattCharacteristic n=s==null?null:s.getCharacteristic(NOTIFY);writer=s==null?null:s.getCharacteristic(WRITE);if(code!=0||writer==null||n==null){status="To urządzenie nie udostępnia protokołu iPixel";disconnect();return;}g.setCharacteristicNotification(n,true);BluetoothGattDescriptor d=n.getDescriptor(CCC);if(d==null){status="Brak powiadomień tablicy";disconnect();return;}d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);if(!g.writeDescriptor(d)){status="Nie włączono odpowiedzi tablicy";disconnect();}});}
        @Override public void onDescriptorWrite(BluetoothGatt g,BluetoothGattDescriptor d,int code){handler.post(()->{if(g!=gatt)return;if(code!=0){status="Błąd odpowiedzi Bluetooth "+code;disconnect();return;}if(!g.requestMtu(512))connected();});}
        @Override public void onMtuChanged(BluetoothGatt g,int mtu,int code){handler.post(()->{if(g!=gatt)return;if(code==0)chunkSize=Math.min(180,Math.max(20,mtu-3));connected();});}
        @Override public void onCharacteristicWrite(BluetoothGatt g,BluetoothGattCharacteristic c,int code){handler.post(()->{if(g!=gatt||packet==null)return;if(code!=0||offset>=packet.length)android.util.Log.i("SRG-iPixel","WRITE status="+code+" offset="+offset+" total="+packet.length);if(code!=0){packet=null;waitingAck=false;status="Błąd zapisu BLE "+code;return;}handler.postDelayed(()->writeNext(),12);});}
        @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic c){byte[] b=c.getValue().clone();handler.post(()->{if(g!=gatt)return;android.util.Log.i("SRG-iPixel","RX "+hex(b));if(b.length>=5&&b[2]==1&&(b[3]&255)==128){int type=b[4]&255;deviceInfo="Typ matrycy "+type;}if(b.length>=5&&(b[2]==8&&(b[3]&255)==128||b[2]==0&&b[3]==1||b[2]==2&&b[3]==0)){if((b[b.length-1]&255)==1||(b[b.length-1]&255)==3){waitingAck=false;status="Połączono — tablica potwierdziła odbiór";}else{waitingAck=false;status="Tablica zgłosiła błąd: "+hex(b);}}});}
    };
    private static String hex(byte[] b){StringBuilder s=new StringBuilder();for(byte x:b)s.append(String.format(Locale.ROOT,"%02x ",x));return s.toString();}
    private void connected(){if(ready)return;retries=0;ready=true;status="Połączono — czekam na dane";shown="";nextPage=System.currentTimeMillis()+1500;Calendar c=Calendar.getInstance();sendRaw(new byte[]{8,0,1,(byte)128,(byte)c.get(Calendar.HOUR_OF_DAY),(byte)c.get(Calendar.MINUTE),(byte)c.get(Calendar.SECOND),0});}
    private void send(String text){if(!ready){status="Najpierw połącz tablicę";return;}if(packet!=null||waitingAck)return;shown=text;waitingAck=true;txSerial++;sendRaw(IpixelText.encode(text,lcd.optBoolean("ledScroll",false)));}
    private void sendRaw(byte[] bytes){if(packet!=null||!ready)return;packet=bytes;offset=0;android.util.Log.i("SRG-iPixel","TX length="+bytes.length+" text="+shown);writeNext();}
    private void writeNext(){if(packet==null||gatt==null||writer==null)return;if(offset>=packet.length){packet=null;if(waitingAck){long serial=txSerial;handler.postDelayed(()->{if(waitingAck&&txSerial==serial){waitingAck=false;status="Brak potwierdzenia tablicy — ostatnia plansza niepewna";}},8000);}return;}byte[] part=Arrays.copyOfRange(packet,offset,Math.min(packet.length,offset+chunkSize));offset+=part.length;writer.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);writer.setValue(part);if(!gatt.writeCharacteristic(writer)){packet=null;waitingAck=false;status="Bluetooth odrzucił zapis";}}
    private long testUntil=0;
    private String panelKey="";private long panelStarted=0,lastPanel=0;
    private final Runnable tick=new Runnable(){public void run(){if(closed)return;long now=System.currentTimeMillis();if(prefs.getBoolean("enabled",false)&&gatt==null&&now>=reconnectAt&&!prefs.getString("address","").isEmpty()){reconnectAt=now+30000;connect(prefs.getString("address",""));}if(ready&&prefs.getBoolean("enabled",false)&&now>=testUntil&&packet==null&&!waitingAck){JSONObject frame;try{frame=cycle.frame(lcd,now);}catch(Exception e){frame=lcd;}String text=frame.optString("ledText");if(text.isEmpty())text=new java.text.SimpleDateFormat("HH:mm",Locale.ROOT).format(new Date());String key=frame.optString("ledKind")+text+frame.optBoolean("ledScroll")+frame.optString("lcdConfig")+frame.optString("kursId")+":"+frame.optInt("aktualnyIndeks")+":"+(frame.optJSONObject("lcdManual")==null?"":frame.optJSONObject("lcdManual").optString("id"));if(!key.equals(panelKey)){panelKey=key;panelStarted=now;lastPanel=0;}boolean moving=frame.optString("ledKind").equals("clock")||frame.optBoolean("ledScroll");if(now-lastPanel>=(moving?400:1000)&&(!text.equals(shown)||moving||lastPanel==0)){shown=text;waitingAck=true;txSerial++;sendRaw(IpixelPanel.draw(frame,now-panelStarted));lastPanel=now;}}handler.postDelayed(this,500);}};
    private void retry(){if(closed||!prefs.getBoolean("enabled",false)||retries>=3)return;int delay=5000*(++retries);handler.postDelayed(()->{if(!closed&&gatt==null&&prefs.getBoolean("enabled",false))connect(prefs.getString("address",""));},delay);}
    private void disconnect(){ready=false;writer=null;packet=null;waitingAck=false;if(gatt!=null){BluetoothGatt old=gatt;gatt=null;try{old.disconnect();old.close();}catch(Exception ignored){}}}
    public void close(){closed=true;handler.removeCallbacksAndMessages(null);stopScan();disconnect();}
}
