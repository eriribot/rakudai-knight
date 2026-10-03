import os
import re

def search_text(folder, filename, patterns):
    path = os.path.join(folder, filename)
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
    results = []
    for pat in patterns:
        for m in re.finditer(pat, text):
            idx = m.start()
            results.append((pat, text[max(0, idx-100):min(len(text), idx+300)].replace('\n', ' ')))
    return results

# 1. Check Vol 9 Final Chapter (前 & 后)
print("=== Vol 9 Final Chapter ===")
v9_folder = '第九卷-世界书整理'
for fn in os.listdir(v9_folder):
    if '终章' in fn or '第十四章' in fn:
        res = search_text(v9_folder, fn, [r'觉醒', r'魔人', r'超越极限', r'命运', r'最后的一击', r'极限'])
        print(f"File: {fn}, matches: {len(res)}")
        for pat, snip in res[:3]:
            print(f"  [{pat}]: {snip[:150]}...")

# 2. Check Vol 10 Chapter 1
print("\n=== Vol 10 Chapter 1 ===")
v10_folder = '第十卷-世界书整理'
for fn in os.listdir(v10_folder):
    if '第一章' in fn:
        res = search_text(v10_folder, fn, [r'魔人', r'命运之轮', r'超越极限', r'觉醒'])
        print(f"File: {fn}, matches: {len(res)}")
        for pat, snip in res[:3]:
            print(f"  [{pat}]: {snip[:150]}...")
