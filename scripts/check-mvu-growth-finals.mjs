import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createSchema, INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { applyOpening, applyTransition, enforceGrowthProgress } from './rakudai-state-core.mjs';
import { prepareRakudaiNativeMvu } from './rakudai-mvu-native.mjs';
import { inlineStoryCatalog, inlineTournamentSource, stripModuleSyntax } from './story-build.mjs';

const require = createRequire(import.meta.url);
const { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), checks = [], clone = structuredClone;
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const plain = value => JSON.parse(JSON.stringify(value));
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
function state() {
  const value = clone(INITIAL_STATE);
  value.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  value.玩家.姓名 = '终值测试玩家';
  value.玩家.六维.魔力控制 = 'F'; value.玩家.六维.体能 = 'F'; value.玩家.六维.魔力量 = 'F';
  Object.assign(value.场景, { 当前卷: 1, 当前章: '第一章', 阶段: '进行中', 时间: '2013-04-21', 地点: '训练室' });
  return value;
}
function finals(before, values, axes = Object.keys(values.经验 || {}), grades = Object.keys(values.六维 || {}), replyKey = 'reply-0') {
  const variables = { stat_data: clone(before) }, previous = { stat_data: clone(before) };
  Object.assign(variables.stat_data.玩家.成长.经验, values.经验 || {});
  Object.assign(variables.stat_data.玩家.六维, values.六维 || {});
  enforceGrowthProgress(variables, previous, { mode: 'final', replyKey, growthFinalAxes: axes, growthGradeAxes: grades });
  assert.deepEqual(previous.stat_data, before);
  return variables.stat_data;
}

const guardSource = [inlineStoryCatalog(), inlineTournamentSource(),
  stripModuleSyntax(read('../世界书规则/MVU/schema.mjs')),
  stripModuleSyntax(read('./rakudai-mvu-structure.mjs')),
  stripModuleSyntax(read('./rakudai-state-core.mjs')),
  stripModuleSyntax(read('./rakudai-mvu-reply-source.mjs')),
  read('./rakudai-mvu-guard.js'), 'installRakudaiMvuGuard(createSchema(z));',
].join('\n');
const wrap = ops => '<UpdateVariable><JSONPatch>' + JSON.stringify(ops) + '</JSONPatch></UpdateVariable>';
function guardFixture(ops) {
  const content = wrap(ops), ctx = { characterId: 7, groupId: null, chatId: 'offline-finals', chat: [{ mes: content }] };
  const hooks = new Map(), notices = [], H = { SillyTavern: { getContext: () => ctx } };
  const W = { parent: H, top: H, addEventListener() {},
    getChatMessages: () => [{ message_id: 0, message: ctx.chat[0].mes, swipe_id: 0 }] };
  const Mvu = { events: { COMMAND_PARSED: 'parsed', VARIABLE_UPDATE_ENDED: 'ended' } };
  const realm = vm.createContext({ window: W, z, structuredClone, Mvu,
    eventOn: (name, callback) => { hooks.set(name, callback); return { stop: () => hooks.delete(name) }; },
    console: { warn: value => notices.push(value), info: value => notices.push(value) } });
  vm.runInContext(guardSource, realm, { filename: 'actual-final-guard-source.js' });
  function update(before) {
    const variables = { stat_data: clone(before) }, previous = { stat_data: clone(before) };
    prepareRakudaiNativeMvu(variables, [W]);
    hooks.get('parsed')(variables, [], content);
    // 使用真实 schema 的逐操作校验入口；不借此声称已验证真实宿主保存。
    for (const op of ops) {
      const next = clone(variables.stat_data), parts = op.path.slice(1).split('/');
      const key = parts.pop(), parent = parts.reduce((value, field) => value[field], next);
      if (op.op === 'remove') delete parent[key];
      else parent[key] = clone(op.value);
      const parsed = schema.safeParse(next);
      if (parsed.success) variables.stat_data = parsed.data;
    }
    hooks.get('ended')(variables, previous);
    assert.deepEqual(previous.stat_data, before);
    assert.equal(schema.safeParse(variables.stat_data).success, true);
    return plain(variables.stat_data);
  }
  return { marker: H.__RK_MVU_GUARD_V4__, update, notices };
}

