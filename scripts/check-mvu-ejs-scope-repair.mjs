import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createMvuScopePlan, buildMvuScopeRepair } from './build-mvu-ejs-scope-repair.mjs';

const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const ejs = require('ejs');
function fixture() {
  const entries = Object.fromEntries(['[MVU]变量列表', '[MVU]变量更新规则', '[MVU]变量更新格式', '用户新写的第一章'].map((comment, index) => [String(index), {
    uid: index, comment, content: `<% const rkObject = ${index}; %>作者当前正文 <%= rkObject %>`,
    disable: false, order: 399 - index, depth: 1, custom: { retain: ['原数据', index] },
  }]));
  entries.backup = { ...structuredClone(entries['2']), uid: 9, comment: '[MVU]变量输出格式', disable: true };
  return { entries, unknownRoot: { untouched: true } };
}
function apply(book, plan) {
  const result = structuredClone(book);
  for (const change of plan.changes) result.entries[change.key].content = change.content;
  return result;
}

test('只包三条启用 MVU，原文、非目标条目及所有 metadata 保留', () => {
  const book = fixture(), before = structuredClone(book), plan = createMvuScopePlan(book), result = apply(book, plan);
  assert.deepEqual(plan.changes.map(row => row.uid), [0, 1, 2]);
  assert.deepEqual(book, before);
  assert.deepEqual(result.unknownRoot, before.unknownRoot);
  for (const [key, entry] of Object.entries(book.entries)) {
    const changed = plan.changes.find(row => row.key === key);
    if (!changed) { assert.deepEqual(result.entries[key], entry); continue; }
    assert.deepEqual(changed.before, entry);
    assert.equal(changed.content, '<% { /* MVU_ENTRY_SCOPE */ %>\n' + entry.content + '\n<% } %>');
    assert.deepEqual({ ...result.entries[key], content: entry.content }, entry);
  }
});

test('重复规划无变化，新旧输出格式名称均支持', () => {
  const book = fixture();
  assert.deepEqual(createMvuScopePlan(apply(book, createMvuScopePlan(book))).changes, []);
  book.entries['2'].comment = '[MVU]变量输出格式';
  assert.equal(createMvuScopePlan(book).changes.length, 3);
});

test('修复当前原文后，三个条目重复拼接也能编译且各自内容不变', () => {
  const plan = createMvuScopePlan(fixture());
  for (const options of [{}, { strict: true, _with: false }]) {
    const sources = plan.changes.map(row => row.content), expected = sources.map(source => ejs.render(source, {}, options)).join('\n');
    assert.equal(ejs.render([...sources, ...sources].join('\n'), {}, options), expected + '\n' + expected);
    for (const row of plan.changes) assert.equal(ejs.render(row.content, {}, options).trim(), ejs.render(row.before.content, {}, options).trim());
  }
});

test('目标缺失、多个启用格式、空正文时拒绝规划', () => {
  const missing = fixture(); delete missing.entries['0'];
  assert.throws(() => createMvuScopePlan(missing), /必须唯一/);
  const duplicate = fixture(); duplicate.entries.backup.disable = false;
  assert.throws(() => createMvuScopePlan(duplicate), /必须唯一/);
  const empty = fixture(); empty.entries['1'].content = '  ';
  assert.throws(() => createMvuScopePlan(empty), /正文为空/);
});

test('导入产物使用实时正文 planner，附带两个明确的操作按钮', () => {
  const artifact = buildMvuScopeRepair();
  assert.ok(artifact.content.includes(createMvuScopePlan.toString()));
  assert.deepEqual(artifact.button.buttons.map(button => button.name), ['预览 EJS 修复并备份', '应用 EJS 作用域修复']);
  assert.ok(!artifact.content.includes('"templates":'));
});
