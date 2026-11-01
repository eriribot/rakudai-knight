from pathlib import Path
import cv2,numpy as np,json
P=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
c=cv2.VideoCapture(str(P.parent/'学战都市×落第骑士英雄谭_联合MV_V2_交锋版.mp4'))
features=[];ns=[]
n=0
while True:
 ok,f=c.read()
 if not ok:break
 if n%5==0:
  g=cv2.cvtColor(f[:600],cv2.COLOR_BGR2GRAY);g=cv2.resize(g,(32,18),interpolation=cv2.INTER_AREA).astype(np.float32)
  if g.std()>16:
   a=(g-g.mean()).ravel();a/=np.linalg.norm(a);features.append(a);ns.append(n)
 n+=1
c.release();a=np.stack(features);sim=a@a.T
matches=[]
for i in range(len(ns)):
 for j in range(i+1,len(ns)):
  if ns[j]-ns[i]>=75 and sim[i,j]>.975:
   matches.append({'a':ns[i]/25,'b':ns[j]/25,'correlation':round(float(sim[i,j]),5)})
matches.sort(key=lambda r:-r['correlation'])
(OUT/'v3_visual_repeat_scan_candidates.json').write_text(json.dumps({'method':'Full V2 sequential decode, grayscale normalized32x18 at5-frame stride, >.975 correlation and at least3s apart. Candidate finder only; not an identity proof; color grading differences intentionally ignored.','decoded_frames':n,'matches':matches},indent=2),encoding='utf-8')
known=[([25,27],[148,150.2]),([29.1,31.32],[48.4,50.3]),([31.32,33.92],[58,60.2]),([64.6,66.24],[74.4,76]),([69.48,72.2],[117.68,119.4]),([66.2,74.44],[127.1,128.1]),([110,110.4],[148,150]),([125.9,127.2],[155.2,156.5])]
rest=[m for m in matches if not any(a[0]<=m['a']<=a[1] and b[0]<=m['b']<=b[1] for a,b in known)]
print(json.dumps({'total':len(matches),'other_candidates':rest[:65]}))
