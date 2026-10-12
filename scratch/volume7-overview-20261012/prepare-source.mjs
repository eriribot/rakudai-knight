import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const source = '落第骑士英雄谭 第七卷 gbk.txt';
const target = '第七卷-世界书整理/核验记录/第七卷原文_UTF8.txt';
const receipt = '第七卷-世界书整理/核验记录/第七卷原文_来源.json';
const raw = fs.readFileSync(source);
const decoded = new TextDecoder('gb18030', { fatal: true }).decode(raw);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const parts = decoded.split(/\r\n|\r|\n/);
const lineCount = /(?:\r\n|\r|\n)$/.test(decoded) ? parts.length - 1 : parts.length;
fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  if (fs.readFileSync(target, 'utf8') !== decoded) throw new Error('Existing UTF-8 source differs; not overwritten.');
} else {
  fs.writeFileSync(target, decoded, 'utf8');
}
const headings = parts.flatMap((line, index) => /^第七卷\s/.test(line.trim())
  ? [{ line: index + 1, text: line.trim() }] : []);
const info = {
  source, target, decoding: 'GB18030 (GBK compatible)',
  transformations: 'Encoding only; preserve all decoded characters and line breaks.',
  lineNumbering: '1-based physical lines; blank lines counted; final empty split token not counted.',
  sourceBytes: raw.length, sourceSha256: hash(raw), utf8Sha256: hash(Buffer.from(decoded, 'utf8')),
  lineCount, headings,
};
if (fs.existsSync(receipt)) throw new Error('Receipt already exists; not overwritten.');
fs.writeFileSync(receipt, JSON.stringify(info, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ...info, tail: parts.slice(-13) }, null, 2));
