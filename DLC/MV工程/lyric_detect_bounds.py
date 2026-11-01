from pathlib import Path
import cv2,numpy as np,json
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent
source=next(P.parent.parent.glob('*Asterisk*.mp4'))
refs=[27,33,39,45,51,54,60,69,75,87,96,102,105,114,117,123,129,135,144,168,174,180,186,192]
bounds=[(21,29),(27,35),(33,42),(40,50),(47,54),(52,58),(55,66),(63,72),(69,79),(80,93),(90,99),(96,106),(103,112),(109,117),(114,120),(117,127),(124,135),(132,142),(140,147),(164,172),(169,176),(173,184),(180,189),(186,196)]
cap=cv2.VideoCapture(str(source));templates=[]
def feat(im):
    im=im[628:706]
    gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
    low=cv2.erode(gray,np.ones((5,5),np.uint8))
    a=((gray>190)&((gray.astype(float)-low)>70)).astype(np.float32)
    return a
for ref in refs:
    cap.set(cv2.CAP_PROP_POS_FRAMES,ref*25);ok,im=cap.read();templates.append(feat(im))
scores=[[] for _ in refs]
cap.set(cv2.CAP_PROP_POS_FRAMES,0)
for n in range(5267):
    ok,im=cap.read()
    if not ok:break
    relevant=[i for i,(a,b) in enumerate(bounds) if a*25<=n<b*25]
    if relevant:
        f=feat(im)
        for i in relevant:
            m=templates[i]
            score=float((f*m).sum()/max(m.sum(),1))
            scores[i].append([n,score])
cap.release()
result=[]
for i,seq in enumerate(scores):
    best=max(x[1] for x in seq)
    active=[n for n,s in seq if s>max(.34,best*.64)]
    a,b=min(active),max(active)+1
    result.append({'i':i,'ref':refs[i],'start':a/25,'end':b/25,'start_frame':a,'end_frame':b,'max_score':best})
(P/'检查/lyric_detect_raw.json').write_text(json.dumps({'ranges':result,'scores':scores},indent=2),encoding='utf8')
print(json.dumps(result,indent=2))
cap=cv2.VideoCapture(str(source))
for group in range(6):
    entries=result[group*4:(group+1)*4]
    sheet=Image.new('RGB',(1280,132*len(entries)*4),'#17191f');d=ImageDraw.Draw(sheet)
    j=0
    for r in entries:
        for n in [r['start_frame']-1,r['start_frame'],r['end_frame']-1,r['end_frame']]:
            cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,im=cap.read()
            if not ok:continue
            sheet.paste(Image.fromarray(cv2.cvtColor(im[610:720],cv2.COLOR_BGR2RGB)),(0,j*132+22))
            d.text((8,j*132+3),f"{r['i']}: frame {n} / {n/25:.2f} sec",fill='white');j+=1
    sheet.save(P/f'检查/lyric_boundaries_{group}.jpg',quality=95)
cap.release()
