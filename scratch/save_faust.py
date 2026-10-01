# -*- coding: utf-8 -*-
with open('落第骑士英雄谭 第十五卷 gbk.txt', 'r', encoding='gb18030', errors='ignore') as f:
    text = f.read()

pos = text.find('男人一把将欧尔雷斯压上桥墩')
if pos != -1:
    with open('scratch/orles_faust.txt', 'w', encoding='utf-8') as out:
        out.write(text[pos-300:pos+1500])
print("Saved cleanly to scratch/orles_faust.txt")
