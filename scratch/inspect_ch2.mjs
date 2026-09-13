import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

for (let i = 2300; i < 4600; i++) {
  if (lines[i].includes('老人') || lines[i].includes('老头') || lines[i].includes('老朽') || lines[i].includes('南乡') || lines[i].includes('斗神')) {
    console.log(`L${i + 1}: ${lines[i]}`);
  }
}
