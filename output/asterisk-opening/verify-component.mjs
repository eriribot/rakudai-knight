import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const work = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(work, '../..');
const require = createRequire(new URL('../worldbook-calibration/dev/package.json', import.meta.url));
const ejs = require('ejs');
const target = path.join(root, '第一卷-世界书整理/开局网页正则替换');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const receipt = readJson(path.join(work, 'component-source-receipt.json'));
const fixturePath = path.join(root, receipt.fixture);
const fixture = readJson(fixturePath);
const artifactPath = path.join(target, 'regex/opening-rakudai-asterisk-preview.regex.json');
const artifact = readJson(artifactPath);
const sourceBytes = fs.readFileSync(path.join(target, 'index.html'));
assert.equal(hash(sourceBytes), receipt.sourceSha256, 'HTML changed after packaging preparation');
assert.equal(hash(fs.readFileSync(fixturePath)), receipt.fixtureSha256, 'original regex fixture changed');
assert.equal(hash(fs.readFileSync(path.join(root, receipt.originalSource))), receipt.originalSourceSha256, 'base page changed after packaging preparation');
assert.equal(receipt.asteriskMvuImplemented, true, 'formal Asterisk MVU receipt required');
assert.equal(artifact.scriptName, '[开局] 落第 × 学战 双开局');
assert.deepEqual(Object.keys(artifact).sort(), Object.keys(fixture).sort(), 'component field set changed');
const changes = Object.keys(fixture).filter(key => JSON.stringify(fixture[key]) !== JSON.stringify(artifact[key]));
assert.ok(changes.includes('replaceString'), 'replacement must contain this update');
assert.ok(changes.every(key => receipt.allowedChangedFields.includes(key)), 'undeclared component field changed');
for (const key of Object.keys(fixture).filter(key => !receipt.allowedChangedFields.includes(key))) {
  assert.deepEqual(artifact[key], fixture[key], 'untouched field: ' + key);
}
const html = sourceBytes.toString('utf8');
assert.equal(artifact.replaceString, '```\n' + html + (html.endsWith('\n') ? '' : '\n') + '```');
assert.equal(fs.readFileSync(path.join(target, '正则替换文本.txt'), 'utf8'), artifact.replaceString);
assert.equal(hash(artifact.replaceString), receipt.replacementSha256);
// SillyTavern may render the full first-message HTML through EJS after regex replacement.
for (const options of [{}, { strict: true, _with: false }]) {
  assert.equal(ejs.render(artifact.replaceString, {}, options), artifact.replaceString, 'opening HTML must survive EJS unchanged');
}
const regex = new RegExp(artifact.findRegex);
assert.equal(regex.test('[开局]'), true);
assert.equal(regex.test('普通剧情'), false);
const report = {
  passed: true, deliveryMode: 'component', stableId: artifact.id,
  changedFields: changes, untouchedFieldsPreserved: true, fullHtmlParity: true,
  replacementTextParity: true, regexCompileAndFixtures: true,
  ejsPlainAndStrictRenderIdentity: true,
  sourceSincePreparationUnchanged: true, fixtureSincePreparationUnchanged: true,
  sourceSha256: receipt.sourceSha256, artifactSha256: hash(fs.readFileSync(artifactPath)),
  artifact: path.relative(root, artifactPath).replaceAll('\\', '/'),
  asteriskMvuImplemented: true,
  liveSillyTavernVerified: false, liveAiVerified: false, liveAsteriskMvuVerified: false
};
fs.writeFileSync(path.join(work, 'component-preservation-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
