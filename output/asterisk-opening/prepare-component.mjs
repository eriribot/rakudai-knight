import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const work = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(work, '../..');
const target = path.join(root, '第一卷-世界书整理/开局网页正则替换');
const fixtureArg = process.argv.indexOf('--fixture');
if (fixtureArg < 0 || !process.argv[fixtureArg + 1]) throw new Error('请用 --fixture 指定当前角色卡导出的开局正则，保留实机稳定 ID。');
const fixturePath = path.resolve(root, process.argv[fixtureArg + 1]);
const sourcePath = path.join(target, 'index.html');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fixtureBytes = fs.readFileSync(fixturePath);
const sourceBytes = fs.readFileSync(sourcePath);
const fixture = JSON.parse(fixtureBytes.toString('utf8').replace(/^\uFEFF/, ''));
const html = sourceBytes.toString('utf8');
if (!fixture.replaceString.startsWith('```\n') || !fixture.replaceString.endsWith('\n```')) {
  throw new Error('Fixture code-fence dialect changed; inspect before packaging.');
}
if (!html.startsWith('<!doctype html>') || !html.includes('ASTERISK_MODE_BEGIN')) {
  throw new Error('Expected the complete independent opening HTML.');
}
if (!html.includes('return buildAsteriskOpeningVariables(draft);') || html.includes('return previewAsteriskOpening();')) {
  throw new Error('Build the formal Asterisk opening before preparing its component.');
}
const replacement = '```\n' + html + (html.endsWith('\n') ? '' : '\n') + '```';
const value = structuredClone(fixture);
value.scriptName = '[开局] 落第 × 学战 双开局';
value.replaceString = replacement;
const spec = {
  schemaVersion: 1, deliveryMode: 'component', kind: 'regex',
  items: [{ artifactName: 'opening-rakudai-asterisk-preview', value }]
};
const canonical = value => JSON.stringify(value, null, 2) + '\n';
fs.writeFileSync(path.join(work, 'component-update-spec.json'), canonical(spec), 'utf8');
fs.writeFileSync(path.join(target, '正则替换文本.txt'), replacement, 'utf8');
const receipt = {
  schemaVersion: 1, deliveryMode: 'component', kind: 'regex',
  stableId: fixture.id,
  fixture: path.relative(root, fixturePath).replaceAll('\\', '/'),
  fixtureSha256: hash(fixtureBytes),
  source: path.relative(root, sourcePath).replaceAll('\\', '/'),
  sourceSha256: hash(sourceBytes),
  originalSource: '第一卷-世界书整理/开局页面/index.html',
  originalSourceSha256: hash(fs.readFileSync(path.join(root, '第一卷-世界书整理/开局页面/index.html'))),
  allowedChangedFields: ['scriptName', 'replaceString'],
  replacementSha256: hash(replacement),
  library: { snapshotVersion: '2026-08-18', route: 'sillytavern-component-update', documents: ['ST-A0', 'ST-A2', 'ST-A6'], adoptedCandidates: [] },
  asteriskMvuImplemented: true,
  liveSillyTavernVerified: false, liveAiVerified: false, liveAsteriskMvuVerified: false
};
fs.writeFileSync(path.join(work, 'component-source-receipt.json'), canonical(receipt), 'utf8');
console.log(canonical({ mode: 'component', id: fixture.id, sourceSha256: receipt.sourceSha256, spec: 'output/asterisk-opening/component-update-spec.json', staging: '第一卷-世界书整理/开局网页正则替换/regex' }));
