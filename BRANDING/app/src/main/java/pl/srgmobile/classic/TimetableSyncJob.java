package pl.srgmobile.classic;
import android.app.job.*;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.atomic.AtomicBoolean;
public final class TimetableSyncJob extends JobService {
    private AtomicBoolean cancelled;
    @Override public boolean onStartJob(JobParameters params){
        cancelled=new AtomicBoolean();AtomicBoolean token=cancelled;
        TimetableSync.start(this,token,()->new Handler(Looper.getMainLooper()).post(()->{if(!token.get())jobFinished(params,false);}));
        return true;
    }
    @Override public boolean onStopJob(JobParameters params){if(cancelled!=null)cancelled.set(true);return true;}
}
