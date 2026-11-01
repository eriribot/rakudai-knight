# Let's inspect the exact wording in Volume 15 Epilogue and Volume 18 Prologue/Chapter 1
with open(r'e:\web\落第\第十八卷-世界书整理\第十八卷_序章_所谓正义，所谓邪恶.txt', 'r', encoding='utf-8') as f:
    v18_prologue = f.read()

with open(r'e:\web\落第\第十八卷-世界书整理\第十八卷_第一章_〈烈风剑帝〉VS〈超人(Thehero)〉.txt', 'r', encoding='utf-8') as f:
    v18_ch1 = f.read()

# Let's check mentions of time, days, weeks, months in v18_prologue and v18_ch1
import re
print("--- Time clues in V18 Prologue ---")
for line in v18_prologue.splitlines():
    if any(k in line for k in ['日', '月', '年', '周', '天', '前', '后', '小时', '昨日', '今天', '明天']):
        if len(line.strip()) < 80:
            print(line.strip())

print("\n--- Time clues in V18 Chapter 1 ---")
for line in v18_ch1.splitlines()[:200]:
    if any(k in line for k in ['日', '月', '年', '周', '天', '前', '后', '小时', '昨日', '今天', '明天']):
        if len(line.strip()) < 80:
            print(line.strip())
