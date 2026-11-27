package pl.srgmobile.classic;
import org.junit.Test;
import org.json.*;
import static org.junit.Assert.*;
public class LedCycleTest {
 private JSONObject source() throws Exception{return new JSONObject("{kursAktywny:true,kursId:'c',aktualnyIndeks:1,kierunek:'Dębica',lcdConfig:{scrollEnabled:true,steps:[{type:'route',seconds:12},{type:'clock',seconds:10}]}}");}
 @Test public void cyclesWithoutAnyNewWebViewPublications() throws Exception{LedCycle c=new LedCycle();JSONObject s=source();assertEquals("route",c.frame(s,100000).getString("ledKind"));assertEquals("clock",c.frame(s,112000).getString("ledKind"));assertEquals("route",c.frame(s,122000).getString("ledKind"));assertFalse(s.has("ledKind"));}
 @Test public void gpsInterruptExpiresEvenWhenWebViewFrozen() throws Exception{LedCycle c=new LedCycle();JSONObject s=source();c.frame(s,100000);s.put("lcdManual",new JSONObject("{courseKey:'c',anchorIndex:1,type:'next',name:'Pilzno',expiresAt:120000}"));assertEquals("NASTĘPNY PRZYSTANEK: Pilzno",c.frame(s,113000).getString("ledText"));assertEquals("route",c.frame(s,120000).getString("ledKind"));s.getJSONObject("lcdManual").put("courseKey","old");assertEquals("route",c.frame(s,121000).getString("ledKind"));}
 @Test public void clockKeepsRealTimeAndConfigurationChangesRestartCycle() throws Exception{LedCycle c=new LedCycle();JSONObject s=new JSONObject();String a=c.frame(s,0).getString("ledText"),b=c.frame(s,60000).getString("ledText");assertNotEquals(a,b);s=source();c.frame(s,100000);s.getJSONObject("lcdConfig").getJSONArray("steps").getJSONObject(0).put("seconds",30);assertEquals("route",c.frame(s,125000).getString("ledKind"));}
}
