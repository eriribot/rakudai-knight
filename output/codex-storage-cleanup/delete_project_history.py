"""Delete only the audited Codex histories through the official thread/delete API."""
import argparse
import ctypes
import json
import ntpath
import os
from pathlib import Path
import queue
import sqlite3
import subprocess
import threading
import time

BASE = Path(__file__).resolve().parent
DATA = Path(r"C:\Users\eriri\.codex")
BINARY = DATA / "plugins" / ".plugin-appserver" / "codex.exe"
ROOTS = [r"F:\PSV", r"F:\psvdecoder", r"F:\aidarwprompt"]
CURRENT = "01a11982-24a0-7021-bbc9-da764a97a5fe"
EXPECTED_COUNT = 22
EXPECTED_BYTES = 541890003


def norm(value):
    value = str(value)
    if value.startswith("\\\\?\\"):
        value = value[4:]
    return ntpath.normcase(ntpath.normpath(value))


def in_scope(cwd):
    return any(norm(cwd) == norm(root) or norm(cwd).startswith(norm(root) + "\\") for root in ROOTS)


def connect_db(name):
    connection = sqlite3.connect((DATA / name).as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def safe_rollout(path):
    path = Path(path)
    allowed = [DATA / "sessions", DATA / "archived_sessions"]
    if not any(norm(path).startswith(norm(root) + "\\") for root in allowed):
        raise RuntimeError("Rollout path outside the two authorized session directories")
    if path.suffix != ".jsonl":
        raise RuntimeError("Unexpected rollout extension")
    for item in [path, *path.parents]:
        if item.stat().st_file_attributes & 1024:
            raise RuntimeError("Refusing a reparse point: " + str(item))
        if norm(item) == norm(DATA):
            break
    if norm(path.resolve()) != norm(path):
        raise RuntimeError("Rollout resolves outside its declared location")
    return path


def inventory():
    result = {}
    pending = [DATA]
    while pending:
        folder = pending.pop()
        with os.scandir(folder) as entries:
            for entry in entries:
                stat = entry.stat(follow_symlinks=False)
                if stat.st_file_attributes & 1024:
                    continue
                if entry.is_dir(follow_symlinks=False):
                    pending.append(Path(entry.path))
                elif entry.is_file(follow_symlinks=False):
                    result[norm(entry.path)] = stat.st_size
    return result


def disk_free():
    free = ctypes.c_ulonglong()
    if not ctypes.windll.kernel32.GetDiskFreeSpaceExW("C:\\", ctypes.byref(free), None, None):
        raise ctypes.WinError()
    return free.value


def preflight():
    manifest = json.loads((BASE / "candidates.json").read_text(encoding="utf-8-sig"))
    items = manifest["candidates"]
    ids = {item["id"] for item in items}
    if len(items) != EXPECTED_COUNT or len(ids) != EXPECTED_COUNT or CURRENT in ids:
        raise RuntimeError("Unexpected candidate identities")
    if sum(item["bytes"] for item in items) != EXPECTED_BYTES:
        raise RuntimeError("Candidate size differs from the reviewed manifest")
    for item in items:
        path = safe_rollout(item["path"])
        if path.stat().st_size != item["bytes"]:
            raise RuntimeError("A candidate changed since the audit: " + str(path))
        with path.open("rb") as stream:
            record = json.loads(stream.readline(2 * 1024 * 1024))
        meta = record.get("payload", {})
        if record.get("type") != "session_meta" or meta.get("id") != item["id"] or not in_scope(meta.get("cwd", "")):
            raise RuntimeError("Session identity or project mismatch")
    with connect_db("state_5.sqlite") as connection:
        rows = {row["id"]: dict(row) for row in connection.execute("SELECT id,cwd,rollout_path,updated_at FROM threads")}
        edges = list(connection.execute("SELECT parent_thread_id,child_thread_id FROM thread_spawn_edges"))
    db_targets = {key for key, row in rows.items() if in_scope(row["cwd"])}
    if db_targets != ids:
        raise RuntimeError("Database project membership differs from the reviewed file manifest")
    for item in items:
        row = rows[item["id"]]
        if norm(row["rollout_path"]) != norm(item["path"]) or row["updated_at"] > time.time() - 86400:
            raise RuntimeError("Candidate path changed or thread was recently active")
    closure = set(ids)
    while True:
        expanded = closure | {child for parent, child in edges if parent in closure}
        if expanded == closure:
            break
        closure = expanded
    if closure != ids:
        raise RuntimeError("Deletion would cascade outside the reviewed candidates")
    children = {child for parent, child in edges if parent in ids and child in ids}
    roots = sorted(ids - children)
    if not roots:
        raise RuntimeError("No root threads found")
    return items, ids, roots


class Rpc:
    def __init__(self):
        self.process = subprocess.Popen([str(BINARY), "app-server", "--stdio"], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
            creationflags=subprocess.CREATE_NO_WINDOW)
        self.messages = queue.Queue()
        self.errors = []
        self.next_id = 0
        self.deleted = set()
        threading.Thread(target=self.read_messages, daemon=True).start()
        threading.Thread(target=self.read_errors, daemon=True).start()

    def read_messages(self):
        for line in self.process.stdout:
            try:
                self.messages.put(json.loads(line))
            except json.JSONDecodeError:
                pass
        self.messages.put({"eof": True})

    def read_errors(self):
        for line in self.process.stderr:
            self.errors.append(line[-1000:])
            self.errors = self.errors[-12:]

    def send(self, method, params, request_id=None):
        message = {"method": method, "params": params}
        if request_id is not None:
            message["id"] = request_id
        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()

    def call(self, method, params):
        self.next_id += 1
        current_id = self.next_id
        self.send(method, params, current_id)
        deadline = time.monotonic() + 60
        while True:
            try:
                message = self.messages.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty:
                raise RuntimeError("RPC timed out: " + method)
            if message.get("eof"):
                raise RuntimeError("App server exited before replying: " + "".join(self.errors))
            if message.get("method") == "thread/deleted":
                self.deleted.add(message["params"]["threadId"])
            if message.get("id") == current_id:
                if "error" in message:
                    raise RuntimeError(json.dumps(message["error"], ensure_ascii=False))
                return message["result"]

    def close(self):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=5)


