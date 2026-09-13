"""Freeze the first submissions and hide skill labels from the content reviewer."""
from pathlib import Path
import hashlib
import json
import secrets

ROOT = Path(__file__).resolve().parents[1]
review = ROOT / 'review'
assert (review / 'source-benchmark.json').is_file(), 'Freeze source-only benchmark first'
map_path = review / 'label-map.json'
assert not map_path.exists(), 'Blind assignments are immutable once created'
arms = ['A', 'B']
secrets.SystemRandom().shuffle(arms)
mapping = {}

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

for label, arm in zip(['X', 'Y'], arms):
    folder = ROOT / arm
    book = read(folder / 'worldbook.json')
    evidence = read(folder / 'evidence.json')
    if isinstance(evidence, dict):
        rows = [evidence[key] for key in ['claims', 'evidence', 'records', 'facts'] if isinstance(evidence.get(key), list)]
        assert len(rows) == 1
        evidence = rows[0]
    sanitized = []
    for index, original in enumerate(evidence, 1):
        item = dict(original)
        item['id'] = f'{label}-{index:03}'
        sanitized.append(item)
    entries = [{key: entry[key] for key in ['uid', 'comment', 'key', 'content']} for entry in book['entries'].values()]
    payload = {'sample': label, 'entries': entries, 'evidence': sanitized}
    destination = review / 'blind' / (label + '.json')
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    mapping[label] = {
        'arm': arm,
        'original_files': {name: hashlib.sha256((folder / name).read_bytes()).hexdigest() for name in ['worldbook.md', 'worldbook.json', 'evidence.json', 'process.md']},
        'blind_sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
    }
map_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'created': ['review/blind/X.json', 'review/blind/Y.json'], 'benchmark_sha256': hashlib.sha256((review / 'source-benchmark.json').read_bytes()).hexdigest()}, ensure_ascii=False))
