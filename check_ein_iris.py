import json

with open('落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

entries = d.get('entries', {})
print(f"Type of entries: {type(entries)}, count: {len(entries)}")

# If entries is a dict or list
if isinstance(entries, dict):
    entry_list = entries.values()
else:
    entry_list = entries

found = 0
for e in entry_list:
    comment = e.get('comment', '')
    keys = e.get('key', []) or e.get('keys', [])
    content = e.get('content', '')
    uid = e.get('uid', e.get('id', ''))
    
    # Check for Ein or Iris
    text_to_search = str(comment) + " " + str(keys)
    if any(k in text_to_search for k in ['艾茵', 'Ein', '艾莉丝', 'Iris', '阿斯卡里德', '深渊', 'Abgrund']):
        print(f"=== UID: {uid} | Comment: {comment} | Keys: {keys} ===")
        print(content)
        print("\n" + "="*50 + "\n")
        found += 1

print(f"Found {found} matching entries.")
