# -*- coding: utf-8 -*-
import os, re

vols = [
    '落第骑士英雄谭 第十卷 gbk.txt',
    '落第骑士英雄谭 第十一卷 gbk.txt',
    '落第骑士英雄谭 第十二卷 gbk.txt',
    '落第骑士英雄谭 第十三卷 gbk.txt',
    '落第骑士英雄谭 第十四卷 gbk.txt',
    '落第骑士英雄谭 第十五卷 gbk.txt',
]

output_lines = []

for v in vols:
    if not os.path.exists(v):
        continue
    with open(v, 'r', encoding='gb18030', errors='ignore') as f:
        text = f.read()

    # Search for mentions of Iris / Black Knight / Or-Gaule appearance, personality, age
    patterns = [
        r'(?:阿斯卡里德|艾莉丝)[^\n]{0,80}(?:岁|年纪|年龄|容貌|长相|真容|素颜|卸下|头盔|脱下|铠甲|身材|高大|娇小|胸|性格|表情|冷漠|温柔|无言|沉默|异色)',
        r'(?:欧尔·格尔|欧尔雷斯)[^\n]{0,80}(?:岁|年纪|年龄|少年|外表|身形|孩童|儿童|十岁)',
        r'雷薇[^\n]{0,100}(?:艾莉丝|阿斯卡里德)',
        r'那一处在视觉上，不过是一片空白',
        r'血染十字架|浴血十字架',
    ]

    for p in patterns:
        for m in re.finditer(p, text):
            start = max(0, m.start() - 200)
            end = min(len(text), m.end() + 400)
            snippet = text[start:end]
            output_lines.append(f"=== {v} match: {m.group(0)[:50]} ===")
            output_lines.append(snippet.strip())
            output_lines.append("\n" + "-"*60 + "\n")

with open(r'e:\web\落第\scratch\iris_research.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(output_lines))

print(f"Done! Written {len(output_lines)} lines to scratch/iris_research.txt")
