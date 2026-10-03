import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
index = json.loads((assets / 'research/epub/index.json').read_text(encoding='utf-8'))
manifest_file = assets / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
fit_file = root / 'scripts/黑白ADV轮盘终端/avatar-fit.json'
fits = json.loads(fit_file.read_text(encoding='utf-8'))
(assets / 'novel').mkdir(exist_ok=True)

people = [
    ('iris', '艾莉丝·阿斯卡里德', 'tw-11', '003_.jpg', 'iris.jpg',
     ['艾莉絲·阿斯卡里德', '艾莉丝·格尔', '艾莉絲·格爾', '阿斯卡里德', 'Iris Ascarid', 'Iris Gaule', 'アイリス・アスカリッド', 'アイリス・ゴール', '黑骑士艾莉丝', '黑騎士艾莉絲', '艾莉丝·格尔·阿斯卡里德', '艾莉絲·格爾·阿斯卡里德'],
     {'levelEyes': [[1046, 299], [1174, 342]], 'window': [945, 165, 600, 855], 'eye': [1155, 442], 'protect': [[1085, 442], [1224, 442], [1170, 607]], 'eyeTarget': 0.39, 'eyeTargetX': 0.35}),
    ('uri', '多多良幽衣', 'tw-12', '003.jpg', 'uri.jpg',
     ['多多良 幽衣', '幽衣'],
     {'window': [256, 215, 470, 775], 'eye': [503, 497], 'protect': [[435, 510], [554, 475], [505, 610]], 'eyeTarget': 0.46, 'eyeTargetX': 0.53}),
    ('or_gaule', '欧尔·格尔', 'tw-15', '004.jpg', 'or-gaule-wallenstein.jpg',
     ['歐爾·格爾', '欧尔雷斯·格尔', '歐爾雷斯·格爾', '傀儡王'],
     {'window': [145, 50, 620, 800], 'eye': [377, 462], 'protect': [[240, 532], [457, 402], [432, 670]], 'eyeTarget': 0.5, 'eyeTargetX': 0.37}),
    ('wallenstein', '华伦斯坦', 'tw-15', '004.jpg', 'or-gaule-wallenstein.jpg',
     ['華倫斯坦'],
     {'window': [1060, 15, 420, 740], 'eye': [1305, 217], 'protect': [[1206, 244], [1410, 192], [1313, 450]], 'eyeTarget': 0.35})
]
for identifier, name, book_id, member_name, filename, aliases, fit in people:
    book = next(b for b in index['books'] if b['id'] == book_id)
    image = next(i for i in book['images'] if i['member'].endswith('/' + member_name))
    relative = 'novel/' + filename
    shutil.copyfile(root / image['file'], assets / relative)
    character = {'id': identifier, 'name': name, 'aliases': aliases, 'file': relative,
                 'sourceUrl': '', 'sourcePage': '', 'sourceEpub': book['epub'], 'sourceMember': image['member'],
                 'hasShieldFrame': False, 'sourceStyle': 'novel-color-illustration',
                 'sourceStatus': 'verified-local-epub-no-original-shield',
                 'width': image['width'], 'height': image['height'], 'sha256': image['sha256'], 'imageUrl': '',
                 'identityEvidence': 'research/epub/character-evidence.json#' + identifier}
    if identifier == 'or_gaule':
        character['imageVariant'] = 'childhood-memory'
    if identifier == 'iris':
        character['imageVariant'] = 'white-green-qipao'
    manifest['characters'] = [c for c in manifest['characters'] if c['id'] != identifier] + [character]
    fits['characters'][identifier] = fit
nagi = next(c for c in manifest['characters'] if c['id'] == 'nagi')
nagi['aliases'] = [a for a in nagi['aliases'] if a not in ['艾莉丝', '艾莉絲']]
for alias in ['有栖院艾莉丝', '有栖院艾莉絲', 'Alice Arisuin']:
    if alias not in nagi['aliases']:
        nagi['aliases'].append(alias)
manifest['ambiguousAliases'] = [{'aliases': ['艾莉丝', '艾莉絲'], 'characters': ['nagi', 'iris'],
                                'handling': 'Unbound. Use 有栖院凪 or 艾莉丝·阿斯卡里德 to select an image.'}]
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
fit_file.write_text(json.dumps(fits, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Added 4 verified novel characters; ambiguous bare names stay unbound.')
