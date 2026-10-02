import os
import glob
import re

patterns = [
    r"人类明明没有翅膀",
    r"登上月球",
    r"以我最弱",
    r"一刀修罗",
    r"挥了十年",
    r"没有一个人愿意爱",
    r"所有的爱情",
    r"纯水是不导电",
    r"小姑",
    r"嫂子",
    r"对自己绝望",
    r"命运",
    r"雷切",
    r"剑神",
    r"比翼",
    r"千分之一秒",
]

results = {p: [] for p in patterns}

for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.txt') and ('卷' in f or '整理' in root):
            filepath = os.path.join(root, f)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                    text = fp.read()
                    for p in patterns:
                        for m in re.finditer(p, text):
                            start = max(0, m.start() - 100)
                            end = min(len(text), m.end() + 100)
                            snippet = text[start:end].replace('\n', ' ')
                            results[p].append((f, snippet))
                            if len(results[p]) >= 3:
                                break
            except Exception:
                pass

with open("scratch/search_quotes.txt", "w", encoding="utf-8") as out:
    for p, matches in results.items():
        out.write(f"=== Keyword / Pattern: {p} ({len(matches)} matches) ===\n")
        for fn, snip in matches[:3]:
            out.write(f"[{fn}]: ... {snip} ...\n")
        out.write("\n")

print("Finished searching quotes")
