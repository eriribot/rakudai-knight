import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const work = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(work, '../..');
const target = path.join(root, '第一卷-世界书整理/开局网页正则替换');
const htmlBytes = fs.readFileSync(path.join(target, 'index.html'));
const html = htmlBytes.toString('utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const scripts = [];
for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].entries()) {
  const [, attributes, body] = match;
  if (/\bsrc\s*=/i.test(attributes)) {
    scripts.push({ index, skipped: 'external script' });
    continue;
  }
  const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  if (type && !['module', 'text/javascript', 'application/javascript'].includes(type.toLowerCase())) {
    scripts.push({ index, skipped: `non-JavaScript type: ${type}` });
    continue;
  }
  const args = type === 'module' ? ['--input-type=module', '--check', '-'] : ['--check', '-'];
  const checked = spawnSync(process.execPath, args, { input: body, encoding: 'utf8' });
  assert.equal(checked.status, 0, `inline script ${index} failed node --check: ${checked.stderr}`);
  scripts.push({ index, passed: true, bytes: Buffer.byteLength(body), sha256: hash(body) });
}
assert.ok(scripts.some(script => script.passed), 'inline scripts found');

const mediaRoot = path.join(target, 'assets/asterisk');
const manifestPath = path.join(mediaRoot, 'media-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const media = manifest.assets.map(asset => {
  const file = path.resolve(mediaRoot, asset.source.path);
  assert.ok(file.startsWith(mediaRoot + path.sep), 'media path remains within assets directory');
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, asset.bytes, `media byte count: ${asset.id}`);
  assert.equal(hash(bytes), asset.sha256, `media hash: ${asset.id}`);
  const original = fs.readFileSync(path.resolve(root, asset.originalSource));
  assert.equal(hash(original), asset.sha256, `unaltered original media: ${asset.id}`);
  return { id: asset.id, bytes: bytes.length, sha256: asset.sha256, originalParity: true };
});
assert.equal(media.length, 35, '16 covers, 8 illustrations, 1 video, 5 school emblems, 2 world logos, 2 unmodified title originals and 1 character-free background');
assert.equal(/opening-crossover-v1|crossoverCover|shared-crossover-cover/.test(html), false, 'generated cover absent from product HTML');
assert.equal(/opening-crossover-v1|crossoverCover|shared-crossover-cover/.test(JSON.stringify(manifest)), false, 'generated cover absent from product media manifest');
const expectedOriginals = {
  'shared-entry-cover': '165b15285c81879567831a257488341b90a72501159386d831472f498d929c31',
  'asterisk-original-entry-cover': 'ad356b0f05390ae1791037cef9f342c25884a68784a36a80af27c2025a9d5345'
};
for (const [id, expected] of Object.entries(expectedOriginals)) {
  assert.equal(media.find(asset => asset.id === id)?.sha256, expected, 'original title image bytes remain unchanged: ' + id);
}
const backdrop = manifest.assets.find(asset => asset.source.path === 'opening-game-backdrop-v1.png');
assert.ok(backdrop, 'separate background asset exists');
const backdropSource = JSON.parse(fs.readFileSync(path.join(work, 'source-assets/opening-game-backdrop-v1.source.json'), 'utf8'));
assert.deepEqual(backdropSource.inputImages, [], 'background generation received no character image');
assert.equal(backdrop.sha256, backdropSource.output.sha256, 'generated background matches its provenance');
const report = {
  passed: true,
  sourceBytes: htmlBytes.length,
  sourceSha256: hash(htmlBytes),
  inlineScriptsChecked: scripts.filter(script => script.passed).length,
  scripts,
  mediaManifestSha256: hash(fs.readFileSync(manifestPath)),
  mediaFileCount: media.length,
  mediaBytes: media.reduce((total, asset) => total + asset.bytes, 0),
  media,
  scope: 'Static JavaScript syntax and copied media integrity; not browser, SillyTavern or live-AI acceptance.'
};
fs.writeFileSync(path.join(work, 'assembled-static-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, sourceBytes: report.sourceBytes, sourceSha256: report.sourceSha256, inlineScriptsChecked: report.inlineScriptsChecked, mediaFileCount: report.mediaFileCount, mediaBytes: report.mediaBytes }, null, 2));
