import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { installRakudaiMvuGrowth } from './rakudai-mvu-growth.mjs';
import { replyMvuBlock, savedReplyEventKeys, submittedFinals } from './rakudai-mvu-reply-source.mjs';

// 离线事件/宿主双测；复用真实来源追踪与成长结算，不连接酒馆、不写报告文件。
const wrap = ops => '<UpdateVariable><json_patch>' + JSON.stringify(ops) + '</json_patch></UpdateVariable>';
const event = { 卷号: 1, 章段: '第一章', 结果: '本轮实际完成反馈改良训练', 参与者: ['测试玩家'], 知情者: ['测试玩家'] };
const request = (经验 = 40, 目标 = ['魔力控制']) => ({ 来源事件: '本轮训练', 目标, 经验, 成果: '准确控制落点' });
const eventOp = { op: 'add', path: '/场景/已发生事件/本轮训练', value: event };
const requestOp = (id = '训练成果', value = request()) => ({ op: 'add', path: '/玩家/成长/申请/' + id, value });

async function fixture(texts = [wrap([eventOp, requestOp()])]) {
  const hooks = new Map(), lifecycle = new Map(), notices = [];
  const ctx = { characterId: 7, groupId: null, chatId: 'offline-growth',
    chat: texts.map(mes => ({ mes, swipe_id: 0 })) };
  const H = { SillyTavern: { getContext: () => ctx } };
  const W = { parent: H, top: H, console: { info: value => notices.push(value) },
    waitGlobalInitialized: async () => {},
    eventOn: (name, callback) => {
      if (!hooks.has(name)) hooks.set(name, new Set());
      hooks.get(name).add(callback);
      return { stop: () => { hooks.get(name)?.delete(callback); if (!hooks.get(name)?.size) hooks.delete(name); } };
    },
    addEventListener: (name, callback) => lifecycle.set(name, callback),
    removeEventListener: name => lifecycle.delete(name),
    getChatMessages: query => ctx.chat.flatMap((message, message_id) => String(query).includes('-') || Number(query) === message_id
      ? [{ message_id, message: message.mes, swipe_id: message.swipe_id, role: 'assistant' }] : []),
  };
  async function emit(name, ...args) { for (const callback of hooks.get(name) || []) await callback(...args); }
  function apply(data, operations) {
    for (const op of operations) {
      const parts = op.path.slice(1).split('/').map(value => value.replace(/~1/g, '/').replace(/~0/g, '~'));
      assert.ok(parts.every(value => value && !['__proto__', 'prototype', 'constructor'].includes(value)));
      const key = parts.pop();
      const parent = parts.reduce((value, field) => value[field], data.stat_data);
      assert.ok(parent && typeof parent === 'object', 'fixture patches require existing parents');
      if (op.op === 'remove') delete parent[key];
      else parent[key] = structuredClone(op.value);
    }
  }
  const Mvu = { events: { COMMAND_PARSED: 'parsed', VARIABLE_UPDATE_ENDED: 'ended' },
    parseMessage: async (content, data) => {
      const variables = structuredClone(data), previous = structuredClone(data);
      await emit('parsed', variables, [], content);
      const patch = replyMvuBlock(content).match(/<(json_?patch)>([\s\S]*?)<\/\1>/i);
      apply(variables, patch ? JSON.parse(patch[2]) : []);
      await emit('ended', variables, previous);
      assert.deepEqual(previous, data, 'ENDED must not mutate its previous-state snapshot');
      return variables;
    } };
  W.Mvu = Mvu;
  const marker = await installRakudaiMvuGrowth(W);
  assert.equal(marker.state, 'ready', marker.message);
  assert.equal(W.z, undefined, 'the standalone script needs no Zod global');
  function state() {
    const stat_data = structuredClone(INITIAL_STATE);
    stat_data.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
    stat_data.玩家.姓名 = '测试玩家';
    stat_data.玩家.成长 = { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 }, 申请: {} };
    stat_data.玩家.六维.魔力控制 = 'F'; stat_data.玩家.六维.体能 = 'F'; stat_data.玩家.六维.魔力量 = 'F';
    Object.assign(stat_data.场景, { 当前卷: 1, 当前章: '第一章', 阶段: '进行中' });
    return { stat_data };
  }
  function identity(id = 0) {
    return { chatId: ctx.chatId, characterId: ctx.characterId, groupId: ctx.groupId,
      chatRef: ctx.chat, messageRef: ctx.chat[id], messageId: id, swipeId: ctx.chat[id].swipe_id };
  }
  return { W, H, ctx, Mvu, hooks, lifecycle, notices, marker, state, identity, emit };
}

