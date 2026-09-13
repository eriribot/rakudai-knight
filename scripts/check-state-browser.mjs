import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const source = fs.readFileSync(new URL('./rakudai-state-controller.js', import.meta.url), 'utf8');
const clone = structuredClone, results = [];
const payload = () => ({ 系统: { 结构版本: 4, 主角模式: '自定义角色' }, 玩家: { ...clone(INITIAL_STATE.玩家), 姓名: '通用测试角色' }, 场景: { 当前章: '第一章', 时间: '春假早晨', 地点: '理事长室', 切入说明: '' } });
function fixture({ deferredMvu = false, nestedIframe = false } = {}) {
  const chat = [{ role: 'assistant', swipe: 0, text: ['开局一', '开局二'], variables: [{ stat_data: clone(INITIAL_STATE), custom: { untouched: true } }, { stat_data: clone(INITIAL_STATE) }] }];
  let ctx = { chat, chatId: 'test-chat', characterId: 1, groupId: null }, writes = 0, waitCalls = 0, iframeProxyReads = 0, parentProxyReads = 0;
  const H = { SillyTavern: { getContext: () => ctx }, __RK_MVU_GUARD_V4__: { version: '4.0.0', growth: 'G03' } };
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
  const realm = vm.createContext({ window: W, structuredClone, console });
  vm.runInContext(source, realm);
  return { api: W.RakudaiStateController, W, H, initializeMvu, get ctx() { return ctx; }, set ctx(value) { ctx = value; }, get writes() { return writes; }, get waitCalls() { return waitCalls; }, get proxyReads() { return { iframe: iframeProxyReads, parent: parentProxyReads }; } };
}
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } }
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
await check('未导入新版伴随脚本时显示具体缺项', async () => {
  const f = fixture(); delete f.H.__RK_MVU_GUARD_V4__;
  await assert.rejects(f.api.capture(), /请先导入并启用.*MVU v4/); assert.equal(f.writes, 0);
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
  for (const data of f.ctx.chat[0].variables) data.stat_data.系统.结构版本 = 3;
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
    const f = fixture(); f.ctx.chat[0].variables[0].stat_data.系统.结构版本 = 3;
    const preview = await f.api.prepareMigration(); mutate(f);
    await assert.rejects(f.api.commitMigration(preview.token), /swipe 已变化/); assert.equal(f.writes, 0);
  }
});
await check('真实浏览器适配的迁移与跨卷只修改剧情字段，不重新派生旧人物或补默认性别', async () => {
  const f = fixture(), value = f.ctx.chat[0].variables[0].stat_data;
  value.系统 = { 结构版本: 3, 开局状态: '已建档', 主角模式: '自定义角色' }; value.玩家.姓名 = '旧玩家'; delete value.玩家.性别;
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
  // G03 跨卷只清空未结算申请，不补发经验；人物本体与关系保持原样。
  const { 成长, ...player } = after.玩家;
  assert.deepEqual(player, original.玩家);
  assert.equal(成长.版本, 'G03'); assert.deepEqual(成长.申请, {}); assert.deepEqual(成长.记录, {});
  assert.deepEqual(成长.经验, { 体能: 0, 魔力控制: 0, 魔力量: 0 });
  assert.deepEqual(after.人际, original.人际); assert.equal(f.writes, 2);
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
fs.writeFileSync(new URL('../output/worldbook-calibration/浏览器适配验证.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (report.passed !== report.total) process.exitCode = 1;
