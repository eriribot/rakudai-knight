import os

def search_iris():
    p = '第十四卷-世界书整理/设定条目/艾莉丝倒戈与法国秘密案件浴血十字架.md'
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8', errors='ignore') as f:
            print("=== File: 艾莉丝倒戈与法国秘密案件浴血十字架.md ===")
            print(f.read()[:2000])

    # Search in Volume 14 txt files for Iris awakening
    v14_dir = '第十四卷-世界书整理'
    for fn in os.listdir(v14_dir):
        if fn.endswith('.txt'):
            fp = os.path.join(v14_dir, fn)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if '魔人' in content and '艾莉丝' in content:
                    idx = content.find('魔人')
                    while idx != -1:
                        snip = content[max(0, idx-100):min(len(content), idx+200)].replace('\n', ' ')
                        if any(k in snip for k in ['觉醒', '惨案', '十字架', '孤儿', '过去']):
                            print(f"\n[{fn}]: {snip}\n")
                            break
                        idx = content.find('魔人', idx+1)

search_iris()
