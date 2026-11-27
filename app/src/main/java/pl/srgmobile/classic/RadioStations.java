package pl.srgmobile.classic;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Radio Browser directory, contacted only by an explicit search/play action. */
final class RadioStations {
 static boolean streamUrl(String url){try{URI u=new URI(url);return ("https".equalsIgnoreCase(u.getScheme())||"http".equalsIgnoreCase(u.getScheme()))&&u.getHost()!=null&&u.getUserInfo()==null;}catch(Exception e){return false;}}
 static JSONArray clean(JSONArray source) throws JSONException {
  JSONArray out=new JSONArray();Set<String> ids=new HashSet<>();
  for(int i=0;i<source.length()&&out.length()<50;i++){JSONObject s=source.optJSONObject(i);if(s==null||s.optInt("lastcheckok")!=1)continue;String id=s.optString("stationuuid"),url=s.optString("url_resolved",s.optString("url"));if(!id.matches("[a-fA-F0-9-]{36}")||!streamUrl(url)||!ids.add(id))continue;out.put(new JSONObject().put("id",id).put("name",s.optString("name").trim()).put("url",url).put("codec",s.optString("codec")).put("bitrate",s.optInt("bitrate")).put("country",s.optString("country")));}return out;
 }
 private static List<String> hosts(){List<String> hosts=new ArrayList<>();try{for(InetAddress a:InetAddress.getAllByName("all.api.radio-browser.info")){String h=a.getCanonicalHostName();if(h.endsWith(".api.radio-browser.info")&&!hosts.contains(h))hosts.add(h);}}catch(Exception ignored){}Collections.shuffle(hosts);if(!hosts.contains("de1.api.radio-browser.info"))hosts.add("de1.api.radio-browser.info");return hosts;}
 private static String get(String url) throws Exception {HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();try{c.setConnectTimeout(8000);c.setReadTimeout(10000);c.setRequestProperty("User-Agent","SRGMobile/1.4.98 (Android internet radio)");if(c.getResponseCode()!=200)throw new IOException("HTTP "+c.getResponseCode());try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>2*1024*1024)throw new IOException("Za duża odpowiedź katalogu");}return new String(out.toByteArray(),StandardCharsets.UTF_8);}}finally{c.disconnect();}}
 static JSONArray search(String query,boolean poland) throws Exception {Exception last=null;int tries=0;for(String host:hosts()){if(tries++>=3)break;try{return clean(new JSONArray(get("https://"+host+"/json/stations/search?hidebroken=true&limit=50&order=clickcount&reverse=true"+(poland?"&countrycode=PL":"")+"&name="+URLEncoder.encode(query,"UTF-8"))));}catch(Exception e){last=e;}}throw new IOException("Katalog stacji jest niedostępny. Spróbuj ponownie.",last);}
 static void click(String id){if(!id.matches("[a-fA-F0-9-]{36}"))return;try{get("https://"+hosts().get(0)+"/json/url/"+id);}catch(Exception ignored){}}
}
