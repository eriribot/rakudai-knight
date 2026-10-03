import html
import json
import re
import sys
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parent.parent
out = root / 'resource/knightavatars/research/epub/xiaoli-entry-profile-search.json'
books = []
fields = re.compile(r'身高|公分|厘米|cm|年龄|年齡|岁|歲|六维|六維|魔力[量控]|攻击力|攻擊力|防御力|防禦力|伐刀者[等阶級]|[ABCDEFＳS]级|[ABCDEFＳS]級|髮|頭髮|头发|瞳|眼睛|发色|膚色|肤色|年纪|年紀|比.+小|女孩子|女孩|四仙|仙人|范.+莉')
for epub in sorted((root / '39688').glob('*.epub')):
    occurrences = []
    with zipfile.ZipFile(epub) as z:
        for member in z.namelist():
            if not member.lower().endswith(('.xhtml', '.html', '.htm')):
                continue
            lines = z.read(member).decode('utf-8-sig', errors='replace').splitlines()
            nonempty = [(i + 1, html.unescape(re.sub('<[^>]*>', '', line)).strip()) for i, line in enumerate(lines)]
            nonempty = [(i, text) for i, text in nonempty if text]
            for pos, (number, text) in enumerate(nonempty):
                if re.search(r'福小莉|小莉|饕餮', text):
                    nearby = nonempty[max(0, pos - 5):pos + 6]
                    matches = [{'line': n, 'text': t} for n, t in nearby if fields.search(t)]
                    occurrences.append({'xhtml': member, 'line': number, 'text': text, 'profileContext': matches})
    if occurrences:
        books.append({'epub': str(epub.relative_to(root)).replace('\\', '/'), 'occurrences': occurrences})
out.write_text(json.dumps(books, ensure_ascii=False, indent=2), encoding='utf-8')
for book in books:
    print(book['epub'], 'occurrences=', len(book['occurrences']))
    seen = set()
    for occurrence in book['occurrences']:
        for context in occurrence['profileContext']:
            key = (occurrence['xhtml'], context['line'])
            if key not in seen:
                seen.add(key)
                print(json.dumps({'xhtml': key[0], **context}, ensure_ascii=False))
