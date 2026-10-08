"""Read-only Codex storage index; outputs are written only beside this script on E:."""
import datetime as dt
import html
import json
import ntpath
import os
from pathlib import Path
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")
BASE = Path(__file__).resolve().parent
DATA = Path(r"C:\Users\eriri\.codex")
TZ = dt.timezone(dt.timedelta(hours=8))
CURRENT = "01a11982-24a0-7021-bbc9-da764a97a5fe"
PROJECTS = {
    r"E:\web\新卡1": "新卡1", r"E:\web\落第": "落第",
    r"D:\webgame\tavern_helper_template-main\src\webgame-ui": "webgame-ui",
    r"D:\preset": "preset", r"E:\web\最简单同层\tavern_helper_template-main": "最简单同层",
    r"F:\SillyTavern-Launcher\SillyTavern": "SillyTavern",
    r"D:\学习整理\幽默": "幽默", r"D:\伪同层卡实验": "伪同层卡实验",
    r"E:\bridgeapi_shujuku": "bridgeapi_shujuku",
    r"E:\web\tavern_helper_template-main\src\islandmilfcode": "islandmilfcode",
    r"E:\web\tavern_helper_template-main": "tavern_helper_template-main（E盘旧目录）",
    r"D:\webgame\tavern_helper_template-main": "tavern_helper_template-main（D盘根目录）",
}


def norm(value):
    value = str(value).replace("/", "\\")
    if value.startswith("\\\\?\\"):
        value = value[4:]
    return ntpath.normcase(ntpath.normpath(value))


def project(cwd):
    for path, label in sorted(PROJECTS.items(), key=lambda pair: len(pair[0]), reverse=True):
        if norm(cwd) == norm(path) or norm(cwd).startswith(norm(path) + "\\"):
            return label, path
    if "\\.codex\\worktrees\\" in norm(cwd) and norm(cwd).endswith("\\islandmilfcode"):
        return "islandmilfcode", r"E:\web\tavern_helper_template-main\src\islandmilfcode"
    return ntpath.basename(cwd) or cwd, cwd


def day(timestamp):
    return dt.datetime.fromtimestamp(timestamp, TZ).strftime("%Y-%m-%d") if timestamp else "未知"


con = sqlite3.connect((DATA / "state_5.sqlite").as_uri() + "?mode=ro", uri=True)
con.row_factory = sqlite3.Row
states = {r["id"]: dict(r) for r in con.execute("SELECT id,name,title,updated_at,created_at FROM threads")}
parents = {r[1]: r[0] for r in con.execute("SELECT parent_thread_id,child_thread_id FROM thread_spawn_edges")}
con.close()
files = []
errors = []
for folder in [DATA / "sessions", DATA / "archived_sessions"]:
    stack = [folder]
    while stack:
        with os.scandir(stack.pop()) as entries:
            for entry in entries:
                st = entry.stat(follow_symlinks=False)
                if st.st_file_attributes & 1024:
                    continue
                if entry.is_dir(follow_symlinks=False):
                    stack.append(Path(entry.path))
                    continue
                if not entry.name.endswith(".jsonl"):
                    continue
                try:
                    with open(entry.path, "rb") as stream:
                        record = json.loads(stream.readline(2 * 1024 * 1024))
                    meta = record["payload"]
                    if record["type"] != "session_meta":
                        raise ValueError("missing session_meta")
                    thread_id = meta["id"]
                    state = states.get(thread_id, {})
                    source = meta.get("source", {})
                    source_parent = (source.get("subagent", {}).get("thread_spawn", {}).get("parent_thread_id")
                        if isinstance(source, dict) and isinstance(source.get("subagent", {}), dict) else None)
                    parent = meta.get("parent_thread_id") or meta.get("spawn_metadata", {}).get("parent_thread_id") or source_parent
                    if parent:
                        parents.setdefault(thread_id, parent)
                    label, root = project(meta.get("cwd", "未知"))
                    title = state.get("name") or state.get("title") or thread_id
                    title = " ".join(title.split())
                    files.append({"id": thread_id, "path": entry.path, "bytes": st.st_size,
                        "cwd": meta.get("cwd"), "project": label, "project_root": root,
                        "title": title[:160] + ("…" if len(title) > 160 else ""),
                        "last_activity": state.get("updated_at", st.st_mtime),
                        "archived": folder.name == "archived_sessions"})
                except Exception as exc:
                    errors.append({"path": entry.path, "error": str(exc)})

