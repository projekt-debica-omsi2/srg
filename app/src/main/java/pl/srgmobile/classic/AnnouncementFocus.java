package pl.srgmobile.classic;
import android.content.Context;
import android.media.*;
import android.os.*;
final class AnnouncementFocus {
 private final AudioManager manager;private final AudioFocusRequest request;
 AnnouncementFocus(Context c,Runnable stop){manager=(AudioManager)c.getSystemService(Context.AUDIO_SERVICE);request=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes()).setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(change->{if(change<0)stop.run();},new Handler(Looper.getMainLooper())).build();}
 static AudioAttributes attributes(){return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();}
 boolean acquire(){int mode=manager.getMode();if(mode==AudioManager.MODE_IN_CALL||mode==AudioManager.MODE_IN_COMMUNICATION||mode==AudioManager.MODE_RINGTONE)return false;return manager.requestAudioFocus(request)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;}
 void close(){manager.abandonAudioFocusRequest(request);}
}
