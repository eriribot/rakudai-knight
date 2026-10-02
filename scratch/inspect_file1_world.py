import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    d1 = json.load(f)

e1 = list(d1['entries'].values()) if isinstance(d1['entries'], dict) else d1['entries']

# Check File 1 world entries 0, 1, 4, 5, 6
for idx in [0, 1, 4, 5, 6]:
    e = e1[idx]
    print(f"=== File 1 Entry [{idx}] {e.get('comment')} ===")
    print(f"Constant: {e.get('constant')}, Keys: {e.get('key')}")
    print(e.get('content'))
    print("\n" + "="*50 + "\n")
