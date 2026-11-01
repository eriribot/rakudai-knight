from pathlib import Path
import cv2
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',19)
def sheet(filename,name,ns):
    c=cv2.VideoCapture(str(P/filename));out=Image.new('RGB',(1280,204*((len(ns)+3)//4)),(10,12,18));d=ImageDraw.Draw(out)
    for i,n in enumerate(ns):
        c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=c.read()
        if not ok:raise RuntimeError(n)
        x=i%4*320;y=i//4*204
        out.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+24));d.text((x+3,y+2),f'f{n} local {n/25:.2f}s',font=font,fill='white')
    out.save(OUT/name,quality=95);c.release()
sheet('素材/v2/ep01/ikki_counter_raw.mp4','audit_counter_cut.jpg',list(range(50,72)))
sheet('素材/v2/ep01/stella_block_raw.mp4','audit_stella_block_cut.jpg',list(range(26)))
sheet('素材/v2/ep01/stella_fire_raw.mp4','audit_stella_fire_raw_top.jpg',[154,162,170,178,186,194])
sheet('素材/v2/ep01/stella_charge_raw.mp4','audit_stella_profile_cut.jpg',list(range(20,46,2)))
sheet('素材/v2/ep01/stella_charge_raw.mp4','audit_ikki_guard_alternate.jpg',list(range(86,120,2)))