test('native primary growth settles an array target and promotes with remainder without Zod', async () => {
  const f = await fixture(), before = f.state();
  before.stat_data.玩家.成长.经验.魔力控制 = 90;
  const saved = await f.Mvu.parseMessage(f.ctx.chat[0].mes, before);
  assert.equal(saved.stat_data.玩家.六维.魔力控制, 'F+');
  assert.equal(saved.stat_data.玩家.成长.经验.魔力控制, 30);
  assert.equal(saved.stat_data.玩家.成长.记录.训练成果.获得, 40);
  assert.deepEqual(saved.stat_data.玩家.成长.申请, {});
  assert.equal(before.stat_data.玩家.成长.经验.魔力控制, 90);
  f.marker.destroy();
});

test('native growth retains unrelated facts and does not install full field constraints', async () => {
  const ops = [eventOp, requestOp(), { op: 'add', path: '/玩家/自由资料', value: { 未知字段: '仍可保存' } }];
  const f = await fixture([wrap(ops)]), saved = await f.Mvu.parseMessage(f.ctx.chat[0].mes, f.state());
  assert.deepEqual(saved.stat_data.玩家.自由资料, { 未知字段: '仍可保存' });
  assert.equal(saved.stat_data.玩家.成长.经验.魔力控制, 40);
  f.marker.destroy();
});

test('renamed replay of the same source cannot claim its award twice', async () => {
  const f = await fixture(), first = await f.Mvu.parseMessage(f.ctx.chat[0].mes, f.state());
  f.ctx.chat.push({ mes: wrap([eventOp, requestOp('改名申请')]), swipe_id: 0 });
  const replay = await f.Mvu.parseMessage(f.ctx.chat[1].mes, first);
  assert.equal(replay.stat_data.玩家.成长.经验.魔力控制, 40);
  assert.equal(replay.stat_data.玩家.成长.记录.改名申请, undefined);
  assert.equal(replay.stat_data.玩家.成长.申请.改名申请, undefined);
  f.marker.destroy();
});

test('ambiguous real reply blocks keep requests pending with no award', async () => {
  const text = wrap([eventOp, requestOp()]), f = await fixture([text, text]);
  const saved = await f.Mvu.parseMessage(text, f.state());
  assert.equal(saved.stat_data.玩家.成长.经验.魔力控制, 0);
  assert.ok(saved.stat_data.玩家.成长.申请.训练成果);
  f.marker.destroy();
});

test('bound secondary repair awards only an event submitted and saved by the real reply', async () => {
  const f = await fixture([wrap([eventOp])]);
  const main = await f.Mvu.parseMessage(f.ctx.chat[0].mes, f.state());
  const saved = await f.marker.parseRepair(JSON.stringify([requestOp()]), main, f.ctx.chat[0].mes, f.identity());
  assert.equal(saved.stat_data.玩家.成长.经验.魔力控制, 40);
  const replay = await f.marker.parseRepair(JSON.stringify([requestOp('副补漏改名')]), saved, f.ctx.chat[0].mes, f.identity());
  assert.equal(replay.stat_data.玩家.成长.经验.魔力控制, 40);
  const noEvidence = await fixture([wrap([])]), prior = noEvidence.state();
  prior.stat_data.场景.已发生事件.本轮训练 = event;
  const refused = await noEvidence.marker.parseRepair(JSON.stringify([requestOp()]), prior, noEvidence.ctx.chat[0].mes, noEvidence.identity());
  assert.equal(refused.stat_data.玩家.成长.经验.魔力控制, 0);
  assert.ok(refused.stat_data.玩家.成长.申请.训练成果);
  f.marker.destroy(); noEvidence.marker.destroy();
});

