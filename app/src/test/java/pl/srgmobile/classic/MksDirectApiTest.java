package pl.srgmobile.classic;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
public class MksDirectApiTest {
 @Test public void originalHandshakeAndSchedule() throws Exception {
  AtomicInteger calls=new AtomicInteger();byte[] database=new byte[1024];
  byte[] result=MksDirectApi.schedule((method,age,limit)->{
   if(calls.getAndIncrement()==0){assertEquals("PingService",method);assertEquals(403,age);return "<int>1234</int>".getBytes(StandardCharsets.UTF_8);}
   assertEquals("GetScheduleFile",method);assertEquals(1577,age);return database;
  });assertSame(database,result);assertEquals(2,calls.get());
 }
 @Test(expected=Exception.class) public void invalidPingStopsDownload() throws Exception {MksDirectApi.schedule((method,age,limit)->"Unauthorized access".getBytes(StandardCharsets.UTF_8));}
 @Test(expected=Exception.class) public void htmlIsNotSchedule() throws Exception {MksDirectApi.schedule((method,age,limit)->method.equals("PingService")?"<int>1</int>".getBytes(): ("<html>"+"error".repeat(50)).getBytes());}
 @Test public void proxyDefaultsToDebicaSchedule() throws Exception {
  assertEquals("https://example.org/mybus-hub-api.php?city=DEBIC&action=schedule",MksDirectApi.proxyAddress("https://example.org/mybus-hub-api.php"));
  assertEquals("",MksDirectApi.proxyAddress(""));
  assertEquals("https://example.org/proxy?city=DEBIC&action=schedule",MksDirectApi.proxyAddress("https://example.org/proxy?city=DEBIC&action=schedule"));
 }
 @Test(expected=Exception.class) public void wrongProxyActionRejected() throws Exception {MksDirectApi.proxyAddress("https://example.org/proxy?city=DEBIC&action=vehicles");}
 @Test public void verifiedSiteAcceptsUnicodeAndPunycode() throws Exception {
  assertEquals(MksDirectApi.DEFAULT_PROXY,MksDirectApi.proxyAddress("http://e-dębica.pl:8088/mybus-hub-api.php"));
  assertEquals(MksDirectApi.DEFAULT_PROXY,MksDirectApi.proxyAddress(MksDirectApi.DEFAULT_PROXY));
 }
 @Test(expected=Exception.class) public void otherHttpPortRejected() throws Exception {MksDirectApi.proxyAddress("http://e-dębica.pl:8089/mybus-hub-api.php");}
 @Test(expected=Exception.class) public void insecureProxyRejected() throws Exception {MksDirectApi.proxyAddress("http://example.org/proxy");}
 @Test(expected=Exception.class) public void jsonProxyErrorNotStoredAsDatabase() throws Exception {MksDirectApi.validateSchedule(("{\"error\":\""+"x".repeat(150)+"\"}").getBytes());}
}
