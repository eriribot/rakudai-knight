with open(r'e:\web\落第\第十七卷-世界书整理\01_卷内时间线.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'T03' in l or (i > 70 and i < 85):
        print(f"{i}: {l.strip()}")
