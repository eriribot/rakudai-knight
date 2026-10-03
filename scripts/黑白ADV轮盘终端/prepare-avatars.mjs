import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Deterministic pixel compositing: source artwork is never redrawn.
// Local sharp or --sharp-module <installed module path>; only needed to regenerate assets.
const require = createRequire(import.meta.url);
const moduleIndex = process.argv.indexOf('--sharp-module');
const sharp = require(moduleIndex === -1 ? 'sharp' : path.resolve(process.argv[moduleIndex + 1]));
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../resource/knightavatars');
const manifestFile = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(directory, 'avatar-fit.json'), 'utf8'));
const output = path.join(root, 'prepared');
fs.mkdirSync(output, { recursive: true });
const hash = pixels => crypto.createHash('sha256').update(pixels).digest('hex');

function localFile(file) {
  const target = fs.realpathSync(path.resolve(root, file));
  const relative = path.relative(fs.realpathSync(root), target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('素材路径越出 knightavatars：' + file);
  return target;
}

// Find every transparent connected component; keep the largest closed one only.
// The external component and the small holes of the flourish must not contain a portrait.
function shieldInterior(pixels, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let best = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || pixels[start * 4 + 3] >= 16) continue;
    let head = 0, tail = 1, edge = false;
    queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      if (!x || !y || x === width - 1 || y === height - 1) edge = true;
      for (const next of [x ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y ? index - width : -1, y < height - 1 ? index + width : -1]) {
        if (next >= 0 && !seen[next] && pixels[next * 4 + 3] < 16) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (!edge && tail > best.length) best = queue.slice(0, tail);
  }
  if (best.length < width * height * 0.3 || best.length > width * height * 0.8) throw new Error('盾口不是闭合区域，停止生成');
  const alpha = Buffer.alloc(width * height);
  for (const index of best) alpha[index] = 255;
  return alpha;
}

