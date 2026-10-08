import os, glob, re

# Check all text files in workspace
all_files = glob.glob("e:/web/落第/**/*.txt", recursive=True) + glob.glob("e:/web/落第/**/*.md", recursive=True)

print(f"Total files: {len(all_files)}")

results = []
for f in all_files:
    # skip scratch
    if "scratch" in f:
        continue
    with open(f, "r", encoding="utf-8", errors="ignore") as fp:
        content = fp.read()
    
    # search for eye/bangs/hair related to Ayase
    # find occurrences of 绚濑 or 绫辻
    for m in re.finditer(r'(?:绚濑|绫辻)', content):
        start = max(0, m.start() - 200)
        end = min(len(content), m.end() + 200)
        snippet = content[start:end]
        if any(w in snippet for w in ["左眼", "右眼", "刘海", "前髪", "前发", "遮", "单眼", "独眼"]):
            results.append((f, snippet))

print(f"Found {len(results)} matches.")
for f, s in results[:20]:
    print(f"=== {f} ===")
    print(s.strip())
    print("-" * 50)
