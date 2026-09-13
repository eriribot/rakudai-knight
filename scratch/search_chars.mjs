import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

function searchContext(keywords, maxMatches = 10) {
  console.log(`=== Searching for [${keywords.join(', ')}] ===`);
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (keywords.some(k => l.includes(k))) {
      console.log(`--- L${i + 1} ---`);
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);
      for (let j = start; j < end; j++) {
        console.log(`${j + 1}: ${lines[j]}`);
      }
      count++;
      if (count >= maxMatches) break;
    }
  }
}

searchContext(['南乡', '寅次郎'], 6);
searchContext(['黑铁严', '严'], 6);
searchContext(['赤座'], 6);
