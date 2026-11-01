from pathlib import Path
import cv2
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent
src=P/'素材/twxgct/ep01/stella_attack_candidate.mp4'
cap=cv2.VideoCapture(str(src));frames=[]
while True:
    ok,f=cap.read()
    if not ok:break
    frames.append(f)
cap.release()
sheet=Image.new('RGB',(1280,204*6),'#131820');d=ImageDraw.Draw(sheet)
for j,n in enumerate(range(0,len(frames),5)):
    im=Image.fromarray(cv2.cvtColor(frames[n],cv2.COLOR_BGR2RGB)).resize((320,180))
    x=j%4*320;y=j//4*204
    sheet.paste(im,(x,y+24));d.text((x+4,y+5),f'local {n/25:.2f}s / nominal source {853.45+n/25:.2f}s',fill='white')
sheet.save(P/'检查/v2_ep1_candidate_dense.jpg',quality=95)
ns=[3,4,13,14,19,20,30,31,54,55,64,65,83,84,93,94]
sheet=Image.new('RGB',(1280,816),'#131820');d=ImageDraw.Draw(sheet)
for j,n in enumerate(ns):
    x=j%4*320;y=j//4*204
    sheet.paste(Image.fromarray(cv2.cvtColor(frames[n],cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+24))
    d.text((x+4,y+5),f'frame {n} / {n/25:.2f}s',fill='white')
sheet.save(P/'检查/v2_ep1_shot_boundaries.jpg',quality=95)
