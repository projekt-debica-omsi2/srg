package pl.srgmobile.classic;

import android.graphics.*;
import org.json.*;
import java.io.ByteArrayOutputStream;
import java.util.Locale;

/** The LCD header drawn at the physical matrix resolution, without its advert area. */
final class IpixelPanel {
    private static String upper(String s){return s.toUpperCase(new Locale("pl","PL"));}
    private static void ticker(Canvas c,Paint p,String text,int left,int y,boolean scroll,long elapsed,double speed){
        text=text.replace('·','-').replace('—','-');int width=IpixelFont.width(text),view=64-left;
        c.save();c.clipRect(left,y,64,y+8);
        int x=left;
        if(scroll)x=left+view-(int)(elapsed/1000f*speed)%(width+view+12);
        IpixelFont.draw(c,p,text,x,y,1);c.restore();
    }
    private static void arrow(Canvas c,Paint p){
        c.drawRect(8,3,14,4,p);c.drawRect(12,1,13,2,p);c.drawRect(13,2,14,3,p);
        c.drawRect(14,3,15,4,p);c.drawRect(13,4,14,5,p);c.drawRect(12,5,13,6,p);
    }
    static byte[] draw(JSONObject s,long elapsed){
        Bitmap b=Bitmap.createBitmap(64,16,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);c.drawColor(Color.BLACK);
        Paint p=new Paint();p.setColor(Color.WHITE);p.setAntiAlias(false);p.setTypeface(Typeface.create("sans-serif-condensed",Typeface.NORMAL));
        String kind=s.optString("ledKind","clock"),text=upper(s.optString("ledText"));boolean scroll=s.optBoolean("ledScroll",false); JSONObject config=s.optJSONObject("lcdConfig"); double speed=Math.max(2,Math.min(42,(config==null?48:config.optDouble("scrollSpeed",48))*10/48));
        if(kind.equals("route")){
            // Left field stays blank until the user explicitly enables a line number.
            if(s.optBoolean("ledShowLine",false))IpixelFont.compact(c,p,s.optString("linia"),0,1,2);
            arrow(c,p);ticker(c,p,upper(s.optString("kierunek")),16,0,scroll,elapsed,speed);
            p.setTextSize(7);JSONArray stops=s.optJSONArray("przystanki");StringBuilder route=new StringBuilder();String previous="";
            if(stops!=null)for(int i=Math.max(0,s.optInt("aktualnyIndeks"));i<stops.length();i++){JSONObject stop=stops.optJSONObject(i);if(stop==null)continue;String name=stop.optString("ulica");if(name.isEmpty())name=stop.optString("nazwa");if(!name.isEmpty()&&!name.equals(previous)){if(route.length()>0)route.append(" - ");route.append(name);previous=name;}}
            ticker(c,p,upper(route.toString()),8,8,scroll,elapsed,speed);
        }else if(kind.equals("next")||kind.equals("current")){
            IpixelFont.draw(c,p,kind.equals("next")?"NASTĘPNY:":"PRZYSTANEK",0,0,1);
            String name=text.replaceFirst("^(NASTĘPNY )?PRZYSTANEK: ","").replace(" · PRZYSTANEK KOŃCOWY","");ticker(c,p,name,0,8,scroll&&IpixelFont.width(name)>64,elapsed,speed);
        }else{
            java.util.Calendar calendar=java.util.Calendar.getInstance();
            String day=upper(new java.text.SimpleDateFormat("EEEE",new Locale("pl","PL")).format(calendar.getTime()));
            String date=upper(new java.text.SimpleDateFormat("d MMMM yyyy",new Locale("pl","PL")).format(calendar.getTime()));
            IpixelFont.clock(c,p,text);
            // Compact 19x5 clock flush left; one blank pixel before the text.
            ticker(c,p,day,20,0,IpixelFont.width(day)>44,elapsed,speed);
            ticker(c,p,date,20,8,true,elapsed,speed);
        }
        ByteArrayOutputStream out=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.PNG,100,out);b.recycle();byte[] frame=IpixelText.frame(out.toByteArray());frame[2]=2;frame[3]=0;return frame;
    }
}
