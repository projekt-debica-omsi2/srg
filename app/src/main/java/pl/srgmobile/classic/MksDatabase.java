package pl.srgmobile.classic;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.GZIPInputStream;

/** Read the public myBus SQLite schedule without executing database content. */
public final class MksDatabase {
 static final String IDS="171,241,243,244,576,252,253,254,123,308,59,60,61,87,88,89,575";
 static JSONArray query(SQLiteDatabase db,String sql) throws Exception {
  JSONArray rows=new JSONArray();try(Cursor c=db.rawQuery(sql,null)){while(c.moveToNext()){JSONObject row=new JSONObject();for(int i=0;i<c.getColumnCount();i++)if(!c.isNull(i))row.put(c.getColumnName(i),c.getString(i));rows.put(row);}}return rows;
 }
 public static JSONObject read(File source,File directory) throws Exception {
  File temp=File.createTempFile("mks-read-",".sqlite",directory);
  try {
   try(InputStream raw=new BufferedInputStream(new FileInputStream(source))){raw.mark(2);int a=raw.read(),b=raw.read();raw.reset();InputStream in=a==31&&b==139?new GZIPInputStream(raw):raw;
    try(InputStream decoded=in;OutputStream out=new FileOutputStream(temp)){byte[] buf=new byte[16384];int n,total=0;while((n=decoded.read(buf))!=-1){total+=n;if(total>64*1024*1024)throw new IOException("Zbyt duża baza MKS po rozpakowaniu");out.write(buf,0,n);}}}
   try(InputStream in=new FileInputStream(temp)){byte[] h=new byte[16];if(in.read(h)!=16||!new String(h,StandardCharsets.US_ASCII).equals("SQLite format 3\0"))throw new IOException("Nieznany format bazy MKS");}
   SQLiteDatabase db=SQLiteDatabase.openDatabase(temp.getPath(),null,SQLiteDatabase.OPEN_READONLY);
   try{return convert(query(db,"SELECT id,nazwa FROM PRZYSTANKI WHERE id IN ("+IDS+")"),query(db,"SELECT td_rj,dt_kal FROM KALENDARZ"),query(db,"SELECT numer_lini,ozn_uwagi,tresc_uwag FROM UWAGI"),query(db,"SELECT o.*,k.opis_tabl,k.opis2tabl,k.lp_opis2tabl FROM ODJAZDY o JOIN KIERUNKI k ON o.id_krn=k.id_krn AND o.id_podm=k.id_podm WHERE o.bus_stop_id IN ("+IDS+")"),query(db,"SELECT wazna_od FROM WERSJE"));}finally{db.close();}
  }finally{temp.delete();}
 }
 public static JSONObject convert(JSONArray stops,JSONArray calendar,JSONArray notes,JSONArray departures,JSONArray versions) throws Exception {
  JSONObject result=new JSONObject().put("schema",1),byStop=new JSONObject(),dates=new JSONObject(),remarks=new JSONObject();
  if(versions.length()!=1)throw new IOException("Nieznana wersja bazy MKS");String from=versions.getJSONObject(0).getString("wazna_od");
  for(int i=0;i<stops.length();i++){JSONObject s=stops.getJSONObject(i);byStop.put(s.getString("id"),new JSONObject().put("name",s.getString("nazwa")).put("profiles",new JSONObject()));}
  for(String id:IDS.split(","))if(!byStop.has(id))throw new IOException("Brak przystanku MKS "+id);
  for(int i=0;i<calendar.length();i++){JSONObject c=calendar.getJSONObject(i);String day=c.getString("dt_kal").substring(0,10);java.time.LocalDate.parse(day);if(day.compareTo(from)>=0)dates.put(day,c.getString("td_rj"));}
  if(dates.length()==0||dates.length()>730)throw new IOException("Niepełny kalendarz MKS");
  for(int i=0;i<notes.length();i++){JSONObject n=notes.getJSONObject(i);remarks.put(n.getString("numer_lini").trim()+"/"+n.getString("ozn_uwagi"),n.getString("tresc_uwag"));}
  int count=0;
  for(int i=0;i<departures.length();i++){
   JSONObject d=departures.getJSONObject(i);String id=d.getString("bus_stop_id"),line=d.getString("numer_lini").trim(),profile=d.getString("typ_dnia");
   JSONObject profiles=byStop.getJSONObject(id).getJSONObject("profiles");if(!profiles.has(profile))profiles.put(profile,new JSONArray());
   String direction=d.getString("opis_tabl").trim();if(d.optInt("lp_opis2tabl")>0&&d.optInt("lp_przyst")>=d.optInt("lp_opis2tabl")&&!d.optString("opis2tabl").trim().isEmpty())direction=d.getString("opis2tabl").trim();
   String[] tokens=d.getString("odjazdy").split(",",-1);if(tokens.length%2!=0)throw new IOException("Nieznany zapis odjazdów MKS");
   for(int j=0;j<tokens.length;j+=2){int seconds=Integer.parseInt(tokens[j]);if(seconds<0||seconds>=86400||seconds%60!=0)throw new IOException("Nieprawidłowy czas MKS");JSONArray rowNotes=new JSONArray();for(char mark:tokens[j+1].toCharArray()){String key=line+"/"+mark;if(!remarks.has(key))throw new IOException("Nieznane oznaczenie MKS "+key);rowNotes.put(remarks.getString(key));}
    profiles.getJSONArray(profile).put(new JSONObject().put("time",String.format(Locale.ROOT,"%02d:%02d",seconds/3600,seconds/60%60)).put("line",line).put("carrier","MKS "+line).put("direction",direction).put("stopId",id).put("notes",rowNotes));count++;
   }
  }
  if(count==0)throw new IOException("Pusta baza odjazdów MKS");
  return result.put("stops",byStop).put("calendar",dates).put("validFrom",from).put("source","myBus MKS Dębica");
 }
}
