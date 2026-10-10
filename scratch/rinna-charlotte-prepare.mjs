import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve('resource/knightavatars');
const review = path.join(root, 'research/review');
fs.mkdirSync(review, { recursive: true });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const baselineFile = path.join(review, 'pre-rinna-charlotte-baseline.json');
if (!fs.existsSync(baselineFile)) {
  const baseline = manifest.characters.map(c => ({ id: c.id, file: c.file, sourceSha256: hash(fs.readFileSync(path.join(root, c.file))), displayFile: c.displayFile || c.file, displaySha256: hash(fs.readFileSync(path.join(root, c.displayFile || c.file))) }));
  fs.writeFileSync(baselineFile, JSON.stringify({ characters: baseline, shieldSha256: hash(fs.readFileSync(path.join(root, manifest.shieldFrame.file))) }, null, 2) + '\n');
  fs.copyFileSync(path.join(root, 'prepared/xiaoli.png'), path.join(review, 'xiaoli-vol12-shield-preserved.png'));
}
const source = path.join(root, 'color/xiaoli-vol18-colorized.png');
const meta = await sharp(source).metadata();
const eyes = [[291, 504], [495, 435]];
const angle = -Math.atan2(eyes[1][1] - eyes[0][1], eyes[1][0] - eyes[0][0]);
const raw = await sharp(source).rotate(angle * 180 / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function transform([x, y]) {
  x -= meta.width / 2; y -= meta.height / 2;
  return [Math.round(x * Math.cos(angle) - y * Math.sin(angle) + raw.info.width / 2), Math.round(x * Math.sin(angle) + y * Math.cos(angle) + raw.info.height / 2)];
}
await sharp(raw.data, { raw: raw.info }).png().toFile(path.join(review, 'xiaoli-vol18-upright.png'));
console.log(JSON.stringify({ sourceEyes: eyes, rotationDegrees: angle * 180 / Math.PI, width: raw.info.width, height: raw.info.height, eyes: eyes.map(transform), mouth: transform([442, 610]), chin: transform([484, 660]), ornaments: [[630, 100], [55, 382]].map(transform), crown: transform([393, 13]) }, null, 2));
