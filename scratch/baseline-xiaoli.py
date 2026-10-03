from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
manifest = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
records = []
for person in manifest['characters']:
    file = person.get('displayFile') or person['file']
    records.append(dict(id=person['id'], file=file,
        sha256=hashlib.sha256((assets / file).read_bytes()).hexdigest(), imageUrl=person.get('imageUrl', '')))
record = dict(characters=records, shieldFrame=manifest['shieldFrame'])
(assets / 'research/review/pre-xiaoli-baseline.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
user_file = Path('C:/Users/eriri/AppData/Local/Temp/codex-clipboard-3c84be8a-a20b-4463-ac45-fc6930b43234.png')
(assets / 'research/user-supplied/xiaoli-original.png').write_bytes(user_file.read_bytes())
print(f'Preserved {len(records)} avatar hashes and URLs; saved user attachment unchanged.')
