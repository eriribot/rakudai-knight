import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSchema, INITIAL_STATE, RELATIONSHIP_SCORING, supportStage, romanceStage, enforceRelationshipScores } from '../世界书规则/MVU/schema.mjs';

// 只做离线小快照：沿用已有脚本，不调用 API、不写报告，也不模拟整套酒馆。
const require = createRequire(import.meta.url);
const { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), clone = structuredClone, name = '协作对象';
const evidence = '双方按约完成巡查，各自承担分工并确认结果';
const breakthrough = '连续多年把彼此列为首要联系人，重大决定会共同商议';
const relation = (values = {}) => ({ 关系: '本局确认的协作对象', 态度印象: '认可配合', 好感: 30, 支援度: 0, 羁绊阶段: '未建立', 变化依据: evidence, ...values });
function state(record = relation()) {
  const stat_data = clone(INITIAL_STATE);
  stat_data.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  stat_data.玩家.姓名 = '快照角色';
  stat_data.场景.当前章 = '第一章'; stat_data.场景.阶段 = '进行中';
  if (record) stat_data.人际[name] = record;
  return { stat_data };
}
function step(previous, changes, { replyKey = 'reply:1', submitted = true, relationshipCorrection = false } = {}) {
  const variables = clone(previous);
  const actual = variables.stat_data.人际[name] ??= relation({ 好感: null });
  Object.assign(actual, changes);
  // 显式提交依据与存档中恰好存在同文依据，是两种不同输入。
  const submittedFields = submitted ? ['变化依据', '好感突破依据', '好感', '支援度'].filter(field => Object.hasOwn(changes, field))
    .map(field => [JSON.stringify([name, field]), typeof changes[field] === 'string' ? changes[field].trim() : changes[field]]) : [];
  const notices = enforceRelationshipScores(variables, previous, { replyKey, submittedFields, relationshipCorrection });
  return { variables, actual, notices };
}
let passed = 0;
function test(label, run) { run(); passed++; console.log('通过：' + label); }

