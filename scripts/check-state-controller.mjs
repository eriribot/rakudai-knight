import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createSchema, INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { createStateController, applyOpening, applyOpeningReplacement, assertOpeningReplacementState, applyTransition, enforceStateOwnership } from './rakudai-state-core.mjs';
const require = createRequire(import.meta.url);
const { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), clone = structuredClone, results = [];
const payload = (name = '测试角色') => ({
  系统: { 结构版本: 4, 主角模式: '自定义角色', 开局状态: '待建档' },
  玩家: { ...clone(INITIAL_STATE.玩家), 姓名: name, 登记等级: 'A',
    综合初评: { 规则版本: 'R05-第一版', 分数: 5.333333333333333, 等级: 'B', 拟定登记等级: null, 评定状态: '已计算', 待填写项: [] } },
  场景: { 当前章: '第一章', 时间: '春假早晨', 地点: '理事长办公室', 切入说明: '报到' },
});
function fixture() {
  let data = { stat_data: clone(INITIAL_STATE), display_data: { existing: true }, delta_data: {}, unrelated: { keep: 1 } };
  let scope = 1, writes = 0, fail = false, noWrite = false, replacementAllowed = true;
  const adapter = {
    validate: state => schema.parse(state),
    assertOpeningReplacement: token => {
      if (token.scope !== scope) throw new Error('分支变化');
      if (!replacementAllowed) throw new Error('本局已经产生后续聊天');
      assertOpeningReplacementState(data.stat_data);
    },
    capture: () => ({ data: clone(data), scope }),
    current: token => { if (token.scope !== scope) throw new Error('分支变化'); return { data: clone(data) }; },
    write: async (token, before, state) => {
      if (scope !== token.scope) throw new Error('分支变化');
      writes++;
      if (!noWrite) data = { ...clone(data), stat_data: clone(state) };
      if (fail) throw new Error('保存响应失败');
    },
  };
  const api = createStateController(adapter);
  return { api, adapter, forbidReplacement() { replacementAllowed = false; }, get data() { return data; }, get writes() { return writes; }, change(fn) { fn(data); }, switch() { scope++; }, fail() { fail = true; }, noWrite() { noWrite = true; } };
}
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (e) { results.push({ name, passed: false, error: e.message }); } }
await check('建档一次整体写入且采用页面分数、保留包装字段', async () => {
  const f = fixture(), { token } = await f.api.capture();
  const result = await f.api.commitOpening(token, payload());
  assert.equal(result.state.系统.开局状态, '已建档'); assert.equal(result.state.场景.阶段, '进行中');
  assert.equal(result.state.玩家.登记等级, null); assert.equal(result.state.玩家.综合初评.分数, 5.333333333333333);
  assert.deepEqual(f.data.unrelated, { keep: 1 });
  await f.api.commitOpening(token, payload()); assert.equal(f.writes, 1);
  await assert.rejects(f.api.commitOpening(token, payload('另一个角色')), /原操作/);
  await assert.rejects(f.api.commitOpening((await f.api.capture()).token, payload()), /已建档/);
});
await check('独立替换将黎恩改为有马风月，保留人际、系统附加信息及包装', async () => {
  const f = fixture();
  f.change(data => {
    data.stat_data = schema.parse(applyOpening(clone(INITIAL_STATE), payload('黎恩')));
    data.stat_data.系统.已删除人物 = ['旧名'];
    data.stat_data.人际.同伴 = { 关系: '朋友', 态度印象: '保留', 性别: '女性', 好感: 80, 支援度: 0, 羁绊阶段: '未建立', 恋爱阶段: '路人', 变化依据: '初始朋友' };
    data.stat_data = schema.parse(data.stat_data);
  });
  const before = clone(f.data), { token } = await f.api.capture(), next = payload('有马风月');
  next.场景 = { 当前章: '第二章', 时间: '次日清晨', 地点: '新地点', 切入说明: '改选开局' };
  await assert.rejects(f.api.commitOpening(token, next), /已建档/);
  const changed = await f.api.replaceOpening(token, next);
  assert.equal(changed.state.玩家.姓名, '有马风月');
  assert.deepEqual(changed.state.人际, before.stat_data.人际);
  assert.deepEqual(changed.state.系统, before.stat_data.系统);
  assert.equal(changed.state.场景.地点, '新地点');
  assert.deepEqual(f.data.unrelated, before.unrelated);
  await f.api.replaceOpening(token, next); await f.api.verify(token); assert.equal(f.writes, 1);
  f.forbidReplacement();
  await assert.rejects(f.api.replaceOpening(token, next), /后续聊天/);
  await assert.rejects(f.api.verify(token), /后续聊天/); assert.equal(f.writes, 1);
});
await check('已有事件、其他卷或未建档状态不能替换，已有竞争修改也不覆盖', async () => {
  for (const mutate of [
    s => { s.场景.已发生事件.报到 = { 卷号: 1, 章段: '第一章', 结果: '已发生', 参与者: [], 知情者: [] }; },
    s => { s.场景.当前卷 = 2; },
    s => { s.系统.开局状态 = '待建档'; },
  ]) {
    const before = applyOpening(clone(INITIAL_STATE), payload('黎恩')); mutate(before);
    assert.throws(() => applyOpeningReplacement(before, payload('有马风月')));
  }
  const f = fixture(); f.change(d => { d.stat_data = applyOpening(clone(INITIAL_STATE), payload('黎恩')); });
  const { token } = await f.api.capture(); f.change(d => { d.unrelated.keep = 2; });
  await assert.rejects(f.api.replaceOpening(token, payload('有马风月')), /其他操作/); assert.equal(f.writes, 0);
});
await check('替换必须具备同步宿主范围校验，觉醒仍仅接受布尔值', async () => {
  for (const invalid of ['true', 1]) {
    const f = fixture(); f.change(d => { d.stat_data = applyOpening(clone(INITIAL_STATE), payload('黎恩')); });
    const p = payload('有马风月'); p.玩家.魔人觉醒 = invalid;
    await assert.rejects(f.api.replaceOpening((await f.api.capture()).token, p)); assert.equal(f.writes, 0);
  }
  for (const guard of [undefined, () => Promise.resolve()]) {
    const f = fixture(); f.change(d => { d.stat_data = applyOpening(clone(INITIAL_STATE), payload('黎恩')); });
    f.adapter.assertOpeningReplacement = guard;
    await assert.rejects(f.api.replaceOpening((await f.api.capture()).token, payload('有马风月')), /状态服务|同步宿主/); assert.equal(f.writes, 0);
  }
});
await check('一辉模式为 F 且不重建一辉 NPC', async () => {
  const f = fixture(), p = payload('黑铁一辉'); p.系统.主角模式 = '黑铁一辉';
  const result = await f.api.commitOpening((await f.api.capture()).token, p);
  assert.equal(result.state.玩家.登记等级, 'F'); assert.deepEqual(result.state.人际, {});
});
await check('两种身份模式建档都固定男性，缺性别的旧草稿兼容且不改输入', async () => {
  for (const mode of ['自定义角色', '黑铁一辉']) {
    const f = fixture(), p = payload(mode === '黑铁一辉' ? '黑铁一辉' : '测试玩家');
    p.系统.主角模式 = mode;
    delete p.玩家.性别;
    f.change(data => { delete data.stat_data.玩家.性别; });
    const before = clone(f.data), originalPayload = clone(p);
    const { state, token } = await f.api.capture();
    assert.equal(state.玩家.性别, '男性');
    assert.deepEqual(f.data, before);
    assert.equal(f.writes, 0);
    const candidate = applyOpening(before.stat_data, p);
    assert.equal(candidate.玩家.性别, '男性');
    const result = await f.api.commitOpening(token, p);
    assert.equal(result.state.玩家.性别, '男性');
    assert.equal(f.data.stat_data.玩家.性别, '男性');
    assert.deepEqual(result.state.人际, {});
    assert.deepEqual(p, originalPayload);
    assert.equal(f.writes, 1);
  }
});
await check('建档草稿显式其他玩家性别在纯规则和写入前均拒绝', async () => {
  for (const value of ['女性', '未知', '', null, [], {}]) {
    const f = fixture(), p = payload(); p.玩家.性别 = value;
    const before = clone(f.data), originalPayload = clone(p);
    assert.throws(() => applyOpening(before.stat_data, p), /男性/);
    await assert.rejects(f.api.commitOpening((await f.api.capture()).token, p), /男性/);
    assert.equal(f.writes, 0);
    assert.deepEqual(f.data, before);
    assert.deepEqual(p, originalPayload);
  }
});
await check('切聊天或 swipe 导致旧凭据不能提交', async () => {
  const f = fixture(), { token } = await f.api.capture(); f.switch();
  await assert.rejects(f.api.commitOpening(token, payload()), /分支变化/); assert.equal(f.writes, 0);
});
await check('其他更新抢先完成时不覆盖', async () => {
  const f = fixture(), { token } = await f.api.capture(); f.change(d => { d.unrelated.keep = 2; });
  await assert.rejects(f.api.commitOpening(token, payload()), /其他操作/); assert.equal(f.writes, 0);
});
await check('无效字段在写入前拒绝', async () => {
  const f = fixture(), p = payload(); p.玩家.MP = 10;
  await assert.rejects(f.api.commitOpening((await f.api.capture()).token, p)); assert.equal(f.writes, 0);
});
await check('写入未落地时不给成功', async () => {
  const f = fixture(); f.noWrite();
  await assert.rejects(f.api.commitOpening((await f.api.capture()).token, payload()), /回读/);
});
await check('写入落地但响应失败：重试只回读不重写', async () => {
  const f = fixture(), { token } = await f.api.capture(); f.fail();
  await assert.rejects(f.api.commitOpening(token, payload()), /保存响应失败/);
  const second = await f.api.commitOpening(token, payload());
  assert.equal(second.alreadyApplied, true); assert.equal(f.writes, 1);
});
await check('重复点击只有一个写入', async () => {
  const f = fixture(), { token } = await f.api.capture();
  const results = await Promise.allSettled([f.api.commitOpening(token, payload()), f.api.commitOpening(token, payload())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.writes, 1);
});
await check('已确认场景不可被建档重置', () => {
  const before = clone(INITIAL_STATE); before.场景.地点 = '宿舍';
  assert.throws(() => applyOpening(before, payload()), /冲突/);
  before.场景.地点 = '理事长办公室'; before.场景.已发生事件.报到通知 = { 卷号: 1, 章段: '第一章', 结果: '已收到通知', 参与者: [], 知情者: [] };
  const after = applyOpening(before, payload()); assert.deepEqual(after.场景.已发生事件, before.场景.已发生事件);
});
await check('卷内章段依序结束和开始，卷末必须使用单独跨卷操作', () => {
  const first = applyOpening(clone(INITIAL_STATE), payload());
  assert.throws(() => applyTransition(first, { action: 'next' }), /先确认/);
  const ended = applyTransition(first, { action: 'end' });
  const next = applyTransition(ended, { action: 'next' }); assert.equal(next.场景.当前章, '第二章'); assert.equal(next.场景.阶段, '未开始');
  assert.equal(applyTransition(next, { action: 'start' }).场景.阶段, '进行中');
  ended.场景.当前章 = '终章'; assert.throws(() => applyTransition(ended, { action: 'next' }), /当前卷末/);
});
await check('模型父对象替换不能绕过系统和章段所有权', () => {
  const state = applyOpening(clone(INITIAL_STATE), payload());
  const before = { stat_data: state }, after = clone(before);
  after.stat_data.系统.开局状态 = '待建档'; after.stat_data.场景.当前章 = '第四章'; after.stat_data.场景.地点 = '训练场';
  after.stat_data.玩家.综合初评.分数 = 6;
  const changes = enforceStateOwnership(after, before); assert.equal(changes.length, 3);
  assert.deepEqual(after.stat_data.系统, state.系统); assert.equal(after.stat_data.场景.当前章, '第一章');
  assert.equal(after.stat_data.场景.地点, '训练场'); assert.deepEqual(after.stat_data.玩家.综合初评, state.玩家.综合初评);
});
await check('已建档玩家性别修改或删除会复原，合法剧情更新照常保留', () => {
  const previous = { stat_data: applyOpening(clone(INITIAL_STATE), payload()) };
  const original = clone(previous);
  for (const value of ['女性', '未知', null, undefined]) {
    const variables = clone(previous);
    if (value === undefined) delete variables.stat_data.玩家.性别;
    else variables.stat_data.玩家.性别 = value;
    variables.stat_data.场景.地点 = '本轮已确认的训练场';
    variables.stat_data.玩家.战斗风格 = '本轮确认调整了防守步法';
    const changed = enforceStateOwnership(variables, previous);
    assert.ok(changed.includes('/玩家/性别'));
    assert.equal(variables.stat_data.玩家.性别, '男性');
    assert.equal(variables.stat_data.场景.地点, '本轮已确认的训练场');
    assert.equal(variables.stat_data.玩家.战斗风格, '本轮确认调整了防守步法');
    assert.deepEqual(previous, original);
  }
});
await check('替换玩家父对象也不能改性别，NPC 性别及恋爱阶段不被玩家约束重写', () => {
  const previous = { stat_data: applyOpening(clone(INITIAL_STATE), payload()) };
  const variables = clone(previous);
  variables.stat_data.玩家 = { ...clone(previous.stat_data.玩家), 性别: '女性', 战斗风格: '父对象更新中的真实战斗变化' };
  variables.stat_data.人际 = {
    女性同伴: { 性别: '女性', 好感: 800, 恋爱阶段: '交往' },
    男性同伴: { 性别: '男性', 好感: 1000, 支援度: 320, 羁绊阶段: 'S' },
  };
  const expectedRelations = clone(variables.stat_data.人际);
  const changed = enforceStateOwnership(variables, previous);
  assert.ok(changed.includes('/玩家/性别'));
  assert.equal(variables.stat_data.玩家.性别, '男性');
  assert.equal(variables.stat_data.玩家.战斗风格, '父对象更新中的真实战斗变化');
  assert.deepEqual(variables.stat_data.人际, expectedRelations);
});
await check('已建档旧存档缺玩家性别时保护仍固定男性，不把历史缺字段作为可选路线', () => {
  const previous = { stat_data: applyOpening(clone(INITIAL_STATE), payload()) };
  delete previous.stat_data.玩家.性别;
  const original = clone(previous), variables = clone(previous);
  variables.stat_data.玩家.性别 = '女性';
  const changed = enforceStateOwnership(variables, previous);
  assert.ok(changed.includes('/玩家/性别'));
  assert.equal(variables.stat_data.玩家.性别, '男性');
  assert.deepEqual(previous, original);
});
await check('待建档时模型无法代为初始化', () => {
  const before = { stat_data: clone(INITIAL_STATE) }, after = { stat_data: applyOpening(clone(INITIAL_STATE), payload()) };
  enforceStateOwnership(after, before); assert.deepEqual(after, before);
});
await check('更新把stat_data置空、换成字符串或数组时恢复', () => {
  const previous = { stat_data: applyOpening(clone(INITIAL_STATE), payload()) };
  for (const invalid of [null, 'bad', []]) {
    const variables = { stat_data: invalid };
    assert.deepEqual(enforceStateOwnership(variables, previous), ['/stat_data']);
    assert.deepEqual(variables.stat_data, previous.stat_data);
  }
});
const report = { passed: results.filter(r => r.passed).length, total: results.length, results };
fs.writeFileSync(new URL('../output/worldbook-calibration/状态控制验证.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
