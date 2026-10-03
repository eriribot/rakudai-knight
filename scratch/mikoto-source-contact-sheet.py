from pathlib import Path
import json,sys,zipfile,io
from PIL import Image,ImageDraw,ImageOps
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[1]
base=root/'resource/knightavatars/research/epub'
index=json.loads((base/'index.json').read_text(encoding='utf-8'))
rows=[]
for book in index['books']:
    if book['id'] not in ['tw-04','tw-05','tw-06']: continue
    for entry in book['images']:
        if not entry['member'].endswith('.jpg') or entry['colorFraction']>.06: continue
        path=base/'mikoto-candidates'/f"{book['id']}-{Path(entry['member']).name}"
        path.parent.mkdir(exist_ok=True)
        with zipfile.ZipFile(root/book['epub']) as z: path.write_bytes(z.read(entry['member']))
        rows.append((book['id'],entry['member'],path,entry))
cell=(160,220);sheet=Image.new('RGB',(160*8,220*((len(rows)+7)//8)),'#fff');draw=ImageDraw.Draw(sheet)
for n,(book,member,path,entry) in enumerate(rows):
    pic=ImageOps.contain(Image.open(path).convert('RGB'),(160,195))
    x=(n%8)*160;y=(n//8)*220
    sheet.paste(pic,(x+(160-pic.width)//2,y))
    draw.text((x+2,y+197),f'{book} {Path(member).name}',fill='black')
    print(book,member,entry['width'],entry['height'],path.relative_to(root))
sheet.save(base/'mikoto-source-contact-sheet.jpg')
