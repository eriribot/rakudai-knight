import os
import re

def extract_scenes():
    # 1. Vol 8 Ch 12: Ouma vs Stella
    p8 = '第八卷-世界书整理/第八卷_第十二章_双龙相克.txt'
    with open(p8, 'r', encoding='utf-8', errors='ignore') as f:
        t8 = f.read()

    # Search for peak clashes
    # Let's find "大阿修罗", "龙神", "断刃", "天龙", "王马"
    climax_ouma = []
    for target in ['大阿修罗', '龙神附身', '天龙断恶', '暴风之龙', '超越常理', '两头怪物']:
        pos = t8.find(target)
        if pos != -1:
            climax_ouma.append((target, t8[max(0, pos-200):min(len(t8), pos+500)]))

    # 2. Desperado awakening
    # Vol 9 final chapter / Vol 15 / Vol 19
    desperado_scenes = []
    
    # Check Vol 10 Ch 1 or Vol 9 Epilogue
    for p in ['第九卷-世界书整理/第九卷_终章（前）_约定之刻.txt', 
              '第十卷-世界书整理/第十卷_第一章_庆典结束之后.txt',
              '第十五卷-世界书整理/第十五卷_第二十二章_剑神.txt',
              '第十九卷-世界书整理/第十九卷_第六章_最爱，也是最强的劲敌.txt']:
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                for target in ['魔人', '因果律', '命运之线', '超越常理', '命运之外', '觉醒']:
                    pos = content.find(target)
                    if pos != -1:
                        desperado_scenes.append((os.path.basename(p), target, content[max(0, pos-150):min(len(content), pos+450)]))
                        break

    with open('scratch/climax_snippets.txt', 'w', encoding='utf-8') as out:
        out.write("=== 【黑铁王马 VS 史黛菈】 双龙相克巅峰对决片段 ===\n\n")
        for target, snip in climax_ouma:
            out.write(f"--- 关键词: {target} ---\n{snip}\n\n")

        out.write("\n=== 【魔人觉醒 / 超越因果】 关键高光片段 ===\n\n")
        for fn, target, snip in desperado_scenes:
            out.write(f"--- 文件: {fn} (关键词: {target}) ---\n{snip}\n\n")

extract_scenes()
print("Extracted to scratch/climax_snippets.txt")
