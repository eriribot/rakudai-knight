from pathlib import Path
import cv2,numpy as np,argparse,math
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('video');ap.add_argument('--frames',default='');ap.add_argument('--step',type=int,default=5);ap.add_argument('--name',default='inspected_clip');args=ap.parse_args()
cap=cv2.VideoCapture(args.video);frames=[]
while True:
    ok,f=cap.read()
    if not ok:break
    frames.append(f)
cap.release()
scores=[]
for n in range(1,len(frames)):
    a=cv2.resize(frames[n-1],(160,90)).astype(float);b=cv2.resize(frames[n],(160,90)).astype(float)
    scores.append((n,round(float(np.abs(a-b).mean()),2)))
print(sorted(scores,key=lambda x:x[1],reverse=True)[:20])
ns=[int(x) for x in args.frames.split(',')] if args.frames else list(range(0,len(frames),args.step))
sheet=Image.new('RGB',(1280,math.ceil(len(ns)/4)*204),'#131820');d=ImageDraw.Draw(sheet)
for j,n in enumerate(ns):
    x=j%4*320;y=j//4*204
    sheet.paste(Image.fromarray(cv2.cvtColor(frames[n],cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+24))
    d.text((x+4,y+5),f'frame {n} / {n/25:.2f}s',fill='white')
sheet.save(P/f'检查/{args.name}.jpg',quality=95)
