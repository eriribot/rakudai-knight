#!/usr/bin/env python3
"""Validate the story catalogue against the original GBK bytes, without repair."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOGUES = (
    ROOT / "scripts/story/volumes-01-09.json",
    ROOT / "scripts/story/volumes-10-19.json",
)
NUMERALS = (
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九",
)
EXPECTED_COUNTS = (6, 6, 6, 6, 6, 5, 5, 5, 3, 5, 5, 6, 6, 4, 6, 5, 6, 4, 5)
CHAPTER_HEADER = re.compile(
    r"^(序章|间章|尾声|终章(?:（[前后]）|[ⅠⅡⅢ]+)?|第[一二三四五六七八九十百]+章)\s*(.*)$"
)
EXCLUDED_HEADER = re.compile(r"^(?:后记|插图|插画|附录|前情提要|目录)(?:\s|$)")
# This is a reported source defect, never a decoding fallback or repaired text.
KNOWN_GBK_DEFECT = {
    "volume": 14,
    "line": 5195,
    "fileByteOffset": 141762,
    "lineByteOffset": 28,
    "bytesHex": "e6",
}


def check_catalogue() -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    source_reports: list[dict] = []
    volumes: list[dict] = []

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    for path in CATALOGUES:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                raise ValueError("catalogue must be an array")
            volumes.extend(data)
        except (OSError, UnicodeError, ValueError) as error:
            errors.append(f"{path.relative_to(ROOT)}: {error}")

    require(len(volumes) == 19, f"Expected 19 volumes; received {len(volumes)}")
    numbers = [v.get("volume") if isinstance(v, dict) else None for v in volumes]
    require(numbers == list(range(1, 20)), "Volumes must appear exactly once in order 1–19")
    node_count = evidence_count = 0

    for v in volumes:
        if not isinstance(v, dict) or type(v.get("volume")) is not int:
            errors.append("Invalid volume object or volume number")
            continue
        number = v["volume"]
        if not 1 <= number <= 19:
            errors.append(f"Out-of-range volume {number}")
            continue
        label = f"volume {number}"
        basename = f"落第骑士英雄谭 第{NUMERALS[number - 1]}卷 gbk.txt"
        require(v.get("sourceFile") == basename, f"{label}: unexpected sourceFile")
        require(v.get("encoding") == "gbk", f"{label}: encoding must be gbk")
        source = ROOT / basename
        try:
            raw = source.read_bytes()
        except OSError as error:
            errors.append(f"{label}: source read failed: {error}")
            continue

        whole_error = None
        try:
            raw.decode("gbk", errors="strict")
        except UnicodeDecodeError as error:
            whole_error = {
                "fileByteOffset": error.start,
                "bytesHex": raw[error.start:error.end].hex(),
                "reason": error.reason,
            }

        # Every line is decoded strictly. Failed lines remain None and cannot
        # contribute a title, summary fact, or evidence text to validation.
        lines: list[str | None] = []
        line_errors: list[dict] = []
        byte_offset = 0
        for line_number, raw_line in enumerate(raw.splitlines(keepends=True), 1):
            try:
                lines.append(raw_line.decode("gbk", errors="strict").rstrip("\r\n"))
            except UnicodeDecodeError as error:
                lines.append(None)
                line_errors.append({
                    "volume": number,
                    "line": line_number,
                    "fileByteOffset": byte_offset + error.start,
                    "lineByteOffset": error.start,
                    "bytesHex": raw_line[error.start:error.end].hex(),
                    "reason": error.reason,
                })
            byte_offset += len(raw_line)

        known_defect = (
            number == 14
            and len(line_errors) == 1
            and all(line_errors[0].get(k) == value for k, value in KNOWN_GBK_DEFECT.items())
        )
        if whole_error is not None:
            if known_defect:
                warnings.append(
                    "Volume 14 is not valid whole-file GBK: L5195, file byte 141762, "
                    "line byte 28, e6. Only strictly decodable lines are checked; "
                    "the original source remains unchanged."
                )
            else:
                errors.append(f"{label}: unrecognized GBK decoding defect: {line_errors}")
        require(whole_error is None or bool(line_errors), f"{label}: inconsistent decode diagnostics")

        prefix = f"第{NUMERALS[number - 1]}卷"
        raw_prefix = prefix.encode("gbk")
        markers = []
        for line_number, (raw_line, line) in enumerate(zip(raw.splitlines(), lines), 1):
            if not raw_line.lstrip().startswith(raw_prefix):
                continue
            if line is None:
                errors.append(f"{label}: undecodable heading at L{line_number}")
                continue
            body = line.strip()[len(prefix):].strip()
            match = CHAPTER_HEADER.fullmatch(body)
            excluded = bool(EXCLUDED_HEADER.match(body))
            require(bool(match) or excluded, f"{label}: unknown heading at L{line_number}: {body}")
            markers.append({"line": line_number, "body": body, "match": match, "excluded": excluded})

        expected_nodes = []
        excluded_titles = []
        interlude_number = 0
        for index, marker in enumerate(markers):
            if marker["excluded"]:
                excluded_titles.append({"line": marker["line"], "title": marker["body"]})
                continue
            if marker["match"] is None:
                continue
            source_key, subtitle = marker["match"].groups()
            key = source_key
            if number in (6, 7, 8, 13) and key == "间章":
                interlude_number += 1
                key = f"间章{interlude_number}"
            expected_nodes.append({
                "key": key,
                "header": marker["body"],
                "subtitle": subtitle,
                "startLine": marker["line"],
                "endLine": markers[index + 1]["line"] - 1 if index + 1 < len(markers) else len(lines),
            })

        chapters = v.get("chapters")
        if not isinstance(chapters, list):
            errors.append(f"{label}: chapters must be an array")
            continue
        node_count += len(chapters)
        require(len(expected_nodes) == EXPECTED_COUNTS[number - 1], f"{label}: source heading count changed")
        require(len(chapters) == len(expected_nodes), f"{label}: catalogue/source chapter count mismatch")
        require(
            [c.get("key") if isinstance(c, dict) else None for c in chapters] == [n["key"] for n in expected_nodes],
            f"{label}: chapter keys or ordering do not match the source headings",
        )
        names: dict[str, str] = {}
        for index, chapter in enumerate(chapters):
            if not isinstance(chapter, dict):
                errors.append(f"{label}: chapter {index + 1} is not an object")
                continue
            node_label = f"{label}/{chapter.get('key', index + 1)}"
            key = chapter.get("key")
            aliases = chapter.get("aliases")
            require(isinstance(key, str) and bool(key), f"{node_label}: missing key")
            require(isinstance(aliases, list), f"{node_label}: aliases must be an array")
            for name in [key] + (aliases if isinstance(aliases, list) else []):
                if not isinstance(name, str) or not name:
                    errors.append(f"{node_label}: invalid key or alias")
                    continue
                require(name not in names, f"{node_label}: key/alias collision for {name!r}")
                names[name] = str(key)

            bounds = chapter.get("source")
            if not isinstance(bounds, dict):
                errors.append(f"{node_label}: source bounds missing")
                continue
            start, end = bounds.get("startLine"), bounds.get("endLine")
            valid_bounds = type(start) is int and type(end) is int and 1 <= start <= end <= len(lines)
            require(valid_bounds, f"{node_label}: invalid source line bounds")
            if index < len(expected_nodes):
                expected = expected_nodes[index]
                require(start == expected["startLine"] and end == expected["endLine"], f"{node_label}: bounds must end immediately before the next heading")
                require(chapter.get("title") in (expected["header"], expected["subtitle"]), f"{node_label}: title does not exactly match the source heading or subtitle")

            summary = chapter.get("summary")
            require(isinstance(summary, str) and bool(summary.strip()) and len(summary) <= 220, f"{node_label}: summary must be nonempty and at most 220 characters")
            evidence = chapter.get("evidence")
            if not isinstance(evidence, list):
                errors.append(f"{node_label}: evidence must be an array")
                continue
            require(len(evidence) >= 2, f"{node_label}: at least two source excerpts are required")
            evidence_count += len(evidence)
            seen_evidence = set()
            for excerpt in evidence:
                if not isinstance(excerpt, dict):
                    errors.append(f"{node_label}: invalid evidence object")
                    continue
                line_number, text = excerpt.get("line"), excerpt.get("text")
                in_range = valid_bounds and type(line_number) is int and start <= line_number <= end
                require(bool(in_range), f"{node_label}: evidence line outside chapter: {line_number}")
                require(isinstance(text, str) and bool(text.strip()), f"{node_label}: empty evidence text")
                if in_range and isinstance(text, str):
                    original_line = lines[line_number - 1]
                    require(original_line is not None and text in original_line, f"{node_label}: evidence does not match strict GBK source at L{line_number}")
                    fingerprint = (line_number, text)
                    require(fingerprint not in seen_evidence, f"{node_label}: duplicate evidence excerpt")
                    seen_evidence.add(fingerprint)

        keys = [c.get("key") for c in chapters if isinstance(c, dict)]
        if number in (6, 7, 8, 13):
            require(keys[0:1] == ["间章1"] and keys[-1:] == ["间章2"], f"{label}: both ordered interludes are required")
            require(names.get("间章") == "间章1", f"{label}: legacy 间章 must refer only to 间章1")
        if number == 9:
            require(keys == ["第十四章", "终章（前）", "终章（后）"], "volume 9: split epilogue required")
            require("终章" not in names, "volume 9: ambiguous 终章 alias is forbidden")
        if number == 16:
            require(keys[0:2] == ["终章Ⅱ", "序章"], "volume 16: 终章Ⅱ must precede 序章")
        if number == 17:
            require(keys[-1:] == ["尾声"], "volume 17: final 尾声 is required")

        source_reports.append({
            "volume": number,
            "file": basename,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "wholeFileGbkStrict": whole_error is None,
            "wholeFileDecodeError": whole_error,
            "lineDecodeErrors": line_errors,
            "knownSourceDefect": known_defect,
            "sourceChapters": len(expected_nodes),
            "catalogueChapters": len(chapters),
            "excludedHeadings": excluded_titles,
        })

    require(node_count == 100, f"Expected 100 nodes; received {node_count}")
    return {
        "ok": not errors,
        "scope": "Offline catalogue structure and exact source-evidence validation; not semantic proof of every summary or real-host acceptance.",
        "counts": {"volumes": len(volumes), "chapters": node_count, "evidence": evidence_count},
        "sources": source_reports,
        "warnings": warnings,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true", help="Also write output/chapter-v4/catalogue-check.json")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    result = check_catalogue()
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        target = ROOT / "output/chapter-v4/catalogue-check.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8")
    sys.stdout.write(rendered)
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
