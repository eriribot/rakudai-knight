import os
import re

queries = [
    ("vol1_kirihara", "第一卷", ["影子", "桐原", "挥刀", "十年", "狩人"]),
    ("vol3_touka", "第三卷", ["雷切", "一刀修罗", "一刀罗刹", "家人", "求婚"]),
    ("vol4_edelweiss", "第四卷", ["比翼", "爱德怀斯", "誓约", "绝望"]),
    ("vol8_ouma", "第八卷", ["大阿修罗", "风之剑神", "龙", "史黛菈"]),
    ("vol9_final", "第九卷", ["决赛", "约定", "并立", "七星剑王"]),
    ("vol15_swordgod", "第十五卷", ["剑神", "傀儡王", "欧尔", "魔人"]),
    ("vol19_end", "第十九卷", ["大教授", "终章", "憧憬", "结婚"])
]

def search_in_folder(folder_sub, words):
    found = []
    for root, dirs, files in os.walk('.'):
        if folder_sub in root:
            for f in files:
                if f.endswith('.txt'):
                    path = os.path.join(root, f)
                    try:
                        with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                            txt = fp.read()
                            for w in words:
                                pos = 0
                                while True:
                                    idx = txt.find(w, pos)
                                    if idx == -1: break
                                    s = max(0, idx - 120)
                                    e = min(len(txt), idx + 180)
                                    found.append((f, w, txt[s:e].replace('\n', ' ')))
                                    pos = idx + len(w) + 300
                                    if len(found) > 15: break
                    except: pass
    return found

with open("scratch/deep_quotes.txt", "w", encoding="utf-8") as out:
    for tag, folder_sub, words in queries:
        out.write(f"=== {tag} ({folder_sub}) ===\n")
        res = search_in_folder(folder_sub, words)
        for fn, w, snip in res[:4]:
            out.write(f"[{fn}] ({w}): {snip}\n\n")

print("Deep quotes extracted to scratch/deep_quotes.txt")
