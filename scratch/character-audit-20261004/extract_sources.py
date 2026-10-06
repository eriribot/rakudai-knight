from pathlib import Path
import json
import re
import zipfile
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('style', 'script'):
            self.skip += 1
        if tag in ('p', 'div', 'br', 'h1', 'h2', 'h3', 'li'):
            self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('style', 'script'):
            self.skip -= 1
        if tag in ('p', 'div', 'h1', 'h2', 'h3', 'li'):
            self.parts.append('\n')
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)
    def lines(self):
        return [s.strip() for s in ''.join(self.parts).splitlines() if s.strip()]

def main():
    manifest = []
    for source in ROOT.glob('落第骑士英雄谭*gbk.txt'):
        data = source.read_bytes()
        try:
            content = data.decode('utf-8-sig')
            encoding = 'utf-8-sig'
        except UnicodeDecodeError:
            content = data.decode('gb18030', errors='replace')
            encoding = 'gb18030'
            if '\ufffd' in content:
                print(f'WARNING: {source.name}: {content.count(chr(0xfffd))} undecodable characters; verify affected excerpts in EPUB')
        target = OUT / 'txt' / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8', newline='')
        manifest.append({'source': str(source.relative_to(ROOT)), 'encoding': encoding,
                         'extracted': str(target.relative_to(ROOT)), 'line_numbering': 'original TXT splitlines, 1-based'})
    for source in (ROOT / '39688').glob('*.epub'):
        folder = OUT / 'epub' / source.stem
        folder.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(source) as archive:
            for name in archive.namelist():
                if not re.search(r'\.(?:xhtml|html|htm)$', name, re.I):
                    continue
                parser = TextParser()
                parser.feed(archive.read(name).decode('utf-8-sig'))
                target = folder / (name.replace('/', '__') + '.txt')
                target.write_text('\n'.join(parser.lines()) + '\n', encoding='utf-8')
                manifest.append({'source': str(source.relative_to(ROOT)), 'member': name,
                                 'extracted': str(target.relative_to(ROOT)),
                                 'line_numbering': 'extracted nonempty text lines, 1-based; not EPUB page numbers'})
    (OUT / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Extracted {len(manifest)} source units into {OUT}')

if __name__ == '__main__':
    main()
