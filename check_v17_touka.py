with open(r'e:\web\落第\第十七卷-世界书整理\01_卷内时间线.md', 'r', encoding='utf-8') as f:
    text = f.read()

for line in text.splitlines():
    if '魔人' in line or '刀华' in line:
        print(line[:100])
