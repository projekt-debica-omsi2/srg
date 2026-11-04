package pl.srgmobile.classic;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import org.json.JSONArray;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** All synthesis and generated audio stay in app-private storage. No network voices. */
final class LocalVoiceStore {
    private final Activity activity;
    private final Consumer<String> notice;
    private final Supplier<Float> volume;
    private final SharedPreferences prefs;
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final File directory;
    private final ArrayDeque<Runnable> waiting=new ArrayDeque<>();
    private final ArrayDeque<String> jobs=new ArrayDeque<>();
    private TextToSpeech tts;
    private MediaPlayer player;
    private String engine="",voice="",activeId;
    private File pendingFile,pendingTarget;
    private boolean ready,initializing,closed,generating;
    private int completed,total,serial;
    private Runnable timeout;
    LocalVoiceStore(Activity activity,Consumer<String> notice,Supplier<Float> volume){
        this.activity=activity;this.notice=notice;this.volume=volume;
        prefs=activity.getSharedPreferences("local-voices",0);
        directory=new File(activity.getFilesDir(),"offline-announcements");
        directory.mkdirs();
    }
    private void ensure(Runnable action){
        if(closed)return;
        if(ready){action.run();return;}
        waiting.add(action);if(initializing)return;initializing=true;
        String selected=prefs.getString("engine","");
        TextToSpeech.OnInitListener listener=status->ui.post(()->{
            if(closed)return;initializing=false;
            if(status==TextToSpeech.SUCCESS){
                engine=selected.isEmpty()?tts.getDefaultEngine():selected;
                List<Voice> voices=offlineVoices();String saved=prefs.getString("voice","");
                Voice chosen=voices.stream().filter(v->v.getName().equals(saved)).findFirst().orElse(voices.isEmpty()?null:voices.get(0));
                if(chosen!=null&&tts.setVoice(chosen)==TextToSpeech.SUCCESS){voice=chosen.getName();tts.setSpeechRate(0.96f);ready=true;}
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                    @Override public void onStart(String id){}
                    @Override public void onDone(String id){ui.post(()->complete(id,true));}
                    @Override public void onError(String id){ui.post(()->complete(id,false));}
                    @Override public void onError(String id,int code){ui.post(()->complete(id,false));}
                });
            }
            if(!ready){waiting.clear();notice.accept("Brak polskiego głosu offline w wybranym silniku. Wybierz inny silnik lub doinstaluj polski głos w jego aplikacji.");return;}
            while(!waiting.isEmpty()&&ready&&!closed)waiting.remove().run();
        });
        if(tts!=null)tts.shutdown();
        tts=selected.isEmpty()?new TextToSpeech(activity,listener):new TextToSpeech(activity,listener,selected);
    }
    private List<Voice> offlineVoices(){
        List<Voice> result=new ArrayList<>();
        if(tts!=null&&tts.getVoices()!=null)for(Voice v:tts.getVoices())if("pl".equals(v.getLocale().getLanguage())&&!v.isNetworkConnectionRequired()&&(v.getFeatures()==null||!v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)))result.add(v);
        result.sort(Comparator.comparing(Voice::getName));return result;
    }
    void choose(){
        // Engine enumeration is supported even when the default has no Polish voice.
        if(initializing){notice.accept("Silnik mowy jest uruchamiany. Spróbuj ponownie za chwilę.");return;}
        if(tts==null){initializing=true;tts=new TextToSpeech(activity,status->ui.post(()->{initializing=false;if(!closed)choose();}));return;}
        List<TextToSpeech.EngineInfo> engines=tts.getEngines();
        if(engines.isEmpty()){notice.accept("Brak zainstalowanego silnika tekst–mowa. Zainstaluj aplikację udostępniającą Androidowi polski głos offline.");return;}
        String[] labels=new String[engines.size()];for(int i=0;i<labels.length;i++)labels[i]=engines.get(i).label;
        new AlertDialog.Builder(activity).setTitle("Wybierz zainstalowany silnik tekst–mowa").setItems(labels,(dialog,index)->{
            cancel();prefs.edit().putString("engine",engines.get(index).name).remove("voice").apply();ready=false;
            ensure(()->{List<Voice> voices=offlineVoices();String[] names=new String[voices.size()];for(int i=0;i<names.length;i++)names[i]=voices.get(i).getName();
                new AlertDialog.Builder(activity).setTitle("Polski głos offline").setItems(names,(d,n)->{cancel();Voice selectedVoice=voices.get(n);if(tts.setVoice(selectedVoice)==TextToSpeech.SUCCESS){voice=selectedVoice.getName();prefs.edit().putString("voice",voice).apply();notice.accept("Wybrano: "+voice+" · tempo 96%. Nowy głos ma osobny zestaw nagrań.");}}).setNegativeButton("Anuluj",null).show();
            });
        }).setNegativeButton("Anuluj",null).show();
    }
    private File cached(String text){
        try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest((engine+"|"+voice+"|0.96|"+text).getBytes(StandardCharsets.UTF_8));StringBuilder hash=new StringBuilder();for(byte b:bytes)hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return new File(directory,hash+".wav");}catch(Exception e){throw new IllegalStateException(e);}
    }
    private boolean valid(File file){return file.isFile()&&file.length()>44;}
    void speak(String text){
        if(text==null||text.trim().isEmpty()||text.length()>1000||closed)return;
        if(generating){notice.accept("Trwa generowanie zapowiedzi. Zaczekaj lub naciśnij Anuluj.");return;}
        ensure(()->{stopPlayback();File file=cached(text);
            if(valid(file)){try{player=new MediaPlayer();player.setDataSource(file.getAbsolutePath());player.setVolume(volume.get(),volume.get());player.setOnCompletionListener(p->stopPlayback());player.setOnErrorListener((p,w,e)->{stopPlayback();speakLive(text);return true;});player.prepare();player.start();return;}catch(Exception e){stopPlayback();}}
            speakLive(text);
        });
    }
    private void speakLive(String text){Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,volume.get());tts.speak(text,TextToSpeech.QUEUE_FLUSH,params,"live");}
    void generate(String json){
        if(generating){notice.accept("Generowanie już trwa.");return;}
        final LinkedHashSet<String> texts=new LinkedHashSet<>();
        try{JSONArray array=new JSONArray(json);if(array.length()>5000)throw new IllegalArgumentException();for(int i=0;i<array.length();i++){String text=array.getString(i);if(text.trim().isEmpty()||text.length()>1000)throw new IllegalArgumentException();texts.add(text);}if(texts.isEmpty())throw new IllegalArgumentException();}
        catch(Exception e){notice.accept("Brak prawidłowego planu zapowiedzi.");return;}
        ensure(()->{cancel();jobs.addAll(texts);completed=0;total=jobs.size();generating=true;notice.accept("Generowanie offline: 0/"+total);next();});
    }
    private void next(){
        if(!generating||closed)return;
        while(!jobs.isEmpty()&&valid(cached(jobs.peek()))){jobs.remove();completed++;}
        if(jobs.isEmpty()){generating=false;notice.accept("Gotowe: "+completed+"/"+total+" zapowiedzi zapisanych lokalnie. Głos: "+voice);return;}
        long size=0;File[] files=directory.listFiles();if(files!=null)for(File f:files)size+=f.length();
        if(size>=100L*1024*1024){cancel();notice.accept("Osiągnięto limit 100 MB nagrań lokalnych. Poprzednie nagrania zachowano.");return;}
        pendingTarget=cached(jobs.peek());pendingFile=new File(directory,pendingTarget.getName()+".partial");activeId="file-"+(++serial);
        final String id=activeId;timeout=()->{if(id.equals(activeId)){cancel();notice.accept("Silnik mowy nie zakończył nagrania w 45 sekund. Spróbuj ponownie lub wybierz inny głos.");}};ui.postDelayed(timeout,45000);
        if(tts.synthesizeToFile(jobs.peek(),new Bundle(),pendingFile,id)!=TextToSpeech.SUCCESS)complete(id,false);
    }
    private void complete(String id,boolean ok){
        if(!generating||!id.equals(activeId))return;
        if(timeout!=null)ui.removeCallbacks(timeout);activeId=null;
        if(!ok||!valid(pendingFile)||!pendingFile.renameTo(pendingTarget)){cancel();notice.accept("Silnik nie zapisał poprawnej zapowiedzi. Gotowe wcześniejsze pliki zachowano; możesz ponowić generowanie.");return;}
        pendingFile=null;pendingTarget=null;jobs.remove();completed++;notice.accept("Generowanie offline: "+completed+"/"+total);ui.post(this::next);
    }
    void cancel(){
        generating=false;activeId=null;jobs.clear();waiting.clear();if(timeout!=null)ui.removeCallbacks(timeout);
        if(tts!=null)tts.stop();stopPlayback();
        if(pendingFile!=null)pendingFile.delete();pendingFile=null;pendingTarget=null;
    }
    private void stopPlayback(){if(player!=null){try{player.release();}catch(Exception ignored){}player=null;}}
    void close(){closed=true;cancel();if(tts!=null){tts.shutdown();tts=null;}}
}
