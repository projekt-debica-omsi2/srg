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
    private final AtomicBoolean cameraBusy = new AtomicBoolean(false);
    private final AtomicBoolean commandBusy = new AtomicBoolean(false);
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private android.speech.tts.TextToSpeech speech;
    private boolean speechReady=false;
    private void speechStatus(String message) { web.evaluateJavascript("window.SRGOmsiSpeechStatus&&window.SRGOmsiSpeechStatus("+JSONObject.quote(message)+")",null); }
    @JavascriptInterface public void speak(String text,String language) {
        if(text==null||text.length()>300)return;
        web.post(()->{
            if(speech==null){speech=new android.speech.tts.TextToSpeech(web.getContext(),result->{speechReady=result==android.speech.tts.TextToSpeech.SUCCESS;if(speechReady)speak(text,language);else speechStatus("Brak silnika głosu systemowego");});return;}
            if(!speechReady){speechStatus("Głos nie jest jeszcze gotowy");return;}
            java.util.Locale locale="pl".equals(language)?new java.util.Locale("pl"):"en".equals(language)?java.util.Locale.ENGLISH:java.util.Locale.GERMAN;
            if(speech.setLanguage(locale)<0){speechStatus("Brak głosu dla wybranego języka w systemie");return;}
            int result=speech.speak(text,android.speech.tts.TextToSpeech.QUEUE_FLUSH,null,"omsi-stop");speechStatus(result==android.speech.tts.TextToSpeech.SUCCESS?"Zapowiedź przekazana do głosu systemowego":"Błąd zapowiedzi");
        });
    }
    public void close(){if(speech!=null){speech.stop();speech.shutdown();speech=null;}speechReady=false;}
    public OmsiBridge(WebView web) { this.web = web; }
    static boolean allowed(String host) {
        if(host == null || !host.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) return false;
        String[] p=host.split("\\."); int[] a=new int[4];
        for(int i=0;i<4;i++){a[i]=Integer.parseInt(p[i]); if(a[i]>255)return false;}
        return a[0]==10 || (a[0]==192&&a[1]==168) || (a[0]==172&&a[1]>=16&&a[1]<=31) || host.equals("127.0.0.1");
    }
    @JavascriptInterface public void poll(String host,String token,String id) { exchange(host,token,id,null,-1); }
    @JavascriptInterface public void command(String host,String token,String payload,String id) { if(payload==null||payload.length()>2048)return;exchange(host,token,id,payload,-1); }
    @JavascriptInterface public void camera(String host,String token,int channel,String id) { if(!((channel>=0&&channel<=3)||(channel>=16&&channel<80)))return;exchange(host,token,id,null,channel); }
    private void exchange(String host,String token,String id,String payload,int channel) {
        AtomicBoolean gate=channel>=0?cameraBusy:payload==null?busy:commandBusy;
        if(!gate.compareAndSet(false,true))return;
        new Thread(()->{
            String response;
            try {
                boolean usb = "127.0.0.1".equals(host);
                int port = usb ? 8766 : 8765;
                if(!allowed(host)||(!usb&&(token==null||!token.matches("[0-9]{4}"))))throw new Exception("Sprawdź lokalny adres IPv4 i kod parowania.");
                try(Socket socket=new Socket()){
                    socket.connect(new InetSocketAddress(host,port),2000); socket.setSoTimeout(2500);
                    byte[] body=payload==null?new byte[0]:payload.getBytes(StandardCharsets.UTF_8);
                    String request=(channel>=0?"GET /api/camera/"+channel:payload==null?"GET /api/status":"POST /api/command")+" HTTP/1.0\r\nHost: "+host+":"+port+"\r\nAuthorization: Bearer "+token+"\r\nContent-Type: application/json\r\nContent-Length: "+body.length+"\r\nConnection: close\r\n\r\n";
                    socket.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));
                    if(body.length>0)socket.getOutputStream().write(body);
                    ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buf=new byte[4096];int n;
                    while((n=socket.getInputStream().read(buf))!=-1){out.write(buf,0,n);if(out.size()>1048576)throw new Exception("Zbyt duża odpowiedź.");}
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
            String callback=channel>=0?"SRGOmsiCameraResult":payload==null?"SRGOmsiResult":"SRGOmsiCommandResult";
            final String script="window."+callback+"&&window."+callback+"("+JSONObject.quote(id)+","+response+")";
            gate.set(false);web.post(()->web.evaluateJavascript(script,null));
        },"SRG-OMSI-poll").start();
    }
}
