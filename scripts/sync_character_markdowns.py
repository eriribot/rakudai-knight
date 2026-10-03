import os
import re
import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['entries']

file_map = {
    '11': '第一卷-世界书整理/人物条目/史黛菈·法米利昂.md',
    '62': '第一卷-世界书整理/人物条目/东堂刀华.md',
    '49': '第一卷-世界书整理/人物条目/黑铁珠雫.md',
    '53': '第一卷-世界书整理/人物条目/绫辻绚濑.md',
    '12': '第一卷-世界书整理/人物条目/新宫寺黑乃.md',
    '17': '第一卷-世界书整理/人物条目/西京宁音.md',
}

for eid, filepath in file_map.items():
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, file not found")
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    new_xml = entries[eid]['content']
    
    # Replace the ```xml ... ``` block
    pattern = r'```xml\s*<([^>]+)>[\s\S]*?</\1>\s*```'
    replacement = f"```xml\n{new_xml}\n```"
    
    if re.search(pattern, md_content):
        updated_md = re.sub(pattern, replacement, md_content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated_md)
        print(f"Successfully synced {filepath}")
    else:
        print(f"Pattern not found in {filepath}")

print("Markdown sync completed.")
