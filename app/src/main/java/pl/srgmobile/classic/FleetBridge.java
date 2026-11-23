package pl.srgmobile.classic;
import android.content.*;
import android.webkit.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;

/** Consent-gated local fleet test client. No request is made until enabled by the driver. */
public final class FleetBridge {
 private final android.app.Activity activity;private final WebView web;private final SharedPreferences prefs;private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();private volatile boolean enabled;private volatile int generation=0;private volatile HttpURLConnection active;
 public FleetBridge(android.app.Activity a,WebView w){activity=a;web=w;prefs=a.getSharedPreferences("fleet",Context.MODE_PRIVATE);enabled=prefs.getBoolean("enabled",false);if(!prefs.contains("number")&&prefs.getString("server","").equals("http://127.0.0.1:8790"))prefs.edit().putString("server","http://matixi.pl:8790").commit();if(!prefs.contains("device"))prefs.edit().putString("device",UUID.randomUUID().toString()).putString("secret",UUID.randomUUID().toString()+UUID.randomUUID()).commit();worker.scheduleWithFixedDelay(()->{if(enabled&&prefs.contains("number"))send("/api/heartbeat",null,null);},1,15,TimeUnit.SECONDS);}
 @JavascriptInterface public String config(){try{return new JSONObject().put("enabled",enabled).put("server",prefs.getString("server","http://matixi.pl:8790")).put("number",prefs.getString("number","")).put("display",prefs.getString("display","")).toString();}catch(Exception e){return "{}";}}
 @JavascriptInterface public void configure(boolean on,String server,String display){
  try{URL u=new URL(server);boolean local=u.getProtocol().equals("http")&&BuildConfig.APPLICATION_ID.equals("pl.srgmobile.testgps");if(!(local||u.getProtocol().equals("https"))||u.getUserInfo()!=null||!u.getPath().isEmpty()&&!u.getPath().equals("/")||u.getQuery()!=null||u.getRef()!=null||display.length()>100)throw new IOException("Podaj adres HTTP lub HTTPS serwera (HTTP tylko w TestGPS)");
   // Changing servers never silently transfers a device identity or location.
   String old=prefs.getString("server","http://matixi.pl:8790");if(!old.equals(server)&&prefs.contains("number"))throw new IOException("Zarezerwowany numer jest przypisany do obecnego serwera");
   enabled=on;generation++;HttpURLConnection c=active;if(!on&&c!=null)c.disconnect();prefs.edit().putBoolean("enabled",on).putString("server",server).putString("display",display.trim()).commit();activity.runOnUiThread(()->web.getSettings().setBlockNetworkLoads(!on));result(on?"Połączenie włączone. Wybierz wolny numer.":"Tryb offline. Wysyłanie zatrzymane.",null);
  }catch(Exception e){result(e.getMessage(),null);}
 }
 @JavascriptInterface public void setStopMode(boolean automatic){prefs.edit().putString("stopMode",automatic?"auto":"manual").apply();}
 @JavascriptInterface public void reserve(String number){send("/api/reserve",number,null);}
 @JavascriptInterface public void publish(String payload){if(!enabled||!prefs.contains("number"))return;send("/api/telemetry",null,payload);}
 private void send(String path,String number,String payload){send(path,number,payload,false);}
 private void send(String path,String number,String payload,boolean backup){if(!enabled)return;final int epoch=generation;worker.execute(()->{HttpURLConnection c=null;boolean responseReceived=false;try{
  if(!enabled||generation!=epoch)return;JSONObject d=new JSONObject().put("device",prefs.getString("device","")).put("secret",prefs.getString("secret","")).put("display",prefs.getString("display",""));if(prefs.contains("stopMode"))d.put("stopMode",prefs.getString("stopMode",""));if(number!=null)d.put("number",number);if(payload!=null)d.put("payload",new JSONObject(payload));String base=prefs.getString("server","http://matixi.pl:8790");if(backup)base="http://81.162.211.211:8790";URL u=new URL(base+path);c=(HttpURLConnection)u.openConnection();active=c;c.setInstanceFollowRedirects(false);c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");if(!enabled||generation!=epoch)return;try(OutputStream out=c.getOutputStream()){out.write(d.toString().getBytes(StandardCharsets.UTF_8));}int status=c.getResponseCode();responseReceived=true;InputStream in=status<400?c.getInputStream():c.getErrorStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream();if(in!=null)try(InputStream input=in){byte[] b=new byte[1024];int n;while((n=input.read(b))!=-1){if(bytes.size()+n>20000)throw new IOException("Zbyt długa odpowiedź");bytes.write(b,0,n);}}JSONObject response=new JSONObject(bytes.toString("UTF-8"));if(!enabled||generation!=epoch)return;if(status>=400)throw new IOException(response.optString("error","Błąd serwera "+status));if(number!=null){prefs.edit().putString("number",response.getString("number")).commit();result("Zarezerwowano numer "+response.getString("number"),response);}else if(!path.equals("/api/heartbeat"))result("Pozycja wysłana",response);
 }catch(Exception e){if(enabled&&generation==epoch){if(!backup&&!responseReceived&&e instanceof IOException&&prefs.getString("server", "http://matixi.pl:8790").equals("http://matixi.pl:8790"))send(path,number,payload,true);else result(e.getMessage(),null);}}finally{if(c!=null)c.disconnect();active=null;}});}
 private void result(String message,JSONObject data){activity.runOnUiThread(()->{try{web.evaluateJavascript("window.onFleetResult&&window.onFleetResult("+JSONObject.quote(message)+","+(data==null?"null":data.toString())+")",null);}catch(Exception ignored){}});}
 public void close(){enabled=false;generation++;if(active!=null)active.disconnect();worker.shutdownNow();}
}
