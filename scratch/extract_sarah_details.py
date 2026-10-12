import os, glob, sys, re

sys.stdout.reconfigure(encoding='utf-8')

vols = [
    '第四卷-世界书整理', '第五卷-世界书整理', '第六卷-世界书整理',
    '第七卷-世界书整理', '第八卷-世界书整理', '第九卷-世界书整理',
    '第十卷-世界书整理', '第十一卷-世界书整理', '第十二卷-世界书整理',
    '第十三卷-世界书整理', '第十四卷-世界书整理', '第十五卷-世界书整理',
    '第十六卷-世界书整理', '第十七卷-世界书整理', '第十八卷-世界书整理',
    '第十九卷-世界书整理'
]

keywords = ['莎拉', '布拉德莉莉', '染血达文西', '染血达芬奇']

for v in vols:
    if not os.path.exists(v):
        continue
    files = sorted(glob.glob(os.path.join(v, '**', '*.txt'), recursive=True))
    v_has_match = False
    for f in files:
        if '第六卷原文_UTF8' in f:
            continue
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            text = fp.read()
        lines = text.splitlines()
        
        matches = [i for i, line in enumerate(lines) if any(k in line for k in keywords)]
        if not matches:
            continue
            
        if not v_has_match:
            print(f"\n==========================================")
            print(f"【{v}】")
            print(f"==========================================")
            v_has_match = True
            
        print(f"\n--- 文件: {os.path.basename(f)} (命中行数: {len(matches)}) ---")
        
        # Group adjacent lines into blocks
        blocks = []
        cur_block = []
        for idx in matches:
            if not cur_block:
                cur_block.append(idx)
            elif idx - cur_block[-1] <= 10: # within 10 lines
                cur_block.append(idx)
            else:
                blocks.append(cur_block)
                cur_block = [idx]
        if cur_block:
            blocks.append(cur_block)
            
        for b_idx, block in enumerate(blocks):
            start = max(0, block[0] - 2)
            end = min(len(lines), block[-1] + 3)
            print(f"\n[片段 {b_idx+1} | 行号 L{start+1}-L{end}]")
            for line_no in range(start, end):
                l_text = lines[line_no]
                # mark matches
                is_match = any(k in l_text for k in keywords)
                prefix = ">> " if is_match else "   "
                print(f"{prefix}{line_no+1}: {l_text}")

