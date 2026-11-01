from pathlib import Path
import cv2
from PIL import Image,ImageDraw,ImageFont

P=Path(__file__).resolve().parent
font=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',20)
clips=[('一辉登场','ep01/ikki_intro.mp4'),('史黛菈攻击','ep01/stella_attack.mp4'),('一辉回望','ep02/ikki_reflection.mp4'),('雪中一辉','ep02/snow_child.mp4'),('龙马现身','ep02/snow_ryoma.mp4'),('赤色磷光','ep12/ep12_departure.mp4')]
rows=[]
for label,rel in clips:
    path=P/'素材/twxgct'/rel
    if not path.exists():continue
    cap=cv2.VideoCapture(str(path));frames=[]
    while True:
        ok,im=cap.read()
        if not ok:break
        frames.append(im)
    cap.release()
    row=Image.new('RGB',(1280,215),'#20252c');d=ImageDraw.Draw(row)
    for j,fraction in enumerate([0,.33,.67,1]):
        index=round((len(frames)-1)*fraction)
        im=Image.fromarray(cv2.cvtColor(frames[index],cv2.COLOR_BGR2RGB)).resize((320,180))
        row.paste(im,(j*320,35));d.text((j*320+5,5),f'{label} {index}/25s',font=font,fill='white')
    rows.append(row)
sheet=Image.new('RGB',(1280,215*len(rows)))
for i,row in enumerate(rows):sheet.paste(row,(0,215*i))
sheet.save(P/'检查/final_clips_contact.jpg',quality=92)
