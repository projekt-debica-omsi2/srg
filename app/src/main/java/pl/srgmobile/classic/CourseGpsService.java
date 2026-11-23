package pl.srgmobile.classic;
import android.app.*;
import android.content.*;
import android.os.*;
public final class CourseGpsService extends Service {
 private PowerManager.WakeLock lock;
 @Override public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("course_gps","GPS kursu w tle",NotificationManager.IMPORTANCE_LOW));Intent open=new Intent(this,MainActivity.class);PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);startForeground(8790,new Notification.Builder(this,"course_gps").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("SRGMobile — GPS kursu").setContentText("Automatyczne przystanki działają w tle. Wyłącz AUTO GPS, aby zatrzymać.").setContentIntent(pi).setOngoing(true).build());lock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"SRGMobile:CourseGPS");lock.acquire();}
 @Override public int onStartCommand(Intent i,int flags,int id){return START_NOT_STICKY;}
 @Override public IBinder onBind(Intent i){return null;}
 @Override public void onDestroy(){if(lock!=null&&lock.isHeld())lock.release();super.onDestroy();}
}