test('explicit final value wins over a same-target request and replay does not promote twice', async () => {
  const ops = [eventOp, requestOp(),
    { op: 'replace', path: '/玩家/六维/魔力控制', value: 'F' },
    { op: 'replace', path: '/玩家/成长/经验/魔力控制', value: 300 }];
  const f = await fixture([wrap(ops)]), first = await f.Mvu.parseMessage(f.ctx.chat[0].mes, f.state());
  assert.equal(first.stat_data.玩家.六维.魔力控制, 'E');
  assert.equal(first.stat_data.玩家.成长.经验.魔力控制, 100);
  assert.equal(first.stat_data.玩家.成长.记录.训练成果.获得, 0);
  const replay = await f.marker.parseRepair(JSON.stringify(ops.slice(2)), first, f.ctx.chat[0].mes, f.identity());
  assert.equal(replay.stat_data.玩家.六维.魔力控制, 'E');
  assert.equal(replay.stat_data.玩家.成长.经验.魔力控制, 100);
  f.marker.destroy();
});

test('loading, failed and active Zod modes leave all settlement to their existing path', async () => {
  for (const mode of ['loading', 'failed', 'zod']) {
    const f = await fixture();
    if (mode === 'zod') f.H.__RK_MVU_GUARD_V4__ = { version: '4.0.0' };
    else f.H.__RK_MVU_GUARD_BOOT_V4__ = { state: mode };
    const saved = await f.Mvu.parseMessage(f.ctx.chat[0].mes, f.state());
    assert.equal(saved.stat_data.玩家.成长.经验.魔力控制, 0);
    assert.equal(saved.stat_data.玩家.成长.版本, undefined);
    await assert.rejects(f.marker.parseRepair('[]', saved, f.ctx.chat[0].mes, f.identity()), /未接管/);
    f.marker.destroy();
  }
});

test('secondary repair rejects stale swipe, concurrent parsing and page changes during parsing', async () => {
  const f = await fixture([wrap([eventOp])]), data = f.state();
  data.stat_data.场景.已发生事件.本轮训练 = event;
  await assert.rejects(f.marker.parseRepair('[]', data, f.ctx.chat[0].mes, { ...f.identity(), swipeId: 1 }), /无法唯一确认/);
  const original = f.Mvu.parseMessage;
  let release;
  f.Mvu.parseMessage = async (...args) => { await new Promise(resolve => { release = resolve; }); return original(...args); };
  const pending = f.marker.parseRepair(JSON.stringify([requestOp()]), data, f.ctx.chat[0].mes, f.identity());
  await assert.rejects(f.marker.parseRepair('[]', data, f.ctx.chat[0].mes, f.identity()), /正在解析/);
  f.ctx.chat[0].swipe_id = 1;
  release();
  await assert.rejects(pending, /来源已变化/);
  f.marker.destroy();
});

test('secondary repair rejects a guard mode change while parsing is pending', async () => {
  const f = await fixture([wrap([eventOp])]), data = f.state();
  data.stat_data.场景.已发生事件.本轮训练 = event;
  const original = f.Mvu.parseMessage;
  let release;
  f.Mvu.parseMessage = async (...args) => { await new Promise(resolve => { release = resolve; }); return original(...args); };
  const pending = f.marker.parseRepair(JSON.stringify([requestOp()]), data, f.ctx.chat[0].mes, f.identity());
  f.H.__RK_MVU_GUARD_BOOT_V4__ = { state: 'loading' };
  release();
  await assert.rejects(pending, /未接管/);
  assert.equal(data.stat_data.玩家.成长.经验.魔力控制, 0);
  f.marker.destroy();
});

