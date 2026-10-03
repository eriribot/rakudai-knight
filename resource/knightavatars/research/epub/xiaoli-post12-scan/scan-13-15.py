import zipfile, json, re, html, hashlib, posixpath, sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
sys.stdout.reconfigure(encoding='utf-8')
root=Path('E:/web/落第')
out=root/'resource/knightavatars/research/epub/xiaoli-post12-scan'
index=json.loads((root/'resource/knightavatars/research/epub/index.json').read_text('utf-8'))
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
records=[]
for b in index['books']:
 if b['volume'] not in (13,14,15) or b['id'] not in ('tw-13','tw-14','tw-15'):continue
 d=out/b['id'];d.mkdir(parents=True,exist_ok=True)
 book={'volume':b['volume'],'epub':b['epub'],'images':[],'mentions':[]}
 with zipfile.ZipFile(root/b['epub']) as z:
  xhtml={n:z.read(n).decode('utf-8-sig') for n in z.namelist() if n.endswith('.xhtml')}
  for n,s in xhtml.items():
   clean=html.unescape(re.sub('<[^>]+>','',s))
   (d/(Path(n).stem+'.txt')).write_text(clean,'utf-8')
   lines=s.splitlines()
   for lineno,line in enumerate(lines,1):
    if any(k in line for k in ['小莉','饕餮','饕饕','福小','福小莉','フー']):
     book['mentions'].append({'xhtml':n,'line':lineno,'text':html.unescape(re.sub('<[^>]+>','',line)).strip()})
  for im in b['images']:
   member=im['member'];data=z.read(member)
   target=d/Path(member).name;target.write_bytes(data)
   refs=[]
   for n,s in xhtml.items():
    lines=s.splitlines()
    for lineno,line in enumerate(lines,1):
     for src in re.findall(r'(?:src|href)=["\']([^"\']+)["\']',line):
      if posixpath.normpath(posixpath.join(posixpath.dirname(n),src))==member:
       refs.append({'xhtml':n,'line':lineno,'before':html.unescape(re.sub('<[^>]+>','', '\n'.join(lines[max(0,lineno-12):lineno-1]))).strip(),'after':html.unescape(re.sub('<[^>]+>','', '\n'.join(lines[lineno:lineno+12]))).strip()})
   book['images'].append({'member':member,'file':str(target.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'width':im['width'],'height':im['height'],'references':refs})
  imgs=[r for r in book['images'] if 'logo' not in r['member'] and 'title' not in r['member']]
  cw,ch=340,500;cols=4;rows=(len(imgs)+cols-1)//cols
  sheet=Image.new('RGB',(cw*cols,ch*rows),'#eee8da');dr=ImageDraw.Draw(sheet)
  for i,r in enumerate(imgs):
   im=Image.open(root/r['file']).convert('RGB');im.thumbnail((cw-16,ch-44))
   x=(i%cols)*cw+(cw-im.width)//2;y=(i//cols)*ch
   sheet.paste(im,(x,y+30));dr.text(((i%cols)*cw+6,y+5),Path(r['member']).name,font=font,fill='black')
  sheet.save(d/'all-illustrations.jpg',quality=92)
 records.append(book)
 (d/'scan.json').write_text(json.dumps(book,ensure_ascii=False,indent=2),'utf-8')
 print(b['id'],len(book['images']),'images',len(imgs),'illustration items',len(book['mentions']),'mentions')
 for m in book['mentions']:print(m['xhtml'],m['line'],m['text'][:230])
(out/'scan-13-15-inventory.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),'utf-8')
