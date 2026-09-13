import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

function getSections(keyword, maxCount = 5, contextSize = 8) {
  console.log(`\n================== KEYWORD: ${keyword} ==================`);
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(keyword)) {
      console.log(`\n>>> Match at Line ${i + 1}:`);
      const s = Math.max(0, i - 3);
      const e = Math.min(lines.length, i + contextSize);
      for (let j = s; j < e; j++) {
        console.log(`${j + 1}: ${lines[j]}`);
      }
      found++;
      i += contextSize; // skip forward
      if (found >= maxCount) break;
    }
  }
}

getSections('寅次郎', 5, 12);
getSections('黑铁严', 5, 12);
getSections('赤座', 5, 12);
