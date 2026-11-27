package pl.srgmobile.classic;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

/** Keeps the optional BLE display and its native ticker alive while screen is off. */
public final class LedDisplayService extends Service {
 private static IpixelBridge bridge;private PowerManager.WakeLock lock;
 static synchronized IpixelBridge obtain(Activity activity){if(bridge==null)bridge=new IpixelBridge(activity);else bridge.attach(activity);return bridge;}
 static void enabled(Context context,boolean enabled){Intent i=new Intent(context,LedDisplayService.class);if(enabled)context.startForegroundService(i);else context.stopService(i);}
 @Override public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("led_display","Tablica LED",NotificationManager.IMPORTANCE_LOW));PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);Notification n=new Notification.Builder(this,"led_display").setSmallIcon(android.R.drawable.ic_menu_info_details).setContentTitle("SRGMobile - tablica LED").setContentText("Cykl tablicy działa w tle. Wyłącz tablicę w ustawieniach, aby zatrzymać.").setContentIntent(open).setOngoing(true).build();if(Build.VERSION.SDK_INT>=29)startForeground(8791,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);else startForeground(8791,n);lock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"SRGMobile:LED");lock.acquire();}
 @Override public int onStartCommand(Intent i,int flags,int id){return START_NOT_STICKY;}
 @Override public IBinder onBind(Intent i){return null;}
 @Override public void onDestroy(){if(lock!=null&&lock.isHeld())lock.release();super.onDestroy();}
}
