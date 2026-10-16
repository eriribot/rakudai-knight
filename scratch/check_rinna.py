import os, zipfile, re

for ep_num in ['04', '05', '06', '07', '10']:
    p = os.path.join(r'd:\card\rakudai-knight\39688', f'[台版]落第骑士英雄谭 {ep_num}.epub')
    if not os.path.exists(p):
        continue
    with zipfile.ZipFile(p, 'r') as z:
        for name in z.namelist():
            if name.endswith(('.xhtml', '.html')):
                data = z.read(name).decode('utf-8', errors='ignore')
                if '风祭' in data or '凛奈' in data:
                    imgs = re.findall(r'src="([^"]+)"', data)
                    for img in imgs:
                        print(f'{ep_num} {name}: {img}')
