package pl.srgmobile.classic;

import android.content.Context;
import org.json.JSONObject;
import org.json.JSONArray;
import android.content.res.AssetManager;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Read-only private LCD panel, reachable only on the tablet's local Wi-Fi/LAN.
 * NOT for public Internet or port forwarding. No GPS coordinates or driver info served.
 */
final class LocalPanelServer {
    private final Context context;
    private volatile String state = "{\"active\":false}";
    private volatile long lastPublish = 0;
    private volatile boolean running = false;
    private ServerSocket server;
    private final ExecutorService workers = Executors.newFixedThreadPool(3);
    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList(
        "lcdManual", "lcdConfig", "active", "line", "direction", "current", "next", "following", "index", "count", "phase", "phaseUntil", "clock", "course", "kursAktywny", "kursId", "linia", "kierunek", "aktualnyIndeks", "koniecKursu", "koncowyNastepny", "reklamyPoZapowiedzi", "przystanki", "aktualny", "nastepny", "przesiadka"));

    LocalPanelServer(Context context) { this.context = context; }

    void start() {
        if (running) return;
        running = true;
        Thread accept = new Thread(() -> {
            try (ServerSocket ss = new ServerSocket(47283)) {
                server = ss;
                ss.setReuseAddress(true);
                while (running) {
                    Socket client = ss.accept();
                    try { workers.execute(() -> handle(client)); }
                    catch (Exception e) { try { client.close(); } catch (Exception ignored) {} }
                }
            } catch (Exception ignored) { running = false; }
        }, "SRG-LCD-HTTP");
        accept.setDaemon(true); accept.start();
    }

    void publish(String raw) {
        if (raw == null || raw.length() > 16000) return;
        try {
            JSONObject input = new JSONObject(raw), safe = new JSONObject();
            for (String field : ALLOWED) {
                if (!input.has(field)) continue;
                Object value = input.opt(field);
                if (value instanceof Boolean || value instanceof Number) safe.put(field, value);
                else if (value instanceof String) safe.put(field, ((String)value).substring(0, Math.min(180, ((String)value).length())));
                else if ((field.equals("przystanki") && value instanceof org.json.JSONArray) || ((field.equals("aktualny") || field.equals("nastepny") || field.equals("przesiadka") || field.equals("lcdConfig") || field.equals("lcdManual")) && value instanceof JSONObject)) safe.put(field, value);
            }
            state = safe.toString();
            lastPublish = System.currentTimeMillis();
        } catch (Exception ignored) { }
    }

    void close() {
        running = false;
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        workers.shutdownNow();
    }

    private void handle(Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(2500);
            BufferedReader br = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
            String first = br.readLine();
            if (first == null || first.length() > 2048 || !first.startsWith("GET ")) return;
            String[] parts = first.split(" ");
            if (parts.length < 2) return;
            // Never support POST, uploaded files, or filesystem paths.
            int lines = 0; String line;
            while ((line = br.readLine()) != null && !line.isEmpty() && lines++ < 32) { /* headers */ }
            String path = parts[1];
            // Public read-only to local LAN: no query key (user QR points to bare IP:47283).
            String route = path.split("\\?",2)[0];
            if (route.equals("/") || route.equals("/lcd.html")) {
                send(socket, 200, "text/html; charset=utf-8", asset("lcd.html"));
            } else if (route.equals("/manifest.webmanifest")) {
                send(socket, 200, "application/manifest+json", asset("manifest.webmanifest"));
            } else if (route.equals("/lcd-cycle.js")) {
                send(socket, 200, "application/javascript; charset=utf-8", asset("lcd-cycle.js"));
            } else if (route.equals("/transfer-draft.js")) {
                send(socket, 200, "application/javascript; charset=utf-8", asset("transfer-draft.js"));
            } else if (route.equals("/app.js")) {
                send(socket, 200, "application/javascript; charset=utf-8", asset("app.js"));
            } else if (route.equals("/app.css")) {
                send(socket, 200, "text/css; charset=utf-8", asset("app.css"));
            } else if (route.equals("/api/reklamy")) {
                JSONArray list = new JSONArray();
                String[] files = context.getAssets().list("reklama");
                if (files != null) for (String file : files) {
                    if (!file.matches("[^/\\\\]{1,200}\\.(?i:png|jpg|jpeg|gif|webp|mp4)")) continue;
                    JSONObject item = new JSONObject();item.put("url", "/reklama/"+android.net.Uri.encode(file));
                    item.put("typ", file.toLowerCase(java.util.Locale.ROOT).endsWith("mp4")?"video":"image");list.put(item);
                }
                JSONArray imported=new AdStore(context).list();
                for(int i=0;i<imported.length();i++)list.put(imported.getJSONObject(i));
                send(socket, 200, "application/json; charset=utf-8", list.toString().getBytes(StandardCharsets.UTF_8));
            } else if (route.startsWith("/reklama-local/")) {
                String name=route.substring("/reklama-local/".length());
                java.io.File file=new AdStore(context).file(name);
                if(file==null||!file.isFile()){send(socket,404,"text/plain",new byte[0]);return;}
                String mime=name.endsWith(".mp4")?"video/mp4":name.endsWith(".png")?"image/png":name.endsWith(".gif")?"image/gif":name.endsWith(".webp")?"image/webp":"image/jpeg";
                try(InputStream in=new java.io.FileInputStream(file)) {
                    OutputStream out=socket.getOutputStream();
                    out.write(("HTTP/1.1 200 OK\r\nContent-Type: "+mime+"\r\nContent-Length: "+file.length()+"\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.flush();
                }
            } else if (route.startsWith("/reklama/")) {
                String file = android.net.Uri.decode(route.substring("/reklama/".length()));
                if (!file.matches("[^/\\\\]{1,200}\\.(?i:png|jpg|jpeg|gif|webp|mp4)")) {
                    send(socket, 404, "text/plain", "Not found".getBytes(StandardCharsets.US_ASCII));return;
                }
                String extension = file.substring(file.lastIndexOf('.')+1).toLowerCase(java.util.Locale.ROOT);
                String mime = extension.equals("mp4")?"video/mp4":extension.equals("png")?"image/png":extension.equals("gif")?"image/gif":extension.equals("webp")?"image/webp":"image/jpeg";
                sendAssetStream(socket,"reklama/"+file,mime);
            } else if (route.equals("/api/state")) {
                String json = state.substring(0, state.length()-1) + ",\"updatedAt\":"+lastPublish+"}";
                send(socket, 200, "application/json; charset=utf-8", json.getBytes(StandardCharsets.UTF_8));
            } else { send(socket, 404, "text/plain", "Not found".getBytes(StandardCharsets.US_ASCII)); }
        } catch (Exception ignored) { }
    }

    private void sendAssetStream(Socket socket, String name, String mime) throws Exception {
        // Stream assets to avoid copying large videos into heap; Android AssetInputStream supports available().
        try (InputStream file = context.getAssets().open(name, AssetManager.ACCESS_STREAMING)) {
            OutputStream out = socket.getOutputStream();
            long remaining = file.available();
            String headers = "HTTP/1.1 200 OK\r\nContent-Type: "+mime+"\r\nContent-Length: "+remaining+
                "\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
            out.write(headers.getBytes(StandardCharsets.US_ASCII));
            byte[] buffer=new byte[16384];int n;
            while ((n=file.read(buffer))!=-1){out.write(buffer,0,n);}
            out.flush();
        }
    }

    private byte[] asset(String name) throws Exception {
        try (InputStream stream = context.getAssets().open(name); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int n;
            while ((n=stream.read(buffer))>0) bytes.write(buffer,0,n);
            return bytes.toByteArray();
        }
    }

    private void send(Socket socket, int code, String contentType, byte[] body) throws Exception {
        OutputStream out = socket.getOutputStream();
        String header = "HTTP/1.1 "+code+" "+(code==200?"OK":code==403?"Forbidden":"Not Found")+"\r\n"+
                "Content-Type: "+contentType+"\r\n"+
                "Content-Length: "+body.length+"\r\n"+
                "Cache-Control: no-store, max-age=0\r\n"+
                "X-Content-Type-Options: nosniff\r\n"+
                "X-Frame-Options: DENY\r\n"+
                "Connection: close\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.US_ASCII));out.write(body);out.flush();
    }
}
