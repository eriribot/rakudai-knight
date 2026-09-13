import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

console.log('Total lines:', lines.length);
lines.forEach((line, idx) => {
  const trimmed = line.trim();
  if (/^第三卷\s+(序章|第[一二三四五六七八九十]+章|终章|尾声|后记)/.test(trimmed) || /^(序章|第[一二三四五六七八九十]+章|终章|尾声|后记)\s+/.test(trimmed)) {
    console.log(`Line ${idx + 1}: ${trimmed}`);
  }
});
