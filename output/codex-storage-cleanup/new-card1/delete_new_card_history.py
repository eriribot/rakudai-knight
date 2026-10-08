"""Scoped deletion of the audited New Card 1 Codex histories, preserving project/media files."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE.parent))
import delete_project_history as shared

ROOT = r"E:\web\新卡1"
EXPECTED_FILES = 218
EXPECTED_IDS = 214
EXPECTED_BYTES = 3881942131


def in_scope(cwd):
    return shared.norm(cwd) == shared.norm(ROOT) or shared.norm(cwd).startswith(shared.norm(ROOT) + "\\")


def check_file(item, original_mtime=None):
    path = shared.safe_rollout(item["path"])
    stat = path.stat()
    if stat.st_size != item["bytes"] or (original_mtime is not None and stat.st_mtime_ns != original_mtime):
        raise RuntimeError("Candidate changed since its audit: " + str(path))
    with path.open("rb") as stream:
        record = json.loads(stream.readline(2 * 1024 * 1024))
    meta = record.get("payload", {})
    if record.get("type") != "session_meta" or meta.get("id") != item["id"] or not in_scope(meta.get("cwd", "")):
        raise RuntimeError("Candidate identity/project mismatch: " + str(path))
    return stat.st_mtime_ns


def state_snapshot():
    with closing(shared.connect_db("state_5.sqlite")) as connection:
        rows = {row["id"]: dict(row) for row in connection.execute("SELECT id,cwd,rollout_path,updated_at FROM threads")}
        edges = list(connection.execute("SELECT parent_thread_id,child_thread_id FROM thread_spawn_edges"))
    return rows, edges


def preflight():
    items = json.loads((BASE / "candidates.json").read_text(encoding="utf-8-sig"))["candidates"]
    ids = {item["id"] for item in items}
    paths = {shared.norm(item["path"]) for item in items}
    if len(items) != EXPECTED_FILES or len(paths) != EXPECTED_FILES or len(ids) != EXPECTED_IDS:
        raise RuntimeError("Unexpected candidate count")
    if shared.CURRENT in ids or sum(item["bytes"] for item in items) != EXPECTED_BYTES:
        raise RuntimeError("Unexpected candidate set or total size")
    mtimes = {shared.norm(item["path"]): check_file(item) for item in items}
    rows, edges = state_snapshot()
    db_ids = {key for key, row in rows.items() if in_scope(row["cwd"])}
    if db_ids != ids:
        raise RuntimeError("Current database membership differs from reviewed candidates")
    for thread_id in ids:
        row = rows[thread_id]
        if row["updated_at"] > time.time() - 86400:
            raise RuntimeError("A candidate was active in the past day")
        matching_paths = {shared.norm(item["path"]) for item in items if item["id"] == thread_id}
        if shared.norm(row["rollout_path"]) not in matching_paths:
            raise RuntimeError("Database canonical rollout not present in manifest")
    closure = set(ids)
    while True:
        new = closure | {child for parent, child in edges if parent in closure}
        if new == closure:
            break
        closure = new
    if closure != ids:
        raise RuntimeError("Deletion would include an out-of-scope descendant")
    roots = sorted(ids - {child for parent, child in edges if parent in ids})
    reached = set(roots)
    while True:
        expanded = reached | {child for parent, child in edges if parent in reached}
        if expanded == reached:
            break
        reached = expanded
    if reached != ids:
        raise RuntimeError("Root deletion coverage does not match candidates")
    canonical = {shared.norm(rows[thread_id]["rollout_path"]) for thread_id in ids}
    return items, ids, roots, mtimes, paths - canonical


def verify_database_deleted(ids):
    rows, _ = state_snapshot()
    remaining = sorted(ids & rows.keys())
    with closing(shared.connect_db("thread_history_1.sqlite")) as connection:
        marks = ",".join("?" for _ in ids)
        history_rows = {table: connection.execute(f"SELECT count(*) FROM {table} WHERE thread_id IN ({marks})", sorted(ids)).fetchone()[0]
            for table in ["thread_items", "thread_turns", "thread_history_projection_state", "thread_realtime_items"]}
    if remaining or any(history_rows.values()):
        raise RuntimeError("API deletion left associated database records: " + json.dumps({"remaining": remaining, "history_rows": history_rows}))
    return history_rows


def run(delete):
    items, ids, roots, mtimes, duplicate_paths = preflight()
    print(json.dumps({"preflight": {"files": len(items), "unique_ids": len(ids), "bytes": EXPECTED_BYTES,
        "root_thread_count": len(roots), "extra_rollout_files": len(duplicate_paths)}, "delete_requested": delete}), flush=True)
    if not delete:
        return
    before = shared.inventory()
    free_before = shared.disk_free()
    rpc = shared.Rpc()
    completed = []
    removed_duplicates = []
    try:
        rpc.call("initialize", {"clientInfo": {"name": "codex_storage_cleanup", "title": "Scoped New Card 1 history cleanup", "version": "1.0"}})
        rpc.send("initialized", {})
        for thread_id in sorted(ids):
            thread = rpc.call("thread/read", {"threadId": thread_id, "includeTurns": False})["thread"]
            if thread.get("id") != thread_id or not in_scope(thread.get("cwd", "")):
                raise RuntimeError("App server returned an unexpected project/identity")
            if thread.get("status", {}).get("type") == "active":
                raise RuntimeError("Refusing to delete an active thread")
        # Recheck live database scope after the RPC reads and before the first deletion.
        rechecked = preflight()
        if rechecked[1] != ids:
            raise RuntimeError("Scope changed during preflight")
        roots = rechecked[2]
        for thread_id in roots:
            rpc.call("thread/delete", {"threadId": thread_id})
            completed.append(thread_id)
            print(json.dumps({"deleted_root": thread_id}), flush=True)
        if rpc.deleted - ids:
            raise RuntimeError("Server reported an out-of-scope deletion")
        verify_database_deleted(ids)
        residuals = [item for item in items if Path(item["path"]).exists()]
        for item in residuals:
            path_key = shared.norm(item["path"])
            if path_key not in duplicate_paths:
                raise RuntimeError("API left a canonical rollout; refusing manual removal")
            check_file(item, mtimes[path_key])
        # Only historical extra copies from the explicit manifest can reach this step.
        # No directory recursion, wildcard deletion, project-file deletion, or media deletion.
        for item in residuals:
            check_file(item, mtimes[shared.norm(item["path"])])
            Path(item["path"]).unlink()
            removed_duplicates.append(item["path"])
    finally:
        rpc.close()
        (BASE / "api-deletion-receipt.json").write_text(json.dumps({"completed_roots": completed,
            "notified_deleted_ids": sorted(rpc.deleted), "removed_duplicate_rollouts": removed_duplicates},
            ensure_ascii=False, indent=2), encoding="utf-8")
    after = shared.inventory()
    remaining_files = [item["path"] for item in items if Path(item["path"]).exists()]
    history_rows = verify_database_deleted(ids)
    allowed = {shared.norm(item["path"]) for item in items}
    session_prefixes = [shared.norm(shared.DATA / x) + "\\" for x in ["sessions", "archived_sessions"]]
    removed_sessions = {path for path in before if path not in after and any(path.startswith(prefix) for prefix in session_prefixes)}
    media_prefixes = [shared.norm(shared.DATA / x) + "\\" for x in ["generated_images", "visualizations", "attachments"]]
    missing_media = [path for path in before if path not in after and any(path.startswith(prefix) for prefix in media_prefixes)]
    report = {"project": ROOT, "candidate_files": len(items), "unique_thread_ids": len(ids),
        "deleted_rollout_bytes": sum(before.get(path, 0) for path in allowed if path not in after),
        "codex_bytes_before": sum(before.values()), "codex_bytes_after": sum(after.values()),
        "c_free_bytes_before": free_before, "c_free_bytes_after": shared.disk_free(),
        "remaining_candidate_files": remaining_files, "remaining_history_rows": history_rows,
        "out_of_scope_removed_sessions": sorted(removed_sessions - allowed), "missing_preserved_media": missing_media,
        "removed_duplicate_rollouts": len(removed_duplicates)}
    (BASE / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if remaining_files or report["out_of_scope_removed_sessions"] or missing_media:
        raise RuntimeError("Post-deletion verification needs attention; see result.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--delete", action="store_true")
    run(parser.parse_args().delete)
