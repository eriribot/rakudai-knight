import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

lines.forEach((l, i) => {
  if (l.includes('南乡') || l.includes('斗神') || l.includes('寅次郎')) {
    console.log(`L${i + 1}: ${l}`);
  }
});