test('R10 数值范围、首次起点和支援阶段保持既定配置', () => {
  const { affection: a, support: s } = RELATIONSHIP_SCORING;
  assert.equal(RELATIONSHIP_SCORING.version, 'R10-按回复分项结算');
  assert.deepEqual(a, { min: 0, max: 1000, initial: 0, ordinaryMin: 2, ordinaryMax: 10, mediumMin: 11, mediumMax: 20, majorMin: 21, majorMax: 40,
    decrease: { ordinaryMin: 1, ordinaryMax: 5, mediumMin: 6, mediumMax: 10, majorMin: 11, majorMax: 20 }, backgroundMin: 70, backgroundMax: 200 });
  assert.deepEqual([s.min, s.max, s.initial, s.ordinaryMin, s.ordinaryMax, s.mediumMin, s.mediumMax, s.majorMin, s.majorMax], [0, 320, 0, 1, 5, 6, 10, 10, 15]);
  for (const [value, stage] of [[0, '未建立'], [80, 'C'], [160, 'B'], [240, 'A'], [320, 'S']]) assert.equal(supportStage(value), stage);
  assert.equal(romanceStage(relation({ 性别: '女性', 好感: 800 })), '交往');
  assert.equal(romanceStage(relation({ 性别: '男性', 好感: 800 })), null);
});
test('真实 Zod 拒绝越界分数，正常剧情幅度不因突破依据放大', () => {
  for (const values of [{ 好感: -1 }, { 好感: 1001 }, { 支援度: -1 }, { 支援度: 321 }, { 支援度: 0.5 }]) assert.equal(schema.safeParse(state(relation(values)).stat_data).success, false);
  for (const [delta, major, accepted] of [[20, false, true], [21, false, false], [40, true, true], [41, true, false], [-10, false, true], [-11, false, false], [-20, true, true], [-21, true, false]]) {
    const changes = { 好感: 100 + delta, 变化依据: evidence, ...(major ? { 好感突破依据: breakthrough } : {}) };
    assert.equal(step(state(relation({ 好感: 100 })), changes).actual.好感, accepted ? 100 + delta : 100);
  }
  assert.equal(step(state(), { 支援度: 15, 变化依据: evidence }).actual.支援度, 15);
  assert.equal(step(state(), { 支援度: 16, 变化依据: evidence }).actual.支援度, 0);
  assert.equal(step(state(relation({ 支援度: 5 })), { 支援度: 4, 变化依据: evidence }).actual.支援度, 5);
});
test('跨回复可使用相同依据和突破文案，同回复换词仍不能重复计分', () => {
  const first = step(state(), { 好感: 55, 变化依据: evidence, 好感突破依据: breakthrough });
  assert.equal(first.actual.好感, 55); assert.deepEqual(first.notices, []);
  const replay = step(JSON.parse(JSON.stringify(first.variables)), { 好感: 60, 变化依据: '改写措辞不能再领奖' });
  assert.equal(replay.actual.好感, 55);
  assert.ok(replay.notices.some(item => item.message.includes('已成功结算')));
  const next = step(first.variables, { 好感: 80, 变化依据: evidence, 好感突破依据: breakthrough }, { replyKey: 'reply:2' });
  assert.equal(next.actual.好感, 80); assert.deepEqual(next.notices, []);
  assert.equal(schema.parse(next.variables.stat_data).系统.关系计分.人物[name].好感.新值, 80);
});
test('好感成功、支援失败后，可同回复同依据只重试支援', () => {
  const first = step(state(), { 好感: 36, 支援度: 20, 变化依据: evidence });
  assert.deepEqual([first.actual.好感, first.actual.支援度], [36, 0]);
  assert.deepEqual(Object.keys(first.variables.stat_data.系统.关系计分.人物[name]), ['好感']);
  const retry = step(first.variables, { 支援度: 10, 变化依据: evidence });
  assert.deepEqual([retry.actual.好感, retry.actual.支援度], [36, 10]);
  assert.deepEqual(retry.notices, []);
  assert.equal(step(retry.variables, { 支援度: 15, 变化依据: evidence }).actual.支援度, 10);
  assert.deepEqual(schema.parse(retry.variables.stat_data).系统.关系计分.人物[name], { 好感: { 旧值: 30, 新值: 36 }, 支援度: { 旧值: 0, 新值: 10 } });
});
test('新人物部分计分失败不丢失支援起点，失败项不占收据', () => {
  const first = step(state(null), { 好感: 6, 支援度: 20, 变化依据: evidence });
  assert.deepEqual([first.actual.好感, first.actual.支援度], [6, 0]);
  const retry = step(first.variables, { 支援度: 5, 变化依据: evidence });
  assert.deepEqual([retry.actual.好感, retry.actual.支援度], [6, 5]);
  assert.equal(schema.safeParse(retry.variables.stat_data).success, true);
});
test('首次背景无需固定关键词，已有数字不能重新初始化', () => {
  for (const previous of [state(null), state(relation({ 好感: null }))]) {
    const result = step(previous, { 好感: 100, 变化依据: evidence, 好感突破依据: breakthrough });
    assert.equal(result.actual.好感, 100); assert.deepEqual(result.notices, []);
  }
  assert.equal(step(state(relation({ 好感: 50 })), { 好感: 100, 变化依据: evidence, 好感突破依据: breakthrough }).actual.好感, 50);
  assert.equal(step(state(null), { 好感: 100, 变化依据: evidence }).actual.好感, null);
});
test('旧字段缺失不会被拒分改成 null，未知支援仍待核定', () => {
  const previous = state(); delete previous.stat_data.人际[name].好感;
  const first = step(previous, { 好感: 6, 变化依据: evidence });
  assert.equal(Object.hasOwn(first.actual, '好感'), false);
  assert.equal(Object.hasOwn(step(first.variables, { 好感: 6, 变化依据: evidence }).actual, '好感'), false);
  for (const support of [null, undefined]) {
    const old = state(relation({ 支援度: support }));
    if (support === undefined) delete old.stat_data.人际[name].支援度;
    const result = step(old, { 支援度: 5, 变化依据: evidence });
    assert.deepEqual(result.actual, old.stat_data.人际[name]);
  }
});
test('无真实来源或未显式提交依据时拒分，错误包含旧值与差值', () => {
  for (const options of [{ replyKey: '' }, { submitted: false }]) {
    const result = step(state(), { 好感: 36, 变化依据: evidence }, options);
    assert.equal(result.actual.好感, 30);
    assert.equal(result.variables.stat_data.系统.关系计分, undefined);
    assert.ok(result.notices.some(item => item.message.includes('旧值30') && item.message.includes('差值+6')));
  }
  assert.equal(step(state(), { 好感: 36 }).actual.好感, 30);
});
// 手动校正已有数字是替换最终值；主回复、首次计分和无来源写入仍沿用普通保护。
test('P02 校正已成功的好感与支援，保留首次旧值并阻止主回复重领', () => {
  const first = step(state(relation({ 好感: null })), { 好感: 6, 支援度: 5, 变化依据: evidence });
  const fixed = step(first.variables, { 好感: 200, 支援度: 2, 变化依据: '玩家确认旧值误记，按本局事实改为最终值' }, { relationshipCorrection: true });
  assert.deepEqual([fixed.actual.好感, fixed.actual.支援度], [200, 2]); assert.deepEqual(fixed.notices, []);
  assert.deepEqual(schema.parse(fixed.variables.stat_data).系统.关系计分.人物[name], { 好感: { 旧值: null, 新值: 200 }, 支援度: { 旧值: 0, 新值: 2 } });
  assert.equal(step(fixed.variables, { 好感: 205, 变化依据: evidence }).actual.好感, 200);
  assert.equal(step(fixed.variables, { 支援度: 3, 变化依据: evidence }).actual.支援度, 2);
  assert.equal(step(fixed.variables, { 好感: 1001, 变化依据: evidence }, { relationshipCorrection: true }).actual.好感, 200);
  assert.equal(step(fixed.variables, { 支援度: 2.5, 变化依据: evidence }, { relationshipCorrection: true }).actual.支援度, 2);
});
test('P02 仍须真实来源和本次依据，新数字仍按普通计分，越界旧账可修为合法值', () => {
  for (const options of [{ replyKey: '' }, { submitted: false }]) {
    assert.equal(step(state(), { 好感: 200, 变化依据: evidence }, { relationshipCorrection: true, ...options }).actual.好感, 30);
  }
  assert.equal(step(state(null), { 好感: 200, 变化依据: evidence }, { relationshipCorrection: true }).actual.好感, null);
  const fixed = step(state(relation({ 好感: 1200 })), { 好感: 800, 变化依据: evidence }, { relationshipCorrection: true });
  assert.equal(schema.parse(fixed.variables.stat_data).系统.关系计分.人物[name].好感.旧值, 1200);
});
console.log(`R10/P02 离线快照 ${passed}/${passed} 通过；未连接真实酒馆。`);
