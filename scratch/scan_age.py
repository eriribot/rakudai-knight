# -*- coding: utf-8 -*-
import glob, re

with open('scratch/age_snippets.txt', 'w', encoding='utf-8') as out:
    for fn in sorted(glob.glob('落第骑士英雄谭 第*.txt')):
        with open(fn, 'r', encoding='gb18030', errors='ignore') as f:
            text = f.read()
        for m in re.finditer(r'(?:欧尔·格尔|欧尔雷斯|阿斯卡里德|艾莉丝)[^\n]{0,80}(?:少年|少女|二十|十|看起来|外表|年纪|岁|身材|高挑|娇小)', text):
            snip = text[max(0, m.start()-50):min(len(text), m.end()+100)]
            out.write(f'{fn}:\n{snip.strip()}\n' + '='*40 + '\n')

print("Finished scanning age snippets.")
