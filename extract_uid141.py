import json

with open('落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for k, e in d.get('entries', {}).items():
    if e.get('uid') == 141:
        with open('uid_141_clean.txt', 'w', encoding='utf-8') as out:
            out.write(e.get('content'))

print("Wrote uid_141_clean.txt")
