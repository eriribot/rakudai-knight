import json

with open(r'e:\web\落第\落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for uid in ['190', '191', '192', '193', '194']:
    e = d['entries'].get(uid, {})
    print(f"UID {uid}: comment={e.get('comment')}, key={e.get('key')}, len={len(e.get('content', ''))}")
    first_lines = e.get('content', '').splitlines()[:5]
    print("  First lines:", first_lines)
