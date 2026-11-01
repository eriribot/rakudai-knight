from pathlib import Path
import sys,json,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(P))
import render_crossover_v2 as R
plan=json.loads((P/'edit_plan_v2.json').read_text(encoding='utf-8'))
(OUT/'audit_plan_snapshot.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
lyrics=json.loads((P/'lyrics_timeline.json').read_text(encoding='utf-8'))['segments']
overlays=R.lyric_overlays(lyrics);clips=R.Clips()
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',19)
rows=[]
for idx,item in enumerate(plan['edits']):
    if not (63.12<=item['start']<76 or 148.48<=item['start']<159.28):continue
    start=round(item['start']*25);end=round(item['end']*25)
    ns=[start,(start+end-1)//2,end-1]
    ims=[]
    for n in ns:
        offset=(n-start)/25
        f=R.render_item(clips,item,offset)
        for a,b,rgb,alpha in overlays:
            if a<=n<b:f=np.clip(f*(1-alpha)+rgb*alpha,0,255).astype(np.uint8);break
        cv2.imencode('.jpg',f)[1].tofile(OUT/f'audit_item_{idx:02}_{n:04}.jpg')
        ims.append(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((426,240)))
    rows.append((idx,item,ns,ims))
for batch in range((len(rows)+5)//6):
    subset=rows[batch*6:batch*6+6];sheet=Image.new('RGB',(1278,len(subset)*288),(10,12,18));d=ImageDraw.Draw(sheet)
    for i,(idx,item,ns,ims) in enumerate(subset):
        for j,(n,im) in enumerate(zip(ns,ims)):
            x=j*426;y=i*288;sheet.paste(im,(x,y+48))
            d.text((x+3,y+3),f'item {idx} target {n/25:.2f}s',font=font,fill='white')
            if 'file' in item:lab=f"local {item.get('clip_start',0)+(n/25-item['start'])*item.get('speed',1):.2f}s"
            else:lab='PAIR'
            d.text((x+3,y+25),lab,font=font,fill=(235,220,160))
    sheet.save(OUT/f'audit_exchange_contact_{batch}.jpg',quality=94)
clips.close()
print('Rendered samples for',len(rows),'edits')
