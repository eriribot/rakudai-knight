from pathlib import Path
import hashlib
import json
import shutil
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[1]
REVISION = '612c51980549e179bb73ead699aa1c37680db08e'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

source = WORKSPACE / '落第骑士英雄谭 第十卷 gbk.txt'
raw = source.read_bytes()
try:
    decoded = raw.decode('utf-8-sig')
    encoding = 'utf-8-sig'
except UnicodeDecodeError:
    decoded = raw.decode('gb18030')
    encoding = 'gb18030'
text = decoded.replace('\r\n', '\n').replace('\r', '\n')
inputs = ROOT / 'inputs'
inputs.mkdir(parents=True, exist_ok=True)
(inputs / 'volume10.utf8.txt').write_text(text, encoding='utf-8', newline='\n')
(inputs / 'volume10.numbered.txt').write_text(''.join(f'{i:05d}\t{line}\n' for i, line in enumerate(text.splitlines(), 1)), encoding='utf-8', newline='\n')

existing = json.loads((WORKSPACE / 'output/chapter-v4/落第骑士英雄谭-v1.3.6-世界书.json').read_text(encoding='utf-8-sig'))
template = dict(next(iter(existing['entries'].values())))
template.update(key=[], keysecondary=[], comment='', content='', constant=False, uid=0, displayIndex=0)
write_json(inputs / 'entry-template.json', template)

skills = ROOT / 'skills'
local = WORKSPACE / '.agents/skills/character-visual-lore-dossier'
local_files = []
for item in sorted(local.rglob('*')):
    if item.is_file():
        relative = item.relative_to(local)
        target = skills / 'character-visual-lore-dossier' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        data = item.read_bytes()
        target.write_bytes(data)
        local_files.append({'path': str(relative).replace('\\', '/'), 'sha256': digest(data)})

headers = {'User-Agent': 'Codex-user-authorized-skill-ab'}
url = f'https://api.github.com/repos/LiarMTTT/TavernWeave/git/trees/{REVISION}?recursive=1'
with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
    tree = json.load(response)['tree']
paths = [row['path'] for row in tree if row['type'] == 'blob' and row['path'].startswith('skills/build-work-library/')]
paths += [
    'skills/consult-tavernweave-library/SKILL.md',
    'skills/consult-tavernweave-library/references/communication-and-guidance.md',
    'skills/consult-tavernweave-library/references/st-guides/A0_驾驭工程从零搭建检查单.md',
    'skills/tavern-card-builder/SKILL.md',
    'skills/tavern-card-builder/references/material-provenance.md',
    'skills/tavern-card-builder/references/lorebook-and-prompts.md',
]
remote_files = []
for path in paths:
    url = f'https://raw.githubusercontent.com/LiarMTTT/TavernWeave/{REVISION}/' + urllib.parse.quote(path)
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
        data = response.read()
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    remote_files.append({'path': path, 'sha256': digest(data)})

for branch in ['A', 'B', 'review']:
    (ROOT / branch).mkdir(exist_ok=True)

write_json(ROOT / 'manifest.json', {
    'created_at': datetime.now(timezone.utc).isoformat(),
    'experiment': 'Same novel volume, same task, two isolated native agents with inherited model settings',
    'source': {'original_path': str(source), 'decoding': encoding, 'raw_sha256': digest(raw), 'normalized_sha256': digest(text.encode('utf-8')), 'normalization': 'decode losslessly then CRLF/CR to LF; no corrections', 'characters': len(text), 'lines': len(text.splitlines())},
    'A': {'skill': 'build-work-library', 'revision': REVISION, 'files': remote_files},
    'B': {'skill': 'character-visual-lore-dossier', 'files': local_files},
    'scope': 'Only supplied volume 10; no web research, other volumes or old lorebook content; no image capability tested',
    'runtime_import_tested': False,
    'token_usage': 'not measured; do not infer from source character counts'
})
print(json.dumps({'root': str(ROOT), 'encoding': encoding, 'lines': len(text.splitlines()), 'characters': len(text), 'source_sha256': digest(text.encode('utf-8')), 'remote_files': len(remote_files), 'local_skill_files': len(local_files)}, ensure_ascii=False))
