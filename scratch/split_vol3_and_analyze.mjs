import fs from 'node:fs';
import path from 'node:path';

const srcFile = '落第骑士英雄谭 第三卷 gbk.txt';
const buf = fs.readFileSync(srcFile);
const text = new TextDecoder('gbk').decode(buf);
const lines = text.split(/\r?\n/);

const outDir = '第三卷-世界书整理';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
['人物条目', '场景条目', '组织条目'].forEach(d => {
  const p = path.join(outDir, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const chapterRanges = [
  { name: '第三卷_序章_珠雫的挑战.txt', title: '序章 珠雫的挑战', start: 3, end: 229 },
  { name: '第三卷_第一章_深海魔女VS雷切.txt', title: '第一章〈深海魔女〉VS〈雷切〉', start: 230, end: 2210 },
  { name: '第三卷_第二章_奥多摩的怪物.txt', title: '第二章 奥多摩的怪物', start: 2211, end: 4761 },
  { name: '第三卷_第三章_身陷逆境的落第骑士.txt', title: '第三章 身陷逆境的〈落第骑士〉', start: 4762, end: 6420 },
  { name: '第三卷_第四章_一刀两断.txt', title: '第四章 一刀两断', start: 6421, end: 8655 },
  { name: '第三卷_终章_无冕剑王.txt', title: '终章 无冕剑王', start: 8656, end: 8920 },
  { name: '第三卷_后记.txt', title: '后记', start: 8921, end: lines.length },
];

const stats = [];
for (const ch of chapterRanges) {
  const chLines = lines.slice(ch.start - 1, ch.end);
  const chText = chLines.join('\n');
  const filePath = path.join(outDir, ch.name);
  fs.writeFileSync(filePath, chText, 'utf8');
  stats.push({
    file: ch.name,
    title: ch.title,
    start: ch.start,
    end: ch.end,
    lineCount: chLines.length,
    charCount: chText.length,
  });
  console.log(`Saved ${ch.name}: ${chLines.length} lines, ${chText.length} chars (L${ch.start}-L${ch.end})`);
}

fs.writeFileSync(path.join(outDir, 'split_stats.json'), JSON.stringify(stats, null, 2), 'utf8');
