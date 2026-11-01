import sys,json,math
from pathlib import Path
import cv2
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parents[1];O=P/'检查/v6';O.mkdir(exist_ok=True)
sys.path.insert(0,str(P))
from render_crossover_v2 import Clips
plan=json.loads((P/'edit_plan_v4.json').read_text('utf-8'));clips=Clips()
candidates={'touka':[48.88,49.60,50.28,50.52,51.00,51.40,51.80,52.16,52.48,52.80,53.16,53.60,54.20],
'ikki':[64.12,64.40,65.20,66.52,68.36,68.52,68.64,69.60,69.76,69.96,70.12],
'stella':[152.00,152.24,152.52,153.84,154.12,154.48,154.64,154.80,157.00,157.16,157.32]}
for who,times in candidates.items():
 sheet=Image.new('RGB',(1600,math.ceil(len(times)/5)*205),(20,20,20));d=ImageDraw.Draw(sheet)
 for j,t in enumerate(times):
  n=round(t*25);t=n/25;i,x=next((i,x) for i,x in enumerate(plan['edits']) if x['start']<=t<x['end'])
  f=clips.frame(x,t-x['start']);im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180))
  px=j%5*320;py=j//5*205;sheet.paste(im,(px,py));d.text((px+3,py+181),f'{who} t{t:.2f} item{i}',fill='white')
 sheet.save(O/f'{who}_candidates.jpg',quality=94)
clips.close()
