import os
import re

txt_files = []
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.txt'):
            txt_files.append(os.path.join(root, f))

print(f"Total txt files: {len(txt_files)}")

# Search for Kirihara fight
print("\n=== Kirihara Fight ===")
for path in txt_files:
    if '桐原' in path or '落第骑士' in path or '第一卷' in path:
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if '猎人森林' in content or '桐原' in content:
                    for m in re.finditer(r'桐原|挥刀|黑暗|猎人森林|一刀修罗', content):
                        idx = m.start()
                        snippet = content[max(0, idx-100):min(len(content), idx+200)].replace('\n', ' ')
                        if '十年' in snippet or '黑暗' in snippet or '放弃' in snippet:
                            print(f"[{os.path.basename(path)}]: {snippet}\n")
                            break
        except:
            pass

# Search for Ryoma Kurogane quotes
print("\n=== Kurogane Ryoma Quotes ===")
for path in txt_files:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            if '黑铁龙马' in content or '龙马' in content:
                for m in re.finditer(r'龙马|翅膀|月球|绝望', content):
                    idx = m.start()
                    snippet = content[max(0, idx-80):min(len(content), idx+160)].replace('\n', ' ')
                    if '翅膀' in snippet or '月球' in snippet or '绝望' in snippet or '器量' in snippet:
                        print(f"[{os.path.basename(path)}]: {snippet}\n")
                        break
    except:
        pass
