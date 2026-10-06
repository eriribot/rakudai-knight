import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]

# Read Stella markdown
stella_md = (root / "第一卷-世界书整理/人物条目/史黛菈·法米利昂.md").read_text(encoding="utf-8")
stella_match = re.search(r"```xml\s*(<Stella Vermillion>.*?</Stella Vermillion>)\s*```", stella_md, re.DOTALL)
if not stella_match:
    raise RuntimeError("Failed to extract Stella XML block")
stella_content = stella_match.group(1)

# Read Shizuku markdown
shizuku_md = (root / "第一卷-世界书整理/人物条目/黑铁珠雫.md").read_text(encoding="utf-8")
shizuku_match = re.search(r"```xml\s*(<Kurogane Shizuku>.*?</Kurogane Shizuku>)\s*```", shizuku_md, re.DOTALL)
if not shizuku_match:
    raise RuntimeError("Failed to extract Shizuku XML block")
shizuku_content = shizuku_match.group(1)

stella_keys = ["史黛菈·法米利昂", "史黛菈", "红莲皇女", "妃龙罪剑", "妃龙吐息", "Stella Vermillion"]
shizuku_keys = ["黑铁珠雫", "珠雫", "深海魔女", "宵时雨", "障波水莲", "水色轮回", "白夜结界", "绯水刃", "Kurogane Shizuku"]

target_files = ["落第骑士英雄谭v0.02.json", "落第骑士英雄谭 (1).json"]

for fname in target_files:
    fpath = root / fname
    if not fpath.exists():
        continue
    with open(fpath, "r", encoding="utf-8") as fp:
        data = json.load(fp)
    entries = data.get("entries", {})
    
    # Update Stella (UID 11)
    if "11" in entries:
        entries["11"]["content"] = stella_content
        entries["11"]["key"] = stella_keys
        entries["11"]["comment"] = "史黛菈·法米利昂"
        print(f"Updated UID 11 (Stella) in {fname}")
        
    # Update Shizuku (UID 49)
    if "49" in entries:
        entries["49"]["content"] = shizuku_content
        entries["49"]["key"] = shizuku_keys
        entries["49"]["comment"] = "黑铁珠雫"
        print(f"Updated UID 49 (Shizuku) in {fname}")
        
    with open(fpath, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    print(f"Saved {fname} successfully")
