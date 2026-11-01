import json

with open(r'e:\web\落第\落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for uid in ['172', '173', '174', '175', '176', '177', '178']:
    if uid in data['entries']:
        e = data['entries'][uid]
        print(f"UID {uid}: comment={e.get('comment')}")
        print(f"Content lines 1-10:\n" + "\n".join(e.get('content', '').splitlines()[:10]))
        print("-" * 40)
