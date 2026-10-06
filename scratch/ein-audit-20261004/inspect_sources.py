from pathlib import Path
import re
import zipfile
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
TERMS = ['艾茵', '恶之华', '惡之華', '阿伯伦特', '阿伯倫特', '阿斯塔萝黛', '阿斯塔蘿黛']

def decode(p):
    raw = p.read_bytes()
    try:
        return raw.decode('utf-8-sig'), 'utf-8-sig'
    except UnicodeDecodeError:
        try:
            return raw.decode('gb18030'), 'gb18030'
        except UnicodeDecodeError:
            return raw.decode('gb18030', errors='replace'), 'gb18030-with-replacement'

class Extract(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]
    def handle_data(self,data):
        self.parts.append(data)
    def handle_endtag(self,tag):
        if tag in ['p','h1','h2','h3','div','li','title']:
            self.parts.append('\n')

rows=[]
for p in ROOT.glob('落第骑士*gbk.txt'):
    s, enc=decode(p)
    rows.append(f'FILE {p.name} ENCODING {enc}')
    for n,l in enumerate(s.split('\n'),1):
        if any(t in l for t in TERMS):
            rows.append(f'{n}: {l.strip()}')
(OUT/'txt-hits.txt').write_text('\n'.join(rows), encoding='utf-8')

rows=[]
for vol in ['10','11','12','13']:
    p=ROOT/'39688'/f'[台版]落第骑士英雄谭 {vol}.epub'
    with zipfile.ZipFile(p) as z:
        for name in z.namelist():
            if not name.endswith('.xhtml'):
                continue
            parser=Extract()
            parser.feed(z.read(name).decode('utf-8-sig'))
            text='\n'.join(l.strip() for l in ''.join(parser.parts).splitlines() if l.strip())
            (OUT/f'{vol}-{Path(name).name}.txt').write_text(text,encoding='utf-8')
            hits=[(n,l) for n,l in enumerate(text.splitlines(),1) if any(t in l for t in TERMS)]
            if hits:
                rows.append(f'FILE {p.name} ENTRY {name}\n'+'\n'.join(text.splitlines()[:3]))
                rows.extend(f'{n}: {l}' for n,l in hits)
(OUT/'epub-hits.txt').write_text('\n'.join(rows), encoding='utf-8')
print('Saved TXT hits and EPUB text for volumes 10-13.')
