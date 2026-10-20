package pl.srgmobile.classic;
import android.content.Context;
import android.net.Network;
import android.util.AtomicFile;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Original public myBus transport, using the protocol supplied with the project. */
public final class MksDirectApi {
    static final String BASE="http://rj.mks.debica.pl/AndroidService/SchedulesService.svc/";
    static final int CODE_SUM=343;
    static final String DEFAULT_PROXY="http://xn--e-dbica-c9a.pl:8088/mybus-hub-api.php?city=DEBIC&action=schedule";
    interface Fetch {byte[] get(String method,long age,int limit) throws Exception;}
    static long parsePing(byte[] bytes) throws Exception {
        String text=Jsoup.parse(new String(bytes,StandardCharsets.UTF_8)).text().trim();
        if(!text.matches("[0-9]{1,10}"))throw new IOException("Nieprawidłowa odpowiedź PingService MKS");
        return Long.parseLong(text);
    }
    static byte[] schedule(Fetch fetch) throws Exception {
        long ping=parsePing(fetch.get("PingService",CODE_SUM+60,65536));
        byte[] bytes=fetch.get("GetScheduleFile",CODE_SUM+ping,64*1024*1024);
        validateSchedule(bytes);return bytes;
    }
    static void validateSchedule(byte[] bytes) throws Exception {
        if(bytes.length<128)throw new IOException("Niepełna baza MKS");
        String prefix=new String(bytes,0,Math.min(bytes.length,256),StandardCharsets.UTF_8).trim().toLowerCase(java.util.Locale.ROOT);
        if(prefix.startsWith("<")||prefix.startsWith("{")||prefix.startsWith("[")||prefix.contains("unauthorized access"))throw new IOException("API MKS zwróciło komunikat zamiast bazy");
    }
    static byte[] get(Context context,String method,long age,int limit) throws Exception {
        if(!method.equals("PingService")&&!method.equals("GetScheduleFile"))throw new IOException("Niedozwolona metoda MKS");
        return transfer(context,new URL(BASE+method),age,limit);
    }
    static byte[] transfer(Context context,URL url,Long age,int limit) throws Exception {
        Network wifi=TimetableSync.wifi(context);if(wifi==null)throw new IOException("Oczekiwanie na Wi-Fi");
        HttpURLConnection conn=(HttpURLConnection)wifi.openConnection(url);
        conn.setConnectTimeout(15000);conn.setReadTimeout(age==null?90000:30000);conn.setInstanceFollowRedirects(false);
        conn.setRequestProperty("User-Agent","myBusOnline");if(age!=null)conn.setRequestProperty("Age",Long.toString(age));conn.setRequestProperty("Accept","*/*");
        try{
            int status=conn.getResponseCode();if(status!=200)throw new IOException("API MKS: HTTP "+status);
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[16384];
            try(InputStream in=conn.getInputStream()){int n;while((n=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted()||TimetableSync.wifi(context)==null)throw new IOException("Przerwano Wi-Fi MKS");if(out.size()+n>limit)throw new IOException("Przekroczony limit bazy MKS");out.write(buffer,0,n);}}
            return out.toByteArray();
        }finally{conn.disconnect();}
    }
    static String proxyAddress(String address) throws Exception {
        if(address.trim().isEmpty())return "";
        URL url=new URL(address.trim());
        String host=IDN.toASCII(url.getHost()).toLowerCase(java.util.Locale.ROOT);
        boolean siteHttp=url.getProtocol().equals("http")&&host.equals("xn--e-dbica-c9a.pl")&&url.getPort()==8088;
        if((!url.getProtocol().equals("https")&&!siteHttp)||host.isEmpty()||url.getUserInfo()!=null||url.getRef()!=null)throw new IOException("Proxy wymaga HTTPS lub adresu e-dębica.pl:8088, bez loginu i fragmentu");
        url=new URL(url.getProtocol(),host,url.getPort(),url.getFile());
        if(url.getQuery()==null||url.getQuery().isEmpty())return url.toString()+"?city=DEBIC&action=schedule";
        java.util.Map<String,String> params=new java.util.HashMap<>();
        for(String item:url.getQuery().split("&")){String[] pair=item.split("=",2);params.put(java.net.URLDecoder.decode(pair[0],"UTF-8"),pair.length>1?java.net.URLDecoder.decode(pair[1],"UTF-8"):"");}
        if(!"DEBIC".equals(params.get("city"))||!"schedule".equals(params.get("action")))throw new IOException("Adres proxy wymaga city=DEBIC i action=schedule");
        return url.toString();
    }
    static String proxy(Context context){return context.getSharedPreferences("timetables",Context.MODE_PRIVATE).getString("mksProxyUrl",DEFAULT_PROXY);}
    public static JSONObject download(Context context) throws Exception {
        String proxy=proxy(context);
        byte[] bytes=proxy.isEmpty()?schedule((method,age,limit)->get(context,method,age,limit)):transfer(context,new URL(proxyAddress(proxy)),null,64*1024*1024);
        validateSchedule(bytes);
        String format=bytes[0]==31&&(bytes[1]&255)==139?"gzip":new String(bytes,0,16,StandardCharsets.US_ASCII).equals("SQLite format 3\0")?"sqlite":"binary";
        MessageDigest md=MessageDigest.getInstance("SHA-256");StringBuilder hash=new StringBuilder();for(byte b:md.digest(bytes))hash.append(String.format("%02x",b&255));
        AtomicFile file=new AtomicFile(new File(context.getFilesDir(),"mks-schedule.bin"));FileOutputStream out=null;
        try{out=file.startWrite();out.write(bytes);file.finishWrite(out);}catch(Exception e){if(out!=null)file.failWrite(out);throw e;}
        return new JSONObject().put("source",proxy.isEmpty()?BASE+"GetScheduleFile":proxy).put("transport",proxy.isEmpty()?"direct":"proxy").put("downloaded",System.currentTimeMillis()).put("bytes",bytes.length).put("sha256",hash.toString()).put("format",format).put("applied",false);
    }
}
