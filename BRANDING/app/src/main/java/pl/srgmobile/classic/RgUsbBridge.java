package pl.srgmobile.classic;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.hardware.usb.*;
import android.os.Build;
import android.webkit.*;
import com.hoho.android.usbserial.driver.*;
import com.hoho.android.usbserial.util.SerialInputOutputManager;
import org.json.*;
import java.util.concurrent.*;

/** Real USB serial transport; deliberately contains no guessed R&G protocol. */
public final class RgUsbBridge implements SerialInputOutputManager.Listener {
 private final Activity activity; private final WebView web; private final UsbManager manager;
 private final ExecutorService queue=Executors.newSingleThreadExecutor();
 private UsbSerialPort port; private UsbDeviceConnection connection; private SerialInputOutputManager io;
 private volatile int deviceId=-1; private int generation=0; private volatile boolean destroyed=false;
 private final String permission,callback;
 private static final ConcurrentHashMap<Integer,RgUsbBridge> owners=new ConcurrentHashMap<>();
 private void submit(Runnable task){if(destroyed)return;try{queue.execute(task);}catch(RejectedExecutionException ignored){}}
 private final BroadcastReceiver receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent i){
  if(permission.equals(i.getAction())) emit("info",i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false)?"Zgoda USB udzielona. Naciśnij Połącz ponownie.":"Odmowa dostępu USB");
  if(UsbManager.ACTION_USB_DEVICE_DETACHED.equals(i.getAction())) {UsbDevice d=i.getParcelableExtra(UsbManager.EXTRA_DEVICE); if(d!=null&&d.getDeviceId()==deviceId) disconnect();}
 }};
 public RgUsbBridge(Activity a,WebView w){this(a,w,"RG","rgUsbEvent");}
 public RgUsbBridge(Activity a,WebView w,String channel,String event){callback=event;activity=a;web=w;manager=(UsbManager)a.getSystemService(Context.USB_SERVICE);permission=a.getPackageName()+"."+channel+"_USB_PERMISSION";
  IntentFilter f=new IntentFilter(permission);f.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
  if(Build.VERSION.SDK_INT>=33)a.registerReceiver(receiver,f,Context.RECEIVER_NOT_EXPORTED);else a.registerReceiver(receiver,f);
 }
 private void emit(String type,String message){if(destroyed)return;activity.runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window."+callback+"&&window."+callback+"("+JSONObject.quote(type)+","+JSONObject.quote(message)+")",null);});}
 @JavascriptInterface public String devices(){JSONArray out=new JSONArray();try{for(UsbSerialDriver d:UsbSerialProber.getDefaultProber().findAllDrivers(manager)){JSONObject o=new JSONObject();o.put("id",d.getDevice().getDeviceId());o.put("name",d.getClass().getSimpleName()+String.format(" · VID %04X PID %04X · ",d.getDevice().getVendorId(),d.getDevice().getProductId())+d.getDevice().getDeviceName());out.put(o);}}catch(Exception e){emit("error",e.toString());}return out.toString();}
 @JavascriptInterface public void connect(int id,int baud,int data,int stop,int parity){submit(()->{
  closePort();try{
   if(baud<300||baud>1000000||data<5||data>8||(stop!=1&&stop!=2)||parity<0||parity>2)throw new Exception("Nieprawidłowe parametry portu");
   UsbSerialDriver driver=null;for(UsbSerialDriver d:UsbSerialProber.getDefaultProber().findAllDrivers(manager))if(d.getDevice().getDeviceId()==id)driver=d;
   if(driver==null)throw new Exception("Nie znaleziono konwertera USB");
   if(!manager.hasPermission(driver.getDevice())){PendingIntent pi=PendingIntent.getBroadcast(activity,0,new Intent(permission).setPackage(activity.getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));manager.requestPermission(driver.getDevice(),pi);emit("info","Zezwól na dostęp USB, następnie naciśnij Połącz.");return;}
   if(owners.putIfAbsent(id,this)!=null)throw new Exception("Ten adapter jest już używany przez drugie połączenie. Wybierz osobny adapter USB.");deviceId=id;
   connection=manager.openDevice(driver.getDevice());if(connection==null)throw new Exception("Brak dostępu USB");port=driver.getPorts().get(0);port.open(connection);port.setParameters(baud,data,stop,parity);deviceId=id;
   final int openedGeneration=generation;
   io=new SerialInputOutputManager(port,new SerialInputOutputManager.Listener(){
    public void onNewData(byte[] data){RgUsbBridge.this.onNewData(data);}
    public void onRunError(Exception e){submit(()->{if(generation==openedGeneration){closePort();emit("error",e.toString());}});}
   });io.start();emit("connected","USB połączone — odpowiedź tablicy niepotwierdzona");
  }catch(Exception e){closePort();emit("error",e.toString());}
 });}
 @JavascriptInterface public void send(String hex){submit(()->{try{if(port==null)throw new Exception("USB rozłączone");String s=hex.replaceAll("\\s","");if(s.length()==0||s.length()>8192||s.length()%2!=0||!s.matches("[0-9a-fA-F]+"))throw new Exception("Niepoprawne HEX / limit 4096 bajtów");byte[] b=new byte[s.length()/2];for(int n=0;n<b.length;n++)b[n]=(byte)Integer.parseInt(s.substring(n*2,n*2+2),16);port.write(b,3000);emit("tx",hex);}catch(Exception e){closePort();emit("error",e.toString());}});}
 @JavascriptInterface public void disconnect(){submit(()->{closePort();emit("disconnected","USB rozłączone");});}
 private void closePort(){generation++;if(io!=null){io.stop();io=null;}try{if(port!=null)port.close();}catch(Exception ignored){}port=null;if(connection!=null)connection.close();connection=null;owners.remove(deviceId,this);deviceId=-1;}
 public void onNewData(byte[] data){StringBuilder s=new StringBuilder();for(byte b:data)s.append(String.format("%02X ",b&255));emit("rx",s.toString());}
 public void onRunError(Exception e){if(!destroyed)submit(()->{closePort();emit("error",e.toString());});}
 public synchronized void close(){if(destroyed)return;destroyed=true;try{activity.unregisterReceiver(receiver);}catch(Exception ignored){}queue.execute(this::closePort);queue.shutdown();}
}
