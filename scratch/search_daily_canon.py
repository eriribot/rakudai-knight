import os
import re

vol_dirs = [d for d in os.listdir('.') if os.path.isdir(d) and '卷' in d]

keywords = ['料理', '做饭', '厨房', '菜刀', '便当', '早餐', '晚餐', '咖喱', '咖哩', '围裙', '煮', '爆炸', '黑暗料理', '毒']
characters = ['史黛菈', '珠雫', '刀华', '绚濑', '黑乃', '宁音', '彼方', '恋恋', '加加美']

results = []

for vdir in sorted(vol_dirs):
    for root, dirs, files in os.walk(vdir):
        for f in files:
            if f.endswith('.txt'):
                filepath = os.path.join(root, f)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                except Exception as e:
                    continue
                
                # Search for character + keyword within close proximity (say 200 chars)
                for char in characters:
                    for kw in keywords:
                        # find all occurrences of kw
                        for m in re.finditer(re.escape(kw), content):
                            start = max(0, m.start() - 250)
                            end = min(len(content), m.end() + 250)
                            snippet = content[start:end]
                            if char in snippet:
                                results.append({
                                    'vol': vdir,
                                    'file': f,
                                    'char': char,
                                    'kw': kw,
                                    'snippet': snippet.replace('\n', ' ')
                                })

print(f"Total matching snippets found: {len(results)}")

with open('scratch/cooking_daily_search_results.txt', 'w', encoding='utf-8') as out:
    for r in results:
        out.write(f"[{r['vol']}/{r['file']}] Char: {r['char']} | KW: {r['kw']}\n")
        out.write(f"Snippet: {r['snippet']}\n\n")

print("Saved to scratch/cooking_daily_search_results.txt")
