# -*- coding: utf-8 -*-
import glob, re

with open('scratch/check_eyes.txt', 'w', encoding='utf-8') as out:
    for fn in sorted(glob.glob('落第骑士英雄谭 第*.txt')):
        with open(fn, 'r', encoding='gb18030', errors='ignore') as f:
            t = f.read()
        matches = re.finditer(r'(?:眼|瞳|红|蓝|异色|旗袍|服装|便服|洋装|长相|容貌|五官|表情)[^\n]{0,80}(?:艾莉丝|阿斯卡里德|格尔)', t)
        for m in matches:
            start = max(0, m.start() - 60)
            end = min(len(t), m.end() + 80)
            snip = t[start:end].strip()
            if any(k in snip for k in ['瞳', '眼', '红', '蓝', '紫', '色', '旗袍', '衣服', '服']):
                out.write(f"[{fn}]\n{snip}\n" + "-"*40 + "\n")

print("Saved clean eye & clothing snippets.")
