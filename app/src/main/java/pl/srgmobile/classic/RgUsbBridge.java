package pl.srgmobile.classic;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.hardware.usb.*;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.*;
import com.hoho.android.usbserial.driver.*;
import com.hoho.android.usbserial.util.SerialInputOutputManager;
import org.json.*;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** R&G USB serial transport + aggressive receive diagnostics. */
public final class RgUsbBridge implements SerialInputOutputManager.Listener {
 private final Activity activity; private final WebView web; private final UsbManager manager;
 private final ExecutorService queue=Executors.newSingleThreadExecutor();
 private final ExecutorService rawQueue=Executors.newSingleThreadExecutor();
 private volatile UsbSerialPort port; private UsbDeviceConnection connection; private SerialInputOutputManager io;
 private volatile int deviceId=-1; private int generation=0; private volatile boolean destroyed=false;
 private int currentBaud=9600,currentData=8,currentStop=1,currentParity=0;
 private volatile boolean currentDtr=false,currentRts=false;
 private final String permission,callback;
 private static final ConcurrentHashMap<Integer,RgUsbBridge> owners=new ConcurrentHashMap<>();

 private boolean capturing=false; private long captureStarted=0L,captureLast=0L;
 private int captureChunks=0,captureBytes=0; private String captureLabel="",captureFolder="SRG-Captures";
 private StringBuilder captureBuffer=new StringBuilder();
 private static final int MAX_CAPTURE_CHARS=8*1024*1024;

 private volatile boolean rawRx=false;
 private final AtomicLong rxBytes=new AtomicLong(),rxChunks=new AtomicLong(),rxErrors=new AtomicLong();
 private volatile long lastRxAt=0L;
 private volatile String lastControlError="";

