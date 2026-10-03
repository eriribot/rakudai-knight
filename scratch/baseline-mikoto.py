from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
manifest = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
records = []
for person in manifest['characters']:
    file = person.get('displayFile') or person['file']
    image = assets / file
    records.append(dict(id=person['id'], file=file, sha256=hashlib.sha256(image.read_bytes()).hexdigest(), imageUrl=person.get('imageUrl', '')))
record = dict(characters=records, shieldFrame=manifest['shieldFrame'])
(assets / 'research/review/pre-mikoto-baseline.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
user_file = Path('C:/Users/eriri/AppData/Local/Temp/codex-clipboard-f465e8ad-fc86-4405-8608-be64c0a1d276.png')
user_copy = assets / 'research/user-supplied/mikoto-profile-screenshot.png'
user_copy.write_bytes(user_file.read_bytes())
with Image.open(user_file) as image:
    image.crop((28, 38, 448, 633)).save(assets / 'novel/mikoto-user-crop.png')
print(f'Preserved {len(records)} avatar hashes and URLs; saved user screenshot and clean crop.')
