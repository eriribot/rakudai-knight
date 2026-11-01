import zipfile

with zipfile.ZipFile(r'e:\web\落第\39688\[台版]落第骑士英雄谭 15.epub', 'r') as z:
    for name in ['OEBPS/Text/Chapter005.xhtml', 'OEBPS/Text/contents.xhtml']:
        content = z.read(name).decode('utf-8', errors='ignore')
        with open('out_' + name.split('/')[-1] + '.txt', 'w', encoding='utf-8') as out:
            out.write(content)
print("Saved files successfully")
