import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    d = json.load(f)

entries = list(d['entries'].values()) if isinstance(d['entries'], dict) else d['entries']

for e in entries:
    if '绚濑' in e.get('comment', ''):
        with open('scratch/ayase_entry.txt', 'w', encoding='utf-8') as out:
            out.write(e.get('content'))
        print("Written scratch/ayase_entry.txt")
        break
