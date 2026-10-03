import os
import re

def search_text(pattern, max_results=10):
    matches = []
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.endswith('.txt') and any(f.startswith(p) for p in ['落第', '第']):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                except:
                    continue
                for m in re.finditer(pattern, content):
                    start = max(0, m.start() - 200)
                    end = min(len(content), m.end() + 200)
                    snippet = content[start:end].replace('\n', ' ')
                    matches.append((path, snippet))
                    if len(matches) >= max_results:
                        return matches
    return matches

queries = {
    "Stella cooking/food Vol 1": r"史黛菈.*?(?:做饭|料理|早餐|晚餐|煮|吃|肚子)",
    "Room 405 chores Vol 1": r"405.*?(?:家事|打扫|煮饭|做饭|买菜|分担)",
    "Okutama cooking Vol 3": r"(?:奥多摩|集训|集训营).*?(?:咖哩|咖喱|料理|煮|菜刀|围裙|饭)",
    "Tohkwa Todo cooking Vol 3": r"刀华.*?(?:料理|咖哩|咖喱|围裙|牛筋|菜刀|若叶)",
    "Shizuku food Vol 5": r"珠雫.*?(?:美食|讲究|料理|吃|食量)",
    "Ayase cooking/domestic": r"绚濑.*?(?:料理|做饭|家务|道场|厨房)",
    "Kurono family Vol 18": r"黑乃.*?(?:拓海|琢海|小鸣|鸣|丈夫|女儿|三千世界)",
    "Nene Saikyo habits": r"西京.*?(?:老太婆|妾身|和服|抽足|霸道天星|公然)",
    "Kanata mischief/wakaba": r"彼方.*?(?:若叶|恶作剧|恶魔|小沫|泡沫|茶|星尘)",
    "Renren daily": r"恋恋.*?(?:咖哩|咖喱|圣代|短裤|跑步|音速)"
}

with open('scratch/canon_findings.txt', 'w', encoding='utf-8') as out:
    for name, q in queries.items():
        out.write(f"====================================\nQUERY: {name}\n")
        res = search_text(q, max_results=5)
        out.write(f"Found {len(res)} matches\n")
        for p, snip in res:
            out.write(f"--- File: {p} ---\n{snip}\n\n")

print("Finished searching canon. Output written to scratch/canon_findings.txt")
