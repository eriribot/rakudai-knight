from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
manifest_path = assets / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
records = [
    dict(id='kiriko', name='药师雾子', aliases=['藥師霧子'], file='novel/kiriko.jpg', sourceEpub='39688/[台版]落第骑士英雄谭 05.epub', sourceMember='OEBPS/Images/004.jpg'),
    dict(id='sara', name='莎拉·布拉德莉莉', aliases=['莎拉'], file='novel/sara.jpg', sourceEpub='39688/[台版]落第骑士英雄谭 06.epub', sourceMember='OEBPS/Images/005.jpg'),
    dict(id='rinna', name='风祭凛奈', aliases=['風祭凜奈', '風祭凛奈', '风祭凜奈'], file='novel/rinna-original.jpg', sourceEpub='39688/[台版]落第骑士英雄谭 05.epub', sourceMember='OEBPS/Images/007.jpg'),
    dict(id='ein', name='艾茵·阿伯伦特', aliases=['艾茵·阿伯倫特', '艾茵', 'Ein', 'Dirty Rose'], file='novel/ein.jpg', sourceEpub='39688/[台版]落第骑士英雄谭 13.epub', sourceMember='OEBPS/Images/004.jpg'),
]
for item in records:
    if any(c['id'] == item['id'] for c in manifest['characters']):
        raise RuntimeError(f"Existing entry: {item['id']}; do not overwrite settings")
    source = assets / item['file']
    with Image.open(source) as im:
        width, height = im.size
    item.update(sourceUrl='', sourcePage='', hasShieldFrame=False,
                sourceStyle='novel-color-illustration',
                sourceStatus='verified-local-epub-no-original-shield',
                width=width, height=height, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                imageUrl='', identityEvidence=f"research/epub/character-evidence.json#{item['id']}")
    if item['id'] == 'rinna':
        item['sourceStyle'] = 'novel-monochrome-illustration'
        item['sourceStatus'] = 'verified-local-epub-ai-colorized'
        item['colorization'] = dict(type='ai-colorized-derivative', mode='built-in',
            file='novel/rinna-colorized.png', record='research/epub/rinna-colorization.json',
            colorReferenceVolume=18, note='第5卷原黑白图上色；参考第18卷发色和瞳色，深红礼服依据第5卷正文。蝴蝶结深红为上色选择。非官方原生彩图。')
    manifest['characters'].append(item)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f"Catalog: {len(manifest['characters'])} characters; image URLs preserved.")
