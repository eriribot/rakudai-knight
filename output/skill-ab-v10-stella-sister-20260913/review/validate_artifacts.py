"""Check A/B file and quotation integrity; does not score semantic correctness."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

source_bytes = (ROOT / 'inputs/volume10.utf8.txt').read_bytes()
source_text = source_bytes.decode('utf-8')
lines = source_text.splitlines()
manifest = load(ROOT / 'manifest.json')
template = load(ROOT / 'inputs/entry-template.json')

integrity = {
    'normalized_source_unchanged': sha(source_bytes) == manifest['source']['normalized_sha256'],
    'original_source_unchanged': sha(Path(manifest['source']['original_path']).read_bytes()) == manifest['source']['raw_sha256'],
    'frozen_skills_unchanged': True,
}
for arm in ['A', 'B']:
    for item in manifest[arm]['files']:
        path = ROOT / item['path'] if arm == 'A' else ROOT / 'skills/character-visual-lore-dossier' / item['path']
        if sha(path.read_bytes()) != item['sha256']:
            integrity['frozen_skills_unchanged'] = False

report = {'scope': 'JSON shape, complete quote occurrence, line ranges and file integrity only; no semantic certification or live import', 'integrity': integrity, 'arms': {}}
for arm in ['A', 'B']:
    folder = ROOT / arm
    result = {'errors': [], 'warnings': [], 'files': {}, 'quotes': []}
    report['arms'][arm] = result
    for name in ['worldbook.md', 'worldbook.json', 'evidence.json', 'process.md']:
        path = folder / name
        if not path.is_file():
            result['errors'].append(f'Missing {name}')
        else:
            data = path.read_bytes()
            result['files'][name] = {'bytes': len(data), 'sha256': sha(data)}
    if result['errors']:
        continue
    try:
        book = load(folder / 'worldbook.json')
        entries = book['entries']
        assert isinstance(entries, dict), 'entries must be an object'
        result['entry_count'] = len(entries)
        assert 1 <= len(entries) <= 4, 'Expected 1–4 entries'
        result['body_characters'] = sum(len(item['content']) for item in entries.values())
        for key, item in entries.items():
            assert str(item['uid']) == key, f'UID mismatch {key}'
            assert isinstance(item['content'], str) and item['content'].strip(), f'Empty content {key}'
            assert isinstance(item['key'], list) and item['key'], f'Empty keywords {key}'
            assert all(isinstance(word, str) and word.strip() for word in item['key']), f'Invalid keyword {key}'
            missing = set(template) - set(item)
            if missing:
                result['errors'].append(f'{key} missing template fields {sorted(missing)}')
        if result['body_characters'] > 3700:
            result['warnings'].append('Body exceeds approximate 3500-character shared scope')
        citations = load(folder / 'evidence.json')
        if isinstance(citations, dict):
            candidates = [citations.get(key) for key in ['claims', 'evidence', 'records', 'facts'] if isinstance(citations.get(key), list)]
            assert len(candidates) == 1, 'Ambiguous evidence container'
            citations = candidates[0]
        assert isinstance(citations, list), 'Evidence must be a list or a single named list container'
        result['claim_rows'] = len(citations)
        seen_ids = set()
        for index, claim in enumerate(citations):
            cid = claim.get('id', f'row-{index}')
            if cid in seen_ids:
                result['errors'].append(f'Duplicate claim ID {cid}')
            seen_ids.add(cid)
            if claim.get('status') not in ['direct', 'inference', 'uncertain']:
                result['errors'].append(f'Invalid status {cid}')
            evidence = claim.get('evidence') if isinstance(claim.get('evidence'), list) else [claim]
            for part in evidence:
                quote = part.get('quote', '')
                start, end = part.get('line_start'), part.get('line_end')
                valid_range = isinstance(start, int) and isinstance(end, int) and 1 <= start <= end <= len(lines)
                exact_anywhere = isinstance(quote, str) and bool(quote) and quote in source_text
                exact_in_range = valid_range and exact_anywhere and quote in '\n'.join(lines[start-1:end])
                row = {'id': cid, 'line_start': start, 'line_end': end, 'exact_anywhere': exact_anywhere, 'exact_in_range': exact_in_range}
                result['quotes'].append(row)
                if not exact_in_range:
                    result['errors'].append(f'Quote or range mismatch {cid}: {start}–{end}')
        result['quote_checks'] = len(result['quotes'])
        result['quote_passes'] = sum(row['exact_in_range'] for row in result['quotes'])
    except (ValueError, KeyError, TypeError, AssertionError) as exc:
        result['errors'].append(str(exc))
    result['structural_pass'] = not result['errors']

out = ROOT / 'review/structural-validation.json'
out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
