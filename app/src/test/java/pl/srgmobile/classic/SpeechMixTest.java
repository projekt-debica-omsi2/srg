package pl.srgmobile.classic;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class SpeechMixTest {
 @Test public void overlappingAnnouncementsRestoreOnlyAfterLastOwner(){Object a=new Object(),b=new Object();List<Boolean> changes=new ArrayList<>();SpeechMix.Listener l=changes::add;SpeechMix.listen(l);try{SpeechMix.begin(a);SpeechMix.begin(a);SpeechMix.begin(b);SpeechMix.end(a);assertTrue(SpeechMix.active());assertEquals(Arrays.asList(false,true),changes);SpeechMix.end(b);assertFalse(SpeechMix.active());assertEquals(Arrays.asList(false,true,false),changes);SpeechMix.end(b);assertEquals(3,changes.size());}finally{SpeechMix.end(a);SpeechMix.end(b);SpeechMix.remove(l);}}
 @Test public void volumeReturnsToUserLevelAndMuteWorks(){assertEquals(.5f,SpeechMix.gain(50,10,false),.001f);assertEquals(.05f,SpeechMix.gain(50,10,true),.001f);assertEquals(0,SpeechMix.gain(90,0,true),.001f);assertEquals(.9f,SpeechMix.gain(90,0,false),.001f);assertEquals(1,SpeechMix.gain(150,10,false),.001f);}
}
