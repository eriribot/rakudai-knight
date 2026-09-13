import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

console.log('--- Chapter 2 overview ---');
// print lines around key points
for (let i = 2211; i < 4761; i += 150) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
