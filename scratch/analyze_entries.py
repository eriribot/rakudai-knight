import json

with open("scratch/summary1.json", "r", encoding="utf-8") as f:
    s1 = json.load(f)
with open("scratch/summary2.json", "r", encoding="utf-8") as f:
    s2 = json.load(f)

with open("scratch/all_comments.txt", "w", encoding="utf-8") as out:
    out.write("=== File 1 (落第骑士英雄谭 (1).json) Entries ===\n")
    for e in s1:
        out.write(f"[{e['index']}] {e['comment']} (len: {e['len']}, keys: {', '.join(e['keys'])})\n")
    
    out.write("\n=== File 2 (落第骑士英雄谭 魔剑物语.json) Entries ===\n")
    for e in s2:
        out.write(f"[{e['index']}] {e['comment']} (len: {e['len']}, keys: {', '.join(e['keys'])})\n")

print("Exported all comments to scratch/all_comments.txt")
