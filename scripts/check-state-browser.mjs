import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const source = fs.readFileSync(new URL('./rakudai-state-controller.js', import.meta.url), 'utf8');
const clone = structuredClone, results = [];
const payload = () => ({ 系统: { 结构版本: 4, 主角模式: '自定义角色' }, 玩家: { ...clone(INITIAL_STATE.玩家), 姓名: '通用测试角色' }, 场景: { 当前章: '第一章', 时间: '春假早晨', 地点: '理事长室', 切入说明: '' } });
function fixture({ deferredMvu = false, nestedIframe = false, guarded = true } = {}) {
  const chat = [{ role: 'assistant', swipe: 0, text: ['开局一', '开局二'], variables: [{ stat_data: clone(INITIAL_STATE), custom: { untouched: true } }, { stat_data: clone(INITIAL_STATE) }] }];
  let ctx = { chat, chatId: 'test-chat', characterId: 1, groupId: null }, writes = 0, waitCalls = 0, iframeProxyReads = 0, parentProxyReads = 0, storageWrites = 0;
  const storage = new Map(), displayEvents = [];
  const H = {
    SillyTavern: { getContext: () => ctx },
    localStorage: {
      getItem: key => storage.has(String(key)) ? storage.get(String(key)) : null,
      setItem(key, value) { storage.set(String(key), String(value)); storageWrites++; },
      removeItem: key => storage.delete(String(key)),
    },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    dispatchEvent(event) { displayEvents.push(event); return true; },
  };
  if (guarded) H.__RK_MVU_GUARD_V4__ = { version: '4.0.0', growth: 'G03' };
  const parent = nestedIframe ? { get SillyTavern() { parentProxyReads++; return H.SillyTavern; } } : H;
  let ready;
  const initialized = new Promise(resolve => { ready = resolve; });
  const W = {
    parent, top: H, z,
    get SillyTavern() { iframeProxyReads++; return H.SillyTavern; },
    async waitGlobalInitialized(name) {
      assert.equal(this, W, '必须绑定本 iframe 的 Helper'); assert.equal(name, 'Mvu'); waitCalls++;
      if (!H.Mvu) await initialized;
      Object.defineProperty(W, 'Mvu', { configurable: true, get: () => H.Mvu });
    },
    getTavernHelperVersion: () => '4.8.19',
    getChatMessages: () => ctx.chat.map((m, i) => ({ message_id: i, role: m.role, swipe_id: m.swipe, swipes: m.text })).filter(m => m.role === 'assistant'),
    updateVariablesWith(updater, option) {
      assert.equal(option.type, 'message'); assert.equal(typeof option.message_id, 'number'); assert.equal(Object.hasOwn(option, 'swipe_id'), false);
      const message = ctx.chat[option.message_id], next = updater(clone(message.variables[message.swipe]));
      assert.equal(typeof next?.then, 'undefined');
      message.variables[message.swipe] = next; writes++; return next;
    },
  };
  const mvu = { getMvuData: option => clone(ctx.chat[option.message_id].variables[ctx.chat[option.message_id].swipe]), replaceMvuData() {} };
  function initializeMvu() { H.Mvu = mvu; ready(); }
  if (!deferredMvu) initializeMvu();
  const realm = vm.createContext({ window: W, structuredClone, console, URL });
  vm.runInContext(source, realm);
  return { api: W.RakudaiStateController, get display() { return W.RakudaiPlayerDisplay; }, W, H, storage, displayEvents, initializeMvu,
    get ctx() { return ctx; }, set ctx(value) { ctx = value; }, get writes() { return writes; }, get storageWrites() { return storageWrites; },
    get waitCalls() { return waitCalls; }, get proxyReads() { return { iframe: iframeProxyReads, parent: parentProxyReads }; } };
}
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } }
await check('副校正候选可独立完整校验，坏人物不通过且不读取或改写存档', () => {
  const f = fixture({ guarded: false }), state = clone(INITIAL_STATE), before = clone(f.ctx.chat);
  const valid = f.api.validateState(state);
  valid.场景.地点 = '仅改返回副本';
  assert.notEqual(state.场景.地点, valid.场景.地点);
  state.人际.黑铁一辉 = { 关系: '初识学长', 好感: 10, 支援: 0, 印象: '礼貌懂事的新生' };
  assert.throws(() => f.api.validateState(state), error => error.issues.some(issue => issue.path.includes('态度印象')));
  assert.deepEqual(f.ctx.chat, before); assert.equal(f.writes, 0); assert.equal(f.waitCalls, 0);
});
await check('旧v4虽同为4.0.0也必须在建档前提示缺少觉醒schema，不写入存档', async () => {
  const f = fixture(); delete f.H.__RK_MVU_GUARD_V4__.growth;
  await assert.rejects(f.api.capture(), /旧v4约束.*魔人觉醒/); assert.equal(f.writes, 0);
});
await check('消息iframe与scriptiframe都使用明确message接口并保留其他数据', async () => {
  const f = fixture(); const first = await f.api.capture({ messageId: 0 });
  await f.api.commitOpening(first.token, payload());
  assert.equal(f.ctx.chat[0].variables[0].stat_data.系统.开局状态, '已建档');
  assert.equal(f.ctx.chat[0].variables[1].stat_data.系统.开局状态, '待建档');
  assert.equal(f.ctx.chat[0].variables[0].custom.untouched, true);
  await f.api.verify(first.token); assert.equal(f.writes, 1);
});
await check('仅有开局楼层时独立替换玩家，保留人际及其他回复页；重复建档仍拒绝', async () => {
  const f = fixture(), first = payload(); first.玩家.姓名 = '黎恩';
  await f.api.commitOpening((await f.api.capture()).token, first);
  const state = f.ctx.chat[0].variables[0].stat_data;
  state.人际.同伴 = { 关系: '朋友', 态度印象: '保留', 性别: '女性', 好感: 80, 支援度: 0, 羁绊阶段: '未建立', 恋爱阶段: '路人', 变化依据: '初始朋友' };
  const before = clone(f.ctx.chat[0].variables), capture = await f.api.capture(), next = payload(); next.玩家.姓名 = '有马风月';
  next.场景 = { ...next.场景, 地点: '新地点', 时间: '次日清晨' };
  await assert.rejects(f.api.commitOpening(capture.token, next), /已建档/);
  await f.api.replaceOpening(capture.token, next); await f.api.replaceOpening(capture.token, next); await f.api.verify(capture.token);
  assert.equal(f.ctx.chat[0].variables[0].stat_data.玩家.姓名, '有马风月');
  assert.deepEqual(f.ctx.chat[0].variables[0].stat_data.人际, before[0].stat_data.人际);
  assert.deepEqual(f.ctx.chat[0].variables[1], before[1]); assert.equal(f.writes, 2);
  f.ctx.chat.push({ role: 'user', swipe: 0, text: ['继续'], variables: [{}] });
  await assert.rejects(f.api.replaceOpening(capture.token, next)); await assert.rejects(f.api.verify(capture.token)); assert.equal(f.writes, 2);
});
await check('真实聊天已有用户楼层或剧情事件时，不因助手列表仍只有楼层0而允许替换', async () => {
  for (const mutate of [
    f => { f.ctx.chat.push({ role: 'user', swipe: 0, text: ['继续'], variables: [{}] }); },
    f => { f.ctx.chat[0].variables[0].stat_data.场景.已发生事件.报到 = { 卷号: 1, 章段: '第一章', 结果: '已发生', 参与者: [], 知情者: [] }; },
  ]) {
    const f = fixture(); await f.api.commitOpening((await f.api.capture()).token, payload()); mutate(f);
    const saved = clone(f.ctx.chat), token = (await f.api.capture()).token;
    await assert.rejects(f.api.replaceOpening(token, payload()), /后续聊天|剧情事件/);
    assert.deepEqual(f.ctx.chat, saved); assert.equal(f.writes, 1);
  }
});
await check('替换临写时新增楼层、换回复页或竞争改变量均拒绝，不能靠先前页面检查放行', async () => {
  for (const mutate of [
    f => { f.ctx.chat.push({ role: 'user', swipe: 0, text: ['继续'], variables: [{}] }); },
    f => { f.ctx.chat[0].swipe = 1; },
    f => { f.ctx.chat[0].variables[0].custom.untouched = false; },
  ]) {
    const f = fixture(); await f.api.commitOpening((await f.api.capture()).token, payload());
    const token = (await f.api.capture()).token, update = f.W.updateVariablesWith;
    f.W.updateVariablesWith = (...args) => { mutate(f); return update(...args); };
    const next = payload(); next.玩家.姓名 = '有马风月';
    await assert.rejects(f.api.replaceOpening(token, next));
    assert.equal(f.ctx.chat[0].variables[0].stat_data.玩家.姓名, '通用测试角色'); assert.equal(f.writes, 1);
  }
});
await check('iframe自带SillyTavern getter且MVU稍后初始化时，等待本iframe并选择最外层宿主', async () => {
  const f = fixture({ deferredMvu: true, nestedIframe: true });
  assert.equal(Object.hasOwn(f.W, 'SillyTavern'), true); assert.equal(Object.hasOwn(f.W, 'Mvu'), false);
  let settled = false;
  const pending = f.api.capture().then(value => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false); assert.equal(f.waitCalls, 1); assert.equal(f.writes, 0);
  f.initializeMvu();
  const captured = await pending;
  assert.equal(f.W.Mvu, f.H.Mvu); assert.deepEqual(f.proxyReads, { iframe: 0, parent: 0 });
  await f.api.commitOpening(captured.token, payload()); await f.api.verify(captured.token);
  assert.equal(f.writes, 1); assert.equal(f.waitCalls, 1, '提交/回读的同步 CAS 不重新等待全局初始化');
});
await check('跨源top不可访问时继续使用同源parent，不让iframe代理掩盖宿主', async () => {
  const f = fixture();
  Object.defineProperty(f.W, 'top', { get() { throw new Error('Cross-origin top'); } });
  const captured = await f.api.capture();
  await f.api.commitOpening(captured.token, payload());
  assert.equal(f.writes, 1); assert.equal(f.proxyReads.iframe, 0);
});
await check('MVU等待失败时不读取或写入，恢复后可重新读取', async () => {
  const f = fixture(), wait = f.W.waitGlobalInitialized;
  f.W.waitGlobalInitialized = async () => { throw new Error('MVU 初始化失败'); };
  await assert.rejects(f.api.capture(), /MVU 初始化失败/); assert.equal(f.writes, 0);
  f.W.waitGlobalInitialized = wait;
  await f.api.capture(); assert.equal(f.writes, 0);
});
for (const [name, mutate] of [
  ['切swipe', f => { f.ctx.chat[0].swipe = 1; }],
  ['切聊天但变量相同', f => { f.ctx = { ...f.ctx, chat: clone(f.ctx.chat), chatId: 'another' }; }],
  ['当前 context 原地更换角色', f => { f.ctx.characterId = 2; }],
  ['当前 context 原地更换群组', f => { f.ctx.groupId = 'another-group'; }],
  ['当前 context 替换聊天数组但保留消息引用', f => { f.ctx.chat = [...f.ctx.chat]; }],
  ['楼层被删除后同位置重建', f => { f.ctx.chat[0] = clone(f.ctx.chat[0]); }],
  ['正文被编辑', f => { f.ctx.chat[0].text[0] = '新开局'; }],
  ['追加用户消息', f => { f.ctx.chat.push({ role: 'user', swipe: 0, text: ['新消息'], variables: [{}] }); }],
]) await check(name + '后旧凭据不能写入', async () => {
  const f = fixture(), { token } = await f.api.capture(); mutate(f);
  await assert.rejects(f.api.commitOpening(token, payload())); assert.equal(f.writes, 0);
});
await check('不允许旧开局页修改已有后续助手楼层', async () => {
  const f = fixture(); f.ctx.chat.push(clone(f.ctx.chat[0]));
  await assert.rejects(f.api.capture({ messageId: 0 }), /历史楼层/);
});
await check('关闭约束可读取和建档，只修当前回复页native schema并保留包装数据', async () => {
  const f = fixture({ guarded: false });
  for (const data of f.ctx.chat[0].variables) data.schema = '没有用别管这个';
  f.ctx.chat[0].swipe = 1;
  f.ctx.chat[0].variables[1].custom = { retained: ['未知包装字段', '原值保留'] };
  const before = clone(f.ctx.chat[0].variables), capture = await f.api.capture();
  assert.deepEqual(f.ctx.chat[0].variables, before, '读取不修复或保存变量');
  await f.api.commitOpening(capture.token, payload()); await f.api.verify(capture.token);
  const current = f.ctx.chat[0].variables[1];
  assert.equal(current.stat_data.系统.开局状态, '已建档');
  assert.equal(current.schema.type, 'object');
  assert.equal(current.schema.strictSet, true);
  assert.equal(current.schema.extensible, false); assert.equal(current.schema.recursiveExtensible, false);
  for (const key of ['系统', '场景', '玩家', '人际']) assert.equal(current.schema.properties[key].required, true);
  assert.equal(current.schema.properties.人际.extensible, true);
  assert.equal(current.schema.properties.人际.recursiveExtensible, true);
  assert.equal(current.schema.properties.场景.properties.时间.required, false);
  assert.deepEqual(current.custom, before[1].custom);
  assert.deepEqual(f.ctx.chat[0].variables[0], before[0]);
  assert.equal(f.writes, 1);
});
await check('native准备保留stat_data对象与业务值，只更新schema', () => {
  const f = fixture({ guarded: false }), data = clone(f.ctx.chat[0].variables[0]);
  data.stat_data.系统.已删除人物 = ['已删除人物一', '已删除人物二'];
  data.schema = '没有用别管这个';
  const reference = data.stat_data, before = clone(reference), custom = clone(data.custom);
  f.W.RakudaiMvuNative.prepare(data, [f.W, f.H], { repairStructure: false });
  assert.strictEqual(data.stat_data, reference); assert.deepEqual(data.stat_data, before); assert.deepEqual(data.custom, custom);
  assert.equal(data.schema.strictSet, true);
  assert.equal(data.schema.properties.系统.properties.已删除人物.type, 'array');
  assert.equal(data.schema.properties.系统.properties.已删除人物.elementType.type, 'string');
});
await check('关闭约束仍可切章、整理名册及保存赛程，controller公开自身能力', async () => {
  const f = fixture({ guarded: false }), draft = payload(); draft.场景.时间 = '2013-04-22 08:30';
  await f.api.commitOpening((await f.api.capture()).token, draft);
  assert.deepEqual(clone(f.api.capabilities), { scheduleAndRoster: true, rosterPermanentRemoval: true,
    tournament: 'T01', tournamentEngine: 'T02', nativeMvu: 'N01' });
  const state = () => f.ctx.chat[0].variables[0].stat_data;
  const firstChapter = state().场景.当前章;
  await f.api.transition((await f.api.capture()).token, { action: 'end' });
  await f.api.transition((await f.api.capture()).token, { action: 'next' });
  assert.notEqual(state().场景.当前章, firstChapter); assert.equal(state().场景.阶段, '未开始');
  state().人际.同伴 = { 关系: '同伴', 态度印象: '已认识', 性别: '男性', 好感: 0, 支援度: 0, 羁绊阶段: '未建立', 变化依据: '实际相识' };
  await f.api.setRosterHidden((await f.api.capture()).token, '同伴', true);
  assert.equal(state().人际.同伴.名册隐藏, true);
  await f.api.deleteRosterPerson((await f.api.capture()).token, '同伴');
  assert.equal(Object.hasOwn(state().人际, '同伴'), false); assert.deepEqual(state().系统.已删除人物, ['同伴']);
  await f.api.tournamentAction((await f.api.capture()).token, { action: 'initialize' });
  await f.api.tournamentAction((await f.api.capture()).token, { action: 'upsertParticipant', id: 'oc_test',
    participant: { 姓名: '本局原创选手', 来源: '原创', 参赛状态: '参赛' } });
  const playerId = Object.keys(state().场景.选拔赛.名册).find(id => state().场景.选拔赛.名册[id].来源 === '玩家');
  await f.api.tournamentAction((await f.api.capture()).token, { action: 'upsertMatch', id: 'match_test',
    match: { 轮次: 1, 甲方: playerId, 乙方: 'oc_test', 日期: '2013-04-22', 时间: '下午', 地点: '演习场', 状态: '已安排', 依据: '本局正式通知' } });
  assert.equal(state().场景.选拔赛.比赛.match_test.状态, '已安排');
  const native = f.ctx.chat[0].variables[0].schema;
  assert.equal(native.properties.场景.properties.选拔赛.properties.名册.extensible, true);
  assert.equal(native.properties.场景.properties.选拔赛.properties.比赛.extensible, true);
  assert.equal(f.ctx.chat[0].variables[1].stat_data.系统.开局状态, '待建档');
  assert.equal(f.writes, 8);
});
await check('关闭约束仍保留本地页面校验及变量并发比较', async () => {
  const f = fixture({ guarded: false }), captured = await f.api.capture(), invalid = payload();
  invalid.玩家.未知字段 = '不能写入';
  await assert.rejects(f.api.commitOpening(captured.token, invalid)); assert.equal(f.writes, 0);
  f.ctx.chat[0].variables[0].custom.untouched = false;
  await assert.rejects(f.api.commitOpening(captured.token, payload()), /变量已被其他操作更新/);
  assert.equal(f.writes, 0); assert.equal(f.ctx.chat[0].variables[0].stat_data.系统.开局状态, '待建档');
});
await check('约束启动中或失败时明确诊断，不能当作关闭约束继续写入', async () => {
  for (const [state, code, text] of [['loading', 'RK_GUARD_LOADING', /正在初始化/], ['failed', 'RK_GUARD_FAILED', /启动失败/]]) {
    const f = fixture({ guarded: false });
    f.H.__RK_MVU_GUARD_BOOT_V4__ = { state, message: '桥接依赖尚未就绪', bridgeActive: state === 'failed' };
    await assert.rejects(f.api.capture(), error => error.code === code && text.test(error.message));
    assert.equal(f.writes, 0);
  }
});
await check('已开启约束的写入保持桥接原有schema，不改为native', async () => {
  const f = fixture(); f.ctx.chat[0].variables[0].schema = '没有用别管这个';
  await f.api.commitOpening((await f.api.capture()).token, payload());
  assert.equal(f.ctx.chat[0].variables[0].schema, '没有用别管这个'); assert.equal(f.writes, 1);
});
await check('旧新约束同时启用时拒绝写入，避免两个 schema 互相抵触', async () => {
  const f = fixture(); f.H.__RK_MVU_GUARD_V3__ = { version: '3.1.0' };
  await assert.rejects(f.api.capture(), /旧版 v3 约束仍在运行/); assert.equal(f.writes, 0);
});
await check('消息返回无效活动 swipe 时拒绝读取，不猜测默认槽', async () => {
  for (const swipe of [-1, 2, null]) {
    const f = fixture(); f.ctx.chat[0].swipe = swipe;
    await assert.rejects(f.api.capture(), /swipe/); assert.equal(f.writes, 0);
  }
});
await check('没有MVU数据不自行伪造初始化', async () => {
  const f = fixture(); f.ctx.chat[0].variables[0] = {};
  await assert.rejects(f.api.capture(), /初始化/); assert.equal(f.writes, 0);
});
await check('旧异步API版本在写入前拒绝', async () => {
  const f = fixture(); f.W.getTavernHelperVersion = () => '3.2.0';
  await assert.rejects(f.api.capture(), /4.8.19/); assert.equal(f.writes, 0);
});
await check('两个界面并发提交只允许一次落地', async () => {
  const f = fixture(), a = await f.api.capture(), b = await f.api.capture();
  const calls = await Promise.allSettled([f.api.commitOpening(a.token, payload()), f.api.commitOpening(b.token, { ...payload(), 玩家: { ...payload().玩家, 姓名: '第二角色' } })]);
  assert.equal(calls.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.writes, 1);
});
await check('迁移只升级当前活动 swipe，保留另一回复页与 MVU 包装', async () => {
  const f = fixture();
  for (const data of f.ctx.chat[0].variables) { data.stat_data.系统.结构版本 = 3; delete data.stat_data.玩家.成长; }
  f.ctx.chat[0].swipe = 1;
  f.ctx.chat[0].variables[1].custom = { retained: '活动页包装' };
  const original = clone(f.ctx.chat[0].variables);
  await assert.rejects(f.api.capture(), error => error.code === 'MIGRATION_REQUIRED');
  const preview = await f.api.prepareMigration();
  assert.equal(f.writes, 0); assert.deepEqual(f.ctx.chat[0].variables, original);
  assert.equal(preview.state.系统.结构版本, 4);
  await f.api.commitMigration(preview.token);
  assert.equal(f.ctx.chat[0].variables[1].stat_data.系统.结构版本, 4);
  assert.deepEqual(f.ctx.chat[0].variables[1].custom, original[1].custom);
  assert.deepEqual(f.ctx.chat[0].variables[0], original[0]);
  await f.api.commitMigration(preview.token); assert.equal(f.writes, 1);
});
await check('迁移预览后切换 swipe 或编辑正文时旧迁移凭据不能提交', async () => {
  for (const mutate of [f => { f.ctx.chat[0].swipe = 1; }, f => { f.ctx.chat[0].text[0] = '正文已更改'; }]) {
    const f = fixture(); f.ctx.chat[0].variables[0].stat_data.系统.结构版本 = 3; delete f.ctx.chat[0].variables[0].stat_data.玩家.成长;
    const preview = await f.api.prepareMigration(); mutate(f);
    await assert.rejects(f.api.commitMigration(preview.token), /swipe 已变化/); assert.equal(f.writes, 0);
  }
});
await check('真实浏览器适配的迁移与跨卷只修改剧情字段，不重新派生旧人物或补默认性别', async () => {
  const f = fixture(), value = f.ctx.chat[0].variables[0].stat_data;
  value.系统 = { 结构版本: 3, 开局状态: '已建档', 主角模式: '自定义角色' }; value.玩家.姓名 = '旧玩家'; delete value.玩家.性别;
  delete value.玩家.成长;
  value.场景 = { ...value.场景, 当前章: '终章', 阶段: '已结束', 时间: '旧时间', 地点: '旧地点', 已发生事件: { 旧事件: { 章段: '第一章', 结果: '实际记录', 参与者: [], 知情者: [] } } };
  delete value.场景.切入说明;
  value.人际.同伴 = { 关系: '同伴', 态度印象: '', 性别: '女性', 好感: 502, 支援度: 181, 羁绊阶段: 'C', 变化依据: '旧记录保留' };
  const original = clone(value), preview = await f.api.prepareMigration();
  assert.deepEqual(clone(preview.changes.map(change => change.path)), ['/系统/结构版本', '/场景/已发生事件/旧事件/卷号']);
  assert.deepEqual(clone(preview.state.玩家), original.玩家); assert.deepEqual(clone(preview.state.人际), original.人际); assert.equal(f.writes, 0);
  await f.api.commitMigration(preview.token);
  const capture = await f.api.capture(); assert.deepEqual(clone(capture.state.玩家), original.玩家); assert.deepEqual(clone(capture.state.人际), original.人际);
  await f.api.transition(capture.token, { action: 'nextVolume', time: '次日', location: '目标场所', entryNote: '从已确认场景继续' });
  const after = f.ctx.chat[0].variables[0].stat_data;
  assert.equal(after.场景.当前卷, 2);
  // 终值模式跨卷不补发经验，不创建申请或奖励记录；人物本体与关系保持原样。
  const { 成长, ...player } = after.玩家;
  assert.deepEqual(player, original.玩家);
  assert.equal(成长.版本, 'G03'); assert.equal(Object.hasOwn(成长, '申请'), false); assert.equal(Object.hasOwn(成长, '记录'), false);
  assert.deepEqual(成长.经验, { 体能: 0, 魔力控制: 0, 魔力量: 0 });
  assert.deepEqual(after.人际, original.人际); assert.equal(f.writes, 2);
});
const openingAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=';
const displayKey = f => 'rk:oc:portrait:v1:' + JSON.stringify([f.ctx.characterId ?? null, f.ctx.groupId ?? null,
  String(f.ctx.getCurrentChatId?.() ?? f.ctx.chatId)]);
