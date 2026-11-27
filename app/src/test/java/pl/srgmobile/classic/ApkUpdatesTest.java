package pl.srgmobile.classic;
import org.junit.Test;
import static org.junit.Assert.*;
public class ApkUpdatesTest {
 private org.json.JSONObject asset(String name) throws Exception{return new org.json.JSONObject().put("name",name).put("browser_download_url","https://github.com/projekt-debica-omsi2/srg/releases/download/v1.4.97/"+name);}
 @Test public void previousIsSeparateFromLatestAndFromOtherEditions() throws Exception{
  org.json.JSONArray assets=new org.json.JSONArray().put(asset("SRGMobile-TestGPS-1.4.97.apk")).put(asset("SRGMobile-TestGPS-previous-1.4.96.apk")).put(asset("SRGMobile-Public-previous-1.4.96.apk"));
  org.json.JSONArray releases=new org.json.JSONArray().put(new org.json.JSONObject().put("assets",assets));
  org.json.JSONObject old=ApkUpdates.select(releases,"pl.srgmobile.testgps","1.4.95-testgps");assertTrue(old.has("latest"));assertFalse(old.has("previous"));
  org.json.JSONObject current=ApkUpdates.select(releases,"pl.srgmobile.testgps","1.4.97-testgps");assertFalse(current.has("latest"));assertEquals("SRGMobile-TestGPS-previous-1.4.96.apk",current.getJSONObject("previous").getString("name"));
  org.json.JSONObject rollback=ApkUpdates.select(releases,"pl.srgmobile.testgps","1.4.97-rollback-1.4.96-testgps");assertFalse(rollback.has("latest"));assertFalse(rollback.has("previous"));
 }
 @Test public void separatesInstalledEditions(){
  assertTrue(ApkUpdates.matchesEdition("SRGMobile-1.4.93.apk","pl.srgmobile.classic.lcd23"));
  assertFalse(ApkUpdates.matchesEdition("SRGMobile-Public-1.4.93.apk","pl.srgmobile.classic.lcd23"));
  assertFalse(ApkUpdates.matchesEdition("SRGMobile-TestGPS-1.4.93.apk","pl.srgmobile.classic.lcd23"));
  assertTrue(ApkUpdates.matchesEdition("SRGMobile-Public-1.4.93.apk","pl.srgmobile.publicapp"));
  assertTrue(ApkUpdates.matchesEdition("SRGMobile-TestGPS-1.4.93.apk","pl.srgmobile.testgps"));
  assertFalse(ApkUpdates.matchesEdition("SRGMobile-1.4.93.apk","pl.srgmobile.testgps"));
 }
 @Test public void comparesNumericalVersions(){
  assertTrue(ApkUpdates.newer("SRGMobile-1.4.100.apk","1.4.92-testgps"));
  assertFalse(ApkUpdates.newer("v1.4.91","1.4.92"));assertFalse(ApkUpdates.newer("v1.4.92","1.4.92"));
  assertFalse(ApkUpdates.newer("no-version","1.4.92"));
 }
}
