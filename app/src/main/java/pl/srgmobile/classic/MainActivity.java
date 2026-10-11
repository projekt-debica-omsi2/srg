package pl.srgmobile.classic;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.GnssStatus;
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
import org.json.JSONObject;

/** Natywne, lokalne GPS_PROVIDER bez wymagania Internetu. */
public final class MainActivity extends Activity implements LocationListener {
    private static final int LOCATION_REQUEST = 41;
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

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requested = getPreferences(MODE_PRIVATE).getBoolean("gps_requested", false);
        if (state != null) requested = state.getBoolean("gps_requested", requested);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        gps = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
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
        web.addJavascriptInterface(new GpsBridge(), "SRGNativeGPS");
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
        super.onStop();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (requested && pageReady) handler.postDelayed(() -> { if (requested) startGpsNative(); }, 300L);
    }
    @Override protected void onDestroy() {
        stopListening();
        pageReady=false;
        if (web != null) { web.removeJavascriptInterface("SRGNativeGPS"); web.destroy(); web=null; }
        super.onDestroy();
    }
}
