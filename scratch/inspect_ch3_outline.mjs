import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

console.log('--- Chapter 3 overview ---');
for (let i = 4762; i < 6420; i += 120) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
