import os, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('第七卷-世界书整理/第七卷_第十章_七星剑舞祭第三轮战·开战.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if any(k in l for k in ['莎拉', '布拉德莉莉', '染血达文西']):
        # If line has dialogue or key combat action
        if any(q in l for q in ['「', '『']):
            print(f"L{i+1}: {l.strip()}")
