import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const work = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(work, '../..');
const fixturePath = 'output/opening-init-repair-20261107/installed-opening-before.regex.json';
const sourcePath = '第一卷-世界书整理/开局网页正则替换/index.html';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(root, name));
const fixtureBytes = read(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString('utf8').replace(/^\uFEFF/, ''));
assert.equal(fixture.id, '91353e85-24b5-4f7a-bdaa-166abb48f0bf');
assert.equal(hash(fixture.replaceString), '405e6b96c41a5bc50c13b10118b7481fcdbd27d308402cdd509bd985a07f4a6f');
const html = read(sourcePath).toString('utf8');
assert.ok(html.startsWith('<!doctype html>') && html.includes('ASTERISK_MODE_BEGIN'));
assert.ok(html.includes('data-opening-copy'));
// 工作区共享规则还有其他未交付改动；组件以实际安装版冻结非本次范围。
// 仅搬运维护源码中的完整适配器、双作品 UI 函数和复制按钮标记。
const section = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return text.slice(a, b);
};
const adapterStart = '// 构建时与 schema、纯状态规则一起内联；';
const adapterEnd = '\n})();\n';
const oldAdapter = section(fixture.replaceString, adapterStart, adapterEnd) + adapterEnd.trimEnd();
const newAdapter = read('scripts/rakudai-state-browser.js').toString('utf8').replace(/\r\n/g, '\n').trimEnd();
const starts = ['      async function copyCardSummary() {', '      async function enterGame() {', '      function applyArchiveAvatar('];
const oldCopy = section(fixture.replaceString, starts[0], starts[1]);
const oldSubmit = section(fixture.replaceString, starts[1], starts[2]);
const newCopy = section(html, starts[0], starts[1]);
const newSubmit = section(html, starts[1], starts[2]);
const copyButton = 'onclick="RakudaiOpening.copyCardSummary()"';
assert.equal(fixture.replaceString.split(copyButton).length - 1, 2);
const replacement = fixture.replaceString.replace(oldAdapter, () => newAdapter)
  .replace(oldCopy, () => newCopy).replace(oldSubmit, () => newSubmit)
  .replaceAll(copyButton, 'data-opening-copy ' + copyButton);
const outsideRepair = replacement.replace(newAdapter, () => oldAdapter)
  .replace(newCopy, () => oldCopy).replace(newSubmit, () => oldSubmit)
  .replaceAll('data-opening-copy ' + copyButton, copyButton);
assert.equal(outsideRepair, fixture.replaceString, 'non-repair surface must remain byte-identical');
const componentHtml = replacement.slice(4, -4);
fs.writeFileSync(path.join(work, 'opening.component.html'), componentHtml);
const value = { ...fixture, scriptName: '[开局] 落第 × 学战 双开局 · 初始化修复 20261107', replaceString: replacement };
const require = createRequire(import.meta.url);
const ejs = require('../worldbook-calibration/dev/node_modules/ejs');
for (const options of [{}, { strict: true, _with: false }]) assert.equal(ejs.render(replacement, {}, options), replacement);
const changedFields = Object.keys(fixture).filter(key => JSON.stringify(value[key]) !== JSON.stringify(fixture[key]));
assert.deepEqual(changedFields.sort(), ['replaceString', 'scriptName']);
assert.equal(new RegExp(value.findRegex).test('[开局]'), true);
assert.equal(new RegExp(value.findRegex).test('普通正文'), false);
const spec = { schemaVersion: 1, deliveryMode: 'component', kind: 'regex', items: [{ artifactName: 'opening-init-repair', value }] };
const receipt = {
  schemaVersion: 1, deliveryMode: 'component', stableId: value.id,
  fixture: fixturePath, fixtureSha256: hash(fixtureBytes), originalReplacementSha256: hash(fixture.replaceString),
  source: 'output/opening-init-repair-20261107/opening.component.html', sourceSha256: hash(componentHtml), replacementSha256: hash(replacement),
  assembly: 'installed baseline + maintained adapter + assembled copy/submit UI functions + two copy-button markers',
  nonRepairSurfaceByteIdentical: true,
  sourceFiles: ['scripts/rakudai-state-browser.js', 'scripts/rakudai-state-controller.js', '第一卷-世界书整理/开局页面/index.html', sourcePath].map(file => ({ file, sha256: hash(read(file)) })),
  changedFields, preservedOtherFields: true, ejsPlainAndStrictIdentity: true,
  originalReplacementBytes: Buffer.byteLength(fixture.replaceString), replacementBytes: Buffer.byteLength(replacement),
  library: { snapshot: '2026-08-18', route: 'sillytavern-component-update', loaded: ['ST-A0', 'ST-A2', 'ST-A6', 'ST-B2'], adoptedCandidates: [] },
  acceptance: 'dependency failure releases buttons; retry and both worlds commit/read back in isolated SillyTavern',
  runtimeEvidence: 'output/playwright/init-repair-20261107', fullCardPackaged: false,
};
for (const [name, data] of [['update-spec.json', spec], ['source-receipt.json', receipt]]) fs.writeFileSync(path.join(work, name), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
