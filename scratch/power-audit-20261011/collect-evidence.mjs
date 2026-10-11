import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const files = [
  '世界书规则/v0.3/00_世界与数值边界.md',
  '世界书规则/v0.3/02_六维参照.md',
  '世界书规则/v0.3/03_综合初评与复核.md',
  '世界书规则/v0.3/04_魔力与成长.md',
  '世界书规则/v0.3/05_S羁绊与觉醒.md',
  '世界书规则/v0.3/07_能力与招式.md',
  '世界书规则/v0.3/README.md',
  '世界书规则/v0.3/条目配置.json',
  '世界书规则/MVU/schema.mjs',
  'scripts/sync-worldbook-calibration.mjs',
  'scripts/rakudai-state-core.mjs',
  'scripts/rakudai-mvu-growth.mjs',
  'scripts/build-chapter-release.mjs',
  'scripts/package-chapter-release.mjs',
  '世界书规则/MVU/变量更新规则.txt',
  '落第骑士英雄谭_TRPG战斗与世界书设计方案_v0.3讨论稿.md',
  '世界观/05_一刀罗刹.md',
  '世界观/06_无冕剑王.md',
  '世界观/11_魔人与命运外侧.md',
  '世界观/12_伐刀者与魔力法则.md',
  '第六卷-世界书整理/人物条目/鹤屋美琴.md',
  '第六卷-世界书整理/设定条目/史黛菈的龙之力.md',
  '第六卷-世界书整理/设定条目/反射术士与完全反射.md',
  '第六卷-世界书整理/设定条目/天愿与绝对不确定.md',
  '第六卷-世界书整理/设定条目/色彩魔法与幻想讽画.md',
  '落第骑士英雄谭 第六卷 gbk.txt',
  '第六卷-世界书整理/核验记录/第六卷原文_UTF8.txt',
  '落第骑士英雄谭 第九卷 gbk.txt',
  '第九卷-世界书整理/第九卷_终章（前）_约定之刻.txt',
];
const books = [
  '世界书规则/v0.3/导出/落第骑士英雄谭.json',
  '落第骑士英雄谭v0.03.json',
  '落第骑士英雄谭v0.05.json',
  'output/chapter-v4/落第骑士英雄谭-v1.3.6.json',
  'output/chapter-v4/落第骑士英雄谭-v1.3.6-世界书.json',
];
const evidence = {
  audit: '20261011-power-inflation',
  capturedAt: new Date().toISOString(),
  scope: 'repository snapshots only; no live SillyTavern import or prompt capture',
  approvedAction: 'audit and proposed corrections only',
  files: [], books: [],
};
for (const file of [...files, ...books]) {
  const raw = fs.readFileSync(path.join(root, file));
  evidence.files.push({ path: file, bytes: raw.length, sha256: hash(raw) });
}
for (const file of books) {
  const data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const entries = data.entries ?? data.data?.character_book?.entries ?? data.character_book?.entries;
  if (!entries) throw new Error(`Missing entries: ${file}`);
  const selected = Object.entries(entries).filter(([key, entry]) =>
    /^(世界设定|伐刀者|魔力|魔人|觉醒|羁绊与觉醒|能力与招式|诸星雄大)$/.test(entry.comment ?? entry.name ?? '')
  ).map(([key, entry]) => ({
    key, uid: entry.uid ?? entry.id,
    name: entry.comment ?? entry.name,
    constant: entry.constant ?? entry.extensions?.constant ?? null,
    disable: entry.disable ?? (typeof entry.enabled === 'boolean' ? !entry.enabled : null),
    contentSha256: hash(entry.content ?? ''),
    content: entry.content ?? '',
  }));
  evidence.books.push({ path: file, entryCount: Object.keys(entries).length, selected });
}
const target = path.join(root, 'scratch/power-audit-20261011/evidence-final.json');
fs.writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ capturedAt: evidence.capturedAt, files: evidence.files.length,
  books: evidence.books.map(book => ({ path: book.path, entryCount: book.entryCount,
    selected: book.selected.map(({ key, uid, name, constant, disable }) => ({ key, uid, name, constant, disable })) })) }, null, 2));
