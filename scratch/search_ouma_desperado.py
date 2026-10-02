import os
import re

# Search Vol 8 for Ouma vs Stella fight
vol8_path = '第八卷-世界书整理'
vol8_files = [os.path.join(vol8_path, f) for f in os.listdir(vol8_path) if f.endswith('.txt')]

print("=== Searching Vol 8 for Ouma vs Stella ===")
for vf in vol8_files:
    with open(vf, 'r', encoding='utf-8', errors='ignore') as fp:
        txt = fp.read()
        if '王马' in txt and ('史黛菈' in txt or '妃龙' in txt):
            print(f"File: {os.path.basename(vf)}")
            for m in re.finditer(r'王马|大阿修罗|天龙|断刀|猛毒|龙|极东|暴风', txt):
                pos = m.start()
                snip = txt[max(0, pos-100):min(len(txt), pos+200)].replace('\n', ' ')
                if any(k in snip for k in ['龙', '剑神', '狂风', '烈焰', '巨剑', '觉醒', '斩']):
                    print(f"  Snippet: {snip[:200]}...\n")
                    if len(snip) > 0:
                        break

# Search for Desperado / 魔人 awakening scenes across all texts
print("\n=== Searching for 魔人觉醒 scenes ===")
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.txt') and ('卷' in root or '卷' in f):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    if '魔人' in content and ('觉醒' in content or '命运' in content or '超越' in content):
                        for m in re.finditer(r'魔人|超越常理|踏入|命运之线|因果', content):
                            pos = m.start()
                            snip = content[max(0, pos-80):min(len(content), pos+180)].replace('\n', ' ')
                            if '魔人' in snip and any(k in snip for k in ['觉醒', '境界', '因果', '踏入', '命运']):
                                print(f"[{f}]: {snip[:200]}...\n")
                                break
            except:
                pass
