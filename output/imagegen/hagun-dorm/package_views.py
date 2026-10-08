from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image
import json

root=Path(__file__).resolve().parent
images=['A-overall-layout.png','B-entrance-to-balcony.png','C-balcony-to-entrance.png','D-sofa-and-storage.png']
records=[]
for name in images:
    with Image.open(root/name) as im:
        im.verify()
    with Image.open(root/name) as im:
        records.append({'file':name,'size':list(im.size)})
(root/'image-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
files=images+[f'{v}-prompt.txt' for v in 'ABCD']+['布局与来源.md','image-manifest.json']
with ZipFile(root/'hagun-dorm-four-views.zip','w',ZIP_DEFLATED) as bundle:
    for name in files:
        bundle.write(root/name,arcname=name)
print(json.dumps({'images':records,'bundle_bytes':(root/'hagun-dorm-four-views.zip').stat().st_size},ensure_ascii=False))
