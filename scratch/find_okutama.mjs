import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

for (let i = 2210; i < 4760; i++) {
  if (lines[i].includes('奥多摩') || lines[i].includes('怪物')) {
    console.log(`L${i + 1}: ${lines[i]}`);
  }
}
