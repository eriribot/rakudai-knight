from pathlib import Path
from PIL import Image, ImageDraw
import argparse, cv2, json, math

ap=argparse.ArgumentParser()
ap.add_argument('video',type=Path)
ap.add_argument('--step',type=float,default=.5)
args=ap.parse_args()
cap=cv2.VideoCapture(str(args.video)); fps=cap.get(cv2.CAP_PROP_FPS)
frames=[]
while True:
    ok,fr=cap.read()
    if not ok: break
    frames.append(fr)
cap.release()
indices=list(range(0,len(frames),max(1,round(fps*args.step))))
if indices[-1]!=len(frames)-1:indices.append(len(frames)-1)
w,h,cols=320,204,4
sheet=Image.new('RGB',(w*cols,h*math.ceil(len(indices)/cols)),(24,24,24))
d=ImageDraw.Draw(sheet)
for k,i in enumerate(indices):
    x,y=(k%cols)*w,(k//cols)*h
    im=Image.fromarray(cv2.cvtColor(frames[i],cv2.COLOR_BGR2RGB)).resize((320,180))
    sheet.paste(im,(x,y+24));d.text((x+6,y+5),f'{i/fps:.2f}s | frame {i}',fill='white')
out=args.video.with_name(args.video.stem+'_contact.jpg')
sheet.save(out,quality=90)
print(json.dumps({'path':str(args.video),'frames':len(frames),'fps':fps,'duration':len(frames)/fps,'contact':str(out)}))
