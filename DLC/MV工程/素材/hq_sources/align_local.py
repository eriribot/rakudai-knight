"""Find same-action source timing from already downloaded short clips."""
import argparse,json
from pathlib import Path
import cv2,numpy as np
ap=argparse.ArgumentParser();ap.add_argument('old');ap.add_argument('new');ap.add_argument('--max-offset',type=int,default=500);a=ap.parse_args()
def vecs(p):
 c=cv2.VideoCapture(p);v=[]
 while True:
  ok,f=c.read()
  if not ok:break
  h,w=f.shape[:2];f=f[int(h*.08):int(h*.83),int(w*.08):int(w*.92)]
  g=cv2.cvtColor(cv2.resize(f,(96,54)),cv2.COLOR_BGR2GRAY).astype(np.float32).ravel();g-=g.mean();g/=max(np.linalg.norm(g),1e-6);v.append(g)
 c.release();return np.stack(v)
x=vecs(a.old);y=vecs(a.new);s=x@y.T
scores=[]
for offset in range(-min(a.max_offset,len(x)-1),min(a.max_offset,len(y)-1)):
 i=np.arange(max(0,-offset),min(len(x),len(y)-offset));j=i+offset
 if len(i)<min(60,int(len(x)*.6)):continue
 # Temporal conversion of 23.976 to 25fps may differ by one frame.
 values=np.max(np.stack([s[i,np.clip(j+d,0,len(y)-1)] for d in [-1,0,1]]),axis=0)
 scores.append((float(np.mean(values)),offset,len(i)))
scores.sort(reverse=True)
print(json.dumps({'old':a.old,'new':a.new,'old_frames':len(x),'new_frames':len(y),'best_offsets':[{'score':z[0],'new_minus_old_frames':z[1],'seconds':z[1]/25,'overlap':z[2]} for z in scores[:8]]},ensure_ascii=False,indent=2))
