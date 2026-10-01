# -*- coding: utf-8 -*-
with open('落第骑士英雄谭 第十三卷 gbk.txt', 'r', encoding='gb18030', errors='ignore') as f:
    text = f.read()

pos = text.find('必然逃不掉这个结局')
if pos != -1:
    with open('scratch/vol13_nassim_fight.txt', 'w', encoding='utf-8') as out:
        out.write(text[pos-2500:pos+2500])
print("Successfully extracted to scratch/vol13_nassim_fight.txt")