test('malformed growth containers are isolated while unrelated facts remain saved', async () => {
  const ops = [{ op: 'replace', path: '/玩家/成长/经验', value: null }, { op: 'replace', path: '/场景/地点', value: '本轮确认的训练室' }];
  const f = await fixture([wrap(ops)]), before = f.state(), saved = await f.Mvu.parseMessage(f.ctx.chat[0].mes, before);
  assert.deepEqual(saved.stat_data.玩家.成长, before.stat_data.玩家.成长);
  assert.equal(saved.stat_data.场景.地点, '本轮确认的训练室');
  assert.ok(f.notices.some(value => value.includes('结构无法安全结算')));
  f.marker.destroy();
});

test('old experience strings and malformed receipt sums cannot become new awards', async () => {
  for (const mutate of [
    state => { state.玩家.成长.经验.魔力控制 = '90'; },
    state => { state.玩家.成长.记录 = { 旧坏账: { 目标: '魔力控制', 来源事件: '过去训练', 活动指纹: 'old', 获得: '40' } }; },
  ]) {
    const f = await fixture(), before = f.state();
    mutate(before.stat_data);
    const saved = await f.Mvu.parseMessage(f.ctx.chat[0].mes, before);
    assert.deepEqual(saved.stat_data.玩家.成长, before.stat_data.玩家.成长);
    assert.equal(saved.stat_data.玩家.六维.魔力控制, 'F');
    assert.deepEqual(saved.stat_data.场景.已发生事件.本轮训练, event);
    f.marker.destroy();
  }
});

test('shared patch parsing accepts safe parent writes and rejects invalid escape paths', () => {
  const state = { 场景: { 已发生事件: { 本轮训练: event } } };
  assert.deepEqual(savedReplyEventKeys(wrap([{ op: 'add', path: '/场景', value: state.场景 }]), state), ['本轮训练']);
  assert.deepEqual(savedReplyEventKeys(wrap([{ op: 'replace', path: '/场景/已发生事件/本轮~训练/结果', value: event.结果 }]), state), []);
  assert.deepEqual(submittedFinals(wrap([{ op: 'add', path: '/玩家', value: { 成长: { 经验: { 体能: 10 } }, 六维: { 体能: 'F' } } }])).growthFinalAxes, ['体能']);
});

test('duplicate installation reuses one marker and unload removes listeners and scope markers', async () => {
  const f = await fixture();
  assert.equal(await installRakudaiMvuGrowth(f.W), f.marker);
  assert.equal(f.hooks.get('ended').size, 1);
  f.lifecycle.get('pagehide')();
  assert.equal(f.hooks.size, 0);
  assert.equal(f.W.__RK_MVU_GROWTH_G04__, undefined);
  assert.equal(f.H.__RK_MVU_GROWTH_G04__, undefined);
});

test('a new iframe takes over and the old pagehide cannot destroy its replacement', async () => {
  const f = await fixture(), oldUnload = f.lifecycle.get('pagehide'), nextLifecycle = new Map();
  const nextWindow = { ...f.W,
    addEventListener: (name, callback) => nextLifecycle.set(name, callback),
    removeEventListener: name => nextLifecycle.delete(name),
  };
  f.ctx.characterId = 8;
  const replacement = await installRakudaiMvuGrowth(nextWindow);
  assert.notEqual(replacement, f.marker);
  assert.equal(replacement.state, 'ready');
  assert.equal(f.hooks.get('ended').size, 1);
  oldUnload();
  assert.equal(f.H.__RK_MVU_GROWTH_G04__, replacement);
  assert.equal(f.hooks.get('ended').size, 1);
  const saved = await f.Mvu.parseMessage(f.ctx.chat[0].mes, f.state());
  assert.equal(saved.stat_data.玩家.成长.经验.魔力控制, 40);
  nextLifecycle.get('pagehide')();
  assert.equal(f.H.__RK_MVU_GROWTH_G04__, undefined);
  assert.equal(f.hooks.size, 0);
});
