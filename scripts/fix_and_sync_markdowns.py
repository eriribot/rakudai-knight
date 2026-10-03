import os
import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['entries']

targets = {
    '62': ('第一卷-世界书整理/人物条目/东堂刀华.md', 'Tohkwa Todo'),
    '49': ('第一卷-世界书整理/人物条目/黑铁珠雫.md', 'Kurogane Shizuku'),
    '53': ('第一卷-世界书整理/人物条目/绫辻绚濑.md', 'Ayatsuji Ayase')
}

for eid, (filepath, tag) in targets.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split before the ```xml
    idx = content.find('```xml')
    if idx != -1:
        prefix = content[:idx]
        new_content = prefix + f"```xml\n{entries[eid]['content']}\n```\n"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Properly synced and closed code fence in {filepath}")
    else:
        print(f"Could not find ```xml in {filepath}")

print("Markdown formatting and synchronization completed.")
