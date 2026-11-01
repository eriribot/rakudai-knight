from pathlib import Path
import concurrent.futures,json,requests
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent;D=P/'素材/v2/portraits';D.mkdir(parents=True,exist_ok=True)
names={'ikki':'黑铁一辉','stella':'史黛菈','toka':'东堂刀华','shizuku':'黑铁珠雫'}
def get(k):
    url=f'https://ittoshura.com/character/chara_{k}.jpg'
    s=requests.Session();s.trust_env=False
    r=s.get(url,timeout=30,headers={'Referer':'https://ittoshura.com/character/','User-Agent':'Mozilla/5.0'})
    r.raise_for_status();f=D/f'{k}_anime_official.jpg';f.write_bytes(r.content)
    im=Image.open(f);im.verify();im=Image.open(f)
    return {'id':k,'character':names[k],'file':str(f),'width':im.width,'height':im.height,'mode':im.mode,'transparent':False,'source_page':'https://ittoshura.com/character/','source_url':url,'origin':'TV anime official character design sheet; downloaded original JPG without editing'}
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for r in pool.map(get,names):records.append(r)
(D/'sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',24)
sheet=Image.new('RGB',(1280,1000),'#252a33');d=ImageDraw.Draw(sheet)
for i,r in enumerate(records):
    im=Image.open(r['file']);im.thumbnail((635,440),Image.Resampling.LANCZOS)
    x=i%2*640;y=i//2*500;sheet.paste(im,(x+(640-im.width)//2,y+40));d.text((x+8,y+6),r['character']+f" {r['width']}x{r['height']}",font=font,fill='white')
sheet.save(P/'检查/anime_official_portraits_contact.jpg',quality=95)
print(json.dumps(records,ensure_ascii=False,indent=2))
