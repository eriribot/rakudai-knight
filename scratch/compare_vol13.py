# -*- coding: utf-8 -*-
import zipfile, re, os, sys

sys.stdout.reconfigure(encoding='utf-8')

epub_path = r'E:\web\落第\39688\[台版]落第骑士英雄谭 13.epub'
txt_path = r'E:\web\落第\落第骑士英雄谭 第十三卷 gbk.txt'

with open(txt_path, 'r', encoding='gb18030') as f:
    gbk_text = f.read()

# Split GBK text into chapters
gbk_markers = [
    ('间章 凶信', '第十三卷 间章 凶信'),
    ('第十五章 月下乱斗', '第十三卷 第十五章 月下乱斗'),
    ('第十六章 王都开战', '第十三卷 第十六章 王都开战'),
    ('第十七章 不转杀手', '第十三卷 第十七章 不转杀手'),
    ('第十八章 狂飙突进', '第十三卷 第十八章 狂飙突进'),
    ('间章 迟来的魔女', '第十三卷 间章 迟来的魔女'),
    ('后记', '后记'),
    ('插图', '插图')
]

gbk_parts = {}
indices = []
for title, marker in gbk_markers:
    pos = gbk_text.find(marker)
    indices.append((pos, title, marker))

indices.sort()
for i in range(len(indices)):
    pos, title, marker = indices[i]
    if i + 1 < len(indices):
        next_pos = indices[i+1][0]
        content = gbk_text[pos:next_pos]
    else:
        content = gbk_text[pos:]
    gbk_parts[title] = content

epub_chapters = [
    ('间章 凶信', 'OEBPS/Text/Chapter001.xhtml'),
    ('第十五章 月下乱斗', 'OEBPS/Text/Chapter002.xhtml'),
    ('第十六章 王都开战', 'OEBPS/Text/Chapter003.xhtml'),
    ('第十七章 不转杀手', 'OEBPS/Text/Chapter004.xhtml'),
    ('第十八章 狂飙突进', 'OEBPS/Text/Chapter005.xhtml'),
    ('间章 迟来的魔女', 'OEBPS/Text/Chapter006.xhtml'),
    ('后记', 'OEBPS/Text/postscript.xhtml')
]

print("=== DETAILED COMPARISON BETWEEN EPUB AND GBK ===")

def clean_txt(t):
    # remove wenku header if present
    t = re.sub(r'★☆★☆★☆轻小说文库.*?修图：kid\s*', '', t, flags=re.DOTALL)
    # remove spaces and newlines
    return re.sub(r'\s+', '', t)

def clean_epub_html(raw):
    # handle ruby: <ruby>A<rt>B</rt></ruby> -> A（B）
    s = re.sub(r'<ruby>(.*?)<rt>(.*?)</rt></ruby>', r'\1（\2）', raw, flags=re.DOTALL)
    # remove all tags
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', '', s)

total_gbk_len = 0
total_epub_len = 0

with zipfile.ZipFile(epub_path, 'r') as z:
    for title, ch_file in epub_chapters:
        raw_epub = z.read(ch_file).decode('utf-8')
        epub_c = clean_epub_html(raw_epub)
        gbk_raw = gbk_parts.get(title, '')
        gbk_c = clean_txt(gbk_raw)
        
        total_gbk_len += len(gbk_c)
        total_epub_len += len(epub_c)
        
        diff_len = len(gbk_c) - len(epub_c)
        print(f"[{title}]")
        print(f"  GBK text clean length : {len(gbk_c):>6}")
        print(f"  EPUB text clean length: {len(epub_c):>6}")
        print(f"  Length Difference     : {diff_len:>6}")

print(f"\nTOTAL GBK clean length : {total_gbk_len}")
print(f"TOTAL EPUB clean length: {total_epub_len}")
print(f"TOTAL Difference       : {total_gbk_len - total_epub_len}")
