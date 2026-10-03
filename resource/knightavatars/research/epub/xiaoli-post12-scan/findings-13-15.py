import json,zipfile,hashlib,re,sys
from pathlib import Path
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
root=Path('E:/web/落第');out=root/'resource/knightavatars/research/epub/xiaoli-post12-scan'
books=json.loads((out/'scan-13-15-inventory.json').read_text('utf-8'))
characters={
13:['西京宁音饮酒','纳西姆','纳西姆与宁音','艾莉丝与欧尔·格尔','史黛菈','艾茵','艾茵','多多良','黑骑士艾莉丝的铠甲','黑铁珠雫'],
14:['宁音与泷泽黑乃','纳西姆','魔化宁音','宁音','宁音','泷泽黑乃与宁音','宁音','婴儿欧尔雷斯','一辉与多多良','艾莉丝'],
15:['一辉','欧尔·格尔','艾莉丝','法米利昂一方配角（米利雅莉亚等）','一辉与欧尔·格尔','欧尔·格尔','黑铁珠雫','欧尔·格尔','幼儿化一辉与珠雫、史黛菈','亚伯拉罕·卡特']}
result={'schemaVersion':1,'scope':'Local Taiwan edition EPUB volumes 13–15; source image bytes preserved.','method':['Reused index.json and its image/XHTML mapping.','Compared entire ZIP image member list including <180px icons and SVG suffixes.','Visually viewed all three contact sheets (every color/monochrome illustration), original volume13 004.jpg and 011.jpg, and unindexed note.png plus logo samples.','Cross-checked every body illustration image element and surrounding named scene text; searched all XHTML for 小莉/饕餮/福小.'],'volumes':[]}
for b in books:
 v=b['volume'];z=zipfile.ZipFile(root/b['epub']);d=out/f'tw-{v}';members=[n for n in z.namelist() if Path(n).suffix.lower() in ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg']]
 indexed={i['member'] for i in b['images']}
 extra=[]
 for m in members:
  if m not in indexed:
   data=z.read(m);f=d/Path(m).name;f.write_bytes(data)
   extra.append({'member':m,'file':str(f.relative_to(root)).replace('\\','/'),'dimensions':list(Image.open(f).size),'sha256':hashlib.sha256(data).hexdigest(),'classification':'48×48 annotation icon 注, not a character; visually reviewed'})
 body=[]
 for num in range(7,17):
  i=next(i for i in b['images'] if i['member'].endswith(f'/{num:03}.jpg'))
  body.append({'member':i['member'],'file':i['file'],'sha256':i['sha256'],'references':i['references'],'identifiedScene':characters[v][num-7],'xiaoli':False,'verification':'visual review + named scene context from linked XHTML'})
 mentions=b['mentions']
 if v==13:
  explanation='All mentions are retrospective. Most misleading candidate 011.jpg appears at Chapter003.xhtml line665; lines663/667/668 explicitly identify the pictured fighter as Stella. Xiaoli is mentioned later at line679 as a previous opponent in Stella’s recollection.'
 elif v==14:explanation='No 小莉/福小/饕餮 mentions in any XHTML. All color and monochrome illustrations visually inspected with chapter scene context; none depicts Xiaoli.'
 else:explanation='Chapter001.xhtml line1153 recalls Stella’s earlier fight with 饕餮; no present Xiaoli scene or illustration found.'
 counts={'zipImageMembers':len(members),'indexedImages':len(b['images']),'bodyMonochromeIllustrations':10,'coverImageVariants':2,'colorSpreadsWithRotatedDuplicates':6,'distinctColorSpreads':3,'contentsPage':1,'decorativeLogos':1 if v==13 else 2,'annotationIcons':1,'svgMembers':sum(Path(m).suffix.lower()=='.svg' for m in members)}
 result['volumes'].append({'volume':v,'epub':b['epub'],'counts':counts,'unindexedImages':extra,'allImagesPreservedWithoutModification':all(hashlib.sha256(z.read(i['member'])).hexdigest()==i['sha256'] for i in b['images']),'finding':'no_verified_xiaoli_illustration','explanation':explanation,'mentions':mentions,'bodyIllustrations':body,'contactSheet':str((d/'all-illustrations.jpg').relative_to(root)).replace('\\','/'),'uncertainCandidates':[]})
(out/'findings-13-15.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps([{'volume':b['volume'],'counts':b['counts'],'finding':b['finding'],'sourceBytesMatch':b['allImagesPreservedWithoutModification']} for b in result['volumes']],ensure_ascii=False,indent=2))
