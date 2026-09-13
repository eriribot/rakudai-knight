import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

console.log('--- Epilogue non-empty lines (8656-8920) ---');
for (let i = 8655; i < 8920; i++) {
  const t = lines[i].trim();
  if (t) console.log(`L${i + 1}: ${t}`);
}
