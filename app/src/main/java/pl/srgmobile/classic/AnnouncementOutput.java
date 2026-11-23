package pl.srgmobile.classic;

import android.app.Activity;
import android.content.*;
import android.media.*;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import org.json.*;

/** Selection concerns media only; it does not take over Bluetooth calls or the LED GATT. */
final class AnnouncementOutput {
    private final Activity activity;private final AudioManager audio;private final SharedPreferences prefs;
    AnnouncementOutput(Activity a){activity=a;audio=(AudioManager)a.getSystemService(Context.AUDIO_SERVICE);prefs=a.getSharedPreferences("announcement-output",Context.MODE_PRIVATE);}
    private String key(AudioDeviceInfo d){return d.getType()+"|"+d.getAddress()+"|"+d.getProductName();}
    @JavascriptInterface public String devices(){try{JSONObject result=new JSONObject();JSONArray list=new JSONArray();for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){if(d.getType()==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP||d.getType()==AudioDeviceInfo.TYPE_BLE_HEADSET||d.getType()==AudioDeviceInfo.TYPE_BLE_SPEAKER)list.put(new JSONObject().put("key",key(d)).put("name",d.getProductName().toString()));}return result.put("selected",prefs.getString("device","")).put("devices",list).toString();}catch(Exception e){return "{\"selected\":\"\",\"devices\":[]}";}}
    @JavascriptInterface public void select(String key){prefs.edit().putString("device",key==null?"":key).apply();}
    boolean playbackAllowed(){String selected=prefs.getString("device","");if(selected.isEmpty())return true;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))if(key(d).equals(selected))return true;return false;}
    @JavascriptInterface public void openBluetooth(){activity.runOnUiThread(()->activity.startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));}
    boolean apply(MediaPlayer player){String selected=prefs.getString("device","");if(selected.isEmpty())return true;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))if(key(d).equals(selected))return player.setPreferredDevice(d);return false;}
}
