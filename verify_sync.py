import os, json

target = None
for root, dirs, files in os.walk('d:/card/rakudai-knight'):
    for f in files:
        if '04_第二十一章' in f:
            target = os.path.join(root, f)
            break

with open(target, 'r', encoding='utf-8') as f:
    md_text = f.read()

with open('d:/card/rakudai-knight/落第骑士英雄谭v0.22.json', 'r', encoding='utf-8') as f:
    json_data = json.load(f)

json_entry_content = json_data['entries']['168']['content']

print('MD file length:', len(md_text))
print('JSON entry length:', len(json_entry_content))

markers = ['掠地蜈蚣', '道理〈假货〉', '情感〈真货〉', '色胆挺大', '我事前就得知有这个可能性']
for m in markers:
    print(f'Marker "{m}" -> MD: {m in md_text}, JSON: {m in json_entry_content}')
