import zipfile, re

with zipfile.ZipFile('e:/web/落第/39688/[台版]落第骑士英雄谭 02.epub') as z:
    for n in sorted(z.namelist()):
        if n.endswith('.xhtml') and 'Chapter' in n:
            txt = z.read(n).decode('utf-8')
            paras = re.findall(r'<p[^>]*>(.*?)</p>', txt, re.DOTALL)
            for i, p in enumerate(paras):
                if 'Images/' in p:
                    img = re.search(r'Images/[^"\'\s]+', p).group(0)
                    prev_p = paras[max(0, i-2):i]
                    next_p = paras[i+1:min(len(paras), i+3)]
                    clean = lambda s: re.sub(r'<[^>]+>', '', s).strip()
                    print(f"=== {img} in {n} ===")
                    print("BEFORE:", " | ".join(clean(x) for x in prev_p))
                    print("AFTER:", " | ".join(clean(x) for x in next_p))
                    print()
