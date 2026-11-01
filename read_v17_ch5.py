with open(r'e:\web\落第\第十七卷-世界书整理\第十七卷_第五章_命运锁链.txt', 'r', encoding='utf-8') as f:
    text = f.read()

for line in text.splitlines():
    if any(k in line for k in ['刀华', '锁链', '门', '觉醒', '魔人']):
        if len(line.strip()) < 80:
            print(line.strip())
