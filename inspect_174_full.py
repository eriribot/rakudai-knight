import json

with open(r'e:\web\落第\落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Comment:", data['entries']['174'].get('comment'))
print("Content:\n", data['entries']['174'].get('content'))
