from pathlib import Path
import json
import cv2
from PIL import Image, ImageDraw

base = Path(__file__).resolve().parent.parent
names = ['ep01/stella_attack.mp4', 'ep02/snow_child.mp4', 'ep02/snow_ryoma.mp4', 'ep02/ikki_reflection.mp4']
out = Image.new('RGB', (960, len(names)*204))
draw = ImageDraw.Draw(out)
report = []
for row, name in enumerate(names):
    cap = cv2.VideoCapture(str(base/name))
    frames=[]
    while True:
        ok,frame=cap.read()
        if not ok:
            break
        frames.append(frame)
    fps=cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    report.append({'file':name,'frames':len(frames),'fps':fps,'duration':len(frames)/fps})
    for col,number in enumerate([0,len(frames)//2,len(frames)-1]):
        im=Image.fromarray(cv2.cvtColor(frames[number],cv2.COLOR_BGR2RGB)).resize((320,180))
        out.paste(im,(col*320,row*204))
        draw.text((col*320,row*204+182),f'{Path(name).stem} frame {number}',fill='white')
out.save(base/'ep02/final_clips_contact.jpg')
(base/'ep02/final_clips_verify.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
