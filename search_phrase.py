import os
import glob

workspace = r'e:\web\落第'
matches = []

for root, dirs, files in os.walk(workspace):
    for f in files:
        if f.endswith(('.txt', '.md', '.json')):
            p = os.path.join(root, f)
            # Skip massive files or binary
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    for i, line in enumerate(fp, 1):
                        if '从天而降' in line or '正义' in line and ('降' in line or '天' in line):
                            matches.append((p, i, line.strip()))
            except Exception:
                pass

print(f"Total matches: {len(matches)}")
for m in matches[:30]:
    print(f"{m[0]}:{m[1]}: {m[2][:100]}")
