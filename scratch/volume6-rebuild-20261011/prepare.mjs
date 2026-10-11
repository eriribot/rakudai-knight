import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const dir = path.join(root, '第六卷-世界书整理');
const temp = path.join(root, 'scratch/volume6-rebuild-20261011');
const sourcePath = path.join(root, '落第骑士英雄谭 第六卷 gbk.txt');
const raw = fs.readFileSync(sourcePath);
const source = new TextDecoder('gb18030', { fatal: true }).decode(raw);
const lines = source.split(/\r\n|\n|\r/);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(temp, {recursive: true});
fs.writeFileSync(path.join(temp, 'original.utf8.txt'), source, 'utf8');
const snapshot = path.join(dir, 'Gemini整理基线/20261011');
if (fs.existsSync(path.join(snapshot, 'manifest.json'))) throw new Error('Baseline already exists; refusing to replace it.');
const entries = [];
function walk(folder, prefix = '') {
  for (const e of fs.readdirSync(folder, {withFileTypes: true})) {
    if (e.name === 'Gemini整理基线') continue;
    const relative = path.join(prefix, e.name);
    if (e.isDirectory()) walk(path.join(folder, e.name), relative);
    else if (e.name.endsWith('.md') || e.name === 'split_stats.json') {
      const b = fs.readFileSync(path.join(folder, e.name));
      const target = path.join(snapshot, relative);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, b);
      entries.push({path: relative.replaceAll('\\', '/'), bytes: b.length, sha256: hash(b)});
    }
  }
}
walk(dir);
const split = JSON.parse(fs.readFileSync(path.join(dir, 'split_stats.json'), 'utf8'));
const checks = split.map(s => {
  const stored = fs.readFileSync(path.join(dir, s.file), 'utf8').replace(/\r\n|\r/g, '\n');
  const expected = lines.slice(s.startLine - 1, s.endLine).join('\n');
  return {...s, exact: stored === expected, sameIgnoringFinalNewline: stored.replace(/\n$/, '') === expected.replace(/\n$/, '')};
});
const headers = lines.flatMap((line,i) => /^\s*第六卷\s/.test(line) ? [{line:i+1,title:line.trim()}] : []);
const result = {date:'2026-10-11',source:'落第骑士英雄谭 第六卷 gbk.txt',encoding:'gb18030',sourceBytes:raw.length,sourceSha256:hash(raw),decodedCharacters:source.length,physicalLines:lines.length,lastNonemptyLine:lines.findLastIndex(s => s.trim())+1,headers,checks,baseline:entries};
fs.writeFileSync(path.join(snapshot, 'manifest.json'), JSON.stringify(result, null, 2)+'\n');
fs.writeFileSync(path.join(temp, 'source-audit.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify(result, null, 2));
