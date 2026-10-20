package pl.srgmobile.classic;

import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import org.json.*;
import java.time.*;
import java.util.*;
import java.util.regex.*;

/** Parses data only. Never executes downloaded scripts. */
public final class TimetableParser {
    public interface Fetch { String get(String url) throws Exception; }
    static String text(Element e,String css) throws Exception {
        Element n=e.selectFirst(css); if(n==null)throw new Exception("Brak pola: "+css); return n.text().trim();
    }
    static JSONObject row(String time,String direction,String carrier,String train) throws Exception {
        if(!time.matches("([01]\\d|2[0-3]):[0-5]\\d")||direction.isEmpty()||carrier.isEmpty())throw new Exception("Nieprawidłowy odjazd");
        return new JSONObject().put("time",time).put("direction",direction).put("carrier",carrier).put("train",train);
    }
    public static JSONObject rail(String slug,String day,Fetch fetch) throws Exception {
        String base="https://gdziepociag.pl/stacja/"+slug+"/?data="+day+"&godzina=";
        LinkedHashMap<String,JSONObject> rows=new LinkedHashMap<>();
        String cursor="00:00"; int expected=-1;
        for(int page=0;page<80;page++){
            Document doc=Jsoup.parse(fetch.get(base+cursor.replace(":","%3A")));
            Element date=doc.selectFirst("input[name=data]");
            if(date==null||!day.equals(date.attr("value")))throw new Exception("Źródło nie potwierdziło daty "+day);
            if(expected<0){Matcher m=Pattern.compile("(\\d+)\\s+Odjazdów w dobie").matcher(doc.text());if(!m.find())throw new Exception("Brak licznika odjazdów");expected=Integer.parseInt(m.group(1));if(expected>1000)throw new Exception("Limit odjazdów");}
            Element list=doc.selectFirst("[data-lista-wynikow]");if(list==null)throw new Exception("Brak tablicy");
            boolean nextDay=false;String last=cursor;int before=rows.size();
            for(Element e:list.children()){
                if(e.hasClass("rozdzielacz-doby")){nextDay=true;break;}
                if(!e.tagName().equals("a"))continue;
                String time=text(e,".godzina-duza");if(time.compareTo(cursor)<0)throw new Exception("Nieciągła tablica");
                JSONObject r=row(time,text(e,".kierunek"),text(e,".badge-przew"),text(e,".pociag-num"));
                rows.put(r.toString(),r);last=time;
            }
            if(rows.size()==expected)break;
            if(nextDay||rows.size()>expected||rows.size()==before)throw new Exception("Niepełny rozkład: "+rows.size()+"/"+expected);
            // Overlap the final minute: the site's +1 minute link can skip simultaneous trains.
            cursor=last;
        }
        if(rows.size()!=expected)throw new Exception("Niepełny rozkład");
        JSONArray a=new JSONArray();for(JSONObject r:rows.values())a.put(r);
        return new JSONObject().put("calendar",new JSONObject().put("mode","dates").put("dates",new JSONArray().put(day))).put("departures",a).put("source",base+"00%3A00");
    }
    static LocalDate easter(int y){int a=y%19,b=y/100,c=y%100,d=b/4,e=b%4,f=(b+8)/25,g=(b-f+1)/3,h=(19*a+b-d-g+15)%30,i=c/4,k=c%4,l=(32+2*e+2*i-h-k)%7,m=(a+11*h+22*l)/451,n=h+l-7*m+114;return LocalDate.of(y,n/31,n%31+1);}
    static boolean holiday(LocalDate d){String md=d.toString().substring(5);return Arrays.asList("01-01","01-06","05-01","05-03","08-15","11-01","11-11","12-24","12-25","12-26").contains(md)||d.equals(easter(d.getYear()))||d.equals(easter(d.getYear()).plusDays(1))||d.equals(easter(d.getYear()).plusDays(49))||d.equals(easter(d.getYear()).plusDays(60));}
    static boolean between(LocalDate d,String a,String b){return !d.isBefore(LocalDate.parse(a))&&!d.isAfter(LocalDate.parse(b));}
    static boolean summer(LocalDate d) throws Exception {if(!between(d,"2026-09-01","2027-08-31"))throw new Exception("Kalendarz szkolny wymaga aktualizacji");return between(d,"2027-06-26","2027-08-31");}
    static boolean school(LocalDate d) throws Exception {return d.getDayOfWeek().getValue()<6&&!holiday(d)&&!summer(d)&&!between(d,"2026-12-23","2026-12-31")&&!between(d,"2027-01-18","2027-01-31")&&!between(d,"2027-03-25","2027-03-30")&&!d.toString().endsWith("10-14");}
    static boolean runs(LocalDate d,Set<String> codes) throws Exception {
        boolean work=d.getDayOfWeek().getValue()<6&&!holiday(d),base=false,has=false;
        for(String c:codes){
            if(Arrays.asList("D","S","(D)","6ś","+").contains(c)){has=true;boolean ok=c.equals("D")?work:c.equals("S")?school(d):c.equals("(D)")?work&&!school(d):c.equals("6ś")?d.getDayOfWeek()==DayOfWeek.SATURDAY&&!holiday(d):d.getDayOfWeek()==DayOfWeek.SUNDAY||holiday(d);base|=ok;}
        }
        if(has&&!base)return false;
        if(codes.contains("L")&&!summer(d)||codes.contains("e")&&summer(d))return false;
        String md=d.toString().substring(5);LocalDate easter=easter(d.getYear());
        for(String c:codes){
            if(md.equals("12-24")&&Arrays.asList("g","m","n","h").contains(c))return false;
            if(md.equals("12-31")&&Arrays.asList("l","m","n").contains(c))return false;
            if((md.equals("12-25")||d.equals(easter))&&Arrays.asList("a","b","d").contains(c))return false;
            if(md.equals("01-01")&&Arrays.asList("b","d").contains(c))return false;
            if((md.equals("12-26")||d.equals(easter.plusDays(1)))&&c.equals("d"))return false;
            if(d.equals(easter.minusDays(1))&&Arrays.asList("T","n","h").contains(c))return false;
        }
        return true;
    }
    public static JSONObject pks(String source,LocalDate today) throws Exception {
        Document doc=Jsoup.parse(source);String period=text(doc,".okres");Matcher dates=Pattern.compile("\\d{4}-\\d{2}-\\d{2}").matcher(period);
        if(!dates.find())throw new Exception("Brak początku ważności PKS");LocalDate start=LocalDate.parse(dates.group());
        if(!dates.find())throw new Exception("Brak końca ważności PKS");LocalDate end=LocalDate.parse(dates.group());
        if(today.isAfter(end))throw new Exception("PKS udostępnia wygasły rozkład");
        LocalDate first=today.isAfter(start)?today:start,last=today.plusDays(13).isBefore(end)?today.plusDays(13):end;
        JSONArray result=new JSONArray();int count=0;
        for(Element e:doc.select("td.odjazdy > div.odjazd")){
            count++;String direction=text(e.parent().parent(),".msckier");Set<String> codes=new HashSet<>();
            for(Element li:e.select("li")){
                Element code=li.selectFirst("div.ozn");if(code==null)continue;String c=code.text();String desc=li.text();
                if(Arrays.asList("D","S","(D)","6ś","+","L","e","l","b","g","a","m","T","n","d","h").contains(c))codes.add(c);
                else if(!(desc.contains("kurs przez")||desc.contains("kurs do")||desc.contains("kurs wykonywany")||desc.contains("kurs skom")||desc.contains("kurs z wjazdem")||desc.contains("kurs wydłużony")||desc.contains("przez ")))throw new Exception("Nowe oznaczenie PKS: "+c);
            }
            JSONArray active=new JSONArray();for(LocalDate d=first;!d.isAfter(last);d=d.plusDays(1))if(runs(d,codes))active.put(d.toString());
            result.put(row(text(e,"a.godj"),direction,"PKS Rzeszów","").put("dates",active).put("platform",text(e,"span.stodj")));
        }
        if(count<1||count>5000)throw new Exception("Brak rozkładu PKS");
        return new JSONObject().put("departures",result).put("validFrom",first.toString()).put("validTo",last.toString()).put("source","https://pks.rzeszow.pl/tablice-dworcowe/13150019/rzeszow-d-a");
    }

