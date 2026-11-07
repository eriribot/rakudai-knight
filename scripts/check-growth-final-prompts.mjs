// Execute the maintained EJS projection body; no host, model or saved-variable writes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const template = fs.readFileSync(new URL('../世界书规则/MVU/变量列表.txt', import.meta.url), 'utf8');
const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const ejs = require('ejs');
function project(state) {
  const rendered = ejs.render(template, { getvar: key => { assert.equal(key, 'stat_data'); return state; } });
  const json = rendered.match(/<status_current_variable>\s*([\s\S]*?)\s*<\/status_current_variable>/)?.[1];
  assert.ok(json, 'The shipped variable-list EJS projection must render a status JSON block.');
  return JSON.parse(json);
}

test('主模型只读到成长经验，历史申请/收据原样留档，其他业务字段保持', () => {
  const state = { 系统: { 结构版本: 4, 关系计分: { receipt: 'retained' } },
    场景: { 地点: '操场', 已发生事件: Object.fromEntries([1, 2, 3, 4, 5].map(index => ['训练' + index, { 结果: '已完成' }])) },
    玩家: { 自定义业务: { 保留: true }, 成长: { 经验: { 魔力控制: 30, 体能: 9 },
      申请: { 旧多目标: { 目标: ['魔力控制', '体能'], 经验: 40 } },
      记录: { receipt: { 获得: 40 } }, 回合结算: { 标识: 'old' }, 自定义历史: ['不删除'] } },
    人际: { 同伴: { 好感: 19 } }, $internal: { display_data: 'framework' } };
  const before = structuredClone(state), prompt = project(state);
  assert.deepEqual(prompt.玩家.成长, { 经验: { 魔力控制: 30, 体能: 9 } });
  assert.deepEqual(prompt.玩家.自定义业务, before.玩家.自定义业务);
  assert.deepEqual(prompt.人际, before.人际);
  assert.equal(prompt.$internal, undefined);
  assert.equal(prompt.系统.关系计分, undefined);
  assert.deepEqual(prompt.场景.已发生事件, Object.fromEntries(Object.entries(before.场景.已发生事件).slice(-4)));
  assert.deepEqual(state, before);
});

test('缺经验时不从旧申请推算，坏成长值保留供诊断，提示投影不改原值', () => {
  for (const growth of [{ 申请: { 旧请求: { 经验: 40 } } }, null, [], '旧坏值']) {
    const state = { 玩家: { 成长: growth } }, before = structuredClone(state), prompt = project(state);
    assert.deepEqual(prompt.玩家.成长, growth && typeof growth === 'object' && !Array.isArray(growth) ? {} : growth);
    assert.deepEqual(state, before);
  }
});
