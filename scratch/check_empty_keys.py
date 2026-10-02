import json

def load_lb(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

d1 = load_lb('落第骑士英雄谭 (1).json')
d2 = load_lb('落第骑士英雄谭 魔剑物语.json')

entries1 = list(d1['entries'].values()) if isinstance(d1['entries'], dict) else d1['entries']
entries2 = list(d2['entries'].values()) if isinstance(d2['entries'], dict) else d2['entries']

with open("scratch/empty_keys_check.txt", "w", encoding="utf-8") as out:
    out.write("=== File 1 entries with NO keys and NOT constant ===\n")
    for idx, e in enumerate(entries1):
        if not e.get('key') and not e.get('constant'):
            out.write(f"[{idx}] {e.get('comment')} (len: {len(e.get('content',''))})\n")
            
    out.write("\n=== File 2 entries with NO keys and NOT constant ===\n")
    for idx, e in enumerate(entries2):
        if not e.get('key') and not e.get('constant'):
            out.write(f"[{idx}] {e.get('comment')} (len: {len(e.get('content',''))})\n")

    out.write("\n=== File 2 trigger keys for plot chapters ===\n")
    for idx, e in enumerate(entries2[:22]):
        out.write(f"[{idx}] {e.get('comment')}: key={e.get('key')}\n")

print("Finished checking empty keys")
