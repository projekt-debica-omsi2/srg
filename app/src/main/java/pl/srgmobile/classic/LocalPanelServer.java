package pl.srgmobile.classic;

import android.content.Context;
import org.json.JSONObject;
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
    private final String key;
    private volatile String state = "{\"active\":false}";
    private volatile long lastPublish = 0;
    private volatile boolean running = false;
    private ServerSocket server;
    private final ExecutorService workers = Executors.newFixedThreadPool(3);
    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList(
        "active", "line", "direction", "current", "next", "following", "index", "count", "phase", "phaseUntil", "clock", "course"));

    LocalPanelServer(Context context, String key) { this.context = context; this.key = key; }
    String getKey() { return key; }

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
        if (raw == null || raw.length() > 4000) return;
        try {
            JSONObject input = new JSONObject(raw), safe = new JSONObject();
            for (String field : ALLOWED) {
                if (!input.has(field)) continue;
                Object value = input.opt(field);
                if (value instanceof Boolean || value instanceof Number) safe.put(field, value);
                else if (value instanceof String) safe.put(field, ((String)value).substring(0, Math.min(150, ((String)value).length())));
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
            boolean loopback = socket.getInetAddress().isLoopbackAddress();
            boolean paired = loopback || path.matches("[^#]*[?&]key="+key+"(?:&[^#]*)?");
            if (!paired) { send(socket, 403, "text/plain", "Brak kodu parowania SRG LCD".getBytes(StandardCharsets.UTF_8)); return; }
            String route = path.split("\\?",2)[0];
            if (route.equals("/") || route.equals("/lcd.html")) {
                send(socket, 200, "text/html; charset=utf-8", asset("lcd.html"));
            } else if (route.equals("/manifest.webmanifest")) {
                send(socket, 200, "application/manifest+json", new String(asset("manifest.webmanifest"), StandardCharsets.UTF_8).replace("__KEY__",key).getBytes(StandardCharsets.UTF_8));
            } else if (route.equals("/api/state")) {
                String json = state.substring(0, state.length()-1) + ",\"updatedAt\":"+lastPublish+"}";
                send(socket, 200, "application/json; charset=utf-8", json.getBytes(StandardCharsets.UTF_8));
            } else { send(socket, 404, "text/plain", "Not found".getBytes(StandardCharsets.US_ASCII)); }
        } catch (Exception ignored) { }
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
