from pathlib import Path
from PIL import Image
import json, hashlib, shutil

root = Path('resource/knightavatars')
research = root / 'research/20261015-vermilion-family'
baseline = json.loads(Path('scratch/vermilion-family-portraits/baseline.json').read_text(encoding='utf8'))
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf8'))
assert manifest == baseline['manifest'], 'manifest changed since baseline; review before appending'
hashfile = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for file, expected in baseline['fileHashes'].items():
    assert hashfile(root / file) == expected, file
sources = {x['key']: x for x in json.loads((research / 'family-evidence.json').read_text(encoding='utf8'))['preservedOriginals']}
generated = json.loads((research / 'imagegen-record.json').read_text(encoding='utf8'))
byid = {x['id']: x for x in generated['outputs']}
people = [
    ('lunaseyes', '露娜艾丝·法米利昂', ['露娜艾絲·法米利昂', '露娜艾丝', '露娜艾絲', '露娜', '露娜姊', '露娜姐']),
    ('astraea', '阿斯特蕾亚·法米利昂', ['阿斯特蕾亞·法米利昂', '阿斯特蕾亚', '阿斯特蕾亞']),
    ('sirius', '席琉斯·法米利昂', ['席琉斯']),
]
checks = []
for id, name, aliases in people:
    assert not any(c['id'] == id for c in manifest['characters'])
    src = sources[id]
    original = research / src['file']
    assert hashfile(original) == src['sha256']
    image = Image.open(original)
    output = root / ('prepared/' + id + '.png')
    if not output.exists():
        shutil.copyfile(byid[id]['generatedFile'], output)
    assert hashfile(output) == hashfile(Path(byid[id]['generatedFile']))
    final = Image.open(output)
    assert final.format == 'PNG' and final.mode == 'RGBA'
    assert 0.73 < final.width / final.height < 0.77
    alpha = final.getchannel('A')
    assert alpha.getextrema() == (0, 255)
    for corner in [(0,0), (final.width-1,0), (0,final.height-1), (final.width-1,final.height-1)]:
        assert alpha.getpixel(corner) == 0
    center_alpha = alpha.getpixel((final.width//2, final.height//2))
    assert center_alpha >= 250, 'portrait center must be effectively opaque; preserve generated alpha'
    file = original.relative_to(root).as_posix()
    record = {
        'id': id, 'name': name, 'aliases': aliases, 'file': file,
        'sourceUrl': '', 'sourcePage': '', 'hasShieldFrame': False,
        'sourceStyle': 'novel-monochrome-illustration' if id == 'sirius' else 'novel-color-illustration',
        'sourceStatus': 'verified-local-epub-ai-enhanced',
        'width': image.width, 'height': image.height, 'sha256': src['sha256'],
        'imageUrl': '', 'identityEvidence': 'research/20261015-vermilion-family/source-report.md',
        'displayFile': 'prepared/' + id + '.png',
        'preparation': {
            'method': 'built-in-imagegen-portrait-restoration-shield',
            'sourceFile': file, 'sourceSha256': src['sha256'], 'templateFile': 'prepared/amane.png',
            'outputWidth': final.width, 'outputHeight': final.height, 'sha256': hashfile(output),
            'record': 'research/20261015-vermilion-family/imagegen-record.json'
        },
        'derivation': {
            'type': 'ai-enhanced-derivative', 'mode': 'built-in',
            'note': '从已核对的第10卷原图提取单人头像并制成透明曲边盾形，属于AI编辑衍生图。原图另存；席琉斯保留黑白。'
        },
        'sourceEpub': src['sourceEpub'], 'sourceMember': src['sourceEntry']
    }
    manifest['characters'].append(record)
    byid[id].update({'displayFile': record['displayFile'], 'width': final.width, 'height': final.height, 'sha256': hashfile(output), 'mode': final.mode})
    checks.append({'id':id, 'name':name, 'sourceHashMatches':True, 'generatedBytesPreserved':True, 'rgba':True, 'transparentCorners':True, 'centerAlpha':center_alpha, 'width':final.width, 'height':final.height})
assert manifest['characters'][:37] == baseline['manifest']['characters']
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n',encoding='utf8')
(research / 'imagegen-record.json').write_text(json.dumps(generated, ensure_ascii=False, indent=2)+'\n',encoding='utf8')
(research / 'validation.json').write_text(json.dumps({'checks':checks,'existingCharactersUnchanged':37,'existingSourceAndDisplayFilesUnchanged':len(baseline['fileHashes']),'totalCharacters':len(manifest['characters'])},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'added':[x[0] for x in people],'totalCharacters':len(manifest['characters']),'existingFilesUnchanged':len(baseline['fileHashes'])}))
