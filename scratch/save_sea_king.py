# -*- coding: utf-8 -*-
with open('落第骑士英雄谭 第十四卷 gbk.txt', 'r', encoding='gb18030', errors='ignore') as f:
    text = f.read()

pos = text.find('Giavellotto di Nettuno')
if pos != -1:
    with open('scratch/sea_king.txt', 'w', encoding='utf-8') as out:
        out.write(text[pos-1200:pos+800])
print("Saved clean text of Sea King vs Nassim.")
