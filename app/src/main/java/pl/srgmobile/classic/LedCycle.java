package pl.srgmobile.classic;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;

/** Native clock/cycle: does not depend on WebView timer execution in the background. */
final class LedCycle {
 private String key="";private long started;
 JSONObject frame(JSONObject source,long now) throws JSONException {
  JSONObject s=new JSONObject(source.toString()),config=s.optJSONObject("lcdConfig");
  String signature=s.optString("kursId")+":"+s.optInt("aktualnyIndeks")+":"+String.valueOf(config);
  if(!signature.equals(key)||now<started){key=signature;started=now;}
  String type="clock",text="";JSONObject manual=s.optJSONObject("lcdManual");
  boolean active=s.optBoolean("kursAktywny")&&!s.optString("kursId").isEmpty();
  boolean valid=active&&manual!=null&&manual.optLong("expiresAt")>now
   &&manual.optString("courseKey",s.optString("kursId")).equals(s.optString("kursId"))
   &&manual.optInt("anchorIndex",s.optInt("aktualnyIndeks"))==s.optInt("aktualnyIndeks")
   &&Arrays.asList("next","current").contains(manual.optString("type"));
  if(valid){type=manual.optString("type");text=manual.optString("name");started=now;}
  else if(active&&s.optBoolean("additional"))type="route";
  else if(active&&config!=null){
   JSONArray steps=config.optJSONArray("steps");List<JSONObject> enabled=new ArrayList<>();long total=0;
   if(steps!=null)for(int i=0;i<steps.length();i++){JSONObject step=steps.optJSONObject(i);if(step==null)continue;String t=step.optString("type");int sec=Math.max(0,Math.min(300,step.optInt("seconds")));if(sec==0||!Arrays.asList("route","clock","transfers").contains(t))continue;if(t.equals("transfers")){JSONObject tr=s.optJSONObject("przesiadka");if(tr==null||tr.optJSONArray("przewoznicy")==null||tr.optJSONArray("przewoznicy").length()==0)continue;}enabled.add(step);total+=sec*1000L;}
   long elapsed=total==0?0:(now-started)%total;
   for(JSONObject step:enabled){long ms=step.optInt("seconds")*1000L;if(elapsed<ms){type=step.optString("type");break;}elapsed-=ms;}
  }
  if(type.equals("transfers"))type="clock";
  if(type.equals("clock"))text=new SimpleDateFormat("HH:mm",Locale.ROOT).format(new Date(now));
  else if(type.equals("next")||type.equals("current")){if(!valid){JSONObject stop=s.optJSONObject(type.equals("next")?"nastepny":"aktualny");text=stop==null?"":stop.optString("nazwa");}text=(type.equals("next")?"NASTĘPNY PRZYSTANEK: ":"PRZYSTANEK: ")+text;}
  else text=s.optString("kierunek");
  s.put("ledKind",type).put("ledText",text).put("ledScroll",!type.equals("clock")&&(config==null||config.optBoolean("scrollEnabled",true)));
  return s;
 }
}
