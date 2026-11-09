import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createStateController, validateStateOperation } from '../rakudai-state-core.mjs';
import { ASTERISK_VOLUMES } from '../rakudai-story-catalog.mjs';
const require = createRequire(import.meta.url), { z } = require('../../output/worldbook-calibration/dev/node_modules/zod');
const main = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const start = main.indexOf('  const asteriskStoryTokens ='), end = main.indexOf('  function makeBridge()', start);
assert.ok(start > 0 && end > start);
const reader = fs.readFileSync(new URL('../rakudai-worldbook-reader.js', import.meta.url), 'utf8');
function fixture(chapter = '第一章', phase = '进行中') {
  let data = { stat_data: { 系统: { 结构版本: 4, 作品: 'asterisk', 开局状态: '已建档', 主角模式: '自定义角色' },
    场景: { 当前卷: null, 当前章: chapter, 阶段: phase, 时间: '早晨', 地点: '学院', 已发生事件: { 过去: { 结果: '保留' } } },
    玩家: { 姓名: '测试', 未知资料: '保留' } }, unrelated: true };
  let primary = '本局世界书', scope = 1, writes = 0, reads = 0, beforeCurrent = null, beforeBook = null;
  const chapters = ASTERISK_VOLUMES[0].chapters;
  const entries = chapters.slice(0, 8).map((item, index) => ({ uid: index, name: '[剧情]' + item.title, enabled: false, position: { order: 200 + index }, content: '原文' + index }));
  const service = createStateController({
    capture: () => ({ data: structuredClone(data), scope }),
    current: saved => { beforeCurrent?.(); if (saved.scope !== scope) throw new Error('宿主分支已变化'); return { data: structuredClone(data) }; },
    validate: (value, selected) => validateStateOperation(value, selected, z),
    write: (saved, expected, state, { assertWritable }) => { assertWritable(); assert.equal(saved.scope, scope); assert.deepEqual(data, expected); data.stat_data = structuredClone(state); writes++; },
  });
  const source = () => ({ chatId: '测试', messageId: 2, swipeId: scope - 1 });
  const events = [], realm = vm.createContext({ structuredClone, setTimeout, clearTimeout, console,
    SS: { destroyed: false }, generationPending: false, limeNativeStarting: false, correctionJob: null, correctionAutoTurn: null,
    correctionMainBusy: () => false, rosterEditRevision: 0,
    readSnapshot: () => ({ state: structuredClone(data.stat_data), source: source(), pending: false }),
    stateService: () => service, terminalStateReader: { clear() {} }, emit: event => events.push(event),
    fn: name => name === 'getCharWorldbookNames' ? () => ({ primary }) : name === 'getWorldbook' ? async () => { reads++; await beforeBook?.(); return structuredClone(entries); } : null,
  });
  vm.runInContext(reader + '\n' + main.slice(start, end) + '\nglobalThis.api = {read:readAsteriskStory,transition:transitionAsteriskStory};', realm);
  return { realm, api: realm.api, entries, service, events, get data() { return data; }, get writes() { return writes; }, get reads() { return reads; },
    setPrimary: value => { primary = value; }, switch: () => { scope++; }, mutate: fn => fn(data),
    onCurrent: fn => { beforeCurrent = fn; }, onBook: fn => { beforeBook = fn; } };
}
const results = [];
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }
await check('目录一次取书，缺208不可用；读取不写，结束后刷新才能开始下一操作', async () => {
  const f = fixture(), before = structuredClone(f.data), view = await f.api.read();
  assert.equal(f.reads, 1); assert.equal(f.writes, 0); assert.equal(view.chapters[8].available, false); assert.match(view.chapters[8].reason, /208/);
  await f.api.transition(view.token, { action: 'end' });
  assert.equal(f.writes, 1); assert.equal(f.data.stat_data.场景.阶段, '已结束');
  assert.deepEqual(f.data.stat_data.玩家, before.stat_data.玩家); assert.deepEqual(f.data.stat_data.场景.已发生事件, before.stat_data.场景.已发生事件);
  await assert.rejects(f.api.transition(view.token, { action: 'next' }), /凭据/);
  await f.api.transition((await f.api.read()).token, { action: 'next' });
  assert.equal(f.data.stat_data.场景.当前章, '第二章'); assert.equal(f.data.stat_data.场景.当前卷, null);
});
await check('缺终章、后改空条目、重复及自动触发条目均不允许切入', async () => {
  const f = fixture('第七章', '已结束');
  await assert.rejects(f.api.transition((await f.api.read()).token, { action: 'next' }), /208/); assert.equal(f.writes, 0);
  for (const mutation of [row => { row.content = ''; }, row => { row.enabled = true; }, (row, all) => { all.push({ ...row, uid: 999 }); }]) {
    const g = fixture(), view = await g.api.read(); mutation(g.entries[2], g.entries);
    await assert.rejects(g.api.transition(view.token, { action: 'jump', chapter: '第二章', time: '翌日', location: '教室', entryNote: '已确认', start: true }), /为空|请关闭|多个/);
    assert.equal(g.writes, 0);
  }
});
await check('变更chat/swipe、状态或主世界书后旧token均被拒绝', async () => {
  for (const alter of [f => f.switch(), f => f.mutate(d => { d.stat_data.玩家.姓名 = '另一个'; }), f => f.setPrimary('另一本')]) {
    const f = fixture(), view = await f.api.read(); alter(f);
    await assert.rejects(f.api.transition(view.token, { action: 'end' }), /已变化/); assert.equal(f.writes, 0);
  }
});
await check('读书期间换分支不交付token；异步current后进入生成不写入', async () => {
  const f = fixture(); f.onBook(() => { f.switch(); }); await assert.rejects(f.api.read(), /已变化/); assert.equal(f.writes, 0);
  const g = fixture(), view = await g.api.read(); g.onCurrent(() => { g.realm.generationPending = true; });
  await assert.rejects(g.api.transition(view.token, { action: 'end' }), /等待当前回复/); assert.equal(g.writes, 0);
});
await check('重复点击只有一次写入；自由章只能显式定位有效目录', async () => {
  const f = fixture(), view = await f.api.read();
  const outcomes = await Promise.allSettled([f.api.transition(view.token, { action: 'end' }), f.api.transition(view.token, { action: 'end' })]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1); assert.equal(f.writes, 1);
  const g = fixture('自由入学'), free = await g.api.read();
  await assert.rejects(g.api.transition(free.token, { action: 'end' }), /目录/);
  await g.api.transition(free.token, { action: 'jump', chapter: '序章', time: '午后', location: '校门', entryNote: '确认切入', start: true });
  assert.equal(g.data.stat_data.场景.当前章, '序章'); assert.equal(g.writes, 1);
});
console.log(JSON.stringify({ passed: results.filter(result => result.passed).length, total: results.length, results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
