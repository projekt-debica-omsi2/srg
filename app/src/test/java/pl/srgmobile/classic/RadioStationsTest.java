package pl.srgmobile.classic;
import org.junit.Test;
import org.json.*;
import static org.junit.Assert.*;
public class RadioStationsTest {
 @Test public void onlyHttpStreamsAndNoEmbeddedCredentials(){assertTrue(RadioStations.streamUrl("https://stream.example/radio"));assertTrue(RadioStations.streamUrl("http://stream.example:8000/live"));assertFalse(RadioStations.streamUrl("file:///data/private"));assertFalse(RadioStations.streamUrl("javascript:alert(1)"));assertFalse(RadioStations.streamUrl("https://user:password@example.com/radio"));}
 @Test public void brokenAndDuplicateStationsAreRemoved() throws Exception{JSONObject a=new JSONObject().put("stationuuid","12345678-1234-1234-1234-123456789012").put("name","Stacja").put("url_resolved","https://radio.example/live").put("lastcheckok",1);JSONObject b=new JSONObject(a.toString()).put("stationuuid","22345678-1234-1234-1234-123456789012").put("lastcheckok",0);JSONArray result=RadioStations.clean(new JSONArray().put(a).put(a).put(b));assertEquals(1,result.length());assertEquals("Stacja",result.getJSONObject(0).getString("name"));assertEquals("https://radio.example/live",result.getJSONObject(0).getString("url"));}
}
