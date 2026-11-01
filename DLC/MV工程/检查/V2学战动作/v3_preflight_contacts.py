import sys,json,math
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent
sys.path.insert(0,str(P))
import render_crossover_v3 as v3
e=v3.engine;c=e.Clips()
plan=json.loads((P/'edit_plan_v3.json').read_text('utf-8'))
lyrics=json.loads((P/'lyrics_timeline.json').read_text('utf-8'))
if isinstance(lyrics,dict):lyrics=lyrics.get('segments',lyrics.get('lyrics'))
overlays=e.lyric_overlays(lyrics)
items=[(i,x) for i,x in enumerate(plan['edits']) if x.get('kind')!='roster']
for batch in range(math.ceil(len(items)/7)):
 chunk=items[batch*7:(batch+1)*7]
 sheet=Image.new('RGB',(1536,len(chunk)*310),(16,16,16));d=ImageDraw.Draw(sheet)
 for row,(i,x) in enumerate(chunk):
  nmax=round((x['end']-x['start'])*25)-1
  for col,n in enumerate([0,nmax//2,nmax]):
   frame=v3.render_item(c,x,n/25)
   absolute=round(x['start']*25)+n
   for a,b,rgb,alpha in overlays:
    if a<=absolute<b:frame=np.clip(frame*(1-alpha)+rgb*alpha,0,255).astype('uint8');break
   im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)).resize((512,288))
   px=col*512;py=row*310;sheet.paste(im,(px,py))
   d.text((px+3,py+289),f"#{i} target {absolute/25:.2f} src {x.get('clip_start',0)+n/25*x.get('speed',1):.3f}",fill='white')
 sheet.save(O/f'v3_preflight_{batch}.jpg',quality=93)
c.close()
