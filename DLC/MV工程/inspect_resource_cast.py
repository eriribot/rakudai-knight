from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent;ROOT=P.parent.parent
files=[ROOT/'resource/knightavatars'/f'{n}.png' for n in ['ikki','stella','toka','shizuku']]
names=['一辉','史黛菈','刀华','珠雫']
font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',22)
sheet=Image.new('RGB',(1280,640),'#242b35');d=ImageDraw.Draw(sheet);records=[]
for i,(f,name) in enumerate(zip(files,names)):
    im=Image.open(f);info={'character':name,'file':str(f),'size':list(im.size),'mode':im.mode}
    if 'A' in im.getbands():
        a=im.getchannel('A');info['alpha_extrema']=list(a.getextrema());h=a.histogram();info['transparent_fraction']=round(h[0]/(im.width*im.height),4);info['partial_alpha_fraction']=round(sum(h[1:255])/(im.width*im.height),4)
    records.append(info)
    rgb=im.convert('RGBA');rgb.thumbnail((300,560),Image.Resampling.LANCZOS)
    x=i*320
    for y in range(50,630,20):
        for xx in range(x,x+320,20):
            d.rectangle((xx,y,xx+19,y+19),fill='#54606d' if (xx//20+y//20)%2 else '#394451')
    sheet.paste(rgb,(x+(320-rgb.width)//2,60),rgb)
    d.text((x+10,10),name+' '+str(im.size),font=font,fill='white')
sheet.save(P/'检查/resource_cast_contact.jpg',quality=95)
(P/'检查/resource_cast_metadata.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(records,ensure_ascii=False,indent=2))
