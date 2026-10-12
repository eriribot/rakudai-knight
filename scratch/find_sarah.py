import os
import glob
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

vols = [
    '第四卷-世界书整理', '第五卷-世界书整理', '第六卷-世界书整理',
    '第七卷-世界书整理', '第八卷-世界书整理', '第九卷-世界书整理',
    '第十卷-世界书整理', '第十一卷-世界书整理', '第十二卷-世界书整理',
    '第十三卷-世界书整理', '第十四卷-世界书整理', '第十五卷-世界书整理',
    '第十六卷-世界书整理', '第十七卷-世界书整理', '第十八卷-世界书整理',
    '第十九卷-世界书整理'
]

keywords = ['莎拉', '布拉德莉莉', '染血达文西', '染血达芬奇']

results = []

for v in vols:
    if not os.path.exists(v):
        continue
    files = sorted(glob.glob(os.path.join(v, '**', '*.txt'), recursive=True))
    for f in files:
        fname = os.path.basename(f)
        if '第六卷原文_UTF8' in fname:
            continue
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            lines = fp.readlines()
        matched_indices = [i for i, line in enumerate(lines) if any(k in line for k in keywords)]
        if matched_indices:
            results.append({
                'volume': v,
                'file': fname,
                'path': f,
                'total_lines': len(lines),
                'match_count': len(matched_indices),
                'matched_indices': matched_indices
            })

print(f"Total matching files: {len(results)}")
for r in results:
    print(f"{r['volume']} -> {r['file']} (matches: {r['match_count']})")
