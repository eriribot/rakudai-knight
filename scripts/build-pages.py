#!/usr/bin/env python3
"""Build Pages from tracked files and a byte-verified, original OP asset."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
MAX_SITE_BYTES = 950 * 1024 * 1024
CHUNK_BYTES = 4 * 1024 * 1024


def safe_relative(value, *, directory=False):
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise ValueError(f"Unsafe relative path: {value!r}")
    name = value[:-1] if directory and value.endswith("/") else value
    parts = name.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError(f"Unsafe relative path: {value!r}")
    path = PurePosixPath(name)
    if path.is_absolute():
        raise ValueError(f"Absolute path is not allowed: {value!r}")
    return path


def reject_links(path):
    """Reject symlinks and Windows junctions, including parent directories."""
    for item in (path, *path.parents):
        if item.is_symlink() or getattr(item, "is_junction", lambda: False)():
            raise ValueError(f"Symlink/junction is not allowed: {item}")


def load_manifest(path):
    manifest = json.loads(path.read_text(encoding="utf-8"))
    size = manifest.get("size")
    if type(size) is not int or not 0 < size < MAX_SITE_BYTES:
        raise ValueError("Manifest size must be a positive integer below 950 MiB")
    digest = manifest.get("sha256")
    if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        raise ValueError("Manifest sha256 must contain 64 lowercase hex characters")
    url = manifest.get("url")
    parsed = urlsplit(url) if isinstance(url, str) else None
    if parsed is None or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Manifest URL must be an HTTPS URL without embedded credentials")
    prefixes = manifest.get("exclude_prefixes")
    if not isinstance(prefixes, list) or any(not isinstance(p, str) or not p.endswith("/") for p in prefixes):
        raise ValueError("exclude_prefixes must be a list of directory paths ending in /")
    for prefix in prefixes:
        safe_relative(prefix, directory=True)
    if len(set(prefixes)) != len(prefixes):
        raise ValueError("Duplicate excluded directory")
    return manifest


def build_plan(root, manifest):
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root)
    files = []
    total = manifest["size"]
    excluded_count = 0
    for raw in tracked.split(b"\0"):
        if not raw:
            continue
        relative = safe_relative(raw.decode("utf-8"))
        name = relative.as_posix()
        # Excluded paths are not build inputs. Do not traverse local-only
        # junctions inside excluded research or backup directories.
        if relative.parts[0].casefold() in {".git", ".github"} or name.startswith(tuple(manifest["exclude_prefixes"])):
            excluded_count += 1
            continue
        # The verified Release asset owns this URL, even if an older OP is tracked.
        if name.casefold() == "op.mp4":
            excluded_count += 1
            continue
        source = root.joinpath(*relative.parts)
        reject_links(source)
        if not source.resolve().is_relative_to(root):
            raise ValueError(f"Tracked path escapes repository: {name}")
        details = source.stat(follow_symlinks=False)
        if not stat.S_ISREG(details.st_mode):
            raise ValueError(f"Tracked source is not a regular file: {name}")
        files.append((relative, source, details.st_size))
        total += details.st_size
    if total > MAX_SITE_BYTES:
        raise ValueError(f"Site would be {total / 1024**2:.2f} MiB; limit is 950 MiB")
    if not any(relative.as_posix() == ".nojekyll" for relative, _, _ in files):
        raise ValueError("Tracked .nojekyll is required to preserve existing static paths")
    return files, total, excluded_count


def copy_verified_op(stream, output, manifest):
    temporary = output / ".op.mp4.part"
    digest = hashlib.sha256()
    size = 0
    with temporary.open("xb") as target:
        while chunk := stream.read(CHUNK_BYTES):
            size += len(chunk)
            if size > manifest["size"]:
                raise ValueError("OP exceeds the byte length recorded in pages-op.json")
            digest.update(chunk)
            target.write(chunk)
    if size != manifest["size"] or digest.hexdigest() != manifest["sha256"]:
        raise ValueError(f"OP verification failed: size={size}, sha256={digest.hexdigest()}")
    destination = output / "op.mp4"
    if destination.exists():
        raise ValueError(f"Refusing to replace an existing file: {destination}")
    temporary.rename(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="_site", help="New or empty output directory; default: _site")
    parser.add_argument("--op-file", type=Path, help="Use a local original V6 file instead of downloading it")
    parser.add_argument("--dry-run", action="store_true", help="Validate paths and planned size without copying or downloading")
    args = parser.parse_args()
    output = Path(os.path.abspath(args.output))
    reject_links(output)
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError(f"Output must be a new or empty directory; nothing was deleted: {output}")
    manifest = load_manifest(ROOT / "pages-op.json")
    files, total, excluded_count = build_plan(ROOT, manifest)
    if args.op_file:
        local_op = Path(os.path.abspath(args.op_file))
        reject_links(local_op)
        details = local_op.stat(follow_symlinks=False)
        if not stat.S_ISREG(details.st_mode) or details.st_size != manifest["size"]:
            raise ValueError("Local OP is not a regular file of the expected byte length")
    summary = {
        "output": str(output),
        "tracked_files_to_copy": len(files),
        "excluded_tracked_files": excluded_count,
        "site_bytes_including_op": total,
        "site_MiB_including_op": round(total / 1024**2, 2),
        "op_source": str(args.op_file) if args.op_file else manifest["url"],
        "op_sha256": manifest["sha256"],
    }
    if args.dry_run:
        print(json.dumps({"dry_run": True, **summary}, ensure_ascii=False, indent=2))
        return
    output.mkdir(parents=True, exist_ok=True)
    if args.op_file:
        with local_op.open("rb") as stream:
            copy_verified_op(stream, output, manifest)
    else:
        request = Request(manifest["url"], headers={"User-Agent": "rakudai-knight-pages-builder"})
        with urlopen(request, timeout=60) as stream:
            copy_verified_op(stream, output, manifest)
    for relative, source, expected_size in files:
        reject_links(source)
        destination = output.joinpath(*relative.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            raise ValueError(f"Refusing to overwrite an output file: {destination}")
        shutil.copy2(source, destination, follow_symlinks=False)
        if destination.is_symlink() or destination.stat().st_size != expected_size:
            raise ValueError(f"Source changed during build: {relative}")
    print(json.dumps({"built": True, **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Pages build failed: {error}", file=sys.stderr)
        sys.exit(1)