    public static JSONObject mks(String raw) throws Exception {
        JSONObject input=new JSONObject(raw),profiles=new JSONObject();
        String[] names={"Roboczy","Roboczy wakacyjny/feryjny","Sobota","Niedziele i święta"};
        for(String name:names)profiles.put(name,new JSONArray());
        if(input.has("conn")){
            JSONArray routes=input.getJSONArray("conn");
            for(int i=0;i<routes.length();i++){
                JSONObject route=routes.getJSONObject(i);
                if(!"171".equals(route.optString("stopId"))||!"DWORZEC PKP".equals(route.optString("stop_name")))continue;
                String line=route.getString("line");if(!line.matches("\\d+"))throw new Exception("Niepoprawna linia MKS");
                JSONObject sections=route.getJSONObject("sections");
                for(String name:names){JSONArray items=sections.getJSONArray(name);
                    for(int j=0;j<items.length();j++){JSONObject item=items.getJSONObject(j);if(!item.optString("mark").isEmpty())throw new Exception("MKS: nowe oznaczenie wymaga sprawdzenia");
                        profiles.getJSONArray(name).put(row(item.getString("time"),route.getString("direction"),"MKS "+line,"").put("stopId","171").put("line",line));
                    }
                }
            }
        }else{
            if(!"171".equals(input.optString("stopId")))throw new Exception("MKS: nieprawidłowy przystanek");
            profiles=input.getJSONObject("profiles");
        }
        for(String name:names){JSONArray items=profiles.getJSONArray(name);if(items.length()>2000)throw new Exception("Limit kursów MKS");
            for(int j=0;j<items.length();j++){JSONObject r=items.getJSONObject(j);if(!"171".equals(r.optString("stopId"))||!r.optString("carrier").matches("MKS \\d+")||!r.optString("mark").isEmpty())throw new Exception("Nieprawidłowy kurs MKS");row(r.getString("time"),r.getString("direction"),r.getString("carrier"),"");}
        }
        if(profiles.getJSONArray("Roboczy").length()==0)throw new Exception("Brak pełnego rozkładu DWORZEC PKP");
        return new JSONObject().put("stopId","171").put("stop","DWORZEC PKP").put("profiles",profiles);
    }
}
