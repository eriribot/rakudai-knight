import os

def read_text(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()

# 1. Ouma vs Stella
vol8_ch12 = '第八卷-世界书整理/第八卷_第十二章_双龙相克.txt'
if os.path.exists(vol8_ch12):
    t8 = read_text(vol8_ch12)
    print("=== Vol 8 Ch 12: 双龙相克 (Length: %d) ===" % len(t8))
    # Look for the peak clashes between Ouma and Stella
    import re
    keywords = ['天龙', '狂风', '大阿修罗', '斩', '咆哮', '碎', '龙神', '剑神', '王马']
    matches = [m.start() for m in re.finditer(r'断刃|龙神|大阿修罗|暴风|极东|王马|妃龙|绝技', t8)]
    for idx in matches[10:15]:
        print("--- Match at %d ---" % idx)
        print(t8[max(0, idx-50):min(len(t8), idx+250)].replace('\n', ' '))
        print()

# 2. Desperado awakening in Vol 9 / 15 / 19
vol15_ch22 = '第十五卷-世界书整理/第十五卷_第二十二章_剑神.txt'
if os.path.exists(vol15_ch22):
    t15 = read_text(vol15_ch22)
    print("=== Vol 15 Ch 22: 剑神 (Length: %d) ===" % len(t15))
    matches15 = [m.start() for m in re.finditer(r'剑神|魔人|因果|命运|斩断|觉醒', t15)]
    for idx in matches15[:5]:
        print("--- Match at %d ---" % idx)
        print(t15[max(0, idx-50):min(len(t15), idx+250)].replace('\n', ' '))
        print()
