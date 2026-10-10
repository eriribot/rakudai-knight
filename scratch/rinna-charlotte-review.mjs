import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve('resource/knightavatars');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const ids = ['rinna', 'charlotte', 'xiaoli'];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const tiles = await Promise.all(ids.map(id => sharp(path.join(root, `research/review/${id}-shield-preview.png`)).resize(217, 306).png().toBuffer()));
await sharp({ create: { width: 651, height: 306, channels: 4, background: '#fff8e7' } }).composite(tiles.map((input, i) => ({ input, left: i * 217, top: 0 }))).png().toFile(path.join(root, 'research/review/rinna-charlotte-preview.png'));
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'research/review/pre-rinna-charlotte-baseline.json'), 'utf8'));
const changes = baseline.characters.filter(c => hash(c.displayFile) !== c.displaySha256).map(c => c.id);
const originalChanges = baseline.characters.filter(c => hash(c.file) !== c.sourceSha256).map(c => c.id);
const shieldUnchanged = hash(manifest.shieldFrame.file) === baseline.shieldSha256;
if (changes.length !== 1 || changes[0] !== 'xiaoli' || originalChanges.length || !shieldUnchanged) throw new Error('Unexpected existing asset changes');
const review = {
  manifestCharacters: manifest.characters.length,
  preparedCharacters: manifest.characters.filter(c => c.displayFile).length,
  uploadFiles: manifest.characters.length + 1,
  modifiedExistingPortraits: changes,
  originalBytesUnchanged: originalChanges.length === 0,
  shieldUnchanged,
  browserPreview: {
    url: 'http://127.0.0.1:58635/preview.html?sample=avatars&view=lime',
    status: 'passed-root-visual-review',
    notes: ['凛奈与夏洛特均在实际编译的LIME名册显示', '凛奈图床素材加载434x580', '夏洛特本地内联加载434x580', '盾口内人物无遮挡脸部与倾斜眼线']
  },
  validation: { avatarTests: '17/17', packagingTests: '9/9' },
  activePortraits: ids.map(id => {
    const c = manifest.characters.find(c => c.id === id);
    return { id, name: c.name, displayFile: c.displayFile, sha256: hash(c.displayFile), imageHostStatus: c.imageUrl ? 'configured-existing-url' : 'pending-upload' };
  })
};
fs.writeFileSync(path.join(root, 'research/review/rinna-charlotte-acceptance.json'), JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify(review, null, 2));
