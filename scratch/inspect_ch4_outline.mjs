import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

console.log('--- Chapter 4 overview ---');
for (let i = 6421; i < 8655; i += 180) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
