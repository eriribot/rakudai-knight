#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract all Obsidian reader highlights (`==...==`, `<mark class="...">...</mark>`),
inline comments (`%%...%%`), and callout notes from a chapter Markdown file or volume directory,
reporting exact 1-based line numbers (#Lx) and act context for worldbook compilation.
"""

import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

HIGHLIGHT_RE = re.compile(
    r"(?:==(?P<hl>[^=\n]+?)==|<mark(?:\s+class=[\"'](?P<cls>[^\"']+)[\"'])?>(?P<mk>[\s\S]+?)</mark>)"
    r"(?:\s*%%(?P<after_cmt>[\s\S]*?)%%)?"
)
STANDALONE_COMMENT_RE = re.compile(r"%%([\s\S]*?)%%")
EMOJI_CATEGORY_MAP = {
    "🟠": "设定/世界观",
    "🟣": "性格/泛用交互",
    "🔵": "招式/武装机制",
    "🟢": "外貌/动画核对",
    "🔴": "完成标识/伏笔/存疑",
    "🟡": "通用重点",
}




def extract_from_file(filepath: str) -> dict:
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    cur_act = "卷首/导览"
    highlights = []
    standalone_comments = []
    callout_notes = []

    in_callout = False
    callout_header = ""
    callout_start_line = 0
    callout_buf = []

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.rstrip("\r\n")

        act_m = re.match(r"^###\s*❖\s*(第\s*\d+\s*幕.*)", line)
        if act_m:
            cur_act = act_m.group(1).strip()

        # Track Obsidian callouts (excluding static ABSTRACT and TIP guide blocks)
        if re.match(r"^>\s*\[!(NOTE|EXAMPLE|TIP|WARNING|CHECK)\](?!-)", line):
            if in_callout and callout_buf:
                callout_notes.append((callout_start_line, callout_header, callout_buf))
            in_callout = True
            callout_header = line.lstrip("> ").strip()
            callout_start_line = idx
            callout_buf = []
            continue

        if in_callout:
            if line.startswith(">"):
                content = re.sub(r"^>\s?", "", line).strip()
                # Keep only lines where user actually wrote something beyond empty `-` or `- [ ]`
                if content and content not in ("-", "- [ ]"):
                    # Ignore pre-filled unchecked todos unless checked or modified, or keep checked ones
                    if not content.startswith("- [ ] "):
                        callout_buf.append((idx, content))
                continue
            else:
                if callout_buf:
                    callout_notes.append((callout_start_line, callout_header, callout_buf))
                in_callout = False
                callout_buf = []

        # Skip the collapsible cheat-sheet lines starting with `>`
        if line.startswith(">"):
            continue

        consumed_comment_spans = []
        for m in HIGHLIGHT_RE.finditer(line):
            hl_text = (m.group("hl") or m.group("mk") or "").strip()
            cls = m.group("cls") or "default"
            for emj, cat in EMOJI_CATEGORY_MAP.items():
                if hl_text.startswith(emj):
                    cls = f"{emj} {cat}"
                    hl_text = hl_text[len(emj):].strip()
                    break
            inline_cmt = (m.group("after_cmt") or "").strip()
            if m.group("after_cmt") is not None:
                consumed_comment_spans.append((m.start(), m.end()))
            highlights.append(
                {
                    "line": idx,
                    "act": cur_act,
                    "class": cls,
                    "highlight": hl_text,
                    "comment": inline_cmt,
                    "full_paragraph": line.strip(),
                }
            )

        for cm in STANDALONE_COMMENT_RE.finditer(line):
            if any(s <= cm.start() and cm.end() <= e for s, e in consumed_comment_spans):
                continue
            c_txt = cm.group(1).strip()
            if c_txt:
                standalone_comments.append(
                    {
                        "line": idx,
                        "act": cur_act,
                        "comment": c_txt,
                        "full_paragraph": line.strip(),
                    }
                )

    if in_callout and callout_buf:
        callout_notes.append((callout_start_line, callout_header, callout_buf))

    return {
        "file": os.path.basename(filepath),
        "highlights": highlights,
        "standalone_comments": standalone_comments,
        "callout_notes": callout_notes,
    }


def print_report(result: dict):
    total = (
        len(result["highlights"])
        + len(result["standalone_comments"])
        + len(result["callout_notes"])
    )
    print(f"=== {result['file']} (共提取 {len(result['highlights'])} 处高亮, "
          f"{len(result['standalone_comments'])} 处独立行内批注, "
          f"{len(result['callout_notes'])} 组卡片批注) ===")
    if total == 0:
        print("  (暂无读者高亮或新增批注)\n")
        return

    if result["highlights"]:
        print("\n[A] 原文高亮与随附批注 (Highlights):")
        for h in result["highlights"]:
            tag = f"[{h['class']}] " if h["class"] != "default" else ""
            cmt = f"  --> 💬 批注: {h['comment']}" if h["comment"] else ""
            print(f"  - #L{h['line']} ({h['act']}) {tag}=={h['highlight']}=={cmt}")
            print(f"    上下文: {h['full_paragraph'][:160]}")

    if result["standalone_comments"]:
        print("\n[B] 独立行内批注 (%%...%%):")
        for c in result["standalone_comments"]:
            print(f"  - #L{c['line']} ({c['act']}) %%{c['comment']}%%")
            print(f"    上下文: {c['full_paragraph'][:160]}")

    if result["callout_notes"]:
        print("\n[C] 评注卡片内容 (Callout Notes):")
        for start_l, header, items in result["callout_notes"]:
            print(f"  - #L{start_l} {header}:")
            for lno, txt in items:
                print(f"      #L{lno}: {txt}")
    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_reader_highlights.py <chapter.md | volume_dir>")
        sys.exit(1)

    target = sys.argv[1]
    if os.path.isfile(target):
        print_report(extract_from_file(target))
    elif os.path.isdir(target):
        for fn in sorted(os.listdir(target)):
            if fn.endswith(".md") and (fn.startswith("第一卷_") or fn.startswith("第二卷_") or fn.startswith("00_")):
                print_report(extract_from_file(os.path.join(target, fn)))
    else:
        print(f"Path not found: {target}")
        sys.exit(1)


if __name__ == "__main__":
    main()