await check('初始化和建档都只有三轴零经验，不创建申请或奖励记录', () => {
  assert.deepEqual(INITIAL_STATE.玩家.成长, { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 } });
  const player = state().玩家; delete player.成长;
  const payload = { 系统: { 结构版本: 4, 主角模式: '自定义角色' }, 玩家: player,
    场景: { 当前章: '第一章', 时间: '2013-04-21', 地点: '训练室' } };
  const saved = applyOpening(clone(INITIAL_STATE), payload);
  assert.deepEqual(saved.玩家.成长, INITIAL_STATE.玩家.成长);
  assert.equal(Object.hasOwn(payload.玩家, '成长'), false);
});
await check('模型已完成晋级且提交档内余量时不再晋级', () => {
  const before = state(); before.玩家.成长.经验.魔力控制 = 90;
  const saved = finals(before, { 六维: { 魔力控制: 'F+' }, 经验: { 魔力控制: 30 } });
  assert.equal(saved.玩家.六维.魔力控制, 'F+'); assert.equal(saved.玩家.成长.经验.魔力控制, 30);
  assert.equal(Object.hasOwn(saved.玩家.成长, '申请'), false);
  assert.equal(Object.hasOwn(saved.玩家.成长, '记录'), false);
});
await check('溢出终值连续晋级且同回复重放不会重复消耗或再次升档', () => {
  const saved = finals(state(), { 经验: { 魔力控制: 300 } });
  assert.equal(saved.玩家.六维.魔力控制, 'E'); assert.equal(saved.玩家.成长.经验.魔力控制, 100);
  const replay = finals(saved, { 经验: { 魔力控制: 300 } });
  assert.equal(replay.玩家.六维.魔力控制, 'E'); assert.equal(replay.玩家.成长.经验.魔力控制, 100);
  assert.deepEqual(replay.玩家.成长.回合结算.终值收据, saved.玩家.成长.回合结算.终值收据);
});
await check('主副均可纠错终值，S保留高额经验且不强加9999奖励上限', () => {
  const before = state(); before.玩家.六维.魔力控制 = 'S';
  const high = finals(before, { 经验: { 魔力控制: 20000 } });
  assert.equal(high.玩家.成长.经验.魔力控制, 20000);
  const corrected = finals(high, { 经验: { 魔力控制: 7 } });
  assert.equal(corrected.玩家.成长.经验.魔力控制, 7);
  const magic = finals(state(), { 经验: { 魔力量: 500 } });
  assert.equal(magic.玩家.魔人觉醒, false); assert.equal(magic.玩家.成长.经验.魔力量, 500);
  assert.equal(magic.玩家.六维.魔力量, 'F');
});
await check('旧申请多目标数组保持原形，真实事件落实也不兑现；新改申请恢复旧值', () => {
  const before = state();
  before.玩家.成长.申请 = { 旧申请: { 来源事件: '本轮训练', 目标: ['魔力控制', '体能'], 经验: 90, 成果: '旧成果' } };
  before.玩家.成长.记录 = { 旧记录: { 来源事件: '已领训练', 目标: '体能', 类型: '旧类型', 获得: 5,
    活动指纹: 'old', 说明: '旧收据保持原文' } };
  const previous = { stat_data: clone(before) }, variables = clone(previous);
  variables.stat_data.场景.已发生事件.本轮训练 = { 卷号: 1, 章段: '第一章', 结果: '本轮实际完成', 参与者: [], 知情者: [] };
  variables.stat_data.玩家.成长.申请.新申请 = { 来源事件: '本轮训练', 目标: '体能', 经验: 40, 成果: '新成果' };
  variables.stat_data.玩家.成长.经验.魔力控制 = 10;
  enforceGrowthProgress(variables, previous, { mode: 'final', replyKey: 'reply-0', growthFinalAxes: ['魔力控制'] });
  assert.deepEqual(variables.stat_data.玩家.成长.申请, before.玩家.成长.申请);
  assert.deepEqual(variables.stat_data.玩家.成长.记录, before.玩家.成长.记录);
  assert.equal(variables.stat_data.玩家.成长.经验.体能, 0);
  assert.equal(variables.stat_data.玩家.成长.经验.魔力控制, 10);
  assert.deepEqual(schema.parse(before).玩家.成长.申请, before.玩家.成长.申请);
});
await check('没有历史申请时提交新申请也不创建留档或奖励', () => {
  const before = state(), variables = { stat_data: clone(before) };
  variables.stat_data.玩家.成长.申请 = { 新申请: { 目标: '体能', 经验: 40 } };
  enforceGrowthProgress(variables, { stat_data: before }, { mode: 'final', replyKey: 'reply-0' });
  assert.equal(Object.hasOwn(variables.stat_data.玩家.成长, '申请'), false);
  assert.equal(Object.hasOwn(variables.stat_data.玩家.成长, '记录'), false);
  assert.equal(variables.stat_data.玩家.成长.经验.体能, 0);
});
await check('手动跳章和跨卷保留历史申请/记录，无历史时不创造申请', () => {
  for (const request of [{ action: 'jump', volume: 1, chapter: '第二章', time: '2013-04-22', location: '宿舍', entryNote: '手动向前切入' },
    { action: 'nextVolume', time: '2013-04-22', location: '宿舍', entryNote: '手动进入下一卷' }]) {
    const before = state();
    if (request.action === 'nextVolume') Object.assign(before.场景, { 当前章: '终章', 阶段: '已结束' });
    const plainJump = applyTransition(before, request);
    assert.equal(Object.hasOwn(plainJump.玩家.成长, '申请'), false);
    assert.equal(Object.hasOwn(plainJump.玩家.成长, '记录'), false);
    before.玩家.成长.申请 = { 历史: { 目标: ['体能'], 经验: 40 } };
    before.玩家.成长.记录 = { 历史: { 未知旧字段: '留档' } };
    const saved = applyTransition(before, request);
    assert.deepEqual(saved.玩家.成长.申请, before.玩家.成长.申请);
    assert.deepEqual(saved.玩家.成长.记录, before.玩家.成长.记录);
    assert.match(saved.玩家.成长.最近提示, /已切入新场景/);
  }
});
await check('可选约束使用终值协议且保留相同补丁重放收据', () => {
  const f = guardFixture([{ op: 'replace', path: '/玩家/成长/经验/魔力控制', value: 300 }]);
  assert.equal(f.marker.growthProtocol, 'final-values-v1'); assert.equal(f.marker.growthMode, 'final');
  const saved = f.update(state()), replay = f.update(saved);
  assert.equal(saved.玩家.六维.魔力控制, 'E'); assert.equal(saved.玩家.成长.经验.魔力控制, 100);
  assert.equal(replay.玩家.六维.魔力控制, 'E'); assert.equal(replay.玩家.成长.经验.魔力控制, 100);
  assert.equal(Object.hasOwn(saved.玩家.成长, '申请'), false);
  assert.equal(f.notices.some(value => value.includes('历史申请') || value.includes('结算记录由代码维护')), false);
});
await check('约束拒绝字符串/负数经验和非法六维，其它合法事实照常保存', () => {
  for (const value of ['40', -1, 1.5]) {
    const f = guardFixture([{ op: 'replace', path: '/玩家/成长/经验/魔力控制', value },
      { op: 'replace', path: '/场景/地点', value: '本轮已确认的教室' }]);
    const saved = f.update(state());
    assert.equal(saved.玩家.成长.经验.魔力控制, 0); assert.equal(saved.场景.地点, '本轮已确认的教室');
  }
  assert.equal(schema.safeParse({ ...state(), 玩家: { ...state().玩家, 六维: { ...state().玩家.六维, 魔力控制: 'Z' } } }).success, false);
});

const report = { passed: checks.every(check => check.passed), checks,
  evidence: 'Real final-mode core, schema and guard sources executed offline; host and per-operation application doubled; no live Tavern writes.' };
const directory = new URL('../世界书规则/MVU/验证记录/终值成长/', import.meta.url);
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(new URL('终值结算验证.json', directory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
