import hashlib
import html
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
index = json.loads((OUT.parent / 'index.json').read_text(encoding='utf-8-sig'))
reports = []
for book in index['books']:
    if book['id'] not in ('cn-18', 'cn-19'):
        continue
    folder = OUT / book['id']
    folder.mkdir(parents=True, exist_ok=True)
    report = {'id': book['id'], 'volume': book['volume'], 'epub': book['epub'], 'images': [], 'nameOccurrences': []}
    with zipfile.ZipFile(ROOT / book['epub']) as z:
        for member in z.namelist():
            if not member.lower().endswith(('.xhtml', '.html', '.htm')):
                continue
            lines = z.read(member).decode('utf-8-sig').splitlines()
            for number, line in enumerate(lines, 1):
                text = html.unescape(re.sub('<[^>]+>', '', line)).strip()
                if re.search(r'福小莉|小莉|饕餮', text):
                    report['nameOccurrences'].append({'xhtml': member, 'line': number, 'text': text})
        for indexed in book['images']:
            data = z.read(indexed['member'])
            path = folder / Path(indexed['member']).name
            path.write_bytes(data)
            row = dict(indexed)
            row['extractedFile'] = str(path.relative_to(ROOT)).replace('\\', '/')
            row['imageTagContexts'] = []
            for ref in indexed.get('references', []):
                lines = z.read(ref['xhtml']).decode('utf-8-sig').splitlines()
                for num, line in enumerate(lines, 1):
                    if Path(indexed['member']).name in line:
                        nearby = []
                        for near_num in range(max(1, num - 12), min(len(lines), num + 18) + 1):
                            tx = html.unescape(re.sub('<[^>]+>', '', lines[near_num - 1])).strip()
                            if tx:
                                nearby.append({'line': near_num, 'text': tx})
                        row['imageTagContexts'].append({'xhtml': ref['xhtml'], 'imageTagLine': num, 'context': nearby})
            report['images'].append(row)
    columns, cellw, cellh = 3, 300, 390
    rows = (len(report['images']) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * cellw, rows * cellh), '#eae7e0')
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(report['images']):
        tile = Image.open(ROOT / row['extractedFile']).convert('RGB')
        tile.thumbnail((cellw - 12, cellh - 34))
        x = (i % columns) * cellw
        y = (i // columns) * cellh
        sheet.paste(tile, (x + (cellw - tile.width) // 2, y + 4))
        draw.text((x + 5, y + cellh - 23), f"{book['id']} | {Path(row['member']).name}", fill='#111111')
    sheet.save(OUT / f"{book['id']}-all-images.jpg", quality=93)
    reports.append(report)
(OUT / '18-19-scan.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
for report in reports:
    print(json.dumps({'id': report['id'], 'images': len(report['images']), 'nameOccurrences': len(report['nameOccurrences'])}, ensure_ascii=False))
    for row in report['images']:
        print(json.dumps({'image': row['member'], 'contexts': row['imageTagContexts']}, ensure_ascii=False))
