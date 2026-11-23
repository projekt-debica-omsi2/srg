package pl.srgmobile.classic;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
public class IpixelTextTest {
    @Test public void textFrameUsesKnownCrcAndLittleEndianLength(){
        byte[] p=IpixelText.frame("123456789".getBytes(StandardCharsets.US_ASCII));
        assertEquals(24,p.length);assertEquals(24,p[0]);assertEquals(0,p[1]);
        assertArrayEquals(new byte[]{0,1,0},java.util.Arrays.copyOfRange(p,2,5));
        assertArrayEquals(new byte[]{9,0,0,0},java.util.Arrays.copyOfRange(p,5,9));
        assertArrayEquals(new byte[]{0x26,0x39,(byte)0xf4,(byte)0xcb},java.util.Arrays.copyOfRange(p,9,13));
        assertArrayEquals("123456789".getBytes(StandardCharsets.US_ASCII),java.util.Arrays.copyOfRange(p,15,24));
    }
}
