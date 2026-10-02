import json

def load_lb(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

d1 = load_lb('落第骑士英雄谭 (1).json')
d2 = load_lb('落第骑士英雄谭 魔剑物语.json')

entries1 = list(d1['entries'].values()) if isinstance(d1['entries'], dict) else d1['entries']
entries2 = list(d2['entries'].values()) if isinstance(d2['entries'], dict) else d2['entries']

def stats(entries, name):
    print(f"=== {name} ===")
    total = len(entries)
    with_keys = [e for e in entries if e.get('key')]
    constants = [e for e in entries if e.get('constant')]
    selective = [e for e in entries if e.get('selective')]
    empty_keys = [e for e in entries if not e.get('key') and not e.get('constant')]
    print(f"Total entries: {total}")
    print(f"With keys: {len(with_keys)}")
    print(f"Constant (always injected): {len(constants)}")
    print(f"Selective: {len(selective)}")
    print(f"Empty keys & NOT constant (NEVER triggerable): {len(empty_keys)}")
    
    print("\n--- Constant Entries ---")
    for e in constants:
        print(f"  [{e.get('comment')}]: len={len(e.get('content',''))}, order={e.get('order')}, pos={e.get('position')}, depth={e.get('depth')}")
        
    print("\n--- Sample Trigger Keys (First 15 with keys) ---")
    for e in with_keys[:15]:
        print(f"  [{e.get('comment')}]: keys={e.get('key')[:4]}, sec={e.get('keysecondary')[:3]}")

stats(entries1, "File 1: 落第骑士英雄谭 (1).json")
print("\n" + "="*50 + "\n")
stats(entries2, "File 2: 落第骑士英雄谭 魔剑物语.json")
