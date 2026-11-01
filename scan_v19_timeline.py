import re

chapters = [
    (r'e:\web\落第\第十九卷-世界书整理\第十九卷_间章_遭囚的皇女.txt', '间章'),
    (r'e:\web\落第\第十九卷-世界书整理\第十九卷_第四章_划破黑暗.txt', '第四章'),
    (r'e:\web\落第\第十九卷-世界书整理\第十九卷_第五章_大教授.txt', '第五章'),
    (r'e:\web\落第\第十九卷-世界书整理\第十九卷_第六章_最爱，也是最强的劲敌.txt', '第六章'),
    (r'e:\web\落第\第十九卷-世界书整理\第十九卷_终章_背负憧憬的意义.txt', '终章'),
]

for p, name in chapters:
    with open(p, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f"=== {name} (Total lines: {len(lines)}) ===")
    for i, line in enumerate(lines, 1):
        if any(w in line for w in ['月', '日', '年', '时', '天', '晨', '夜', '晚', '早', '星期', '周']):
            if len(line.strip()) < 60 and any(w in line for w in ['昨天', '今天', '明天', '日后', '数月', '黎明', '翌日', '半夜', '深夜', '早晨', '正午', '黄昏', '晚上']):
                print(f"  L{i}: {line.strip()}")
