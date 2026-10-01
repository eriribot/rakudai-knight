import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assetDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../resource/knightavatars');
const normalizeName = name => name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '');
const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// 本地素材始终验证；imageUrl 留空时内联，有值时只输出已验证的图床地址，不在构建阶段请求网络。
export function buildKnightAvatarCatalog(directory = assetDirectory) {
  const root = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.characters)) throw new Error('骑士头像清单版本或人物列表无效');
  const imageCache = new Map();
  function configuredUrl(value, label) {
    if (value === undefined || value === '') return null;
    if (typeof value !== 'string' || !value.trim()) throw new Error(label + '.imageUrl 必须是非空 HTTPS 地址，或留空字符串');
    const address = value.trim();
    let parsed;
    try { parsed = new URL(address); } catch { throw new Error(label + '.imageUrl 不是有效的 HTTPS 地址'); }
    if (!/^https:\/\//i.test(address) || parsed.protocol !== 'https:' || /[\u0000-\u001f\u007f]/.test(address)) {
      throw new Error(label + '.imageUrl 只允许 https:// 地址');
    }
    if (parsed.username || parsed.password) throw new Error(label + '.imageUrl 不得包含 URL 用户名或密码');
    return address;
  }
  function image(file, allowMaskSvg = false) {
    if (typeof file !== 'string' || !file) throw new Error('骑士头像清单缺少本地图片路径');
    const resolved = fs.realpathSync(path.resolve(root, file));
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('骑士头像路径越出素材目录：' + file);
    const extension = path.extname(resolved).toLowerCase();
    const mime = imageTypes[extension] || (allowMaskSvg && extension === '.svg' ? 'image/svg+xml' : null);
    if (!mime) throw new Error('骑士头像仅支持本地位图：' + file);
    if (mime === 'image/svg+xml') {
      const svg = fs.readFileSync(resolved, 'utf8');
      if (/<(?!\/?(?:svg|path)\b)[^>]*>|\b(?:on\w+|href)\s*=|url\s*\(|<!/i.test(svg)) throw new Error('盾形遮罩仅支持静态 SVG 路径：' + file);
    }
    if (!imageCache.has(resolved)) imageCache.set(resolved, 'data:' + mime + ';base64,' + fs.readFileSync(resolved).toString('base64'));
    return imageCache.get(resolved);
  }
  const shieldUrl = configuredUrl(manifest.shieldFrame?.imageUrl, '盾框 shieldFrame');
  const catalog = { byName: Object.create(null), entries: Object.create(null), shield: null };
  for (const character of manifest.characters) {
    if (!character || typeof character.id !== 'string' || !/^[a-z0-9_-]+$/.test(character.id) ||
        typeof character.name !== 'string' || !character.name.trim() || !Array.isArray(character.aliases) ||
        typeof character.hasShieldFrame !== 'boolean') throw new Error('骑士头像人物格式无效');
    if (catalog.entries[character.id]) throw new Error('重复的骑士头像 ID：' + character.id);
    // 原始素材必须存在；displayFile 仅用于已确认的完整盾形合成图，不取代来源存档。
    image(character.file);
    const displayImage = image(character.displayFile || character.file);
    catalog.entries[character.id] = {
      src: configuredUrl(character.imageUrl, '人物 ' + character.id) || displayImage,
      hasShieldFrame: character.hasShieldFrame,
      prepared: !!character.displayFile,
      portraitScale: Number.isFinite(character.portraitScale) ? Math.min(2, Math.max(1, character.portraitScale)) : 1,
    };
    for (const name of [character.name, ...character.aliases]) {
      if (typeof name !== 'string' || !name.trim()) throw new Error('骑士头像别名必须是非空文字：' + character.id);
      const key = normalizeName(name);
      if (!key || key === '__proto__') throw new Error('骑士头像别名无效：' + character.id);
      if (catalog.byName[key] && catalog.byName[key] !== character.id) throw new Error('骑士头像别名冲突：' + name);
      catalog.byName[key] = character.id;
    }
  }
  // 合成图保留来源 hasShieldFrame=false；共用框作为独立对比层，人物整图不加滤镜。
  if (Object.values(catalog.entries).some(entry => !entry.hasShieldFrame)) {
    const localFrame = image(manifest.shieldFrame && manifest.shieldFrame.file);
    const frame = manifest.shieldFrame;
    catalog.shield = { src: shieldUrl || localFrame };
    const pixels = fs.readFileSync(path.resolve(root, frame.file));
    const png = pixels.length >= 24 && pixels.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const width = png ? pixels.readUInt32BE(16) : frame.width;
    const height = png ? pixels.readUInt32BE(20) : frame.height;
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) catalog.shield.aspectRatio = width / height;
    if (frame.maskFile) catalog.shield.mask = image(frame.maskFile, true);
    const aperture = frame.aperture;
    if (aperture && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(aperture[key]) && aperture[key] >= 0 && aperture[key] <= 100) &&
        aperture.width > 0 && aperture.height > 0 && aperture.x + aperture.width <= 100 && aperture.y + aperture.height <= 100) {
      catalog.shield.aperture = aperture;
    }
  }
  return catalog;
}
