package pl.srgmobile.classic;
import java.util.*;
/** Shared announcement state; adjacent files in one announcement do not unduck music. */
final class SpeechMix {
 interface Listener {void changed(boolean speaking);}
 private static final Set<Object> owners=Collections.newSetFromMap(new IdentityHashMap<>());
 private static final Set<Listener> listeners=new HashSet<>();
 static synchronized void listen(Listener listener){listeners.add(listener);listener.changed(!owners.isEmpty());}
 static synchronized void remove(Listener listener){listeners.remove(listener);}
 static synchronized boolean active(){return !owners.isEmpty();}
 static synchronized void begin(Object owner){boolean was=active();owners.add(owner);if(!was)notifyListeners();}
 static synchronized void end(Object owner){boolean was=active();owners.remove(owner);if(was&&!active())notifyListeners();}
 private static void notifyListeners(){for(Listener l:new ArrayList<>(listeners))l.changed(active());}
 static float gain(int volume,int duck,boolean speaking){return Math.max(0,Math.min(100,volume))/100f*(speaking?Math.max(0,Math.min(100,duck))/100f:1);}
}
