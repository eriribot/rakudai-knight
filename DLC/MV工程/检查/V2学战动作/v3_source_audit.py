from pathlib import Path
import json,cv2
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
v2=P.parent/'学战都市×落第骑士英雄谭_联合MV_V2_交锋版.mp4'
clean=P/'学战都市_去水印母版.mp4'
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',19)
def sheet(src,name,times,cols=4):
    c=cv2.VideoCapture(str(src));out=Image.new('RGB',(cols*320,204*((len(times)+cols-1)//cols)),(10,12,18));d=ImageDraw.Draw(out)
    for i,t in enumerate(times):
        n=round(t*25);c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=c.read()
        if not ok:raise RuntimeError((str(src),t))
        x=i%cols*320;y=i//cols*204
        out.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+24));d.text((x+3,y+2),f'{n/25:.2f}s / f{n}',font=font,fill='white')
    out.save(OUT/name,quality=95);c.release()
sheet(clean,'v3_blue_next_opponent_exact.jpg',[133.20,133.24,133.28,133.32,134.52,134.56,134.60,134.64])
c=cv2.VideoCapture(str(clean))
for t in [130.2,130.4,131.0,131.6,132.0,132.6,133.12,133.24,133.52,134.0,134.6,135.2]:
    c.set(cv2.CAP_PROP_POS_FRAMES,round(t*25));ok,f=c.read()
    if ok:cv2.imencode('.png',f)[1].tofile(OUT/f'v3_blue_full_{t:.2f}.png')
c.release()
