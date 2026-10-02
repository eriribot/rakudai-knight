import json

def load_lb(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

d1 = load_lb('落第骑士英雄谭 (1).json')
d2 = load_lb('落第骑士英雄谭 魔剑物语.json')

entries1 = list(d1['entries'].values()) if isinstance(d1['entries'], dict) else d1['entries']
entries2 = list(d2['entries'].values()) if isinstance(d2['entries'], dict) else d2['entries']

def find_entry(entries, name):
    for idx, e in enumerate(entries):
        if name in e.get('comment', ''):
            return idx, e
    return None, None

chars = ['黑铁一辉', '史黛菈', '黑铁珠雫', '爱德怀斯']

with open("scratch/compare_chars.txt", "w", encoding="utf-8") as out:
    for c in chars:
        i1, e1 = find_entry(entries1, c)
        i2, e2 = find_entry(entries2, c)
        out.write(f"########################################\n")
        out.write(f"CHARACTER: {c}\n")
        out.write(f"########################################\n\n")
        
        out.write(f"=== File 1: [{i1}] {e1.get('comment')} (Length: {len(e1.get('content',''))}) ===\n")
        out.write(f"Keys: {e1.get('key')}\n")
        out.write(f"Constant: {e1.get('constant')}, Pos: {e1.get('position')}, Depth: {e1.get('depth')}\n")
        out.write(e1.get('content')[:1500] + "\n...\n\n")
        
        out.write(f"=== File 2: [{i2}] {e2.get('comment')} (Length: {len(e2.get('content',''))}) ===\n")
        out.write(f"Keys: {e2.get('key')}\n")
        out.write(f"Constant: {e2.get('constant')}, Pos: {e2.get('position')}, Depth: {e2.get('depth')}\n")
        out.write(e2.get('content')[:1500] + "\n...\n\n")

print("Exported character comparison")
