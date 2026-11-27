package pl.srgmobile.classic;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
public final class InternetRadioService extends Service {
 private int generation;
 @Override public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("internet_radio","Radio internetowe",NotificationManager.IMPORTANCE_LOW));PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,InternetRadioService.class).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);Notification n=new Notification.Builder(this,"internet_radio").setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("SRGMobile - radio internetowe").setContentText("Odtwarzanie w tle. Zapowiedzi automatycznie ściszają radio.").setContentIntent(open).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause,"Zatrzymaj",stop).build()).setOngoing(true).build();if(Build.VERSION.SDK_INT>=29)startForeground(8792,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);else startForeground(8792,n);}
 @Override public int onStartCommand(Intent i,int flags,int id){generation=InternetRadio.get(this).generation();if(i!=null&&"STOP".equals(i.getAction()))InternetRadio.get(this).stopWithStatus("Radio zatrzymane");return START_NOT_STICKY;}
 @Override public IBinder onBind(Intent i){return null;}
 @Override public void onDestroy(){InternetRadio.get(this).serviceEnded(generation);super.onDestroy();}
}
