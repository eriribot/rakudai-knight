# -*- coding: utf-8 -*-
with open('落第骑士英雄谭 第十四卷 gbk.txt', 'r', encoding='gb18030', errors='ignore') as f:
    text = f.read()

pos = text.find('氧气送不到脑部')
print("Found at pos:", pos)
if pos != -1:
    with open('scratch/nassim_sea_king_full.txt', 'w', encoding='utf-8') as out:
        out.write(text[pos-2500:pos+2000])
print("Written to scratch/nassim_sea_king_full.txt")
