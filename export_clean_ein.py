import json

with open('落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

entries = d.get('entries', {})
with open('clean_ein_iris_utf8.txt', 'w', encoding='utf-8') as out:
    for k, e in entries.items():
        if e.get('uid') in [200, 203]:
            out.write(f"=== UID: {e.get('uid')} | Comment: {e.get('comment')} ===\n")
            out.write(e.get('content') + "\n")
            out.write("\n" + "="*60 + "\n\n")

print("Done writing clean_ein_iris_utf8.txt")
