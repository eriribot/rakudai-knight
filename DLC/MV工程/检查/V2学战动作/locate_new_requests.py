from pathlib import Path
import cv2
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
cap=cv2.VideoCapture(str(P.parents[1]/'学战都市_去水印母版.mp4'))
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',18)
def sheet(name,times,cols=4):
    out=Image.new('RGB',(cols*320,204*((len(times)+cols-1)//cols)),(12,14,20));d=ImageDraw.Draw(out)
    for i,t in enumerate(times):
        n=round(t*25);cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read()
        if not ok:raise RuntimeError(t)
        x=i%cols*320;y=i//cols*204
        out.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y))
        d.text((x+3,y+182),f'{n/25:.2f}s / f{n}',font=font,fill='white')
    out.save(P/name,quality=94)
sheet('school_last_cut_frames.jpg',[n/25 for n in [867,868,869,870]])
for t in []:
    cap.set(cv2.CAP_PROP_POS_FRAMES,round(t*25));ok,f=cap.read()
    if ok:cv2.imencode('.png',f)[1].tofile(P/f'full_{t:.2f}.png')
cap.release()
