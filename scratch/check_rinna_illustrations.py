import os, zipfile, re, sys
sys.stdout.reconfigure(encoding='utf-8')


def check_context(epub_name, chapter_name):
    p = os.path.join(r'd:\card\rakudai-knight\39688', epub_name)
    with zipfile.ZipFile(p, 'r') as z:
        content = z.read(chapter_name).decode('utf-8', errors='ignore')
        # find all images and surrounding text
        parts = re.split(r'(<img[^>]+>)', content)
        for idx, part in enumerate(parts):
            if '<img' in part:
                # get text before and after
                before = re.sub(r'<[^>]+>', '', ''.join(parts[max(0, idx-2):idx]))[-200:]
                after = re.sub(r'<[^>]+>', '', ''.join(parts[idx+1:min(len(parts), idx+3)]))[:200]
                if any(k in before or k in after for k in ['风祭', '凛奈', '眼罩', '夏洛特', '狮子', '魔兽使', '彼方']):
                    print(f'=== {epub_name} {part} ===')
                    print('BEFORE:\n', before)
                    print('AFTER:\n', after)
                    print('-'*40)

check_context('[台版]落第骑士英雄谭 04.epub', 'OEBPS/Text/Chapter004.xhtml')
check_context('[台版]落第骑士英雄谭 05.epub', 'OEBPS/Text/Chapter001.xhtml')
check_context('[台版]落第骑士英雄谭 06.epub', 'OEBPS/Text/Chapter001.xhtml')
check_context('[台版]落第骑士英雄谭 06.epub', 'OEBPS/Text/Chapter002.xhtml')
check_context('[台版]落第骑士英雄谭 07.epub', 'OEBPS/Text/Chapter002.xhtml')
check_context('[台版]落第骑士英雄谭 10.epub', 'OEBPS/Text/Chapter001.xhtml')
