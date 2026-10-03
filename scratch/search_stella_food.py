import os
import re

def search_all_occurrences(char_name, kws, max_count=20):
    hits = []
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.endswith('.txt') and any(f.startswith(p) for p in ['落第', '第']):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                        text = fp.read()
                except:
                    continue
                for kw in kws:
                    pattern = f"{char_name}[^。！？\n]*?{kw}|{kw}[^。！？\n]*?{char_name}"
                    for m in re.finditer(pattern, text):
                        start = max(0, m.start() - 150)
                        end = min(len(text), m.end() + 150)
                        snip = text[start:end].replace('\n', ' ')
                        hits.append((f, kw, snip))
                        if len(hits) >= max_count:
                            return hits
    return hits

stella_hits = search_all_occurrences('史黛菈', ['料理', '做饭', '下厨', '家务', '吃', '食量', '煮', '便当', '肉'], max_count=30)
with open('scratch/stella_food_search.txt', 'w', encoding='utf-8') as out:
    for f, kw, snip in stella_hits:
        out.write(f"File: {f} | KW: {kw}\nSnippet: {snip}\n\n")

print("Saved Stella hits")
