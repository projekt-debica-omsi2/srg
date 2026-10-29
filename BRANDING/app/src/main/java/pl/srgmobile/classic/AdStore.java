package pl.srgmobile.classic;

import android.content.Context;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.util.Arrays;
import java.util.UUID;

/** Persistent passenger media imported with Android's document picker. */
final class AdStore {
    private final Context context;
    AdStore(Context context) { this.context=context; }
    File directory() { return new File(context.getFilesDir(),"lcd-ads"); }
    static boolean valid(String name) { return name!=null && name.matches("[a-f0-9-]{36}\\.(png|jpg|gif|webp|mp4)"); }
    File file(String name) { return valid(name)?new File(directory(),name):null; }
    JSONArray list() throws Exception {
        JSONArray result=new JSONArray();
        File[] files=directory().listFiles();
        if(files==null)return result;
        Arrays.sort(files,(a,b)->a.getName().compareTo(b.getName()));
        for(File file:files) {
            if(!file.isFile() || !valid(file.getName()))continue;
            JSONObject item=new JSONObject();
            item.put("id",file.getName());
            item.put("name",context.getSharedPreferences("lcd-ads",0).getString(file.getName(),file.getName()));
            item.put("url","/reklama-local/"+file.getName());
            item.put("typ",file.getName().endsWith(".mp4")?"video":"image");
            result.put(item);
        }
        return result;
    }
    void add(Uri uri) throws Exception {
        String mime=context.getContentResolver().getType(uri),extension;
        if("image/png".equals(mime))extension="png";
        else if("image/jpeg".equals(mime))extension="jpg";
        else if("image/gif".equals(mime))extension="gif";
        else if("image/webp".equals(mime))extension="webp";
        else if("video/mp4".equals(mime))extension="mp4";
        else throw new IOException("Nieobsługiwany format. Wybierz JPG, PNG, GIF, WebP lub MP4.");
        String name="Reklama."+extension;
        try(Cursor c=context.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)) {
            if(c!=null&&c.moveToFirst()&&!c.isNull(0))name=c.getString(0);
        }
        File dir=directory();if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Nie można utworzyć folderu reklam.");
        String id=UUID.randomUUID().toString()+"."+extension;
        File target=new File(dir,id),temp=new File(dir,id+".part");
        try {
            try(InputStream in=context.getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(temp)) {
                if(in==null)throw new IOException("Nie można odczytać pliku.");
                byte[] buffer=new byte[65536];int n;long size=0;
                while((n=in.read(buffer))!=-1){size+=n;if(size>250L*1024*1024)throw new IOException("Maksymalny rozmiar reklamy to 250 MB.");out.write(buffer,0,n);}
                if(size==0)throw new IOException("Plik jest pusty.");
            }
            context.getSharedPreferences("lcd-ads",0).edit().putString(id,name).commit();
            if(!temp.renameTo(target))throw new IOException("Nie udało się zapisać reklamy.");
        } finally { if(temp.exists())temp.delete(); }
    }
    boolean remove(String id) {
        File file=file(id);if(file==null||!file.isFile()||!file.delete())return false;
        context.getSharedPreferences("lcd-ads",0).edit().remove(id).apply();return true;
    }
}
