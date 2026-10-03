import os

def dump_passages():
    with open('scratch/awakening_raw.txt', 'w', encoding='utf-8') as out:
        # 1. Vol 9 Final Chapter (前)
        p9 = '第九卷-世界书整理/第九卷_终章（前）_约定之刻.txt'
        if os.path.exists(p9):
            with open(p9, 'r', encoding='utf-8', errors='ignore') as f:
                t9 = f.read()
            out.write("=== 【第九卷 终章（前）约定之刻】 原文片段 ===\n")
            for kw in ['魔人', '追过超越自我极限', '最后的一击', '一刀罗刹', '燃天焚地龙王炎']:
                pos = t9.find(kw)
                if pos != -1:
                    out.write(f"--- 关键词: {kw} ---\n")
                    out.write(t9[max(0, pos-100):min(len(t9), pos+400)].replace('\n', '\n') + "\n\n")

        # 2. Vol 10 Ch 1
        p10 = '第十卷-世界书整理/第十卷_第一章_庆典结束之后.txt'
        if os.path.exists(p10):
            with open(p10, 'r', encoding='utf-8', errors='ignore') as f:
                t10 = f.read()
            out.write("=== 【第十卷 第一章 庆典结束之后】 原文片段 ===\n")
            for kw in ['斩断命运之链', '魔人【Desperado】', '提升自己的魔力上限', '命运之轮']:
                pos = t10.find(kw)
                if pos != -1:
                    out.write(f"--- 关键词: {kw} ---\n")
                    out.write(t10[max(0, pos-100):min(len(t10), pos+400)].replace('\n', '\n') + "\n\n")

        # 3. Vol 14 Ch 21
        p14 = '第十四卷-世界书整理/第十四卷_第二十一章_天理难容的心愿.txt'
        if os.path.exists(p14):
            with open(p14, 'r', encoding='utf-8', errors='ignore') as f:
                t14 = f.read()
            out.write("=== 【第十四卷 第二十一章 天理难容的心愿】 原文片段 ===\n")
            for kw in ['魔人', '觉醒', '保护弟弟', '浴血十字架', '欧尔·格尔']:
                pos = t14.find(kw)
                if pos != -1:
                    out.write(f"--- 关键词: {kw} ---\n")
                    out.write(t14[max(0, pos-100):min(len(t14), pos+400)].replace('\n', '\n') + "\n\n")

dump_passages()
print("Dumped to scratch/awakening_raw.txt")
