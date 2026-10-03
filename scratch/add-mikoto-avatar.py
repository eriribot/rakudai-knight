from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
manifest_file = assets / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
if any(person['id'] == 'mikoto' for person in manifest['characters']):
    raise RuntimeError('mikoto already exists; do not overwrite.')
original_file = 'research/user-supplied/mikoto-profile-screenshot.png'
with Image.open(assets / original_file) as image:
    original_width, original_height = image.size
color_file = 'color/mikoto-colorized.png'
with Image.open(assets / color_file) as image:
    width, height = image.size
record = dict(id='mikoto', name='鹤屋美琴', aliases=['鶴屋美琴', 'Mikoto Tsuruya', 'Tsuruya Mikoto'],
    file=original_file, sourceUrl='', sourcePage='', hasShieldFrame=False,
    sourceStyle='user-supplied-monochrome-illustration', sourceStatus='identity-confirmed-user-image-ai-colorized',
    width=original_width, height=original_height,
    sha256=hashlib.sha256((assets / original_file).read_bytes()).hexdigest(), imageUrl='',
    identityEvidence='research/epub/character-evidence.json#mikoto',
    colorization=dict(type='ai-colorized-derivative', mode='built-in', file=color_file,
        record='research/epub/mikoto-colorization.json',
        note='使用用户提供的黑白人物裁图上色；灰金发有第5卷尾声正文依据。原出版载体未核实，眼睛深灰与灰白制服为本次中性补色，不标为官方原生彩图。'))
manifest['characters'].append(record)
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

fit_file = root / 'scripts/黑白ADV轮盘终端/avatar-fit.json'
fit_text = fit_file.read_text(encoding='utf-8')
fit = json.loads(fit_text)
sx, sy = width/420, height/595
def point(x, y):
    return [round(x*sx), round(y*sy)]
fit['characters']['mikoto'] = dict(sourceFile=color_file,
    window=[round(65*sx), 0, round(305*sx), round(450*sy)],
    eye=point(231, 206), protect=[point(176, 205), point(288, 206), point(231, 285), point(230, 326)],
    eyeTarget=.51, eyeTargetX=.54)
closing_index = fit_text.rfind('\n  }')
if closing_index < 0:
    raise RuntimeError('Fit formatting changed; inspect before adding the entry.')
fit_file.write_text(fit_text[:closing_index].rstrip()+',\n    "mikoto": '+json.dumps(fit['characters']['mikoto'], ensure_ascii=False)+fit_text[closing_index:], encoding='utf-8')

evidence_file = assets / 'research/epub/character-evidence.json'
evidence = json.loads(evidence_file.read_text(encoding='utf-8'))
if any(person['id']=='mikoto' for person in evidence['characters']):
    raise RuntimeError('mikoto evidence already exists.')
evidence['characters'].append(dict(id='mikoto', name='鹤屋美琴',
    sourceImage=original_file, imageSourceStatus='user-supplied-publication-unverified',
    sourceEpub='39688/[台版]落第骑士英雄谭 05.epub',
    evidence=[dict(xhtml='OEBPS/Text/Chapter005.xhtml', location='尾声；XHTML第70行',
        excerpt='一名有着灰金色发丝的女性', establishes='hair-color'),
        dict(xhtml='OEBPS/Text/Chapter003.xhtml', location='第3章；XHTML第37行',
        excerpt='巨门学园三年级〈冰霜冷笑〉鹤屋美琴', establishes='identity')],
    colorizationRecord='research/epub/mikoto-colorization.json',
    detailedEvidence='research/epub/mikoto-evidence.json',
    displayVariant='用户提供黑白人物图的AI上色盾形头像；眼睛和制服为未核实官方颜色的中性补色。'))
evidence_file.write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Added mikoto; total {len(manifest["characters"])} avatars; color source {width}×{height}.')