def run(delete):
    items, ids, roots = preflight()
    summary = {"files": len(items), "bytes": sum(x["bytes"] for x in items), "root_threads": roots}
    print(json.dumps({"preflight": summary, "delete_requested": delete}), flush=True)
    if not delete:
        return
    before = inventory()
    free_before = disk_free()
    rpc = Rpc()
    completed = []
    try:
        rpc.call("initialize", {"clientInfo": {"name": "codex_storage_cleanup", "title": "Scoped project history cleanup", "version": "1.0"}})
        rpc.send("initialized", {})
        # Verify the server sees the exact same project membership before deleting anything.
        for thread_id in sorted(ids):
            thread = rpc.call("thread/read", {"threadId": thread_id, "includeTurns": False})["thread"]
            if thread.get("id") != thread_id or not in_scope(thread.get("cwd", "")):
                raise RuntimeError("App server returned an unexpected thread identity")
            if thread.get("status", {}).get("type") == "active":
                raise RuntimeError("Refusing to delete an active thread")
        for thread_id in roots:
            rpc.call("thread/delete", {"threadId": thread_id})
            completed.append(thread_id)
            print(json.dumps({"deleted_root": thread_id}), flush=True)
        if rpc.deleted - ids:
            raise RuntimeError("Server reported a deletion outside the reviewed candidates")
    finally:
        rpc.close()
        (BASE / "api-deletion-receipt.json").write_text(json.dumps({"completed_roots": completed,
            "notified_deleted_ids": sorted(rpc.deleted)}, indent=2), encoding="utf-8")
    after = inventory()
    remaining_files = [item["path"] for item in items if Path(item["path"]).exists()]
    with connect_db("state_5.sqlite") as connection:
        remaining_ids = [row[0] for row in connection.execute("SELECT id FROM threads") if row[0] in ids]
    with connect_db("thread_history_1.sqlite") as connection:
        marks = ",".join("?" for _ in ids)
        history_rows = {table: connection.execute(f"SELECT count(*) FROM {table} WHERE thread_id IN ({marks})", sorted(ids)).fetchone()[0]
            for table in ["thread_items", "thread_turns", "thread_history_projection_state", "thread_realtime_items"]}
    allowed_paths = {norm(item["path"]) for item in items}
    removed_sessions = [path for path in before if path not in after and
        any(path.startswith(norm(DATA / name) + "\\") for name in ["sessions", "archived_sessions"])]
    report = {"candidate_files": len(items), "deleted_rollout_bytes": sum(before.get(p, 0) for p in allowed_paths if p not in after),
        "codex_bytes_before": sum(before.values()), "codex_bytes_after": sum(after.values()),
        "c_free_bytes_before": free_before, "c_free_bytes_after": disk_free(),
        "remaining_candidate_files": remaining_files, "remaining_state_ids": remaining_ids,
        "remaining_history_rows": history_rows, "out_of_scope_removed_sessions": sorted(set(removed_sessions) - allowed_paths)}
    (BASE / "result.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report), flush=True)
    if remaining_files or remaining_ids or any(history_rows.values()) or report["out_of_scope_removed_sessions"]:
        raise RuntimeError("Post-deletion verification needs attention; see result.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--delete", action="store_true")
    run(parser.parse_args().delete)