 private void submit(Runnable task){if(destroyed)return;try{queue.execute(task);}catch(RejectedExecutionException ignored){}}
 private final BroadcastReceiver receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent i){
  if(permission.equals(i.getAction()))emit("info",i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false)?"Zgoda USB udzielona. Naciśnij Połącz ponownie.":"Odmowa dostępu USB");
  if(UsbManager.ACTION_USB_DEVICE_DETACHED.equals(i.getAction())){UsbDevice d=i.getParcelableExtra(UsbManager.EXTRA_DEVICE);if(d!=null&&d.getDeviceId()==deviceId)disconnect();}
 }};
 public RgUsbBridge(Activity a,WebView w){this(a,w,"RG","rgUsbEvent");}
 public RgUsbBridge(Activity a,WebView w,String channel,String event){callback=event;activity=a;web=w;manager=(UsbManager)a.getSystemService(Context.USB_SERVICE);permission=a.getPackageName()+"."+channel+"_USB_PERMISSION";
  IntentFilter f=new IntentFilter(permission);f.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
  if(Build.VERSION.SDK_INT>=33)a.registerReceiver(receiver,f,Context.RECEIVER_NOT_EXPORTED);else a.registerReceiver(receiver,f);
 }
 private void emit(String type,String message){if(destroyed)return;activity.runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window."+callback+"&&window."+callback+"("+JSONObject.quote(type)+","+JSONObject.quote(message)+")",null);});}
 private void emitCaptureSaved(JSONObject data){if(destroyed)return;final String json=data.toString();activity.runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window.rgUsbCaptureSaved&&window.rgUsbCaptureSaved(JSON.parse("+JSONObject.quote(json)+"))",null);});}

 @JavascriptInterface public String devices(){
  JSONArray out=new JSONArray();
  try{for(UsbSerialDriver d:UsbSerialProber.getDefaultProber().findAllDrivers(manager)){
   JSONObject o=new JSONObject();o.put("id",d.getDevice().getDeviceId());o.put("driver",d.getClass().getSimpleName());o.put("vid",d.getDevice().getVendorId());o.put("pid",d.getDevice().getProductId());
   o.put("name",d.getClass().getSimpleName()+String.format(" · VID %04X PID %04X · ",d.getDevice().getVendorId(),d.getDevice().getProductId())+d.getDevice().getDeviceName());out.put(o);
  }}catch(Exception e){emit("error",e.toString());}
  return out.toString();
 }

 private void startCallbackIo(){
  if(port==null||rawRx)return;
  final int openedGeneration=generation;
  io=new SerialInputOutputManager(port,new SerialInputOutputManager.Listener(){
   public void onNewData(byte[] data){RgUsbBridge.this.onNewData(data);}
   public void onRunError(Exception e){submit(()->{if(generation==openedGeneration){rxErrors.incrementAndGet();emitStats();closePort();emit("error",e.toString());}});}
  });
  io.start();
 }
 private void stopCallbackIo(){if(io!=null){try{io.stop();}catch(Exception ignored){}io=null;}}
 private void startRawLoop(){
  rawQueue.execute(()->{
   byte[] buf=new byte[4096];
   while(rawRx&&!destroyed&&port!=null){
    try{int n=port.read(buf,150);if(n>0)onNewData(Arrays.copyOf(buf,n));}
    catch(Exception e){if(rawRx){rxErrors.incrementAndGet();emit("raw_rx_error",e.toString());emitStats();}break;}
   }
   if(!destroyed)emit("raw_rx_status","RAW RX STOP");
  });
 }
 private void switchRxMode(boolean raw){
  if(port==null)return;
  if(raw){
   if(rawRx)return;
   rawRx=true;stopCallbackIo();emit("raw_rx_status","RAW RX START · port.read() timeout 150 ms");startRawLoop();
  }else{
   if(rawRx){rawRx=false;try{Thread.sleep(220);}catch(InterruptedException ignored){}}
   if(io==null)startCallbackIo();
   emit("raw_rx_status","CALLBACK RX aktywny");
  }
 }

 @JavascriptInterface public void connect(int id,int baud,int data,int stop,int parity){submit(()->{
  closePort();try{
   if(baud<300||baud>1000000||data<5||data>8||(stop!=1&&stop!=2)||parity<0||parity>2)throw new Exception("Nieprawidłowe parametry portu");
   UsbSerialDriver driver=null;for(UsbSerialDriver d:UsbSerialProber.getDefaultProber().findAllDrivers(manager))if(d.getDevice().getDeviceId()==id)driver=d;
   if(driver==null)throw new Exception("Nie znaleziono konwertera USB");
   if(!manager.hasPermission(driver.getDevice())){PendingIntent pi=PendingIntent.getBroadcast(activity,0,new Intent(permission).setPackage(activity.getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));manager.requestPermission(driver.getDevice(),pi);emit("info","Zezwól na dostęp USB, następnie naciśnij Połącz.");return;}
   if(owners.putIfAbsent(id,this)!=null)throw new Exception("Ten adapter jest już używany przez drugie połączenie.");deviceId=id;
   connection=manager.openDevice(driver.getDevice());if(connection==null)throw new Exception("Brak dostępu USB");
   port=driver.getPorts().get(0);port.open(connection);port.setParameters(baud,data,stop,parity);
   currentBaud=baud;currentData=data;currentStop=stop;currentParity=parity;currentDtr=false;currentRts=false;lastControlError="";
   try{port.setDTR(false);}catch(Exception e){lastControlError+="DTR:"+e.getClass().getSimpleName()+" ";}
   try{port.setRTS(false);}catch(Exception e){lastControlError+="RTS:"+e.getClass().getSimpleName()+" ";}
   rxBytes.set(0);rxChunks.set(0);rxErrors.set(0);lastRxAt=0;rawRx=false;
   startCallbackIo();emit("connected","USB połączone · diagnostyka 1.4.73 · "+baud+"/"+data+"/"+stop+" parity="+parity);emitStats();
  }catch(Exception e){closePort();emit("error",e.toString());}
 });}

 @JavascriptInterface public void startRawRx(){submit(()->{if(port==null){emit("raw_rx_error","USB nie jest połączone.");return;}switchRxMode(true);emitStats();});}
 @JavascriptInterface public void stopRawRx(){submit(()->{if(port==null)return;switchRxMode(false);emitStats();});}

 @JavascriptInterface public void resetRxCounters(){rxBytes.set(0);rxChunks.set(0);rxErrors.set(0);lastRxAt=0;emitStats();}

 @JavascriptInterface public void diagnosticConfig(int baud,int data,int stop,int parity,boolean dtr,boolean rts,boolean raw,boolean purge){
  submit(()->{
   if(port==null){emit("diag_error","USB nie jest połączone.");return;}
   try{
    switchRxMode(false);
    if(baud<300||baud>1000000||data<5||data>8||(stop!=1&&stop!=2)||parity<0||parity>2)throw new Exception("Nieprawidłowe parametry");
    port.setParameters(baud,data,stop,parity);currentBaud=baud;currentData=data;currentStop=stop;currentParity=parity;
    lastControlError="";
    try{port.setDTR(dtr);currentDtr=dtr;}catch(Exception e){lastControlError+="DTR:"+e.getClass().getSimpleName()+" ";}
    try{port.setRTS(rts);currentRts=rts;}catch(Exception e){lastControlError+="RTS:"+e.getClass().getSimpleName()+" ";}
    if(purge){try{port.purgeHwBuffers(false,true);}catch(Exception e){lastControlError+="PURGE:"+e.getClass().getSimpleName()+" ";}}
    rxBytes.set(0);rxChunks.set(0);rxErrors.set(0);lastRxAt=0;
    if(raw)switchRxMode(true);else switchRxMode(false);
    emit("diag_config","Ustawiono "+baud+"/"+data+"/"+stop+" P"+parity+" · DTR "+(dtr?"ON":"OFF")+" · RTS "+(rts?"ON":"OFF")+" · "+(raw?"RAW":"CALLBACK")+(purge?" · PURGE":""));
    emitStats();
   }catch(Exception e){rxErrors.incrementAndGet();emit("diag_error",e.toString());emitStats();}
  });
 }

 @JavascriptInterface public String rxStats(){
  try{
   JSONObject o=new JSONObject();o.put("bytes",rxBytes.get());o.put("chunks",rxChunks.get());o.put("errors",rxErrors.get());o.put("lastRxAt",lastRxAt);o.put("raw",rawRx);o.put("connected",port!=null);
   o.put("baud",currentBaud);o.put("dataBits",currentData);o.put("stopBits",currentStop);o.put("parity",currentParity);o.put("dtr",currentDtr);o.put("rts",currentRts);o.put("controlError",lastControlError);
   return o.toString();
  }catch(Exception e){return "{}";}
 }
 private void emitStats(){emit("rx_stats",rxStats());}

 @JavascriptInterface public void send(String hex){submit(()->{try{if(port==null)throw new Exception("USB rozłączone");String s=hex.replaceAll("\\s","");if(s.length()==0||s.length()>8192||s.length()%2!=0||!s.matches("[0-9a-fA-F]+"))throw new Exception("Niepoprawne HEX / limit 4096 bajtów");byte[] b=new byte[s.length()/2];for(int n=0;n<b.length;n++)b[n]=(byte)Integer.parseInt(s.substring(n*2,n*2+2),16);port.write(b,3000);emit("tx",hex);}catch(Exception e){closePort();emit("error",e.toString());}});}
 @JavascriptInterface public void disconnect(){submit(()->{closePort();emit("disconnected","USB rozłączone");});}

 @JavascriptInterface public void startCapture(String label,String folder){submit(()->{
  synchronized(this){
   if(port==null){emit("capture_error","Najpierw połącz konwerter USB.");return;}
   if(capturing){emit("capture_error","Przechwytywanie już trwa.");return;}
   captureLabel=safeLabel(label);captureFolder=safeFolder(folder);captureStarted=System.currentTimeMillis();captureLast=captureStarted;captureChunks=0;captureBytes=0;captureBuffer=new StringBuilder();
   try{
    JSONObject meta=new JSONObject();meta.put("type","srg_capture");meta.put("format",3);meta.put("appVersion","1.4.73");meta.put("category","linia_dodatkowa");meta.put("label",captureLabel);meta.put("startedAt",captureStarted);
    meta.put("baud",currentBaud);meta.put("dataBits",currentData);meta.put("stopBits",currentStop);meta.put("parity",currentParity);meta.put("dtr",currentDtr);meta.put("rts",currentRts);meta.put("rxMode",rawRx?"raw-poll":"callback");
    captureBuffer.append(meta).append('\n');capturing=true;emit("capture_started","Nasłuch: "+captureLabel+" · "+(rawRx?"RAW":"CALLBACK")+" · DTR "+currentDtr+" RTS "+currentRts);
   }catch(Exception e){captureBuffer=new StringBuilder();emit("capture_error","Nie można rozpocząć zapisu: "+e.getMessage());}
  }
 });}
 @JavascriptInterface public void stopCapture(){submit(()->{synchronized(this){if(!capturing){emit("capture_error","Przechwytywanie nie jest uruchomione.");return;}saveCaptureLocked("manual");}});}
 @JavascriptInterface public boolean isCapturing(){synchronized(this){return capturing;}}

 private String safeLabel(String s){String x=s==null?"":s.trim();if(x.isEmpty())x="BEZ_NAZWY";return x.length()>120?x.substring(0,120):x;}
 private String safeFolder(String s){String x=s==null?"":s.trim().replaceAll("[^\\p{L}\\p{N}._ -]","_");if(x.isEmpty())x="SRG-Captures";return x.length()>60?x.substring(0,60):x;}
 private String safeFilePart(String s){String x=s.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9._-]+","_").replaceAll("_+","_");if(x.isEmpty())x="CAPTURE";return x.length()>45?x.substring(0,45):x;}
 private void appendCapture(byte[] data){
  synchronized(this){if(!capturing)return;long now=System.currentTimeMillis();long dt=Math.max(0,now-captureLast),t=Math.max(0,now-captureStarted);captureLast=now;
   StringBuilder hex=new StringBuilder();for(byte b:data){if(hex.length()>0)hex.append(' ');hex.append(String.format(Locale.ROOT,"%02X",b&255));}
   try{JSONObject row=new JSONObject();row.put("t",t);row.put("dt",dt);row.put("dir","rx");row.put("hex",hex.toString());captureBuffer.append(row).append('\n');captureChunks++;captureBytes+=data.length;
    if(captureBuffer.length()>MAX_CAPTURE_CHARS){emit("capture_error","Limit 8 MB — zapisuję zebrane dane.");saveCaptureLocked("limit");}
   }catch(Exception e){emit("capture_error","Błąd zapisu ramki: "+e.getMessage());}
  }
 }
 private void saveCaptureLocked(String reason){
  if(!capturing)return;capturing=false;long ended=System.currentTimeMillis();
  try{JSONObject end=new JSONObject();end.put("type","end");end.put("endedAt",ended);end.put("durationMs",Math.max(0,ended-captureStarted));end.put("chunks",captureChunks);end.put("bytes",captureBytes);end.put("reason",reason);end.put("rxMode",rawRx?"raw-poll":"callback");end.put("dtr",currentDtr);end.put("rts",currentRts);captureBuffer.append(end).append('\n');}catch(Exception ignored){}
  String stamp=new SimpleDateFormat("yyyyMMdd-HHmmss",Locale.ROOT).format(new Date(captureStarted));String fileName="SRG-capture-"+stamp+"-"+safeFilePart(captureLabel)+".jsonl";String path;
  try{path=writeCapture(fileName,captureBuffer.toString(),captureFolder);}catch(Exception e){emit("capture_error","Nie udało się zapisać pliku: "+e.getMessage());captureBuffer=new StringBuilder();return;}
  try{JSONObject saved=new JSONObject();saved.put("label",captureLabel);saved.put("category","linia_dodatkowa");saved.put("file",fileName);saved.put("path",path);saved.put("chunks",captureChunks);saved.put("bytes",captureBytes);saved.put("startedAt",captureStarted);saved.put("rxMode",rawRx?"raw-poll":"callback");saved.put("dtr",currentDtr);saved.put("rts",currentRts);emitCaptureSaved(saved);}catch(Exception ignored){}
  emit("capture_saved","Zapisano "+captureChunks+" porcji / "+captureBytes+" B: "+path);captureBuffer=new StringBuilder();
 }
 private String writeCapture(String fileName,String data,String folder)throws Exception{
  byte[] bytes=data.getBytes(java.nio.charset.StandardCharsets.UTF_8);
  if(Build.VERSION.SDK_INT>=29){
   ContentValues v=new ContentValues();v.put(MediaStore.MediaColumns.DISPLAY_NAME,fileName);v.put(MediaStore.MediaColumns.MIME_TYPE,"application/x-ndjson");v.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/"+folder);
   android.net.Uri uri=activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,v);if(uri==null)throw new IOException("Android nie utworzył pliku w Pobrane");
   try(OutputStream out=activity.getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("Brak strumienia zapisu");out.write(bytes);}return "Pobrane/"+folder+"/"+fileName;
  }
  File base=activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(base==null)throw new IOException("Brak pamięci zewnętrznej");File dir=new File(base,folder);if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Nie można utworzyć folderu");File f=new File(dir,fileName);try(OutputStream out=new FileOutputStream(f)){out.write(bytes);}return f.getAbsolutePath();
 }
 private void closePort(){rawRx=false;if(capturing)saveCaptureLocked("disconnect");generation++;stopCallbackIo();try{if(port!=null)port.close();}catch(Exception ignored){}port=null;if(connection!=null)connection.close();connection=null;owners.remove(deviceId,this);deviceId=-1;emitStats();}
 public void onNewData(byte[] data){rxBytes.addAndGet(data.length);rxChunks.incrementAndGet();lastRxAt=System.currentTimeMillis();appendCapture(data);StringBuilder s=new StringBuilder();for(byte b:data)s.append(String.format(Locale.ROOT,"%02X ",b&255));emit("rx",s.toString());emitStats();}
 public void onRunError(Exception e){rxErrors.incrementAndGet();if(!destroyed)submit(()->{closePort();emit("error",e.toString());});}
 public synchronized void close(){if(destroyed)return;destroyed=true;try{activity.unregisterReceiver(receiver);}catch(Exception ignored){}queue.execute(this::closePort);queue.shutdown();rawRx=false;rawQueue.shutdownNow();}
}
