import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    d = json.load(f)

entries = list(d['entries'].values()) if isinstance(d['entries'], dict) else d['entries']
for idx, e in enumerate(entries):
    if '文风' in e.get('comment', ''):
        print(f"Entry index: {idx}, comment: {e.get('comment')}")
        print("Constant:", e.get('constant'))
        print("Order:", e.get('order'))
        print("Position:", e.get('position'))
        print("Depth:", e.get('depth'))
        print("Keys:", e.get('key'))
        break