groups = {}
by_id = {}
for row in files:
    by_id.setdefault(row["id"], row)
    key = norm(row["project_root"])
    g = groups.setdefault(key, {"project": row["project"], "path": row["project_root"], "bytes": 0, "files": 0,
        "archived_bytes": 0, "archived_files": 0, "latest": 0})
    g["bytes"] += row["bytes"]
    g["files"] += 1
    g["archived_bytes"] += row["bytes"] if row["archived"] else 0
    g["archived_files"] += int(row["archived"])
    g["latest"] = max(g["latest"], row["last_activity"])


def root_id(thread_id):
    visited = set()
    while thread_id in parents and parents[thread_id] in by_id:
        if thread_id in visited:
            raise RuntimeError("cycle in thread ancestry")
        visited.add(thread_id)
        thread_id = parents[thread_id]
    return thread_id


families = {}
for row in files:
    root = root_id(row["id"])
    head = by_id[root]
    f = families.setdefault(root, {"id": root, "title": head["title"], "project": head["project"],
        "bytes": 0, "files": 0, "archived_bytes": 0, "latest": 0, "projects": set(), "members": []})
    f["bytes"] += row["bytes"]
    f["files"] += 1
    f["archived_bytes"] += row["bytes"] if row["archived"] else 0
    f["latest"] = max(f["latest"], row["last_activity"])
    f["projects"].add(row["project"])
    f["members"].append({"id": row["id"], "path": row["path"], "bytes": row["bytes"], "archived": row["archived"]})
for g in groups.values():
    g["latest_date"] = day(g["latest"])
for f in families.values():
    f["latest_date"] = day(f["latest"])
    f["projects"] = sorted(f["projects"])
    f["cross_project"] = len(f["projects"]) > 1
    f["current_chat"] = CURRENT in {m["id"] for m in f["members"]}
    f["fully_archived"] = f["bytes"] == f["archived_bytes"]
project_rows = sorted(groups.values(), key=lambda r: r["bytes"], reverse=True)
family_rows = sorted(families.values(), key=lambda r: r["bytes"], reverse=True)
report = {"generated_at": dt.datetime.now(TZ).isoformat(), "measurement": "logical file lengths, sessions and archived_sessions only; family totals include descendants; no deletion performed",
    "session_bytes": sum(r["bytes"] for r in files), "files": len(files), "projects": project_rows,
    "families": family_rows, "errors": errors}
