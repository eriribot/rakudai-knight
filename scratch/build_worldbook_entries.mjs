import fs from 'node:fs';
import path from 'node:path';

const root = 'e:/web/落第';
const targetJson = path.join(root, '世界书规则/v0.3/导出/落第骑士英雄谭.json');
const wb = JSON.parse(fs.readFileSync(targetJson, 'utf8'));

// 1. Update [剧情]第一卷.终章 (uid: 23)
if (wb.entries[23]) {
  const epilogueSource = fs.readFileSync(path.join(root, '世界书规则/v0.3/13_终章场景.md'), 'utf8');
  const match = epilogueSource.match(/<!-- 正文开始 -->\n([\s\S]*?)\n<!-- 正文结束 -->/);
  if (match) {
    wb.entries[23].content = match[1].trim();
    wb.entries[23].order = 105;
    wb.entries[23].position = 0;
    wb.entries[23].disable = true;
    wb.entries[23].key = [];
    wb.entries[23].keysecondary = [];
    console.log('Updated uid 23: [剧情]第一卷.终章 (order: 105, disable: true)');
  }
}

console.log('Done check 1');
