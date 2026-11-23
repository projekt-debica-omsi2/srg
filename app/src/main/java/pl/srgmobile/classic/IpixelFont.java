package pl.srgmobile.classic;

import android.graphics.Canvas;
import android.graphics.Paint;
import java.util.HashMap;
import java.util.Map;

/** Five-column glyphs painted on whole LEDs; no font scaling or antialiasing. */
final class IpixelFont {
    private static final Map<Character,String[]> GLYPHS=new HashMap<>();
    static {
        add('A',"01110 10001 10001 11111 10001 10001 10001");
        add('B',"11110 10001 10001 11110 10001 10001 11110");
        add('C',"01111 10000 10000 10000 10000 10000 01111");
        add('D',"11110 10001 10001 10001 10001 10001 11110");
        add('E',"11111 10000 10000 11110 10000 10000 11111");
        add('F',"11111 10000 10000 11110 10000 10000 10000");
        add('G',"01111 10000 10000 10111 10001 10001 01111");
        add('H',"10001 10001 10001 11111 10001 10001 10001");
        add('I',"11111 00100 00100 00100 00100 00100 11111");
        add('J',"00111 00010 00010 00010 10010 10010 01100");
        add('K',"10001 10010 10100 11000 10100 10010 10001");
        add('L',"10000 10000 10000 10000 10000 10000 11111");
        add('M',"10001 11011 10101 10101 10001 10001 10001");
        add('N',"10001 11001 11001 10101 10011 10011 10001");
        add('O',"01110 10001 10001 10001 10001 10001 01110");
        add('P',"11110 10001 10001 11110 10000 10000 10000");
        add('Q',"01110 10001 10001 10001 10101 10010 01101");
        add('R',"11110 10001 10001 11110 10100 10010 10001");
        add('S',"01111 10000 10000 01110 00001 00001 11110");
        add('T',"11111 00100 00100 00100 00100 00100 00100");
        add('U',"10001 10001 10001 10001 10001 10001 01110");
        add('V',"10001 10001 10001 10001 10001 01010 00100");
        add('W',"10001 10001 10001 10101 10101 11011 10001");
        add('X',"10001 10001 01010 00100 01010 10001 10001");
        add('Y',"10001 10001 01010 00100 00100 00100 00100");
        add('Z',"11111 00001 00010 00100 01000 10000 11111");
        add('0',"01110 10001 10011 10101 11001 10001 01110");
        add('1',"00100 01100 00100 00100 00100 00100 01110");
        add('2',"01110 10001 00001 00010 00100 01000 11111");
        add('3',"11110 00001 00001 01110 00001 00001 11110");
        add('4',"00010 00110 01010 10010 11111 00010 00010");
        add('5',"11111 10000 10000 11110 00001 00001 11110");
        add('6',"01110 10000 10000 11110 10001 10001 01110");
        add('7',"11111 00001 00010 00100 01000 01000 01000");
        add('8',"01110 10001 10001 01110 10001 10001 01110");
        add('9',"01110 10001 10001 01111 00001 00001 01110");
        add(' ',"00000 00000 00000 00000 00000 00000 00000");
        add('-',"00000 00000 00000 11111 00000 00000 00000");
        add('>',"00000 01000 00100 00010 00100 01000 00000");
        add(':',"00000 00100 00100 00000 00100 00100 00000");
        add('.',"00000 00000 00000 00000 00000 00100 00100");
        add('/',"00001 00001 00010 00100 01000 10000 10000");
        add('?',"01110 10001 00001 00010 00100 00000 00100");
    }
    private static void add(char ch,String rows){GLYPHS.put(ch,rows.split(" "));}
    static int width(String text){return text.length()*6;}
    static void clock(Canvas canvas,Paint paint,String text){
        String[] digits={"111 101 101 101 111","010 110 010 010 111","111 001 111 100 111","111 001 111 001 111","101 101 111 001 001","111 100 111 001 111","111 100 111 101 111","111 001 010 010 010","111 101 111 101 111","111 101 111 001 111"};int x=3;
        x=0;
        for(char ch:text.toCharArray()){String pattern=ch>='0'&&ch<='9'?digits[ch-'0']:"000 010 000 010 000";String[] rows=pattern.split(" ");for(int r=0;r<5;r++)for(int col=0;col<3;col++)if(rows[r].charAt(col)=='1')canvas.drawRect(x+col,5+r,x+col+1,6+r,paint);x+=4;}
    }
    static void compact(Canvas canvas,Paint paint,String text,int x,int y,int scale){
        String[] digits={"111 101 101 101 101 101 111","010 110 010 010 010 010 111","111 001 001 111 100 100 111","111 001 001 111 001 001 111","101 101 101 111 001 001 001","111 100 100 111 001 001 111","111 100 100 111 101 101 111","111 001 001 010 010 010 010","111 101 101 111 101 101 111","111 101 101 111 001 001 111"};
        for(char ch:text.toCharArray()){String pattern=ch>='0'&&ch<='9'?digits[ch-'0']:ch==':'?"000 010 010 000 010 010 000":ch=='.'?"000 000 000 000 000 000 010":"000 000 000 000 000 000 000";String[] rows=pattern.split(" ");for(int r=0;r<7;r++)for(int col=0;col<3;col++)if(rows[r].charAt(col)=='1')canvas.drawRect(x+col*scale,y+r*scale,x+(col+1)*scale,y+(r+1)*scale,paint);x+=4*scale;}
    }
    static void draw(Canvas canvas,Paint paint,String text,int x,int y,int scale){
        String accented="ĄĆĘŁŃÓŚŹŻ",base="ACELNOSZZ";
        for(int i=0;i<text.length();i++){
            char ch=text.charAt(i);int accent=accented.indexOf(ch);char plain=accent<0?ch:base.charAt(accent);
            String[] rows=GLYPHS.getOrDefault(plain,GLYPHS.get('?'));
            int top=scale>1||"ĆŃÓŚŹŻ".indexOf(ch)>=0?1:0;
            for(int r=0;r<7;r++)for(int col=0;col<5;col++)if(rows[r].charAt(col)=='1')canvas.drawRect(x+col*scale,y+(r+top)*scale,x+(col+1)*scale,y+(r+top+1)*scale,paint);
            if(accent>=0){if(ch=='Ł'){canvas.drawRect(x,y+4*scale,x+4*scale,y+5*scale,paint);}else if(ch=='Ą'||ch=='Ę'){canvas.drawRect(x+3*scale,y+7*scale,x+5*scale,y+8*scale,paint);}else{int a=ch=='Ż'?2:3;canvas.drawRect(x+a*scale,y,x+(a+1)*scale,y+scale,paint);}}
            x+=6*scale;
        }
    }
}