(BASE / "remaining-storage-index.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

esc = html.escape
def size(n):
    return f"{n / 1024**3:.2f} GiB" if n >= 1024**3 else f"{n / 1024**2:.1f} MiB"

project_html = "".join(f'<tr><td>{i}</td><td>{esc(r["project"])}<small>{esc(r["path"])}</small></td><td>{size(r["bytes"])}</td><td>{r["files"]}</td><td>{size(r["archived_bytes"])}</td><td>{r["latest_date"]}</td></tr>' for i,r in enumerate(project_rows,1))
family_html = ""
for i, r in enumerate(family_rows, 1):
    status = "当前聊天·保留" if r["current_chat"] else ("全部已归档" if r["fully_archived"] else "含未归档记录")
    if r["cross_project"]:
        status += " · 跨项目需逐项核对"
    members = "".join(f'<li>{size(m["bytes"])} · {"归档" if m["archived"] else "会话"}<code>{esc(m["path"])}</code></li>' for m in sorted(r["members"],key=lambda m:m["bytes"],reverse=True))
    family_html += f'<tr class="family"><td>{i}</td><td><details><summary>{esc(r["title"])}</summary><p>根会话 ID：<code>{r["id"]}</code></p><ul>{members}</ul></details><small>{esc(r["project"])}</small></td><td>{size(r["bytes"])}</td><td>{r["files"]}</td><td>{r["latest_date"]}</td><td>{status}</td></tr>'
document = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Codex 占用清理索引</title><style>
body{font:15px/1.65 system-ui,sans-serif;background:#f6f5f1;color:#222b35;max-width:1250px;margin:40px auto;padding:0 24px}h1{font-size:30px;margin-bottom:8px}h2{margin-top:34px}p{color:#56616b}table{border-collapse:collapse;width:100%;background:white;border:1px solid #dadfdf}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid #e9ecec;vertical-align:top}th{background:#eaf0ee;white-space:nowrap}small{display:block;color:#63716f;font-size:12px;overflow-wrap:anywhere}td:nth-child(3),td:nth-child(4),td:nth-child(5){white-space:nowrap}code{display:block;font-size:12px;overflow-wrap:anywhere;white-space:normal}input{width:min(600px,90%);padding:12px;border:1px solid #bac6c2;border-radius:6px;margin:12px 0}summary{cursor:pointer}li{margin-bottom:10px}a{color:#226851}.note{padding:14px 18px;border-left:4px solid #5e8d79;background:#eef4f0}.wrap{overflow:auto}
</style><h1>Codex 占用清理索引</h1>'''
document += f'<p>统计时间：{esc(report["generated_at"])}（Asia/Taipei） · 会话文件 {len(files)} 份，共 {size(report["session_bytes"])}。</p>'
document += '<div class="note">本页只提供索引，不会删除文件。大小为逻辑文件长度，不包含数据库、图片、插件等。项目表与聊天表是同一批数据的两种视图，不能相加。聊天大小包含其子会话；已归档不代表已无价值，最近活动日期来自会话元数据，不能单独作为删除依据。</div>'
document += '<h2>建议从这里选</h2><p><strong>先检查 webgame-ui 与 islandmilfcode：</strong>两项会话合计约 2.63 GiB，最近活动分别为 8 月 24 日和 8 月 31 日。如果旧项目已经结束、不再需要继续这些聊天，可优先选择其中不需要的历史。</p>'
if any(r['project'] == '新卡1' for r in project_rows):
    document += '<p><strong>新卡1 按聊天挑选：</strong>近期仍有活动，可在下表逐项确认是否还需继续。</p>'
else:
    document += '<p>当前索引未发现「新卡1」会话文件。落第正在使用，建议保留近期任务。</p>'
document += '<p>非会话部分：.tmp 与顶层 cache 合计约 137 MiB，收益较小，尚未核实整目录可清；generated_images 约 187 MiB 为用户图片；plugins、skills、.sandbox-bin 及 SQLite 数据库不建议按文件直接删除。</p>'
document += '<p><a href="#projects">按项目</a> · <a href="#families">按聊天及子会话</a></p><h2 id="projects">按项目占用排序</h2><div class="wrap"><table><thead><tr><th>#</th><th>项目及路径</th><th>总大小</th><th>文件数</th><th>其中已归档</th><th>最近活动</th></tr></thead><tbody>' + project_html + '</tbody></table></div>'
document += '<h2 id="families">按聊天及子会话占用排序</h2><p>展开标题可查看对应会话文件。搜索支持项目名、聊天标题及会话 ID。</p><input id="filter" aria-label="搜索聊天" placeholder="搜索项目名 / 聊天标题 / ID"><div class="wrap"><table><thead><tr><th>#</th><th>聊天 / 项目</th><th>含子会话大小</th><th>文件数</th><th>最近活动</th><th>状态</th></tr></thead><tbody>' + family_html + '</tbody></table></div>'
document += '<script>document.getElementById("filter").addEventListener("input",function(){const q=this.value.toLowerCase();document.querySelectorAll(".family").forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q))})</script></html>'
(BASE / "清理索引.html").write_text(document, encoding="utf-8")
print(json.dumps({"files":report["files"],"session_bytes":report["session_bytes"],"projects":project_rows,
    "largest_families":[{k:v for k,v in f.items() if k!='members'} for f in family_rows[:18]],
    "largest_archived_families":[{k:v for k,v in f.items() if k!='members'} for f in family_rows if f['fully_archived']][:10],
    "errors":errors},ensure_ascii=False))
