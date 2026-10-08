import glob, re

files = glob.glob("e:/web/落第/第二卷-世界书整理/*.txt")
for f in sorted(files):
    with open(f, "r", encoding="utf-8") as fp:
        lines = fp.readlines()
    for idx, l in enumerate(lines):
        # find sentences mentioning 绚濑, 少女, 学姐, 绫辻 along with appearance words
        if any(w in l for w in ["发", "眼", "脸", "貌", "姿", "身", "容"]):
            if any(k in l for k in ["绚濑", "绫辻", "黑发"]):
                print(f"{f}:{idx+1}: {l.strip()}")
