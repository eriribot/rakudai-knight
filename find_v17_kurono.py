import os, glob

for p in glob.glob(r'e:\web\落第\第十七卷-世界书整理\*.txt'):
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()
    if '新宫寺黑乃' in content and '诸星' in content:
        print(f"Match in {p}")
        for line in content.splitlines():
            if '觉醒' in line or '门' in line or '魔人' in line:
                if len(line.strip()) < 100:
                    print("  ", line.strip())
