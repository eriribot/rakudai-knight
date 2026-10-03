import hashlib
import json
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[4]
index = json.loads((OUT.parent / 'index.json').read_text(encoding='utf-8-sig'))
audit = []
for book in index['books']:
    if not 13 <= book.get('volume', 0) <= 19:
        continue
    with zipfile.ZipFile(ROOT / book['epub']) as z:
        indexed = {r['member'] for r in book['images']}
        names = [n for n in z.namelist() if n.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'))]
        extra = []
        for n in names:
            if n in indexed:
                continue
            if n.lower().endswith('.svg'):
                extra.append({'member': n, 'type': 'svg'})
            else:
                im = Image.open(z.open(n))
                extra.append({'member': n, 'size': list(im.size)})
        audit.append({'id': book['id'], 'epub': book['epub'], 'indexedImageCount': len(indexed), 'zipImageCount': len(names), 'notIndexed': extra})
(OUT / 'zip-image-completeness.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(audit, ensure_ascii=False, indent=2))
source18 = Image.open(OUT / 'cn-18/190226.jpg')
source19 = Image.open(OUT / 'cn-19/196521.jpg')
source18.crop((0, 425, 605, 1590)).save(OUT / 'vol18-xiaoli-detail.jpg', quality=96)
source19.crop((800, 292, 937, 482)).resize((411, 570), Image.Resampling.LANCZOS).save(OUT / 'vol19-candidate-detail.jpg', quality=96)
