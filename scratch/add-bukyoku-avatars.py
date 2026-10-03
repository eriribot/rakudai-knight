from pathlib import Path
import hashlib
import json
import zipfile
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
book = '39688/[台版]落第骑士英雄谭 09.epub'
with zipfile.ZipFile(root / book) as epub:
    (assets / 'novel/rai-original.jpg').write_bytes(epub.read('OEBPS/Images/007.jpg'))
manifest_path = assets / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
records = [
    dict(id='rai', name='碎城雷', aliases=['IKADSUCHI SAIJO', 'Ikadsuchi Saijo'],
         file='novel/rai-original.jpg', sourceMember='OEBPS/Images/007.jpg'),
    dict(id='momiji', name='浅木椛', aliases=['淺木椛', '浅桦', '淺樺', 'Momiji Asagi', 'MOMIJI ASAGI'],
         file='novel/byakuya-momiji.jpg', sourceMember='OEBPS/Images/003.jpg'),
    dict(id='byakuya', name='城之崎白夜', aliases=['白夜', 'Byakuya Jogasaki', 'BYAKUYA JOGASAKI'],
         file='novel/byakuya-momiji.jpg', sourceMember='OEBPS/Images/003.jpg'),
]
for item in records:
    if any(c['id'] == item['id'] for c in manifest['characters']):
        raise RuntimeError(f"Existing entry: {item['id']}; do not overwrite settings")
    source = assets / item['file']
    with Image.open(source) as im:
        width, height = im.size
    item.update(sourceEpub=book, sourceUrl='', sourcePage='', hasShieldFrame=False,
                sourceStyle='novel-color-illustration', sourceStatus='verified-local-epub-no-original-shield',
                width=width, height=height, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                imageUrl='', identityEvidence=f"research/epub/character-evidence.json#{item['id']}")
    if item['id'] == 'rai':
        item['sourceStyle'] = 'novel-monochrome-illustration'
        item['sourceStatus'] = 'verified-local-epub-ai-colorized'
        item['colorization'] = dict(type='ai-colorized-derivative', mode='built-in',
            file='novel/rai-colorized.png', record='research/epub/rai-colorization.json',
            colorReferenceFile='research/user-supplied/rai-anime-reference.png',
            note='保留第9卷小說人物，使用用户提供的小说裁片上色；动画截图仅作配色参考。非官方原生彩图。')
    if item['id'] == 'momiji':
        item['aliasNotes'] = {'浅桦/淺樺': '用户在本次对话中使用的简称，仅用于头像匹配；标准姓名为浅木椛。'}
    manifest['characters'].append(item)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
evidence_path = assets / 'research/epub/character-evidence.json'
evidence = json.loads(evidence_path.read_text(encoding='utf-8'))
bukyoku = json.loads((assets / 'research/epub/bukyoku-evidence.json').read_text(encoding='utf-8'))
for record in bukyoku['characters']:
    if record['name']=='碎城雷':
        record['id']='rai'
    if any(c['id']==record['id'] for c in evidence['characters']):
        raise RuntimeError('Existing evidence id: '+record['id'])
    if record['id']=='rai':
        record['colorizationRecord']='research/epub/rai-colorization.json'
        record['displayVariant']='用户提供的小说原图裁片的AI上色衍生头像；本地保存完整EPUB原档。'
    evidence['characters'].append(record)
evidence_path.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
record_path = assets / 'research/epub/rai-colorization.json'
record = json.loads(record_path.read_text(encoding='utf-8'))
record['identityEvidence'] = 'resource/knightavatars/research/epub/character-evidence.json#rai'
record['epubOriginal'] = dict(path='resource/knightavatars/novel/rai-original.jpg', sourceEpub=book,
    sourceMember='OEBPS/Images/007.jpg', sha256=next(c['sha256'] for c in manifest['characters'] if c['id']=='rai'))
record['inputs'][0]['sourceEpub']=book
record['inputs'][0]['sourceMember']='OEBPS/Images/007.jpg'
record['inputs'][0]['note']='用户提供的第9卷007.jpg小说头像裁片，原byte保留；完整EPUB原始JPG另存rai-original.jpg，二者SHA分别记录。'
record['identityBasis']='碎城雷由用户指定，并与第9卷007.jpg及第7卷具名PROFILE核对；rai为本地稳定ID。'
record['scope']='保存用户两张输入、AI上色结果及记录；主清单另保存完整EPUB原图，供来源校验和后续裁盾。'
record_path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"Catalog {len(manifest['characters'])}; novel evidence {len(evidence['characters'])}; prior image URLs preserved.")
