from pathlib import Path
import json,sys,copy,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(P));import render_crossover_v2 as R
plan=json.loads((OUT/'audit_plan_snapshot.json').read_text(encoding='utf-8'))
fixes={19:{'file':'素材/v2/ep01/stella_charge_raw.mp4','clip_start':4.56,'speed':.16,'crop':[32,0,576,324]},28:{'speed':.66},33:{'crop':[80,40,480,270]},15:{'clip_start':8.24},16:{'crop':[0,0,1080,608]}}
pair=copy.deepcopy(plan['edits'][25]);pair['left'].update(speed=.28,focus_x=330);pair['right'].update(speed=.28,focus_x=950)
cl=R.Clips();font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',19)
rows=[]
for idx,changes in fixes.items():
    it=copy.deepcopy(plan['edits'][idx]);it.update(changes);rows.append((idx,it))
rows.append((25,pair))
out=Image.new('RGB',(1278,288*len(rows)),(10,12,18));d=ImageDraw.Draw(out)
for i,(idx,it) in enumerate(rows):
    a=round(it['start']*25);b=round(it['end']*25)
    for j,n in enumerate([a,(a+b-1)//2,b-1]):
        f=R.render_item(cl,it,(n-a)/25)
        cv2.imencode('.jpg',f)[1].tofile(OUT/f'fix_candidate_{idx}_{n}.jpg')
        x=j*426;y=i*288;out.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((426,240)),(x,y+48))
        d.text((x+4,y+4),f'item{idx} candidate {n/25:.2f}',font=font,fill='white')
out.save(OUT/'audit_fix_candidates.jpg',quality=95);cl.close()
(OUT/'audit_fix_proposals.json').write_text(json.dumps({'parameter_patches':fixes,'pair_item_25':pair},ensure_ascii=False,indent=2),encoding='utf-8')
