import json

with open('落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print("Top keys:", list(d.keys()))
if 'data' in d:
    print("data keys:", list(d['data'].keys()))
