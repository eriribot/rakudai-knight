with open(r'e:\web\落第\第十七卷-世界书整理\第十七卷_第三章_离散.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx in range(0, min(150, len(lines))):
    if any(k in lines[idx] for k in ['魔人', '门', '门扉', '黑乃', '诸星', '刀华']):
        print(f"{idx+1}: {lines[idx].strip()}")
