import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve('resource/knightavatars');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const manifestFile = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.characters.some(c => c.id === 'charlotte')) throw new Error('Charlotte already registered');
const original = path.join(root, 'novel/charlotte-original.jpg');
const originalMeta = await sharp(original).metadata();
manifest.characters.push({
  id: 'charlotte', name: '夏洛特', aliases: ['Charlotte Cordé', 'Charlotte Corde'],
  file: 'novel/charlotte-original.jpg',
  sourceEpub: '39688/[台版]落第骑士英雄谭 05.epub',
  sourceMember: 'OEBPS/Images/007.jpg',
  sourceUrl: '', sourcePage: '', hasShieldFrame: false,
  sourceStyle: 'novel-monochrome-illustration',
  sourceStatus: 'verified-local-epub-ai-colorized',
  width: originalMeta.width, height: originalMeta.height,
  sha256: hash(fs.readFileSync(original)),
  imageUrl: '',
  imageHostStatus: {
    status: 'pending-upload-new-portrait',
    intendedUrl: 'https://eriribot.github.io/rakudai-knight/resource/knightavatars/prepared/charlotte.png',
    note: '上传 prepared/charlotte.png 后将此地址填入 imageUrl；当前内联本地头像。'
  },
  identityEvidence: 'research/epub/charlotte-evidence.json',
  colorization: {
    type: 'ai-colorized-derivative', mode: 'built-in',
    file: 'color/charlotte-colorized.png',
    record: 'research/epub/charlotte-colorization.json',
    colorReferenceVolume: 6,
    note: '第5卷女仆正面原黑白图上色；绿发紫瞳与黑白女仆装参考第6卷官方彩页。紫红格纹蝴蝶结为衍生选色。非官方原生彩图。'
  }
});
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
const sourceFile = 'color/charlotte-colorized.png';
const source = path.join(root, sourceFile);
const meta = await sharp(source).metadata();
const eyes = [[426, 345], [710, 326]];
const angle = -Math.atan2(eyes[1][1] - eyes[0][1], eyes[1][0] - eyes[0][0]);
const raw = await sharp(source).rotate(angle * 180 / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function transform([x, y]) {
  x -= meta.width / 2; y -= meta.height / 2;
  return [Math.round(x * Math.cos(angle) - y * Math.sin(angle) + raw.info.width / 2), Math.round(x * Math.sin(angle) + y * Math.cos(angle) + raw.info.height / 2)];
}
const newEyes = eyes.map(transform);
const fit = {
  sourceFile, levelEyes: eyes,
  window: [100, 55, 930, 1280],
  eye: [Math.round((newEyes[0][0] + newEyes[1][0]) / 2), newEyes[0][1]],
  protect: [...newEyes, ...[[590, 540], [590, 620], [690, 840]].map(transform)],
  eyeTarget: 0.34, eyeTargetX: 0.54
};
const fitFile = 'scripts/黑白ADV轮盘终端/avatar-fit.json';
const fitText = fs.readFileSync(fitFile, 'utf8');
const updated = fitText.replace(/(\s*)\}\s*\}\s*$/, ',\n    "charlotte": ' + JSON.stringify(fit) + '\n  }\n}\n');
if (updated === fitText) throw new Error('Failed to add crop config');
JSON.parse(updated);
fs.writeFileSync(fitFile, updated);
const recordFile = path.join(root, 'research/epub/charlotte-colorization.json');
const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
for (const input of record.inputs) {
  const file = path.join(root, input.path);
  const info = await sharp(file).metadata();
  Object.assign(input, { width: info.width, height: info.height, sha256: hash(fs.readFileSync(file)) });
}
Object.assign(record.originalIllustration, { width: originalMeta.width, height: originalMeta.height, sha256: hash(fs.readFileSync(original)) });
Object.assign(record.output, { width: meta.width, height: meta.height, sha256: hash(fs.readFileSync(source)) });
fs.writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n');
await sharp(raw.data, { raw: raw.info }).png().toFile(path.join(root, 'research/review/charlotte-upright.png'));
console.log(JSON.stringify({ rotationDegrees: angle * 180 / Math.PI, width: raw.info.width, height: raw.info.height, fit }, null, 2));
