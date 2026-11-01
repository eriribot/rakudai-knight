from pathlib import Path
import cv2
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
ROOT=P.parent.parent
source=next(ROOT.glob('*Asterisk*.mp4'))
cap=cv2.VideoCapture(str(source))
times=list(range(21,202,3))
for group in range(4):
    current=times[group*16:(group+1)*16]
    if not current:continue
    sheet=Image.new('RGB',(1280,len(current)*132),'#17191f');draw=ImageDraw.Draw(sheet)
    for row,t in enumerate(current):
        cap.set(cv2.CAP_PROP_POS_FRAMES,t*25);ok,frame=cap.read()
        if not ok:continue
        crop=Image.fromarray(cv2.cvtColor(frame[610:720],cv2.COLOR_BGR2RGB))
        sheet.paste(crop,(0,row*132+22));draw.text((8,row*132+3),str(t)+' s',fill='white')
    sheet.save(P/f'检查/lyrics_sheet_{group}.jpg',quality=95)
cap.release()
