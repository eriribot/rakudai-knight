with open(r'e:\web\落第\第十七卷-世界书整理\第十七卷_第五章_命运锁链.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('ch5_clean.txt', 'w', encoding='utf-8') as out:
    for idx, l in enumerate(lines):
        if any(k in l for k in ['锁链', '门', '极限', '枷锁', '童子', '刀华']):
            out.write(f"{idx+1}: {l}")
