import glob, sys, os

sys.stdout.reconfigure(encoding='utf-8')

for f in glob.glob('人物仔细考究/*.md'):
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        lines = fp.readlines()
    for i, line in enumerate(lines):
        if '风骨' in line or '傲骨' in line:
            print(f"{os.path.basename(f)} L{i+1}: {line.strip()}")
