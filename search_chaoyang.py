import json

with open(r'e:\web\落第\落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for uid, e in d['entries'].items():
    content = e.get('content', '')
    comment = e.get('comment', '')
    if '朝阳' in content or '朝阳' in comment:
        print(f"UID {uid}: comment={comment}")
        for l in content.splitlines():
            if '朝阳' in l:
                print("  ", l[:100])
