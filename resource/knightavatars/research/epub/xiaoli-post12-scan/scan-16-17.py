from pathlib import Path
import json,zipfile,io,sys,hashlib,re,html,posixpath
from PIL import Image,ImageOps,ImageDraw,ImageFont
sys.stdout.reconfigure(encoding='utf-8')
root=Path('E:/web/落第')
out=root/'resource/knightavatars/research/epub/xiaoli-post12-scan'
idx=json.loads((root/'resource/knightavatars/research/epub/index.json').read_text('utf-8'))
books=[]
for book in idx['books']:
    if book['volume'] not in (16,17): continue
    rec={'id':book['id'],'epub':book['epub'],'images':[],'mentions':[]}
    with zipfile.ZipFile(root/book['epub']) as z:
        texts={n:z.read(n).decode('utf-8-sig') for n in z.namelist() if n.endswith(('.xhtml','.html'))}
        for n,t in texts.items():
            lines=t.splitlines()
            for i,line in enumerate(lines):
                if re.search('小莉|饕餮|饕餮|Xiaoli',line,re.I):
                    clean=lambda s:html.unescape(re.sub('<[^>]*>',' ',s)).strip()
                    rec['mentions'].append({'xhtml':n,'line':i+1,'text':clean(line),'nearby':[(j+1,clean(lines[j])) for j in range(max(0,i-4),min(len(lines),i+5))]})
        thumbs=[]
        for img in book['images']:
            data=z.read(img['member'])
            ext=Path(img['member']).suffix
            target=out/(book['id']+'-'+Path(img['member']).name)
            target.write_bytes(data)
            image=Image.open(io.BytesIO(data))
            r={**img,'originalFile':target.relative_to(root).as_posix(),'exactReferences':[]}
            for n,t in texts.items():
                lines=t.splitlines()
                for i,line in enumerate(lines):
                    if '<img' not in line and '<image' not in line:continue
                    if Path(img['member']).name not in line:continue
                    r['exactReferences'].append({'xhtml':n,'line':i+1,'tag':line.strip(),'context':[(j+1,html.unescape(re.sub('<[^>]*>',' ',lines[j])).strip()) for j in range(max(0,i-5),min(len(lines),i+7))]})
            rec['images'].append(r)
            thumbs.append(ImageOps.contain(image.convert('RGB'),(230,290)))
        cw,ch=250,325
        sheet=Image.new('RGB',(1000,40+((len(thumbs)+3)//4)*ch),'#fff6e5')
        d=ImageDraw.Draw(sheet)
        font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
        d.text((8,8),book['id']+' all indexed bitmap images',font=font,fill='black')
        for j,(im,r) in enumerate(zip(thumbs,rec['images'])):
            x=(j%4)*cw;y=40+(j//4)*ch
            sheet.paste(im,(x+(cw-im.width)//2,y))
            d.text((x+5,y+292),Path(r['member']).name,font=font,fill='black')
            d.text((x+5,y+308),str(r['width'])+' x '+str(r['height']),font=font,fill='black')
        target=out/(book['id']+'-all-images.jpg');sheet.save(target,quality=94)
        rec['contactSheet']=target.relative_to(root).as_posix()
    books.append(rec)
(out/'16-17-inventory.json').write_text(json.dumps({'books':books},ensure_ascii=False,indent=2),'utf-8')
for b in books:
    print(json.dumps({'id':b['id'],'imageCount':len(b['images']),'mentions':[(m['xhtml'],m['line'],m['text'][:130]) for m in b['mentions']]},ensure_ascii=False))
tw=next(b for b in books if b['id']=='tw-16');cn=next(b for b in books if b['id']=='cn-16')
print('16 exact SHA shared:',len(set(i['sha256'] for i in tw['images'])&set(i['sha256'] for i in cn['images'])))
