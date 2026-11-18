import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// 只从明确指定的现有 ST 世界书导出第三卷；不改正文、条目元数据或实际数据目录。
const inputArg = process.argv.indexOf('--input');
if (inputArg < 0 || !process.argv[inputArg + 1]) throw new Error('用法：node export-worldbook.mjs --input <现有世界书.json> [--write|--check]');
const input = path.resolve(process.argv[inputArg + 1]);
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worldbook');
const artifactPath = path.join(output, 'asterisk-volume3.worldbook.json');
const manifestPath = path.join(output, 'component-manifest.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceBytes = fs.readFileSync(input), source = JSON.parse(sourceBytes);
const rows = Object.entries(source.entries);
const expected = [
  '第一章.开幕前夜', '第二章.凤凰星武祭', '第三章.阿尔第与莉姆希', '第四章.吸血暴姬',
  '第五章.雷渥夫姐妹', '第六章.力量与代价', '第七章.霸溃血镰', '终章.余烬与暗流',
];
const selected = expected.map((name, index) => {
  const order = 217 + index, comment = '[剧情]第三卷.' + name;
  const matches = rows.filter(([, row]) => row.comment?.startsWith('[剧情]') && row.order === order);
  if (matches.length !== 1 || matches[0][1].comment !== comment) throw new Error(`order ${order} 须唯一匹配 ${comment}`);
  const [key, row] = matches[0];
  if (row.disable !== true || typeof row.content !== 'string' || !row.content.trim()) throw new Error(`${comment} 须禁用自动触发且有非空正文`);
  return [key, row];
});
const artifact = { entries: Object.fromEntries(selected) };
const artifactText = JSON.stringify(artifact, null, 2) + '\n';
const manifest = {
  schemaVersion: 1, deliveryMode: 'component', kind: 'sillytavern-worldbook',
  sourceName: path.basename(input), sourceSha256: sha(sourceBytes),
  artifact: path.basename(artifactPath), artifactSha256: sha(artifactText),
  entryCount: selected.length, orderRange: [217, 224],
  preserved: ['entry keys', 'uid', 'content', 'disable', 'all other entry fields'],
  entries: selected.map(([key, row]) => ({ key, uid: row.uid, name: row.comment, order: row.order,
    disable: row.disable, contentChars: row.content.length, contentSha256: sha(row.content), entrySha256: sha(JSON.stringify(row)) })),
};
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--write')) {
  fs.mkdirSync(output, { recursive: true });
  for (const [target, content] of [[artifactPath, artifactText], [manifestPath, manifestText]]) {
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== content) throw new Error('交付文件已存在且内容不同：' + target);
    fs.writeFileSync(target, content);
  }
}
if (process.argv.includes('--write') || process.argv.includes('--check')) {
  if (fs.readFileSync(artifactPath, 'utf8') !== artifactText || fs.readFileSync(manifestPath, 'utf8') !== manifestText) throw new Error('组件与当前来源不一致');
  if (sha(fs.readFileSync(input)) !== manifest.sourceSha256) throw new Error('来源世界书在导出期间发生变化');
}
console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'plan',
  output: artifactPath, ...manifest }, null, 2));
