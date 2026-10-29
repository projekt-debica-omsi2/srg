package pl.srgmobile.classic;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.GnssStatus;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.content.res.AssetFileDescriptor;
import java.util.ArrayDeque;
import java.io.IOException;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;
import java.net.NetworkInterface;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.util.Collections;

/** Natywne, lokalne GPS_PROVIDER bez wymagania Internetu. */
public final class MainActivity extends Activity implements LocationListener {
    private RgUsbBridge rgUsb, ibisUsb;
    private static final int LOCATION_REQUEST = 41;
    private static final int MEDIA_REQUEST = 42;
    private PermissionRequest pendingMediaRequest;
    private float voiceVolume = 0.9f;
    private WebView web;
    private LocationManager gps;
    private boolean requested = false;
    private boolean listening = false;
    private boolean pageReady = false;
    private boolean receivedFix = false;
    private int satellitesUsed = -1;
    private long lastFixAt = 0L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private GnssStatus.Callback satCallback;
    private MediaPlayer voicePlayer;
    private final ArrayDeque<String> pendingVoice = new ArrayDeque<>();
    private LocalPanelServer lcdServer;
    private int chimeIndex = 1;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requested = getPreferences(MODE_PRIVATE).getBoolean("gps_requested", false);
        if (state != null) requested = state.getBoolean("gps_requested", requested);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        gps = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        chimeIndex = 1; // Jedyny dzwonek B2-E4-C4
        voiceVolume = getPreferences(MODE_PRIVATE).getFloat("voice_volume",0.9f);
        // LCD: odczyt tylko w lokalnej sieci Wi-Fi/hotspot, stały port 47283,
        // brak klucza w adresie (zgodność z wydrukowanym QR).
        lcdServer = new LocalPanelServer(this);
        lcdServer.start();
        web = new WebView(this);
        web.setBackgroundColor(0xff070a09);
        WebSettings cfg = web.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true);
        cfg.setDefaultTextEncodingName("UTF-8");
        cfg.setAllowFileAccess(true);
        cfg.setAllowContentAccess(false);
        cfg.setAllowFileAccessFromFileURLs(false);
        cfg.setAllowUniversalAccessFromFileURLs(false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    // WebView wczytuje wyłącznie lokalne, zaufane assety aplikacji.
                    String origin = String.valueOf(request.getOrigin());
                    if (!origin.startsWith("file://")) { request.deny();return; }
                    List<String> missing=new ArrayList<>();
                    for (String r:request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                            if (checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)
                                missing.add(Manifest.permission.CAMERA);
                        } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
                                missing.add(Manifest.permission.RECORD_AUDIO);
                        } else {request.deny();return;}
                    }
                    if (pendingMediaRequest!=null) pendingMediaRequest.deny();
                    pendingMediaRequest=request;
                    if (missing.isEmpty()) completeMediaPermission();
                    else requestPermissions(missing.toArray(new String[0]),MEDIA_REQUEST);
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                runOnUiThread(() -> { if (pendingMediaRequest==request) pendingMediaRequest=null; });
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest req) {
                String url = req.getUrl().toString();
                return !url.startsWith("file:///android_asset/");
            }
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (requested) startGpsNative(); else explainStatus();
            }
        });
        TimetableSync.install(this);
        web.addJavascriptInterface(new TimetableSync.Bridge(this), "SRGTimetables");
        web.addJavascriptInterface(new Object(){
            @JavascriptInterface public void exportFile(){runOnUiThread(()->{
                if(!new java.io.File(getFilesDir(),"mks-schedule.bin").isFile()){android.widget.Toast.makeText(MainActivity.this,"API MKS nie pobrało jeszcze bazy",android.widget.Toast.LENGTH_LONG).show();return;}
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.setType("application/octet-stream");intent.addCategory(Intent.CATEGORY_OPENABLE);intent.putExtra(Intent.EXTRA_TITLE,"mks-schedule.bin");startActivityForResult(intent,44);
            });}
        },"SRGMksExport");
        web.addJavascriptInterface(new GpsBridge(), "SRGNativeGPS");
        web.addJavascriptInterface(new OmsiBridge(web), "SRGOmsiNative");
        web.addJavascriptInterface(new AudioBridge(), "SRGNativeAudio");
        web.addJavascriptInterface(new LcdBridge(), "SRGLcd");
        rgUsb = new RgUsbBridge(this, web);
        web.addJavascriptInterface(rgUsb, "SRGRgUsb");
        ibisUsb = new RgUsbBridge(this, web, "IBIS", "ibisUsbEvent");
        web.addJavascriptInterface(ibisUsb, "SRGIbisUsb");
        web.addJavascriptInterface(new Object(){
            @JavascriptInterface public boolean isPhone(){return getResources().getConfiguration().smallestScreenWidthDp < 600;}
            @JavascriptInterface public String version(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception e){return "";}}
        }, "SRGApp");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    public final class GpsBridge {
        @JavascriptInterface public void start() {
            runOnUiThread(() -> {
                requested = true;
                storeRequested();
                startGpsNative();
            });
        }
        @JavascriptInterface public void stop() {
            runOnUiThread(() -> {
                requested = false;
                storeRequested();
                stopListening();
                sendStatus("STOPPED", "Wyłączono ręcznie przyciskiem Zatrzymaj.");
            });
        }
        @JavascriptInterface public void getStatus() {
            runOnUiThread(() -> explainStatus());
        }
        @JavascriptInterface public void openLocationSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)); }
                catch (Exception e) { sendStatus("ERROR", "Nie można otworzyć ustawień Androida: "+e.getMessage()); }
            });
        }
    }

    /** Publish ONLY passenger-facing course data; never expose coordinates or driver ID. */
    public final class LcdBridge {
        @JavascriptInterface public void chooseAds() {
            runOnUiThread(() -> {
                Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);picker.setType("*/*");
                picker.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/gif","image/webp","video/mp4"});
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                try{startActivityForResult(picker,43);}catch(Exception e){adsNotice("Nie można otworzyć wyboru plików.");}
            });
        }
        @JavascriptInterface public String listAds() {
            try{return new AdStore(MainActivity.this).list().toString();}catch(Exception e){return "[]";}
        }
        @JavascriptInterface public boolean removeAd(String id) { return new AdStore(MainActivity.this).remove(id); }
        @JavascriptInterface public void publish(String json) {
            if (lcdServer != null) lcdServer.publish(json);
        }
        @JavascriptInterface public String getUrl() {
            return "http://"+getLocalIp()+":47283/";
        }
    }
    private void adsNotice(String text) {
        runOnUiThread(() -> { if(web!=null)web.evaluateJavascript("window.srgAdsUpdated && window.srgAdsUpdated("+JSONObject.quote(text)+")",null); });
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==44){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null){final android.net.Uri uri=data.getData();new Thread(()->{
                String message;
                try(java.io.InputStream in=new java.io.FileInputStream(new java.io.File(getFilesDir(),"mks-schedule.bin"));java.io.OutputStream out=getContentResolver().openOutputStream(uri)){
                    if(out==null)throw new java.io.IOException("Brak dostępu do pliku");byte[] buffer=new byte[16384];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);message="Zapisano bazę MKS";
                }catch(Exception e){message="Nie zapisano bazy MKS: "+e.getMessage();}
                final String result=message;runOnUiThread(()->android.widget.Toast.makeText(this,result,android.widget.Toast.LENGTH_LONG).show());
            },"MKS-export").start();}return;
        }
        if(requestCode!=43)return;
        if(resultCode!=RESULT_OK||data==null){adsNotice("Nie dodano plików.");return;}
        List<android.net.Uri> uris=new ArrayList<>();
        if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());
        else if(data.getData()!=null)uris.add(data.getData());
        adsNotice("Zapisywanie reklam…");
        new Thread(() -> {
            int added=0;String error="";AdStore store=new AdStore(this);
            for(android.net.Uri uri:uris)try{store.add(uri);added++;}catch(Exception e){error=String.valueOf(e.getMessage());}
            adsNotice("Dodano: "+added+" z "+uris.size()+"."+(error.isEmpty()?"":" "+error));
        },"SRG-ad-import").start();
    }
    private void completeMediaPermission() {
        PermissionRequest r=pendingMediaRequest; pendingMediaRequest=null;
        if(r==null)return;
        List<String> permitted=new ArrayList<>();
        for(String res:r.getResources()) {
            if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) &&
               checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)
                permitted.add(res);
            else if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) &&
               checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)
                permitted.add(res);
        }
        if (permitted.size()==r.getResources().length && !permitted.isEmpty())
            r.grant(permitted.toArray(new String[0]));
        else r.deny();
    }

    private String getLocalIp() {
        String fallback = null;
        try {
            for (NetworkInterface nif : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!nif.isUp() || nif.isLoopback()) continue;
                for (InetAddress ip : Collections.list(nif.getInetAddresses())) {
                    if (!(ip instanceof Inet4Address) || !ip.isSiteLocalAddress() || ip.isLoopbackAddress()) continue;
                    // Prefer the tablet Wi-Fi address over any VPN or tethering interface.
                    if (nif.getName().toLowerCase(java.util.Locale.ROOT).startsWith("wlan")) return ip.getHostAddress();
                    if (fallback == null) fallback = ip.getHostAddress();
                }
            }
        } catch (Exception ignored) { }
        return fallback == null ? "127.0.0.1" : fallback;
    }

    /** Each utterance starts with the selected short chime (1..4). */
    public final class AudioBridge {
        @JavascriptInterface public void announceStop(int stopId, boolean onRequest) {
            if (stopId < 1 || stopId > 68) return;
            runOnUiThread(() -> {
                if (onRequest) queueVoice(chimeFile(), "next.mp3", "stops/"+stopId+".mp3", "na_zadanie.mp3");
                else queueVoice(chimeFile(), "next.mp3", "stops/"+stopId+".mp3");
            });
        }
        @JavascriptInterface public void announceTerminal(int stopId, boolean onRequest) {
            if (stopId < 1 || stopId > 68) return;
            runOnUiThread(() -> {
                if (onRequest) queueVoice(chimeFile(), "next.mp3", "stops/"+stopId+".mp3", "na_zadanie.mp3", "terminal.mp3");
                else queueVoice(chimeFile(), "next.mp3", "stops/"+stopId+".mp3", "terminal.mp3");
            });
        }
        @JavascriptInterface public void announceName(int stopId, boolean onRequest) {
            if (stopId < 1 || stopId > 68) return;
            runOnUiThread(() -> {
                if (onRequest) queueVoice(chimeFile(), "stops/"+stopId+".mp3", "na_zadanie.mp3");
                else queueVoice(chimeFile(), "stops/"+stopId+".mp3");
            });
        }
        @JavascriptInterface public void announceStart(int variantIndex) {
            if (variantIndex < 0 || variantIndex > 6) return;
            runOnUiThread(() -> queueVoice(chimeFile(), "start/"+variantIndex+".mp3"));
        }
        @JavascriptInterface public void announceInspection() {
            runOnUiThread(() -> queueVoice(chimeFile(), "inspection.mp3"));
        }
        @JavascriptInterface public void setChime(int i) {
            if (i != 1) return;
            runOnUiThread(() -> {
                chimeIndex = i;
                getPreferences(MODE_PRIVATE).edit().putInt("chime_index", i).apply();
                queueVoice(chimeFile());
            });
        }
        @JavascriptInterface public void stop() { runOnUiThread(() -> stopVoice()); }
        @JavascriptInterface public void setVolume(int percent) {
            runOnUiThread(() -> {
                voiceVolume=Math.max(0f,Math.min(1f,percent/100f));
                getPreferences(MODE_PRIVATE).edit().putFloat("voice_volume",voiceVolume).apply();
                if(voicePlayer!=null)voicePlayer.setVolume(voiceVolume,voiceVolume);
            });
        }
    }
    private String chimeFile() { return "chimes/"+chimeIndex+".mp3"; }
    private void queueVoice(String... files) {
        stopVoice();
        for (String file : files) pendingVoice.addLast(file);
        playVoiceNext();
    }
    private void stopVoice() {
        pendingVoice.clear();
        if (voicePlayer != null) {
            try { voicePlayer.setOnCompletionListener(null); voicePlayer.stop(); } catch (Exception ignored) {}
            try { voicePlayer.release(); } catch (Exception ignored) {}
            voicePlayer = null;
        }
    }
    private void playVoiceNext() {
        if (pendingVoice.isEmpty()) {
            sendJS("window.onNativeAudioStatus&&window.onNativeAudioStatus('DONE','');");
            return;
        }
        String file = pendingVoice.removeFirst();
        if (!file.matches("(?:chimes/[1-4]\\.mp3|next\\.mp3|stops/[0-9]{1,2}\\.mp3|start/[0-6]\\.mp3|terminal\\.mp3|inspection\\.mp3|na_zadanie\\.mp3)")) {
            sendAudioError("Nieprawidłowy plik audio");
            playVoiceNext();
            return;
        }
        MediaPlayer mp = new MediaPlayer();
        try (AssetFileDescriptor afd = getAssets().openFd("audio/"+file)) {
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            mp.setOnCompletionListener(completed -> {
                if (voicePlayer != completed) return;
                completed.release();voicePlayer=null;playVoiceNext();
            });
            mp.setOnErrorListener((player, what, extra) -> {
                if (voicePlayer == player) { player.release(); voicePlayer=null;sendAudioError("Błąd dekodera "+what);playVoiceNext(); }
                return true;
            });
            mp.prepare();
            mp.setVolume(voiceVolume,voiceVolume);
            voicePlayer = mp;
            sendJS("window.onNativeAudioStatus&&window.onNativeAudioStatus('PLAYING','');");
            mp.start();
        } catch (IOException | IllegalStateException e) {
            try { mp.release(); } catch (Exception ignored) {}
            voicePlayer = null;
            sendAudioError("Nie można odtworzyć "+file+": "+e.getMessage());
            playVoiceNext();
        }
    }
    private void sendAudioError(String detail) {
        sendJS("window.onNativeAudioStatus&&window.onNativeAudioStatus('ERROR',"+JSONObject.quote(detail)+");");
    }

    private void storeRequested() {
        getPreferences(MODE_PRIVATE).edit().putBoolean("gps_requested", requested).apply();
    }
    private boolean hasFinePermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    private boolean gpsAvailable() {
        try { return gps != null && gps.getAllProviders().contains(LocationManager.GPS_PROVIDER); }
        catch (Exception e) { return false; }
    }
    private boolean gpsEnabled() {
        try { return gpsAvailable() && gps.isProviderEnabled(LocationManager.GPS_PROVIDER); }
        catch (Exception e) { return false; }
    }
    private void explainStatus() {
        if (!pageReady) return;
        if (!hasFinePermission()) {
            if (requested) sendStatus("PERMISSION", "Brak uprawnienia ACCESS_FINE_LOCATION. Wybierz DOKŁADNA lokalizacja, nie tylko przybliżona.");
            else sendStatus("READY", "Naciśnij Uruchom GPS, aby nadać dostęp do dokładnej lokalizacji.");
            return;
        }
        if (!gpsAvailable()) {
            sendStatus("NO_PROVIDER", "Android nie udostępnia GPS_PROVIDER. Ten sprzęt może nie mieć odbiornika satelitarnego.");
            return;
        }
        if (!gpsEnabled()) {
            sendStatus("DISABLED", "Uprawnienia aplikacji są OK, ale wyłączona jest LOKALIZACJA urządzenia. Użyj przycisku Lokalizacja Androida.");
            return;
        }
        if (listening && receivedFix) {
            sendStatus("FIX", "GPS działa. Ostatnia pozycja została odebrana.");
        } else if (listening) {
            sendStatus("WAITING", "GPS aktywny. Czekam na sygnał satelitarny (na zewnątrz może potrwać kilka minut).");
        } else if (requested) {
            startGpsNative();
        } else {
            sendStatus("READY", "Uprawnienia i GPS urządzenia OK. Naciśnij Uruchom GPS.");
        }
    }

    private void startGpsNative() {
        if (!requested || !pageReady || listening) return;
        if (!hasFinePermission()) {
            sendStatus("PERMISSION_REQUEST", "Android pyta o lokalizację. Zaznacz DOKŁADNA i Zezwalaj podczas używania.");
            requestPermissions(new String[]{ Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION }, LOCATION_REQUEST);
            return;
        }
        if (!gpsAvailable()) {
            sendStatus("NO_PROVIDER", "Brak odbiornika GPS_PROVIDER. Uprawnienia nie dodadzą sprzętowego GPS.");
            return;
        }
        if (!gpsEnabled()) {
            sendStatus("DISABLED", "GPS urządzenia jest wyłączony. Kliknij Lokalizacja Androida i włącz lokalizację globalną.");
            return;
        }
        try {
            // Błąd opcjonalnego licznika satelitów nie może zablokować lokalizacji.
            satellitesUsed = -1;
            if (satCallback == null) {
                satCallback = new GnssStatus.Callback() {
                    @Override public void onSatelliteStatusChanged(GnssStatus status) {
                        int count = 0;
                        for (int i=0; i<status.getSatelliteCount(); i++) if (status.usedInFix(i)) count++;
                        satellitesUsed = count;
                    }
                };
                try { gps.registerGnssStatusCallback(satCallback, handler); }
                catch (Exception ignored) { satCallback=null; }
            }
            gps.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper());
            listening = true;
            receivedFix = false;
            lastFixAt = 0;
            sendStatus("WAITING", "GPS uruchomiony. Czekam na sygnał satelitarny; dane komórkowe nie są potrzebne.");
            handler.postDelayed(() -> {
                if (requested && listening && !receivedFix)
                    sendStatus("WAITING", "GPS nadal szuka pozycji. Spróbuj na otwartej przestrzeni i odczekaj 1–3 minuty.");
            }, 30000L);
        } catch (SecurityException e) {
            stopListening();
            sendStatus("PERMISSION", "Android zablokował dokładną lokalizację. Sprawdź uprawnienie Dokładna.");
        } catch (Exception e) {
            stopListening();
            sendStatus("ERROR", "Błąd LocationManager: "+e.getClass().getSimpleName()+" "+e.getMessage());
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] grants) {
        super.onRequestPermissionsResult(code, perms, grants);
        if (code == MEDIA_REQUEST) { completeMediaPermission(); return; }
        if (code != LOCATION_REQUEST) return;
        if (hasFinePermission()) {
            if (requested) startGpsNative(); else explainStatus();
        } else {
            sendStatus("PERMISSION", "Android nie przyznał DOKŁADNEJ lokalizacji. Sprawdź aplikację w Ustawienia → Uprawnienia.");
        }
    }
    @Override public void onLocationChanged(Location loc) {
        if (!requested || !listening || loc == null) return;
        if (!loc.hasAccuracy()) return;
        receivedFix = true;
        lastFixAt = android.os.SystemClock.elapsedRealtime();
        String speed = loc.hasSpeed() ? Float.toString(loc.getSpeed()) : "null";
        String direction = loc.hasBearing() ? Float.toString(loc.getBearing()) : "null";
        String sats = satellitesUsed < 0 ? "null" : Integer.toString(satellitesUsed);
        sendJS("window.onNativeGpsFix&&window.onNativeGpsFix("+
                loc.getLatitude()+","+loc.getLongitude()+","+loc.getAccuracy()+","+
                speed+","+direction+","+sats+");");
    }
    @Override public void onProviderDisabled(String provider) {
        if (LocationManager.GPS_PROVIDER.equals(provider) && requested) {
            stopListening();
            sendStatus("DISABLED", "GPS został wyłączony w ustawieniach urządzenia. Włącz główną lokalizację.");
        }
    }
    @Override public void onProviderEnabled(String provider) {
        if (LocationManager.GPS_PROVIDER.equals(provider) && requested) startGpsNative();
    }
    private void stopListening() {
        if (gps != null) {
            try { gps.removeUpdates(this); } catch (Exception ignored) {}
            if (satCallback != null) {
                try { gps.unregisterGnssStatusCallback(satCallback); } catch (Exception ignored) {}
            }
        }
        satCallback=null;
        listening=false;
    }
    private void sendStatus(String code, String details) {
        sendJS("window.onNativeGpsStatus&&window.onNativeGpsStatus("+
                JSONObject.quote(code)+","+JSONObject.quote(details)+");");
    }
    private void sendJS(String js) {
        if (!pageReady || web == null) return;
        runOnUiThread(() -> { if (pageReady && web != null) web.evaluateJavascript(js, null); });
    }
    @Override public void onSaveInstanceState(Bundle state) {
        state.putBoolean("gps_requested", requested);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() {
        // Okno systemowe uprawnień może wywołać onPause.
        // Nie anulujemy w tym momencie GPS ani życzenia jego uruchomienia.
        super.onPause();
        if (web != null) web.onPause();
    }
    @Override protected void onStop() {
        // Brak lokalizacji w tle. Użytkownik nadal chce GPS po wznowieniu.
        stopListening();
        stopVoice();
        super.onStop();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (requested && pageReady) handler.postDelayed(() -> { if (requested) startGpsNative(); }, 300L);
    }
    @Override protected void onDestroy() {
        stopListening();
        if (rgUsb != null) rgUsb.close();
        if (ibisUsb != null) ibisUsb.close();
        stopVoice();
        if (lcdServer != null) lcdServer.close();
        if (pendingMediaRequest!=null){pendingMediaRequest.deny();pendingMediaRequest=null;}
        pageReady=false;
        if (web != null) { web.removeJavascriptInterface("SRGMksExport"); web.removeJavascriptInterface("SRGTimetables"); web.removeJavascriptInterface("SRGNativeGPS"); web.removeJavascriptInterface("SRGNativeAudio"); web.removeJavascriptInterface("SRGLcd"); web.destroy(); web=null; }
        super.onDestroy();
    }
}

