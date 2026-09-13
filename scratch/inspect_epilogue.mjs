import fs from 'node:fs';

const buf = fs.readFileSync('落第骑士英雄谭 第三卷 gbk.txt');
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

console.log('--- Epilogue lines (8656-8920) ---');
for (let i = 8655; i < 8920; i += 20) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