function bounds(alpha, width, height) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (alpha[y * width + x] > 127) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function maskSvg(alpha, width, height) {
  // A union of horizontal runs follows the real pixel boundary, including its narrowing tip.
  const rows = [];
  for (let y = 0; y < height; y++) {
    let left = -1;
    for (let x = 0; x <= width; x++) {
      const inside = x < width && alpha[y * width + x] > 127;
      if (inside && left === -1) left = x;
      if (!inside && left !== -1) { rows.push(`M${left} ${y}h${x - left}v1H${left}z`); left = -1; }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="white" d="${rows.join('')}"/></svg>\n`;
}

function chooseCrop(fit, box, alpha, width, height, orientedSource = null) {
  const [left, top, sourceWidth, sourceHeight] = fit.window;
  const aspect = box.width / box.height;
  const baseHeight = Math.min(sourceHeight, sourceWidth / aspect);
  let best = null;
  for (const zoom of [1, 1.025, 1.05, 1.075, 1.1]) {
    const cropHeight = Math.floor(baseHeight / zoom), cropWidth = Math.floor(cropHeight * aspect);
    const minX = left, maxX = left + sourceWidth - cropWidth;
    const minY = top, maxY = top + sourceHeight - cropHeight;
    for (let yi = 0; yi <= 12; yi++) for (let xi = 0; xi <= 12; xi++) {
      const x = Math.round(minX + (maxX - minX) * xi / 12), y = Math.round(minY + (maxY - minY) * yi / 12);
      const sx = box.width / cropWidth, sy = box.height / cropHeight;
      const map = point => [box.left + (point[0] - x) * sx, box.top + (point[1] - y) * sy];
      const eye = map(fit.eye), target = fit.eyeTarget || 0.55;
      let score = Math.abs((eye[0] - box.left) / box.width - (fit.eyeTargetX || 0.5)) * 4 + Math.abs((eye[1] - box.top) / box.height - target) * 2 + (zoom - 1) * 2;
      for (const point of fit.protect) {
        const [px, py] = map(point).map(Math.round);
        if (px < 0 || py < 0 || px >= width || py >= height || alpha[py * width + px] < 127) score += 100;
      }
      // Rotation exposes transparent corners. Require an opaque source footprint
      // for every shield pixel, including a small resize-kernel safety margin.
      if (orientedSource && score < 100 && (!best || score < best.score)) {
        let covered = true;
        const sourceWidth = orientedSource.info.width, sourceHeight = orientedSource.info.height;
        for (let index = 0; index < alpha.length && covered; index++) {
          if (alpha[index] < 128) continue;
          const px = index % width, py = Math.floor(index / width);
          const sourceX = Math.round(x + (px - box.left) / box.width * cropWidth);
          const sourceY = Math.round(y + (py - box.top) / box.height * cropHeight);
          if (sourceX < 4 || sourceY < 4 || sourceX + 4 >= sourceWidth || sourceY + 4 >= sourceHeight) { covered = false; break; }
          for (const dx of [-4, 4]) for (const dy of [-4, 4]) {
            if (orientedSource.data[((sourceY + dy) * sourceWidth + sourceX + dx) * 4 + 3] !== 255) covered = false;
          }
        }
        if (!covered) continue;
      }
      if (!best || score < best.score) best = { left: x, top: y, width: cropWidth, height: cropHeight, score };
    }
  }
  if (!best || best.score >= 100) throw new Error('脸部保护点或旋转后的不透明区域无法填满盾口，请调整 avatar-fit.json');
  const { score, ...crop } = best;
  return crop;
}

const frameSource = localFile(manifest.shieldFrame.file);
const frameRaw = await sharp(frameSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const fullMask = shieldInterior(frameRaw.data, frameRaw.info.width, frameRaw.info.height);
const width = settings.outputWidth, height = settings.outputHeight;
const mask = await sharp(fullMask, { raw: { width: frameRaw.info.width, height: frameRaw.info.height, channels: 1 } }).resize(width, height).toColourspace('b-w').raw().toBuffer();
if (mask.length !== width * height) throw new Error('盾口遮罩必须为单通道');
const box = bounds(mask, width, height);
const frame = await sharp(frameSource).resize(width, height).png().toBuffer();
fs.writeFileSync(path.join(root, manifest.shieldFrame.maskFile), maskSvg(fullMask, frameRaw.info.width, frameRaw.info.height));
const tiles = [];
const novelTiles = [];
const report = [];
for (const character of manifest.characters.filter(item => !item.hasShieldFrame)) {
  const fit = settings.characters[character.id];
  if (!fit) throw new Error('缺少人物裁切配置：' + character.id);
  const sourceFile = fit.sourceFile || character.file;
  const source = localFile(sourceFile);
  let sourceImage = sharp(source), orientation = null;
  if (fit.levelEyes) {
    const eyes = fit.levelEyes;
    const metadata = await sharp(source).metadata();
    if (!Array.isArray(eyes) || eyes.length !== 2 || eyes.some(point => !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value)) || point[0] < 0 || point[0] >= metadata.width || point[1] < 0 || point[1] >= metadata.height) || eyes[1][0] <= eyes[0][0]) throw new Error('眼线校正坐标无效：' + character.id);
    const rotationDegrees = -Math.atan2(eyes[1][1] - eyes[0][1], eyes[1][0] - eyes[0][0]) * 180 / Math.PI;
    const maxLevelDegrees = fit.maxLevelDegrees ?? 45;
    if (!Number.isFinite(maxLevelDegrees) || maxLevelDegrees <= 0 || maxLevelDegrees > 90 || Math.abs(rotationDegrees) > maxLevelDegrees) throw new Error('眼线倾角超出核验范围，请先核对图片方向：' + character.id);
    sourceImage = sourceImage.rotate(rotationDegrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    orientation = { method: 'level-eye-line', sourceEyes: eyes, rotationDegrees };
    if (fit.orientationNote) orientation.landmarkNote = fit.orientationNote;
  }
  const raw = await sourceImage.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (orientation) Object.assign(orientation, { rotatedWidth: raw.info.width, rotatedHeight: raw.info.height, cropSpace: 'after-rotation' });
  const [x, y, w, h] = fit.window;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > raw.info.width || y + h > raw.info.height) throw new Error('人物区域越出原图：' + character.id);
  let crop;
  try { crop = chooseCrop(fit, box, mask, width, height, orientation ? raw : null); }
  catch (error) { throw new Error(character.id + '：' + error.message, { cause: error }); }
  const portrait = await sharp(raw.data, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } }).extract(crop).resize(box.width, box.height, { fit: 'cover' }).png().toBuffer();
  const canvas = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: portrait, left: box.left, top: box.top }]).raw().toBuffer();
  for (let index = 0; index < mask.length; index++) canvas[index * 4 + 3] = Math.round(canvas[index * 4 + 3] * mask[index] / 255);
  const result = await sharp(canvas, { raw: { width, height, channels: 4 } }).composite([{ input: frame }]).png().toBuffer();
  const displayFile = 'prepared/' + character.id + '.png';
  fs.writeFileSync(path.join(root, displayFile), result);
  character.displayFile = displayFile;
  delete character.portraitScale;
  character.preparation = { method: 'closed-shield-region-face-aware-crop-v1', sourceFile, sourceSha256: hash(fs.readFileSync(source)), crop, outputWidth: width, outputHeight: height, sha256: hash(result) };
  if (orientation) character.preparation.orientation = orientation;
  const thumb = await sharp(result).resize(130, 174).png().toBuffer();
  const label = Buffer.from(`<svg width="174" height="32"><text x="87" y="23" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="16" fill="#263344">${character.name}</text></svg>`);
  const tile = await sharp({ create: { width: 174, height: 212, channels: 4, background: '#fff8e7' } }).composite([{ input: thumb, left: 22, top: 4 }, { input: label, left: 0, top: 178 }]).png().toBuffer();
  tiles.push(tile); report.push({ id: character.id, sourceFile, crop, displayFile, ...(orientation ? { orientation } : {}) });
  if (character.sourceStyle?.startsWith('novel-')) novelTiles.push(tile);
}
const sheet = await sharp({ create: { width: 522, height: Math.max(1, Math.ceil(tiles.length / 3)) * 212, channels: 4, background: '#fff8e7' } }).composite(tiles.map((input, index) => ({ input, left: index % 3 * 174, top: Math.floor(index / 3) * 212 }))).png().toBuffer();
fs.writeFileSync(path.join(output, 'contact-sheet.png'), sheet);
if (novelTiles.length) {
  const columns = Math.min(4, novelTiles.length);
  const novelSheet = await sharp({ create: { width: columns * 174, height: Math.ceil(novelTiles.length / columns) * 212, channels: 4, background: '#fff8e7' } }).composite(novelTiles.map((input, index) => ({ input, left: index % columns * 174, top: Math.floor(index / columns) * 212 }))).png().toBuffer();
  fs.writeFileSync(path.join(output, 'novel-contact-sheet.png'), novelSheet);
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'preparation-report.json'), JSON.stringify({ method: 'closed-shield-region-face-aware-crop-v1', frameSha256: hash(fs.readFileSync(frameSource)), maskArea: fullMask.filter(value => value > 0).length, shieldBounds: box, outputWidth: width, outputHeight: height, characters: report }, null, 2) + '\n');
console.log(JSON.stringify({ prepared: report.length, output, shieldBounds: box, report }, null, 2));
