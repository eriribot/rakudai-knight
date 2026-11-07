import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDualWorldbookPlan } from './build-dual-mvu-worldbook-update.mjs';
import { resolveMvuWorld } from './rakudai-mvu-structure.mjs';

// 只读预览：把更新器将要写入的每条正文连同渲染结果导出成 txt，方便人工核对。
// 不修改任何世界书、不改模板，也不参与构建。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'output/worldbook-preview');
const require = createRequire(path.join(root, 'output/worldbook-calibration/dev/package.json'));
const ejs = require('ejs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const templates = {
  list: read('世界书规则/MVU/变量列表.txt'),
  update: read('世界书规则/MVU/变量更新规则.txt'),
  format: read('世界书规则/MVU/变量输出格式.txt'),
  init: read('世界书规则/MVU/[initvar]变量初始化.yaml'),
};
const LORE = ['世界设定', '魔力', '能力与招式', '伐刀者', '觉醒', '魔人', '能力系别'];
const LORE_SOURCE = '世界书规则/v0.3/导出/落第骑士英雄谭.json';

function loreBodies() {
  const file = path.join(root, LORE_SOURCE);
  if (!fs.existsSync(file)) return {};
  const card = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(card.entries) ? card.entries : Object.values(card.entries || {});
  return Object.fromEntries(LORE.map(name => [name, list.find(entry => entry.comment === name)?.content]));
}

const bodies = loreBodies();
const rows = [
  ['[MVU]变量列表', templates.list],
  ['[MVU]变量更新规则', templates.update],
  ['[MVU]变量输出格式', templates.format],
  ['[initvar]变量初始化', templates.init],
  ...LORE.map(name => [name, bodies[name]]),
];
const missing = LORE.filter(name => typeof bodies[name] !== 'string');
if (missing.length) throw new Error('缺少机制条目原文：' + missing.join('、'));
const book = { entries: Object.fromEntries(rows.map(([comment, content], index) => [String(index), {
  uid: index, comment, content, disable: false, position: 1,
}])) };
const plan = createDualWorldbookPlan(book, { templates, worldResolver: resolveMvuWorld.toString(), buttons: [] });
if (plan.skipped.length) throw new Error('条目未匹配：' + plan.skipped.join('、'));

const state = world => ({ 系统: { 结构版本: 4, 作品: world, 开局状态: '已建档', 主角模式: '自定义角色' }, 玩家: {}, 场景: {} });
const render = (content, world) => ejs.render(content, {
  getvar: key => key.split('.').reduce((value, part) => value?.[part], { stat_data: state(world) }),
});
const safe = name => name.replace(/[<>:"/\\|?*]/g, '_');
const write = (file, text) => {
  const target = path.join(outDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text.endsWith('\n') ? text : text + '\n', 'utf8');
};

fs.rmSync(outDir, { recursive: true, force: true });
const index = ['# 世界书条目正文预览', '',
  '由 `scripts/export-worldbook-preview.mjs` 生成，只读，不修改世界书。',
  '- `条目/`：更新器会写入的完整正文（含 EJS），可直接对照粘贴。',
  '- `渲染/落第/`、`渲染/学战/`：同一正文在两种 `系统.作品` 下的实际渲染结果。',
  '- 三条 MVU 规则按「现有正文即当前模板」计算，若你书里的落第正文更旧，那条以书里为准。',
  `- 七个机制条目的正文取自 ${LORE_SOURCE}，仅作示例；更新器不会改动它们的正文。`,
  '', '| 条目 | 类型 | 存储字数 | 落第渲染 | 学战渲染 |', '|---|---|---|---|---|'];

const INIT = '[initvar]变量初始化';
const changes = plan.changes.slice();
if (!changes.some(change => change.comment === INIT)) changes.push({ comment: INIT, content: templates.init });
if (!changes.some(change => LORE.includes(change.comment))) throw new Error('机制条目未出现在更新计划中');
for (const change of changes) {
  const name = change.comment, stored = change.content;
  const rk = render(stored, 'rakudai'), aw = render(stored, 'asterisk');
  write(path.join('条目', safe(name) + '.txt'), stored);
  write(path.join('渲染', '落第', safe(name) + '.txt'), rk);
  write(path.join('渲染', '学战', safe(name) + '.txt'), aw);
  index.push(`| ${name} | ${LORE.includes(name) ? '机制资料（只加包装）' : 'MVU 规则（换新版）'} | ${stored.length} | ${rk.length} | ${aw.length} |`);
}
write('00_索引.md', index.join('\n'));
console.log(JSON.stringify({ entries: changes.length, out: path.relative(root, outDir) }, null, 2));
