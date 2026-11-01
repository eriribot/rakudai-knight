from pathlib import Path
from PIL import Image,ImageDraw
import math,json
P=Path(__file__).resolve().parent;R=P.parent.parent/'resource'
files=sorted(R.glob('no*.jpg'))+sorted(R.glob('p*.jpg'))
sheet=Image.new('RGB',(1200,math.ceil(len(files)/6)*300),'#252a33');d=ImageDraw.Draw(sheet);records=[]
for j,p in enumerate(files):
    im=Image.open(p);records.append({'path':str(p),'size':list(im.size),'mode':im.mode});im.thumbnail((196,270),Image.Resampling.LANCZOS)
    x=j%6*200;y=j//6*300;sheet.paste(im.convert('RGB'),(x+(200-im.width)//2,y+25));d.text((x+4,y+3),p.name+' '+str(records[-1]['size']),fill='white')
sheet.save(P/'检查/resource_covers_contact.jpg',quality=95)
(P/'检查/resource_covers_metadata.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf8')
