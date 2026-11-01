from pathlib import Path
import json,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
cap=cv2.VideoCapture(str(P.parents[1]/'学战都市_去水印母版.mp4'))
def frame(n):
    cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read()
    if not ok:raise RuntimeError(n)
    return f
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',20)
# These are compositor portrait planes, NOT claimed physical four-corner screens.
# The real display is hexagonal and top vertices are outside the image.
specs=[
 {'id':'saya_kirin','interval':[13.04,13.76],'reveal_end':13.24,'reference':334,'samples':[331,334,343],
  'quads':{'left':[[120,20],[520,15],[545,520],[160,565]],'right':[[800,35],[1210,25],[1200,545],[810,505]]},
  'track_rois':{'left':[210,95,260,405],'right':[855,110,280,390]}},
 {'id':'doroteo_elliott','interval':[11.16,11.80],'reveal_end':11.36,'reference':289,'samples':[284,289,294],
  'quads':{'left':[[50,20],[560,15],[575,500],[175,555]],'right':[[745,60],[1125,65],[1125,510],[745,480]]},
  'track_rois':{'left':[205,145,285,345],'right':[790,150,225,300]}},
 {'id':'ard_rmc','interval':[12.08,12.80],'reveal_end':12.28,'reference':313,'samples':[307,313,319],
  'quads':{'left':[[80,5],[530,0],[550,510],[145,555]],'right':[[760,0],[1275,0],[1265,550],[760,500]]},
  'track_rois':{'left':[200,100,240,380],'right':[850,130,275,360]}}
]
result={'coordinate_space':[1280,720],'corner_order':'TL,TR,BR,BL','important':'The physical panels are six-sided, their upper corners lie outside the frame, and the first 0.20 s have animated scan reveal. These manually chosen portrait replacement quads enclose old characters; they are not a measured physical rectangle. Use them with panel masks and preserve original foreground flare. Their changes between clean visible samples are estimated by feature homography. Full reveal requires custom wipe/rebuild, not simple opacity over old people.','panels':[]}
out=Image.new('RGB',(1280,3*3*384),(10,12,18));d=ImageDraw.Draw(out)
for j,s in enumerate(specs):
    ref=frame(s['reference']);gr=cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY)
    samples=[]
    for k,n in enumerate(s['samples']):
        f=frame(n);g=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);rec={'frame':n,'seconds':n/25,'quads':{},'track_errors':{}}
        for side in ['left','right']:
            q=np.array(s['quads'][side],np.float32)
            if n!=s['reference']:
                x,y,w,h=s['track_rois'][side];mask=np.zeros_like(gr);mask[y:y+h,x:x+w]=255
                pts=cv2.goodFeaturesToTrack(gr,250,.015,6,mask=mask)
                p2,st,err=cv2.calcOpticalFlowPyrLK(gr,g,pts,None,winSize=(31,31),maxLevel=4)
                a=pts[st[:,0]==1];b=p2[st[:,0]==1]
                H,inliers=cv2.findHomography(a,b,cv2.RANSAC,2.5)
                if H is not None:
                    q=cv2.perspectiveTransform(q[None],H)[0]
                    residual=np.linalg.norm(cv2.perspectiveTransform(a,H)-b,axis=2).ravel()
                    rec['track_errors'][side]={'inliers':int(inliers.sum()),'matches':len(a),'median_inlier_error':round(float(np.median(residual[inliers.ravel()==1])),3)}
                else:rec['track_errors'][side]={'failed':True}
            rec['quads'][side]=[[round(float(v),1) for v in xy] for xy in q]
            cv2.polylines(f,[q.round().astype(np.int32)],True,(0,215,255),2,cv2.LINE_AA)
            for idx,(x,y) in enumerate(q):
                cv2.circle(f,(round(x),round(y)),5,(0,60,255),-1)
                cv2.putText(f,f'{side[0]}{idx} {x:.0f},{y:.0f}',(max(0,round(x)-50),min(710,max(20,round(y)+20))),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1,cv2.LINE_AA)
        samples.append(rec)
        y=(j*3+k)*384
        out.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((640,360)),(0,y+24))
        d.text((5,y),f'{s["id"]} {n/25:.2f}s f{n}',font=font,fill='white')
        for z,(side,q) in enumerate(rec['quads'].items()):
            d.text((650,y+40+z*145),side+' TL TR BR BL',font=font,fill=(255,220,80))
            for a,pt in enumerate(q):d.text((650,y+65+z*145+a*22),str(pt),font=font,fill='white')
    result['panels'].append({key:value for key,value in s.items() if key not in ['quads','track_rois','samples']}|{'samples':samples})
(P/'screen_compositor_anchors.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
out.save(P/'screen_compositor_anchors_contact.jpg',quality=94)
cap.release()
