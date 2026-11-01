from pathlib import Path
import cv2
from PIL import Image, ImageDraw, ImageFont
P=Path(__file__).resolve().parent
src=P.parents[1]/'学战都市_去水印母版.mp4'
cap=cv2.VideoCapture(str(src))
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',20)
def sheet(name,times):
    w,h=320,204
    out=Image.new('RGB',(w*4,h*((len(times)+3)//4)),(15,15,20));d=ImageDraw.Draw(out)
    for i,t in enumerate(times):
        n=round(t*25);cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read()
        if not ok: raise RuntimeError((t,n))
        im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180))
        x=(i%4)*w;y=(i//4)*h;out.paste(im,(x,y))
        d.text((x+5,y+181),f'{n/25:.2f}s / f{n}',font=font,fill='white')
    out.save(P/name,quality=94)
sheet('boundary_true_cut_frames.jpg',[63.00,63.04,63.08,63.12,76.48,76.52,76.56,76.60,159.40,159.44,159.48,159.52])
cap.release()
