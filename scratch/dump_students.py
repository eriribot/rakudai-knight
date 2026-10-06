import json

with open('落第骑士英雄谭v0.02.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['entries']
with open('scratch/check_students.txt', 'w', encoding='utf-8') as out:
    for u in ['60', '61', '62', '63', '64', '65', '66']:
        if u in entries:
            e = entries[u]
            out.write(f"=== UID: {u} | {e.get('comment')} ===\n")
            out.write(f"Keys: {e.get('keys')}\n")
            out.write(e.get('content', '') + "\n\n")

print("Done dumping 60-66")
