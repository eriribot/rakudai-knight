import os
import glob
import sys

sys.stdout.reconfigure(encoding='utf-8')

vols = [
    '第四卷-世界书整理', '第五卷-世界书整理', '第六卷-世界书整理',
    '第七卷-世界书整理', '第八卷-世界书整理', '第九卷-世界书整理',
    '第十卷-世界书整理', '第十一卷-世界书整理', '第十二卷-世界书整理',
    '第十三卷-世界书整理', '第十四卷-世界书整理', '第十五卷-世界书整理',
    '第十六卷-世界书整理', '第十七卷-世界书整理', '第十八卷-世界书整理',
    '第十九卷-世界书整理'
]

other_keywords = ['布拉德莉莉', '达文西', '达·芬奇', '达芬奇', 'Bloodlily']

for v in vols:
    if not os.path.exists(v):
        continue
    files = sorted(glob.glob(os.path.join(v, '**', '*.txt'), recursive=True))
    for f in files:
        if '第六卷原文_UTF8' in f:
            continue
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            lines = fp.readlines()
        for i, line in enumerate(lines):
            for k in other_keywords:
                if k in line and '莎拉' not in line:
                    print(f"{v} -> {os.path.basename(f)} L{i+1}: {line.strip()[:100]}")
