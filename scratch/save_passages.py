# -*- coding: utf-8 -*-
with open('落第骑士英雄谭 第十四卷 gbk.txt', 'r', encoding='gb18030', errors='ignore') as f:
    text = f.read()

pos1 = 41660
with open('scratch/found_passage_1.txt', 'w', encoding='utf-8') as out:
    out.write(text[pos1-600:pos1+1000])

pos2 = 82690
with open('scratch/found_passage_2.txt', 'w', encoding='utf-8') as out:
    out.write(text[pos2-600:pos2+1000])

print("Both passages written cleanly!")
