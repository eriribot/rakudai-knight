with open(r'e:\web\落第\第十八卷-世界书整理\第十八卷_第一章_〈烈风剑帝〉VS〈超人(Thehero)〉.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('end_ch1_utf8.txt', 'w', encoding='utf-8') as out:
    for i in range(1800, len(lines)):
        out.write(f"{i+1}: {lines[i]}")
