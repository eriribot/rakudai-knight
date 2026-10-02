import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    d1 = json.load(f)

entries1 = list(d1['entries'].values()) if isinstance(d1['entries'], dict) else d1['entries']

for idx in [3, 8, 10, 30]:
    e = entries1[idx]
    print(f"=== File 1 Entry [{idx}] {e.get('comment')} ===")
    print(e.get('content')[:1000])
    print("\n" + "-"*40 + "\n")
