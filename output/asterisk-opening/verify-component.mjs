import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const work = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(work, '../..');
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
assert.equal(hash(fs.readFileSync(path.join(root, receipt.originalSource))), receipt.originalSourceSha256, 'original page changed');
assert.equal(receipt.originalSourceSha256, '5f5672658041039ff1911cf8965b97211e965e0beda98187e36d0f9585c420fc');
assert.deepEqual(Object.keys(artifact).sort(), Object.keys(fixture).sort(), 'component field set changed');
const changes = Object.keys(fixture).filter(key => JSON.stringify(fixture[key]) !== JSON.stringify(artifact[key]));
assert.deepEqual(changes.sort(), ['replaceString', 'scriptName']);
for (const key of Object.keys(fixture).filter(key => !receipt.allowedChangedFields.includes(key))) {
  assert.deepEqual(artifact[key], fixture[key], 'untouched field: ' + key);
}
const html = sourceBytes.toString('utf8');
assert.equal(artifact.replaceString, '```\n' + html + (html.endsWith('\n') ? '' : '\n') + '```');
assert.equal(fs.readFileSync(path.join(target, '正则替换文本.txt'), 'utf8'), artifact.replaceString);
assert.equal(hash(artifact.replaceString), receipt.replacementSha256);
const regex = new RegExp(artifact.findRegex);
assert.equal(regex.test('[开局]'), true);
assert.equal(regex.test('普通剧情'), false);
const report = {
  passed: true, deliveryMode: 'component', stableId: artifact.id,
  changedFields: changes, untouchedFieldsPreserved: true, fullHtmlParity: true,
  replacementTextParity: true, regexCompileAndFixtures: true,
  originalPageUnchanged: true, originalFixtureUnchanged: true,
  sourceSha256: receipt.sourceSha256, artifactSha256: hash(fs.readFileSync(artifactPath)),
  artifact: path.relative(root, artifactPath).replaceAll('\\', '/'),
  liveSillyTavernVerified: false, liveAiVerified: false
};
fs.writeFileSync(path.join(work, 'component-preservation-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
