from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
report = json.loads((assets / 'research/review/github-pages-avatar-check.json').read_text(encoding='utf-8'))
if not report['passed'] or report['total'] != 31:
    raise RuntimeError('Host verification did not pass; do not configure unverified URLs.')
verified = {item['id']:item for item in report['files']}
manifest_file = assets / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
for record in manifest['characters']:
    item = verified[record['id']]
    file = record.get('displayFile') or record['file']
    if item['file'] != file or hashlib.sha256((assets / file).read_bytes()).hexdigest() != item['sha256']:
        raise RuntimeError('Asset changed after remote verification: '+record['id'])
    record['imageUrl'] = item['url']
frame = verified['shieldFrame']
if manifest['shieldFrame']['file'] != frame['file'] or hashlib.sha256((assets / frame['file']).read_bytes()).hexdigest() != frame['sha256']:
    raise RuntimeError('Shield frame changed after remote verification.')
manifest['shieldFrame']['imageUrl'] = frame['url']
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Configured 30 character URLs and 1 frame URL from the verified GitHub Pages files.')