const displayRecord = f => JSON.parse(f.H.localStorage.getItem(displayKey(f)));
async function establishedDisplayFixture(name = '通用测试角色') {
  const f = fixture({ guarded: false }), draft = payload(); draft.玩家.姓名 = name;
  await f.api.commitOpening((await f.api.capture()).token, draft);
  return f;
}
await check('开局建档前同步捕获外观，成功回读后绑定新姓名；无需小手机且不额外写MVU', async () => {
  const f = fixture({ guarded: false }), before = clone(f.ctx.chat);
  assert.equal(f.H.__RK_PHONE_SHELL__, undefined);
  const display = f.display.capture();
  assert.equal(typeof display.then, 'undefined'); assert.equal(display.version, 1);
  assert.equal(display.scope, JSON.stringify([1, null, 'test-chat'])); assert.equal(display.primaryName, '');
  assert.equal(display.avatarUrl, ''); assert.deepEqual(clone(display.aliases), []);
  assert.ok(display.token); assert.deepEqual(clone(f.ctx.chat), before); assert.equal(f.storageWrites, 0);
  const committed = await f.api.commitOpening((await f.api.capture()).token, payload());
  assert.equal(committed.state.玩家.姓名, '通用测试角色');
  const saved = f.display.apply(display, { profileName: committed.state.玩家.姓名, avatarUrl: openingAvatar });
  assert.equal(typeof saved.then, 'undefined'); assert.equal(saved.avatarUrl, openingAvatar);
  const record = displayRecord(f);
  assert.equal(record.version, 1); assert.equal(record.profileName, '通用测试角色'); assert.equal(record.avatarUrl, openingAvatar); assert.equal(record.source, 'opening');
  assert.equal(f.writes, 1); assert.equal(f.storageWrites, 1);
  assert.equal(f.displayEvents.length, 1); assert.equal(f.displayEvents[0].type, 'rk:player-portrait-changed');
  assert.equal(f.displayEvents[0].detail.scope, display.scope); assert.equal(f.displayEvents[0].detail.revision, saved.revision);
  assert.notEqual(saved.revision, display.revision);
});
await check('已游玩聊天按最新活动回复页捕获头像，旧开局页不能借此重建人物，应用外观不写MVU', async () => {
  const f = await establishedDisplayFixture(), latest = clone(f.ctx.chat[0]);
  f.ctx.chat.push({ role: 'user', swipe: 0, text: ['继续剧情'], variables: [{}] }, latest);
  latest.text = ['最新正文', '另一个回复']; latest.swipe = 1;
  latest.variables[1] = clone(latest.variables[0]);
  const before = clone(f.ctx.chat), writes = f.writes;
  await assert.rejects(f.api.capture({ messageId: 0 }), /历史楼层/);
  const captured = f.display.capture();
  assert.equal(captured.primaryName, '通用测试角色');
  f.display.apply(captured, { profileName: '  通用测试角色  ', avatarUrl: openingAvatar });
  assert.deepEqual(clone(f.ctx.chat), before); assert.equal(f.writes, writes);
  assert.equal(displayRecord(f).profileName, '通用测试角色'); assert.equal(f.displayEvents.length, 1);
});
await check('头像姓名仅按当前已建档姓名去首尾空白匹配，不接受不同人物或相似昵称', async () => {
  const f = await establishedDisplayFixture('黎恩·舒华泽'), captured = f.display.capture(), before = clone(f.ctx.chat);
  for (const profileName of ['另一人物', '黎恩舒华泽', '', null]) {
    assert.throws(() => f.display.apply(captured, { profileName, avatarUrl: openingAvatar }), /姓名.*不一致/);
  }
  assert.deepEqual(clone(f.ctx.chat), before); assert.equal(f.writes, 1); assert.equal(f.storageWrites, 0); assert.equal(f.displayEvents.length, 0);
});
await check('待建档状态即使填写同名也不能应用头像，不伪造开局完成', () => {
  const f = fixture({ guarded: false }); f.ctx.chat[0].variables[0].stat_data.玩家.姓名 = '草稿玩家';
  const captured = f.display.capture(), before = clone(f.ctx.chat);
  assert.throws(() => f.display.apply(captured, { profileName: '草稿玩家', avatarUrl: openingAvatar }), /已建档|姓名.*不一致/);
  assert.deepEqual(clone(f.ctx.chat), before); assert.equal(f.writes, 0); assert.equal(f.storageWrites, 0);
});
await check('头像凭据只属于生成它的控制器，伪造或另一iframe凭据均不能保存', async () => {
  const a = await establishedDisplayFixture(), b = await establishedDisplayFixture();
  const captured = a.display.capture();
  for (const invalid of [undefined, { token: {} }, captured]) {
    assert.throws(() => b.display.apply(invalid, { profileName: '通用测试角色', avatarUrl: openingAvatar }), /操作已失效/);
  }
  assert.equal(a.storageWrites, 0); assert.equal(b.storageWrites, 0); assert.equal(b.writes, 1);
});
for (const [name, mutate] of [
  ['切聊天', f => { f.ctx = { ...f.ctx, chatId: 'other-chat', chat: clone(f.ctx.chat) }; }],
  ['换角色', f => { f.ctx.characterId = 2; }],
  ['换群组', f => { f.ctx.groupId = 'other-group'; }],
  ['切swipe', f => { f.ctx.chat[0].swipe = 1; }],
  ['编辑正文', f => { f.ctx.chat[0].text[0] = '已编辑正文'; }],
  ['新增楼层', f => { f.ctx.chat.push({ role: 'user', swipe: 0, text: ['新的用户消息'], variables: [{}] }); }],
  ['替换聊天数组', f => { f.ctx.chat = [...f.ctx.chat]; }],
  ['重建同位置消息', f => { f.ctx.chat[0] = clone(f.ctx.chat[0]); }],
]) await check('开局外观捕获后' + name + '使旧头像凭据失效，不写存储或MVU', async () => {
  const f = await establishedDisplayFixture(), captured = f.display.capture(); mutate(f);
  const before = clone(f.ctx.chat);
  assert.throws(() => f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: openingAvatar }), /变化|历史楼层/);
  assert.deepEqual(clone(f.ctx.chat), before); assert.equal(f.writes, 1); assert.equal(f.storageWrites, 0); assert.equal(f.displayEvents.length, 0);
});
await check('头像capture后另一界面保存使revision过期，保留竞争结果且不发变更事件', async () => {
  const f = await establishedDisplayFixture(), captured = f.display.capture(), competitor = {
    version: 1, avatarUrl: 'https://example.com/other.png', aliases: ['教官'], profileName: '通用测试角色', source: 'opening', revision: 'other-interface',
  };
  f.H.localStorage.setItem(displayKey(f), JSON.stringify(competitor));
  const before = clone(f.ctx.chat), storageWrites = f.storageWrites;
  assert.throws(() => f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: openingAvatar }), /变化|重新读取|重新应用/);
  assert.deepEqual(displayRecord(f), competitor); assert.deepEqual(clone(f.ctx.chat), before);
  assert.equal(f.storageWrites, storageWrites); assert.equal(f.writes, 1); assert.equal(f.displayEvents.length, 0);
});
await check('无profileName与revision的旧终端头像记录可兼容，更新同玩家头像保留别名', async () => {
  const f = await establishedDisplayFixture();
  f.H.localStorage.setItem(displayKey(f), JSON.stringify({ version: 1, avatarUrl: 'https://example.com/legacy.png', aliases: ['教官', '黎恩'] }));
  const captured = f.display.capture(), writes = f.writes;
  assert.deepEqual(clone(captured.aliases), ['教官', '黎恩']); assert.ok(captured.revision);
  f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: openingAvatar });
  assert.deepEqual(displayRecord(f).aliases, ['教官', '黎恩']); assert.equal(displayRecord(f).profileName, '通用测试角色');
  assert.equal(displayRecord(f).source, 'opening'); assert.equal(f.writes, writes);
});
await check('捕获后存储变成未知版本或来源时拒绝覆盖，保留原记录而不伪装成新开局来源', async () => {
  for (const invalid of [{ version: 2, source: 'opening' }, { version: 1, source: 'unknown-provider' }]) {
    const f = await establishedDisplayFixture(), captured = f.display.capture(), record = {
      avatarUrl: 'https://example.com/existing.png', aliases: [], profileName: '通用测试角色', revision: 'external-record', ...invalid,
    };
    f.H.localStorage.setItem(displayKey(f), JSON.stringify(record));
    const storageWrites = f.storageWrites;
    assert.throws(() => f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: openingAvatar }), /版本|来源/);
    assert.deepEqual(displayRecord(f), record); assert.equal(f.storageWrites, storageWrites);
    assert.equal(f.writes, 1); assert.equal(f.displayEvents.length, 0);
  }
});
await check('明确替换开局人物后头像绑定新玩家，清掉前玩家别名并只保留一次MVU人物替换', async () => {
  const f = await establishedDisplayFixture('原玩家');
  f.H.localStorage.setItem(displayKey(f), JSON.stringify({ version: 1, avatarUrl: 'https://example.com/old.png', aliases: ['旧昵称'], profileName: '原玩家', source: 'opening', revision: 'old-player' }));
  const captured = f.display.capture(), draft = payload(); draft.玩家.姓名 = '新玩家';
  await f.api.replaceOpening((await f.api.capture()).token, draft);
  f.display.apply(captured, { profileName: '新玩家', avatarUrl: openingAvatar });
  assert.equal(displayRecord(f).profileName, '新玩家'); assert.deepEqual(displayRecord(f).aliases, []);
  assert.equal(displayRecord(f).avatarUrl, openingAvatar); assert.equal(f.writes, 2);
});
await check('同一头像凭据保存一次后不可重放，不能再次覆写头像或发送事件', async () => {
  const f = await establishedDisplayFixture(), captured = f.display.capture();
  f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: openingAvatar });
  const saved = displayRecord(f), storageWrites = f.storageWrites;
  assert.throws(() => f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: 'https://example.com/replay.png' }), /变化|重新读取|重新应用/);
  assert.deepEqual(displayRecord(f), saved); assert.equal(f.storageWrites, storageWrites); assert.equal(f.displayEvents.length, 1); assert.equal(f.writes, 1);
});
await check('本机外观存储失败不修改MVU，也不发出保存成功事件', async () => {
  const f = await establishedDisplayFixture(), captured = f.display.capture(), before = clone(f.ctx.chat);
  f.H.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => f.display.apply(captured, { profileName: '通用测试角色', avatarUrl: openingAvatar }), /未能保存|QuotaExceeded|存储/);
  assert.deepEqual(clone(f.ctx.chat), before); assert.equal(f.writes, 1); assert.equal(f.storageWrites, 0); assert.equal(f.displayEvents.length, 0);
});
await check('伴随guard运行时保护：恢复章段后也拒绝关联未来事件', () => {
  const hooks = new Map(), events = [], H = {}, W = { parent: H, addEventListener: (...args) => events.push(args) };
  const script = JSON.parse(fs.readFileSync(new URL('../世界书规则/MVU/落第骑士-MVU-v4字段约束.json', import.meta.url), 'utf8')).content;
  const realm = vm.createContext({ window: W, structuredClone, z, Mvu: { events: { VARIABLE_UPDATE_ENDED: 'test-end' } },
    eventOn: (name, listener) => { hooks.set(name, listener); return { stop: () => hooks.delete(name) }; }, console: { warn() {} } });
  vm.runInContext(script.split('// 注册字段校验与写入责任保护；')[0] + '\ninstallRakudaiMvuGuard(createSchema(z));', realm);
  assert.equal(H.__RK_MVU_GUARD_V4__.version, '4.0.0');
  const before = { stat_data: clone(INITIAL_STATE) };
  before.stat_data.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' }; before.stat_data.玩家.姓名 = '测试'; before.stat_data.场景.当前章 = '第一章'; before.stat_data.场景.阶段 = '进行中';
  const after = clone(before); after.stat_data.$internal = { display_data: clone(before.stat_data), delta_data: {} };
  after.stat_data.场景.当前章 = '第四章'; after.stat_data.场景.已发生事件.未来 = { 卷号: 1, 章段: '第四章', 结果: '被错误预写', 参与者: [], 知情者: [] };
  hooks.get('test-end')(after, before);
  const internal = after.stat_data.$internal; delete after.stat_data.$internal;
  assert.deepEqual(after, before); assert.deepEqual(internal.delta_data, {});
  events.find(([type]) => type === 'pagehide')[1](); assert.equal(H.__RK_MVU_GUARD_V4__, undefined); assert.equal(hooks.size, 0);
});
const report = { passed: results.filter(r => r.passed).length, total: results.length, runtime: '离线固定API语义模拟，未连接真实酒馆', results };
const reportDirectory = new URL('../世界书规则/MVU/验证记录/', import.meta.url);
fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(new URL('浏览器适配验证.json', reportDirectory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (report.passed !== report.total) process.exitCode = 1;
