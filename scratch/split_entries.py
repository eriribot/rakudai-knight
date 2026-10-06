import json
import shutil
import re

# Read XML content directly from markdown files
def extract_xml(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()
    match = re.search(r'```xml\s*(<.*?>.*?</.*?>)\s*```', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    raise ValueError(f"Could not find xml in {md_path}")

yuri_xml = extract_xml(r'第四卷-世界书整理\人物条目\尤利_雪国孤儿首领.md')
anastasia_xml = extract_xml(r'第四卷-世界书整理\人物条目\安娜丝塔西亚_雪国孤儿.md')

print("Yuri XML length:", len(yuri_xml))
print("Anastasia XML length:", len(anastasia_xml))

for fname in ['落第骑士英雄谭 (1).json', '落第骑士英雄谭v0.02.json']:
    bak_name = fname + '.bak_20261005_split_yuri_anastasia'
    shutil.copy(fname, bak_name)
    print(f"Created backup: {bak_name}")
    
    with open(fname, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    entries = data['entries']
    
    # 1. Update Yuri in entry '214'
    if '214' in entries:
        entries['214']['comment'] = '尤利'
        entries['214']['key'] = ['尤利', 'Yuri', 'ユーリ', '雪国孤儿首领']
        entries['214']['content'] = yuri_xml
    else:
        print(f"Warning: '214' not found in {fname}")
        
    # Check if Anastasia already exists
    anastasia_id = None
    for k, v in entries.items():
        if v.get('comment') == '安娜丝塔西亚':
            anastasia_id = k
            break
            
    if anastasia_id is not None:
        entries[anastasia_id]['content'] = anastasia_xml
        entries[anastasia_id]['key'] = ['安娜丝塔西亚', 'Anastasia', '娜塔莎', 'Natasha', '雪国孤儿少女']
        print(f"Updated existing Anastasia entry {anastasia_id} in {fname}")
    else:
        new_uid = max([v.get('uid', 0) for v in entries.values()]) + 1
        new_id = str(max([int(k) for k in entries.keys() if k.isdigit()]) + 1)
        new_display = max([v.get('displayIndex', 0) for v in entries.values()]) + 1
        
        anastasia_entry = dict(entries['214'])
        anastasia_entry['uid'] = new_uid
        anastasia_entry['displayIndex'] = new_display
        anastasia_entry['comment'] = '安娜丝塔西亚'
        anastasia_entry['key'] = ['安娜丝塔西亚', 'Anastasia', '娜塔莎', 'Natasha', '雪国孤儿少女']
        anastasia_entry['content'] = anastasia_xml
        anastasia_entry['order'] = 281
        
        entries[new_id] = anastasia_entry
        print(f"Added Anastasia entry {new_id} (uid: {new_uid}) in {fname}")
        
    with open(fname, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {fname} successfully.")
