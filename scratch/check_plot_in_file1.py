import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    d1 = json.load(f)

entries1 = list(d1['entries'].values()) if isinstance(d1['entries'], dict) else d1['entries']

# Search for any mention of "剧情" or entry activation or automation in File 1
print("=== File 1 entries with 'automationId' or 'outletName' or 'triggers' ===")
for idx, e in enumerate(entries1):
    if e.get('automationId') or e.get('outletName') or e.get('triggers'):
        print(f"[{idx}] {e.get('comment')}: automationId={e.get('automationId')}, outletName={e.get('outletName')}, triggers={e.get('triggers')}")

# Check content of [剧情] entries in File 1 - what is inside them?
print("\n=== File 1 Sample [剧情] entries content ===")
for idx in [13, 15, 24, 118]:
    e = entries1[idx]
    print(f"--- [{idx}] {e.get('comment')} ---")
    print("Content preview (first 300 chars):")
    print(e.get('content')[:300])
