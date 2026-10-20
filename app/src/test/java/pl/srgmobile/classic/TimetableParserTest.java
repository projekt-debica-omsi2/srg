package pl.srgmobile.classic;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.LocalDate;
import java.util.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
public class TimetableParserTest {
 String item(String t,String name){return "<a><b class='godzina-duza'>"+t+"</b><b class='kierunek'>"+name+"</b><b class='badge-przew'>POLREGIO</b><b class='pociag-num'>R 1</b></a>";}
 String page(int total,String body){return "<input name=data value=2026-10-24><p>"+total+" Odjazdów w dobie</p><div data-lista-wynikow>"+body+"</div>";}
 @Test public void overlappingMinuteDoesNotLoseTrains() throws Exception {
  JSONObject result=TimetableParser.rail("debica","2026-10-24",url->url.endsWith("00%3A00")?page(3,item("05:00","A")+item("06:00","B")):page(3,item("06:00","B")+item("06:00","C")+"<div class=rozdzielacz-doby>jutro</div>"));
  assertEquals(3,result.getJSONArray("departures").length());
 }
 @Test(expected=Exception.class) public void incompleteDayRejected() throws Exception {TimetableParser.rail("debica","2026-10-24",url->page(3,item("05:00","A")+"<div class=rozdzielacz-doby>jutro</div>"));}
 @Test(expected=Exception.class) public void changedDateRejected() throws Exception {TimetableParser.rail("debica","2026-10-24",url->page(1,item("05:00","A")).replace("value=2026-10-24","value=2026-10-25"));}
 @Test public void schoolAndHolidayCalendars() throws Exception {
  assertFalse(TimetableParser.runs(LocalDate.parse("2027-01-20"),Set.of("S")));
  assertTrue(TimetableParser.runs(LocalDate.parse("2027-01-20"),Set.of("(D)")));
  assertFalse(TimetableParser.runs(LocalDate.parse("2026-12-24"),Set.of("D")));
  assertTrue(TimetableParser.runs(LocalDate.parse("2026-12-24"),Set.of("+")));
  assertFalse(TimetableParser.runs(LocalDate.parse("2027-03-27"),Set.of("6ś","n")));
 }
 @Test public void realPksSnapshot() throws Exception {
  String source=new String(getClass().getResourceAsStream("/pks.html").readAllBytes(),StandardCharsets.UTF_8);
  JSONObject result=TimetableParser.pks(source,LocalDate.parse("2026-10-19"));
  assertEquals(904,result.getJSONArray("departures").length());
  assertEquals("2026-11-01",result.getString("validTo"));
 }
 @Test public void suppliedMksState() throws Exception {
  String raw=new String(getClass().getResourceAsStream("/mks-state.json").readAllBytes(),StandardCharsets.UTF_8);
  JSONObject feed=TimetableParser.mks(raw);
  assertEquals(250,feed.getJSONObject("profiles").getJSONArray("Roboczy").length());
  assertEquals(50,feed.getJSONObject("profiles").getJSONArray("Niedziele i święta").length());
  assertEquals(86,TimetableParser.mks(feed.toString()).getJSONObject("profiles").getJSONArray("Sobota").length());
 }
 @Test(expected=Exception.class) public void wrongMksStopRejected() throws Exception {TimetableParser.mks("{\"stopId\":\"153\",\"profiles\":{}}");}
}
