import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const source = fs.readFileSync(new URL('./rakudai-state-controller.js', import.meta.url), 'utf8');
const clone = structuredClone, results = [];
const payload = () => ({ 系统: { 结构版本: 3, 主角模式: '自定义角色' }, 玩家: { ...clone(INITIAL_STATE.玩家), 姓名: '通用测试角色' }, 场景: { 当前章: '第一章', 时间: '春假早晨', 地点: '理事长室', 切入说明: '' } });
function fixture() {
  const chat = [{ role: 'assistant', swipe: 0, text: ['开局一', '开局二'], variables: [{ stat_data: clone(INITIAL_STATE), custom: { untouched: true } }, { stat_data: clone(INITIAL_STATE) }] }];
  let ctx = { chat, chatId: 'test-chat', characterId: 1, groupId: null }, writes = 0;
  const H = { SillyTavern: { getContext: () => ctx }, __RK_MVU_GUARD_V3__: { version: '3.1.0' } };
  const W = {
    parent: H, z,
    getTavernHelperVersion: () => '4.8.19',
    getChatMessages: () => ctx.chat.map((m, i) => ({ message_id: i, role: m.role, swipe_id: m.swipe, swipes: m.text })).filter(m => m.role === 'assistant'),
    updateVariablesWith(updater, option) {
      assert.equal(option.type, 'message'); assert.equal(typeof option.message_id, 'number'); assert.equal(Object.hasOwn(option, 'swipe_id'), false);
      const message = ctx.chat[option.message_id], next = updater(clone(message.variables[message.swipe]));
      assert.equal(typeof next?.then, 'undefined');
      message.variables[message.swipe] = next; writes++; return next;
    },
  };
  H.Mvu = { getMvuData: option => clone(ctx.chat[option.message_id].variables[ctx.chat[option.message_id].swipe]), replaceMvuData() {} };
  const realm = vm.createContext({ window: W, structuredClone, console });
  vm.runInContext(source, realm);
  return { api: W.RakudaiStateController, W, H, get ctx() { return ctx; }, set ctx(value) { ctx = value; }, get writes() { return writes; } };
}
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } }
await check('消息iframe与scriptiframe都使用明确message接口并保留其他数据', async () => {
  const f = fixture(); const first = await f.api.capture({ messageId: 0 });
  await f.api.commitOpening(first.token, payload());
  assert.equal(f.ctx.chat[0].variables[0].stat_data.系统.开局状态, '已建档');
  assert.equal(f.ctx.chat[0].variables[1].stat_data.系统.开局状态, '待建档');
  assert.equal(f.ctx.chat[0].variables[0].custom.untouched, true);
  await f.api.verify(first.token); assert.equal(f.writes, 1);
});
for (const [name, mutate] of [
  ['切swipe', f => { f.ctx.chat[0].swipe = 1; }],
  ['切聊天但变量相同', f => { f.ctx = { ...f.ctx, chat: clone(f.ctx.chat), chatId: 'another' }; }],
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
  const f = fixture(); delete f.H.__RK_MVU_GUARD_V3__;
  await assert.rejects(f.api.capture(), /修订 3.1.0/); assert.equal(f.writes, 0);
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
await check('伴随guard运行时保护：恢复章段后也拒绝关联未来事件', () => {
  const hooks = new Map(), events = [], H = {}, W = { parent: H, addEventListener: (...args) => events.push(args) };
  const script = JSON.parse(fs.readFileSync(new URL('../世界书规则/MVU/落第骑士-MVU-v3字段约束.json', import.meta.url), 'utf8')).content;
  const realm = vm.createContext({ window: W, structuredClone, z, Mvu: { events: { VARIABLE_UPDATE_ENDED: 'test-end' } },
    eventOn: (name, listener) => { hooks.set(name, listener); return { stop: () => hooks.delete(name) }; }, console: { warn() {} } });
  vm.runInContext(script.split('// 注册字段校验与写入责任保护；')[0] + '\ninstallRakudaiMvuGuard(createSchema(z));', realm);
  assert.equal(H.__RK_MVU_GUARD_V3__.version, '3.1.0');
  const before = { stat_data: clone(INITIAL_STATE) };
  before.stat_data.系统 = { 结构版本: 3, 开局状态: '已建档', 主角模式: '自定义角色' }; before.stat_data.玩家.姓名 = '测试'; before.stat_data.场景.当前章 = '第一章'; before.stat_data.场景.阶段 = '进行中';
  const after = clone(before); after.stat_data.$internal = { display_data: clone(before.stat_data), delta_data: {} };
  after.stat_data.场景.当前章 = '第四章'; after.stat_data.场景.已发生事件.未来 = { 章段: '第四章', 结果: '被错误预写', 参与者: [], 知情者: [] };
  hooks.get('test-end')(after, before);
  const internal = after.stat_data.$internal; delete after.stat_data.$internal;
  assert.deepEqual(after, before); assert.deepEqual(internal.delta_data, {});
  events.find(([type]) => type === 'pagehide')[1](); assert.equal(H.__RK_MVU_GUARD_V3__, undefined); assert.equal(hooks.size, 0);
});
const report = { passed: results.filter(r => r.passed).length, total: results.length, runtime: '离线固定API语义模拟，未连接真实酒馆', results };
fs.writeFileSync(new URL('../output/worldbook-calibration/浏览器适配验证.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (report.passed !== report.total) process.exitCode = 1;
