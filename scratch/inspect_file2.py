import json

with open('落第骑士英雄谭 魔剑物语.json', 'r', encoding='utf-8') as f:
    d2 = json.load(f)

entries2 = list(d2['entries'].values()) if isinstance(d2['entries'], dict) else d2['entries']

for idx in [0, 80, 81, 84, 85, 96, 97, 98, 99]:
    e = entries2[idx]
    print(f"=== File 2 Entry [{idx}] {e.get('comment')} ===")
    print(f"Keys: {e.get('key')}, Constant: {e.get('constant')}, Pos: {e.get('position')}, Depth: {e.get('depth')}, Disabled: {e.get('disable')}")
    print("Content preview (first 500 chars):")
    print(e.get('content')[:500])
    print("\n" + "="*50 + "\n")
