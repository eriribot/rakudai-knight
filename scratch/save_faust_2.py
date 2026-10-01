# -*- coding: utf-8 -*-
with open('落第骑士英雄谭 第十五卷 gbk.txt', 'r', encoding='gb18030', errors='ignore') as f:
    text = f.read()

pos = text.find('这、这叫我、怎……怎么选……呜呃、我选不出来啦')
if pos != -1:
    with open('scratch/orles_faust_2.txt', 'w', encoding='utf-8') as out:
        out.write(text[pos:pos+2500])
print("Saved cleanly to scratch/orles_faust_2.txt")
