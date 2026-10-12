import os, sys

sys.stdout.reconfigure(encoding='utf-8')

def extract_scenes(filepath, keywords):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    matches = [i for i, l in enumerate(lines) if any(k in l for k in keywords)]
    if not matches:
        return
    print(f"=== File: {os.path.basename(filepath)} ===")
    
    clusters = []
    curr = []
    for m in matches:
        if not curr or m - curr[-1] <= 15:
            curr.append(m)
        else:
            clusters.append(curr)
            curr = [m]
    if curr:
        clusters.append(curr)
        
    for c_i, c in enumerate(clusters):
        start = max(0, c[0] - 2)
        end = min(len(lines), c[-1] + 3)
        print(f"\n--- Cluster {c_i+1} (Lines {start+1}-{end}) ---")
        for idx in range(start, end):
            l = lines[idx].rstrip()
            print(f"{idx+1:4d}: {l}")

extract_scenes('第七卷-世界书整理/第七卷_第九章_战士们略微喧嚣的中场休息.txt', ['莎拉', '布拉德莉莉', '染血达文西'])
