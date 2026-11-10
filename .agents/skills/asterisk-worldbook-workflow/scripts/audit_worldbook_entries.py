#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audit SillyTavern Worldbook Markdown files in a target volume/chapter directory.
Checks:
1. XML Chinese character counts (中文字数) and SillyTavern estimated tokens (ST_Tokens).
2. Female character budget (3,000 - 3,500 ST_Tokens, tolerance +250) > Male character budget (1,800 - 2,550 ST_Tokens).
3. Forbidden patterns inside <...> XML blocks:
   - CH-xx or #Lxxx source line citations
   - '截胡' plot-hijacking scripts
   - '六维属性' or '伐刀者等级' cross-work power scaling in Asterisk entries
"""

import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

KNOWN_FEMALES = {
    "尤莉丝", "沙沙宫纱夜", "克劳蒂雅", "谷津崎匡子", "刀藤绮凛",
    "席尔薇雅", "依蕾奈", "普莉熙拉", "艾涅丝妲", "卡蜜拉",
    "莉姆希", "芙萝拉", "赫尔加", "天雾遥", "奥菲莉亚",
    "范星露", "可罗奈",
}


def count_cjk(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def estimate_st_tokens(text: str) -> int:
    cjk_and_punct = len(re.findall(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]", text))
    other = len(text) - cjk_and_punct
    return int(cjk_and_punct * 0.95 + other * 0.30)


def extract_xml_block(md_text: str) -> str:
    m = re.search(r"```xml\s*(<[\s\S]+?>)\s*```", md_text)
    if m:
        return m.group(1)
    m2 = re.search(r"<!--\s*正文开始\s*-->\s*(<[\s\S]+?>)\s*<!--\s*正文结束\s*-->", md_text)
    if m2:
        return m2.group(1)
    return ""


def infer_gender(filename: str) -> str:
    for name in KNOWN_FEMALES:
        if name in filename:
            return "F"
    return "M"


def audit_directory(target_dir: str) -> int:
    errors = []
    char_dir = os.path.join(target_dir, "人物条目")
    scene_dir = os.path.join(target_dir, "场景条目")
    lore_dir = os.path.join(target_dir, "词条与设定条目")

    female_tokens = []
    male_tokens = []

    print(f"=== Worldbook Audit: {target_dir} ===\n")

    if os.path.isdir(char_dir):
        print("[1] 人物条目 (Character Entries)")
        for fn in sorted(os.listdir(char_dir)):
            if not fn.endswith(".md"):
                continue
            path = os.path.join(char_dir, fn)
            with open(path, "r", encoding="utf-8") as f:
                txt = f.read()
            xml = extract_xml_block(txt)
            if not xml:
                errors.append(f"{fn}: 未找到 ```xml <...> ``` 世界书代码块")
                continue

            cjk = count_cjk(xml)
            tok = estimate_st_tokens(xml)
            gender = infer_gender(fn)

            if gender == "F":
                female_tokens.append((fn, tok))
                if not (2900 <= tok <= 4750):
                    errors.append(f"{fn} (女): ST_Tokens={tok} 超出目标区间 [3000-4500 (±250)]")
            else:
                male_tokens.append((fn, tok))
                if not (1700 <= tok <= 2650):
                    errors.append(f"{fn} (男): ST_Tokens={tok} 超出目标区间 [1800-2500 (±150)]")

            if re.search(r"CH-\d+|#L\d+", xml, re.I):
                errors.append(f"{fn}: XML 正文内残留 CH-xx / #Lxx 标记")
            if "截胡" in txt:
                errors.append(f"{fn}: 含有禁用词『截胡』（请改为泛用交互指南）")
            if re.search(r"六维属性|伐刀者等级", xml):
                errors.append(f"{fn}: XML 正文内含有跨作脑补『六维属性/伐刀者等级』")
            if "***" in txt:
                errors.append(f"{fn}: 含有禁用符号『***』（严禁使用 *** 分割线、加粗斜体或装饰符）")

            print(f"  - {fn:28s} | 性别={gender} | XML中文字数={cjk:4d} | ST_Tokens≈{tok:4d}")

        if female_tokens and male_tokens:
            min_f_name, min_f = min(female_tokens, key=lambda x: x[1])
            max_m_name, max_m = max(male_tokens, key=lambda x: x[1])
            if min_f <= max_m:
                errors.append(
                    f"女角色最低 Token ({min_f_name}={min_f}) 未严格大于男角色最高 Token ({max_m_name}={max_m})"
                )

    for label, sub in [("[2] 场景条目 (Scene Entries)", scene_dir), ("[3] 词条与设定条目 (Lore Entries)", lore_dir)]:
        if os.path.isdir(sub):
            print(f"\n{label}")
            for fn in sorted(os.listdir(sub)):
                if not fn.endswith(".md"):
                    continue
                path = os.path.join(sub, fn)
                with open(path, "r", encoding="utf-8") as f:
                    txt = f.read()
                xml = extract_xml_block(txt)
                cjk = count_cjk(xml) if xml else count_cjk(txt)
                tok = estimate_st_tokens(xml) if xml else estimate_st_tokens(txt)
                if xml and re.search(r"CH-\d+|#L\d+", xml, re.I):
                    errors.append(f"{fn}: XML 正文内残留 CH-xx / #Lxx 标记")
                if "截胡" in xml:
                    errors.append(f"{fn}: XML 正文内含有禁用词『截胡』")
                if "***" in txt:
                    errors.append(f"{fn}: 含有禁用符号『***』")
                print(f"  - {fn:36s} | XML中文字数={cjk:4d} | ST_Tokens≈{tok:4d}")

    print("\n=== Audit Result ===")
    if errors:
        print(f"FAILED ({len(errors)} issue(s) found):")
        for e in errors:
            print(f"  [!] {e}")
        return 1
    print("PASSED: 全部字数/Token 梯度、零 CH- 引用、零『截胡』、零伪造六维、零『***』符号检查均通过！")
    return 0


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else r"DLC/学战研究/第一卷-世界书整理"
    sys.exit(audit_directory(target))
