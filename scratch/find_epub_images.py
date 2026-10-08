import zipfile, re

with zipfile.ZipFile('e:/web/落第/39688/[台版]落第骑士英雄谭 02.epub') as z:
    for n in sorted(z.namelist()):
        if n.endswith('.xhtml'):
            txt = z.read(n).decode('utf-8')
            imgs = re.findall(r'Images/[^"\'\s]+', txt)
            if imgs:
                print(f"{n}: {imgs}")
