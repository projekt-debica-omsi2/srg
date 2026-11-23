package pl.srgmobile.classic;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.zip.CRC32;

/** Independent encoder for the iPixel 16-pixel monochrome text wire format. */
final class IpixelText {
    static byte[] encode(String input, boolean scroll) {
        String text=input.toUpperCase(new java.util.Locale("pl","PL")).replaceAll("[\\r\\n\\t]", " ").trim();
        int[] chars=text.codePoints().limit(500).toArray();
        ByteBuffer data=ByteBuffer.allocate(14+chars.length*20).order(ByteOrder.LITTLE_ENDIAN);
        data.putShort((short)chars.length);
        // Left/centre alignment; leftward scrolling, white, no background.
        data.put(new byte[]{1,1,(byte)(scroll?1:0),45,1,(byte)255,(byte)255,(byte)255,0,0,0,0});
        Paint p=new Paint();p.setTypeface(Typeface.create("sans-serif-condensed",Typeface.NORMAL));
        p.setTextSize(13);p.setColor(Color.WHITE);p.setAntiAlias(false);
        for(int ch:chars){
            Bitmap b=Bitmap.createBitmap(8,16,Bitmap.Config.ARGB_8888);
            Canvas c=new Canvas(b);String glyph=new String(Character.toChars(ch));
            float width=p.measureText(glyph);c.save();if(width>7)c.scale(7/width,1);
            c.drawText(glyph,0,12,p);c.restore();
            data.put(new byte[]{0,(byte)255,(byte)255,(byte)255});
            for(int y=0;y<16;y++){int bits=0;for(int x=0;x<8;x++)if(Color.alpha(b.getPixel(x,y))>0)bits|=1<<x;data.put((byte)bits);}
            b.recycle();
        }
        return frame(data.array());
    }
    static byte[] frame(byte[] data){
        CRC32 crc=new CRC32();crc.update(data);
        ByteBuffer frame=ByteBuffer.allocate(data.length+15).order(ByteOrder.LITTLE_ENDIAN);
        frame.putShort((short)frame.capacity()).put(new byte[]{0,1,0}).putInt(data.length).putInt((int)crc.getValue()).put(new byte[]{0,0}).put(data);
        return frame.array();
    }
}
