package pl.srgmobile.classic;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.net.Socket;
import java.net.InetSocketAddress;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/** Fixed read-only endpoint on numeric private IPv4 addresses. No redirects or arbitrary URLs. */
public final class OmsiBridge {
    private final WebView web;
    private final AtomicBoolean busy = new AtomicBoolean(false);
    public OmsiBridge(WebView web) { this.web = web; }
    static boolean allowed(String host) {
        if(host == null || !host.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) return false;
        String[] p=host.split("\\."); int[] a=new int[4];
        for(int i=0;i<4;i++){a[i]=Integer.parseInt(p[i]); if(a[i]>255)return false;}
        return a[0]==10 || (a[0]==192&&a[1]==168) || (a[0]==172&&a[1]>=16&&a[1]<=31) || host.equals("127.0.0.1");
    }
    @JavascriptInterface public void poll(String host,String token,String id) {
        if(!busy.compareAndSet(false,true))return;
        new Thread(()->{
            String response;
            try {
                if(!allowed(host)||token==null||!token.matches("[a-f0-9]{24}"))throw new Exception("Sprawdź lokalny adres IPv4 i kod parowania.");
                try(Socket socket=new Socket()){
                    socket.connect(new InetSocketAddress(host,8765),2000); socket.setSoTimeout(2500);
                    String request="GET /api/status HTTP/1.0\r\nHost: "+host+":8765\r\nAuthorization: Bearer "+token+"\r\nConnection: close\r\n\r\n";
                    socket.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));
                    ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buf=new byte[4096];int n;
                    while((n=socket.getInputStream().read(buf))!=-1){out.write(buf,0,n);if(out.size()>262144)throw new Exception("Zbyt duża odpowiedź.");}
                    String raw=new String(out.toByteArray(),StandardCharsets.UTF_8);
                    if(!raw.startsWith("HTTP/1.0 200 ")&&!raw.startsWith("HTTP/1.1 200 "))throw new Exception("Brak autoryzacji lub błąd mostka.");
                    int split=raw.indexOf("\r\n\r\n");if(split<0)throw new Exception("Niepełna odpowiedź.");
                    JSONObject data=new JSONObject(raw.substring(split+4));
                    if(data.optInt("schema")!=1)throw new Exception("Nieobsługiwana wersja mostka.");
                    response=new JSONObject().put("ok",true).put("data",data).toString();
                }
            } catch(Exception e) {
                response="{\"ok\":false,\"error\":"+JSONObject.quote(e.getMessage()==null?"Brak połączenia":e.getMessage())+"}";
            }
            final String script="window.SRGOmsiResult&&window.SRGOmsiResult("+JSONObject.quote(id)+","+response+")";
            busy.set(false);web.post(()->web.evaluateJavascript(script,null));
        },"SRG-OMSI-poll").start();
    }
}
