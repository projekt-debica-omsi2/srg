package pl.srgmobile.classic;

import android.app.job.*;
import android.content.*;
import android.net.*;
import android.os.Build;
import android.util.AtomicFile;
import android.webkit.JavascriptInterface;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.*;

public final class TimetableSync {
    private static final AtomicBoolean busy=new AtomicBoolean();
    private static final ExecutorService executor=Executors.newSingleThreadExecutor();
    private static final Object lock=new Object();
    private static final int JOB=1455;
    private static final long REFRESH=6*60*60*1000L;
    private static final String[][] STATIONS={{"rzeszow-da","rzeszow-glowny"},{"debica-da","debica"},{"sedziszow-grunwaldzka","sedziszow-malopolski-wschodni"}};
    static boolean bundled(Context c){return c.getSharedPreferences("timetables",Context.MODE_PRIVATE).getBoolean("useBundled",false);}
    static Network wifi(Context c){
        if(bundled(c))return null;
        ConnectivityManager cm=(ConnectivityManager)c.getSystemService(Context.CONNECTIVITY_SERVICE);
        for(Network n:cm.getAllNetworks()){NetworkCapabilities cap=cm.getNetworkCapabilities(n);if(cap!=null&&cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)&&cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)&&!cap.hasTransport(NetworkCapabilities.TRANSPORT_VPN))return n;}
        return null;
    }
    static String mksSource(Context c){return c.getSharedPreferences("timetables",Context.MODE_PRIVATE).getString("mksUrl","");}
    static String download(Context c,String address) throws Exception {
        URL url=new URL(address);
        for(int redirect=0;redirect<4;redirect++){
            if(!url.getProtocol().equals("https")||!(url.getHost().equals("gdziepociag.pl")||url.getHost().equals("www.gdziepociag.pl")||url.getHost().equals("pks.rzeszow.pl")||url.toString().equals(mksSource(c))))throw new IOException("Niedozwolone źródło rozkładu");
            Network n=wifi(c);if(n==null)throw new IOException("Oczekiwanie na Wi-Fi z Internetem");
            HttpURLConnection conn=(HttpURLConnection)n.openConnection(url);
            conn.setConnectTimeout(15000);conn.setReadTimeout(20000);conn.setInstanceFollowRedirects(false);conn.setRequestProperty("User-Agent","SRG-Mobile/1.4.55 (timetable offline sync)");
            try{
                int status=conn.getResponseCode();
                if(status>=300&&status<400){String location=conn.getHeaderField("Location");if(location==null)throw new IOException("Puste przekierowanie");url=new URL(url,location);continue;}
                if(status!=200)throw new IOException("Źródło odpowiada HTTP "+status);
                ByteArrayOutputStream data=new ByteArrayOutputStream();byte[] b=new byte[16384];
                try(InputStream in=conn.getInputStream()){int count;while((count=in.read(b))!=-1){if(Thread.currentThread().isInterrupted()||wifi(c)==null)throw new IOException("Przerwano pobieranie Wi-Fi");if(data.size()+count>6000000)throw new IOException("Przekroczony limit strony");data.write(b,0,count);}}
                String type=conn.getContentType();Charset encoding=StandardCharsets.UTF_8;
                if(type!=null){Matcher m=Pattern.compile("charset=([\\w-]+)",Pattern.CASE_INSENSITIVE).matcher(type);if(m.find())encoding=Charset.forName(m.group(1));}
                return new String(data.toByteArray(),encoding);
            }finally{conn.disconnect();}
        }
        throw new IOException("Zbyt wiele przekierowań");
    }
    private static AtomicFile file(Context c){return new AtomicFile(new File(c.getFilesDir(),"timetables-v1.json"));}
    static JSONObject read(Context c){synchronized(lock){try{return new JSONObject(new String(file(c).readFully(),StandardCharsets.UTF_8));}catch(Exception e){return new JSONObject();}}}
    static void save(Context c,JSONObject data) throws Exception {synchronized(lock){AtomicFile f=file(c);FileOutputStream out=null;try{out=f.startWrite();out.write(data.toString().getBytes(StandardCharsets.UTF_8));f.finishWrite(out);}catch(Exception e){if(out!=null)f.failWrite(out);throw e;}}}
    static JSONObject obj(JSONObject p,String key) throws Exception {JSONObject x=p.optJSONObject(key);if(x==null){x=new JSONObject();p.put(key,x);}return x;}
    static void run(Context c,AtomicBoolean cancelled) {
        long started=System.currentTimeMillis();JSONObject data=read(c);
        try{
            if(wifi(c)==null)return;
            LocalDate today=LocalDate.now(ZoneId.of("Europe/Warsaw"));
            JSONObject checked=obj(data,"checked"),errors=obj(data,"errors"),stations=obj(data,"stationRail");
            // Prune only past dates, leaving future offline snapshots intact.
            for(Iterator<String> i=stations.keys();i.hasNext();){JSONObject dates=stations.getJSONObject(i.next());List<String> gone=new ArrayList<>();for(Iterator<String> j=dates.keys();j.hasNext();){String d=j.next();if(d.compareTo(today.toString())<0)gone.add(d);}for(String d:gone)dates.remove(d);}
            for(JSONObject history:new JSONObject[]{checked,errors}){List<String> gone=new ArrayList<>();for(Iterator<String> i=history.keys();i.hasNext();){String k=i.next();int slash=k.indexOf('/');if(slash>=0&&k.substring(slash+1).compareTo(today.toString())<0)gone.add(k);}for(String k:gone)history.remove(k);}
            if(started-checked.optLong("pks")>=REFRESH){
                try{JSONObject pks=TimetableParser.pks(download(c,"https://pks.rzeszow.pl/tablice-dworcowe/13150019/rzeszow-d-a"),today);if(!pks.toString().equals(data.optJSONObject("pks")==null?"":data.getJSONObject("pks").toString())){data.put("pks",pks);data.put("updated",System.currentTimeMillis());}checked.put("pks",System.currentTimeMillis());errors.remove("pks");}
                catch(Exception e){errors.put("pks",e.getMessage());}
                save(c,data);
            }
            if(!data.has("mksNetwork")||started-checked.optLong("mksApi")>=REFRESH||!MksDirectApi.proxy(c).equals(data.optString("mksApiProxy"))){
                try{String proxyUsed=MksDirectApi.proxy(c);JSONObject meta=MksDirectApi.download(c);JSONObject network=MksDatabase.read(new File(c.getFilesDir(),"mks-schedule.bin"),c.getCacheDir());data.put("mksNetwork",network);data.put("mksApi",meta.put("applied",true));data.put("updated",System.currentTimeMillis());data.put("mksApiProxy",proxyUsed);checked.put("mksApi",System.currentTimeMillis());errors.remove("mksApi");}
                catch(Exception e){errors.put("mksApi",e.getMessage());}
                save(c,data);
            }
            String mksUrl=mksSource(c);
            if(!mksUrl.isEmpty()&&(started-checked.optLong("mks")>=REFRESH||!mksUrl.equals(data.optString("mksSource")))){
                try{JSONObject mks=TimetableParser.mks(download(c,mksUrl));data.put("mks",mks);data.put("mksSource",mksUrl);checked.put("mks",System.currentTimeMillis());errors.remove("mks");data.put("updated",System.currentTimeMillis());}
                catch(Exception e){errors.put("mks",e.getMessage());}
                save(c,data);
            }
            for(int offset=0;offset<7;offset++)for(String[] station:STATIONS){
                if(cancelled.get()||System.currentTimeMillis()-started>180000||wifi(c)==null)return;
                String day=today.plusDays(offset).toString(),key=station[0]+"/"+day;
                if(System.currentTimeMillis()-checked.optLong(key)<REFRESH)continue;
                try{
                    JSONObject feed=TimetableParser.rail(station[1],day,u->{if(cancelled.get())throw new IOException("Zatrzymano zadanie");return download(c,u);});
                    JSONObject dates=obj(stations,station[0]);JSONObject previous=dates.optJSONObject(day);
                    if(previous==null||!previous.toString().equals(feed.toString())){dates.put(day,feed);data.put("updated",System.currentTimeMillis());}
                    checked.put(key,System.currentTimeMillis());errors.remove(key);
                }catch(Exception e){errors.put(key,e.getMessage());}
                save(c,data);
            }
        }catch(Exception ignored){/* Old atomic snapshot remains readable on storage failures. */}
    }
    static void start(Context c,AtomicBoolean cancelled,Runnable done){
        if(!busy.compareAndSet(false,true)){if(done!=null)done.run();return;}
        Context app=c.getApplicationContext();executor.execute(()->{try{run(app,cancelled);}finally{busy.set(false);if(done!=null)done.run();}});
    }
    public static void install(Context c){
        JobScheduler scheduler=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if(scheduler.getPendingJob(JOB)==null){
            JobInfo.Builder b=new JobInfo.Builder(JOB,new ComponentName(c,TimetableSyncJob.class)).setPeriodic(15*60*1000L).setPersisted(true);
            if(Build.VERSION.SDK_INT>=28)b.setRequiredNetwork(new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build());
            else b.setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY);
            scheduler.schedule(b.build());
        }
        start(c,new AtomicBoolean(),null);
    }
    public static final class Bridge {
        private final Context context;
        public Bridge(Context c){context=c.getApplicationContext();}
        @JavascriptInterface public String mksProxy(){return MksDirectApi.proxy(context);}
        @JavascriptInterface public String setMksProxy(String address){
            try{String normalized=MksDirectApi.proxyAddress(address);
                if(!context.getSharedPreferences("timetables",Context.MODE_PRIVATE).edit().putString("mksProxyUrl",normalized).commit())return "Nie zapisano proxy";
                check();return normalized.isEmpty()?"Wybrano bezpośrednie API MKS":"Zapisano proxy MKS. Pobieranie przez Wi-Fi; przywrócony stary rozkład nadal wstrzymuje aktualizacje.";
            }catch(Exception e){return "Nie zapisano proxy: "+e.getMessage();}
        }
        @JavascriptInterface public String mksSource(){return TimetableSync.mksSource(context);}
        @JavascriptInterface public String setMksSource(String address){
            try{
                if(!address.isEmpty()){
                    URL url=new URL(address);
                    if(!url.getProtocol().equals("https")||url.getHost().isEmpty()||url.getUserInfo()!=null||url.getRef()!=null)throw new Exception("Wpisz pełny adres HTTPS pliku JSON");
                }
                context.getSharedPreferences("timetables",Context.MODE_PRIVATE).edit().putString("mksUrl",address).apply();
                // The next check uses the new endpoint; the previous good data is retained.
                synchronized(lock){JSONObject data=read(context);obj(data,"checked").remove("mks");save(context,data);}
                check();return address.isEmpty()?"Wyłączono pobieranie MKS; zachowano ostatnią kopię.":"Zapisano źródło MKS. Pobieranie przy dostępnym Wi-Fi.";
            }catch(Exception e){return "Nie zapisano źródła: "+e.getMessage();}
        }
        @JavascriptInterface public boolean useBundled(boolean value){
            boolean ok=context.getSharedPreferences("timetables",Context.MODE_PRIVATE).edit().putBoolean("useBundled",value).commit();
            if(ok&&!value)check();return ok;
        }
        @JavascriptInterface public String snapshot(){return bundled(context)?"{\"useBundled\":true}":read(context).toString();}
        @JavascriptInterface public String status(){return bundled(context)?"Przywrócono rozkład z aplikacji — aktualizacje wstrzymane":busy.get()?"Pobieranie rozkładów przez Wi-Fi":wifi(context)!=null?"Wi-Fi dostępne — sprawdzanie co 6 godzin":"Offline — oczekiwanie na Wi-Fi z Internetem";}
        @JavascriptInterface public void check(){start(context,new AtomicBoolean(),null);}
    }
}
