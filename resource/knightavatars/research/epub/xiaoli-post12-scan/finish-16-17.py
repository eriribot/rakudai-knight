from pathlib import Path
import json,zipfile,hashlib,io,re,html,sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
root=Path('E:/web/落第')
out=root/'resource/knightavatars/research/epub/xiaoli-post12-scan'
inventory=json.loads((out/'16-17-inventory.json').read_text('utf-8'))
findings={'scope':'Local EPUB volume 16, both editions; volume 17. Images reviewed visually and against XHTML scene references.','candidateCount':0,'findings':[],'volume16Comparison':{'exactSharedSha256Count':0,'visualPairCount':16,'pairs':[],'note':'16 base illustrations/cover/contents match visually; encodings and some resolutions differ. The Taiwanese package adds three rotated color-page versions and three decorative bitmaps; these are not additional character illustrations.'}}
for b in inventory['books']:
    with zipfile.ZipFile(root/b['epub']) as z:
        raster=[n for n in z.namelist() if re.search(r'\.(jpg|jpeg|png|gif|webp)$',n,re.I)]
        svg=[n for n in z.namelist() if n.lower().endswith('.svg')]
        texts={n:z.read(n).decode('utf-8-sig') for n in z.namelist() if n.lower().endswith(('.xhtml','.html'))}
        keywords=[]
        inline_svg=[]
        for n,t in texts.items():
            if re.search(r'<svg\b',t,re.I): inline_svg.append(n)
            for i,line in enumerate(t.splitlines()):
                if re.search(r'福小|小莉|小丽|小麗|饕餮|Xiaoli|Fu Xiaoli',line,re.I):
                    keywords.append({'xhtml':n,'line':i+1,'text':html.unescape(re.sub('<[^>]*>',' ',line)).strip()})
        extras=[]
        for n in raster:
            if n not in {r['member'] for r in b['images']}:
                data=z.read(n);size=Image.open(io.BytesIO(data)).size
                extras.append({'member':n,'size':size,'sha256':hashlib.sha256(data).hexdigest(),'visualFinding':'48×48 red square bearing 注; decorative footnote button, no person'})
        hashes_valid=all(hashlib.sha256((root/i['originalFile']).read_bytes()).hexdigest()==i['sha256'] for i in b['images'])
        finding={'id':b['id'],'epub':b['epub'],'zipRasterCount':len(raster),'indexedBitmapCount':len(b['images']),'independentSvgCount':len(svg),'inlineSvgDocuments':inline_svg,'notIndexed':extras,'keywords':keywords,'xiaoliIllustrationCount':0,'status':'no-xiaoli-illustration-identified-in-this-local-edition','visualReview':'Every image shown in the all-images contact sheet; color captions and the potentially ambiguous long-black-haired volume17 woman inspected at full size. Contexts agree with other named characters.','originalImageCopiesSha256Validated':hashes_valid,'inventoryFile':'16-17-inventory.json','contactSheet':b['contactSheet']}
        if b['id']=='tw-16':
            finding['uniqueBasePageCount']=16
            finding['additionalRotatedCopies']=['OEBPS/Images/003_.jpg','OEBPS/Images/004_.jpg','OEBPS/Images/005_.jpg']
            finding['decorativeBitmaps']=['OEBPS/Images/logo.png','OEBPS/Images/logo2.png','OEBPS/Images/note.png']
        if b['id']=='cn-17':
            finding['falsePositiveExcluded']={'member':'OEBPS/Images/140446.jpg','imageTag':{'xhtml':'OEBPS/Text/chapter4.xhtml','line':1826},'namedSceneAnchor':{'xhtml':'OEBPS/Text/chapter4.xhtml','line':1780,'excerpt':'这名女子站在战车上方，黑色的长卷发随海风飘曳。她就是 C 级骑士，折木有里。'},'result':'折木有里, not 福小莉'}
        findings['findings'].append(finding)
tw=next(b for b in inventory['books'] if b['id']=='tw-16');cn=next(b for b in inventory['books'] if b['id']=='cn-16')
for n in range(1,17):
    a=next(i for i in tw['images'] if i['member']==f'OEBPS/Images/{n:03d}.jpg')
    b=next(i for i in cn['images'] if i['member']==f'OEBPS/Images/{137114+n}.jpg')
    findings['volume16Comparison']['pairs'].append({'twMember':a['member'],'cnMember':b['member'],'twSize':[a['width'],a['height']],'cnSize':[b['width'],b['height']],'sameSha256':a['sha256']==b['sha256'],'visualStatus':'same composition and character scene, checked in parallel contact sheets'})
(out/'16-17-findings.json').write_text(json.dumps(findings,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'candidateCount':0,'books':[(f['id'],f['zipRasterCount'],f['originalImageCopiesSha256Validated']) for f in findings['findings']],'comparisonPairCount':len(findings['volume16Comparison']['pairs'])},ensure_ascii=False))
