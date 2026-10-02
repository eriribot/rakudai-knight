import json

with open('落第骑士英雄谭 魔剑物语.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
entries = list(d['entries'].values()) if isinstance(d['entries'], dict) else d['entries']

for e in entries:
    if '文風' in e.get('comment', '') or '文风' in e.get('comment', ''):
        with open('scratch/mojian_wenfeng.txt', 'w', encoding='utf-8') as out:
            out.write(e.get('content'))

print("Exported scratch/mojian_wenfeng.txt")
