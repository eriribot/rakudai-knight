import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDualWorldbookPlan } from './build-dual-mvu-worldbook-update.mjs';
import { resolveMvuWorld } from './rakudai-mvu-structure.mjs';

// 世界书 JSON 与酒馆更新器共用同一份计划；三条 MVU 直接同步模板，先备份再写。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target) throw new Error('用法：node scripts/apply-dual-mvu-to-card.mjs <世界书.json>');
const file = path.resolve(target);
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const templates = {
  list: read('世界书规则/MVU/变量列表.txt'),
  update: read('世界书规则/MVU/变量更新规则.txt'),
  format: read('世界书规则/MVU/变量输出格式.txt'),
  init: read('世界书规则/MVU/[initvar]变量初始化.yaml'),
  world: read('世界书规则/MVU/双作品世界设定.ejs.txt'),
};
const raw = fs.readFileSync(file, 'utf8');
const card = JSON.parse(raw);
const entries = card.entries;
const plan = createDualWorldbookPlan(card, { templates, worldResolver: resolveMvuWorld.toString(), buttons: [] });
const rows = Object.entries(entries);

const updated = structuredClone(entries);
const report = [];
for (const change of plan.changes) {
  const entry = updated[change.key];
  if (!entry) throw new Error('计划中的条目不存在：' + change.comment);
  report.push({ uid: entry.uid, comment: entry.comment, before: entry.content.length, after: change.content.length });
  entry.content = change.content;
}
const backup = file.replace(/\.json$/i, '') + '.before-dual-mvu.json';
if (plan.changes.length) {
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw, 'utf8');
  fs.writeFileSync(file, JSON.stringify({ ...card, entries: updated }), 'utf8');
}

// 回读核对：目标条目内容一致，其余条目逐字段未变。
const after = JSON.parse(fs.readFileSync(file, 'utf8'));
const changedKeys = new Set(plan.changes.map(change => change.key));
for (const change of plan.changes) {
  if (after.entries[change.key].content !== change.content) throw new Error('写入后内容不一致：' + change.comment);
}
let untouched = 0;
for (const [key, entry] of rows) {
  if (changedKeys.has(key)) continue;
  if (JSON.stringify(after.entries[key]) !== JSON.stringify(entry)) throw new Error('非目标条目被改动：' + entry.comment);
  untouched++;
}
if (Object.keys(after.entries).length !== rows.length) throw new Error('条目数量发生变化');

const lines = ['# 世界书条目更新：' + path.basename(file), '',
  '备份：`' + path.basename(backup) + '`', '', '| UID | 条目 | 原字数 | 新字数 |', '|---|---|---|---|',
  ...report.map(row => `| ${row.uid} | ${row.comment} | ${row.before} | ${row.after} |`), '',
  `未改动的条目：${untouched} 条，逐字段比对一致。`];
const reportPath = path.join(root, 'output/worldbook-preview', '卡片条目更新报告.md');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8');
console.log(JSON.stringify({ file, backup, changed: report.length, untouched, skipped: plan.skipped, report: path.relative(root, reportPath) }, null, 2));
