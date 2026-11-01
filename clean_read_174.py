import json

with open(r'e:\web\落第\落第骑士英雄谭v0.22.json', 'r', encoding='utf-8', errors='replace') as f:
    data = json.load(f)

c = data['entries']['174']['content']
for idx, line in enumerate(c.splitlines(), 1):
    # filter out non-ascii and non-cjk printable
    clean_line = "".join([ch if ord(ch) >= 32 or ch in '\t' else f'\\x{ord(ch):02x}' for ch in line])
    print(f"{idx}: {clean_line}")
