package pl.srgmobile.classic;
import org.junit.Test;
import static org.junit.Assert.*;
public class ApkUpdatesTest {
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
