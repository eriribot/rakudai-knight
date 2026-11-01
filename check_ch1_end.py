with open(r'e:\web\落第\第十八卷-世界书整理\第十八卷_第一章_〈烈风剑帝〉VS〈超人(Thehero)〉.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines in Ch1: {len(lines)}")
for idx, line in enumerate(lines[-60:], len(lines)-59):
    print(f"{idx}: {line.strip()}")
