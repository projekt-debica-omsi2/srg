package pl.srgmobile.classic;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.*;
import java.nio.file.*;
public class MksDatabaseTest {
 static JSONObject fixture() throws Exception {
  Path p=Path.of("../tests/fixtures/mks-sqlite-tables.json");if(!Files.exists(p))p=Path.of("tests/fixtures/mks-sqlite-tables.json");
  return new JSONObject(Files.readString(p));
 }
 static JSONObject convert(JSONObject t) throws Exception {return MksDatabase.convert(t.getJSONArray("stops"),t.getJSONArray("calendar"),t.getJSONArray("notes"),t.getJSONArray("departures"),t.getJSONArray("versions"));}
 @Test public void realDatabaseCalendarAndSides() throws Exception {
  JSONObject f=convert(fixture());assertEquals(17,f.getJSONObject("stops").length());assertEquals(75,f.getJSONObject("calendar").length());
  assertEquals("SO",f.getJSONObject("calendar").getString("2026-10-24"));assertEquals("ŚW",f.getJSONObject("calendar").getString("2026-10-25"));
  assertFalse(f.getJSONObject("calendar").has("2027-01-01"));
  JSONArray west=f.getJSONObject("stops").getJSONObject("123").getJSONObject("profiles").getJSONArray("RO");
  assertEquals("05:03",west.getJSONObject(0).getString("time"));assertEquals("BRACIEJOWA",west.getJSONObject(0).getString("direction"));
  assertTrue(west.getJSONObject(2).getJSONArray("notes").toString().contains("GŁOBIKOWA"));
  JSONArray east=f.getJSONObject("stops").getJSONObject("308").getJSONObject("profiles").getJSONArray("RO");assertEquals("05:36",east.getJSONObject(0).getString("time"));assertEquals("STOBIERNA",east.getJSONObject(0).getString("direction"));
 }
 @Test(expected=Exception.class) public void missingStopRejectsUpdate() throws Exception {JSONObject t=fixture();t.getJSONArray("stops").remove(0);convert(t);}
 @Test(expected=Exception.class) public void malformedDeparturesRejectUpdate() throws Exception {JSONObject t=fixture();t.getJSONArray("departures").getJSONObject(0).put("odjazdy","oops,");convert(t);}
 @Test(expected=Exception.class) public void unknownNoteRejectsUpdate() throws Exception {JSONObject t=fixture();t.getJSONArray("departures").getJSONObject(0).put("odjazdy","3600,?");convert(t);}
}
