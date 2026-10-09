// Run: node scripts/check-tournament-prompt-window.mjs
// Actual terminal wiring and correction source; host events/MVU are offline fixtures.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { shouldInjectTournament, tournamentCalendar } from './rakudai-tournament-calendar.mjs';
import { deriveTournament } from './rakudai-tournament.mjs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const template = read('../世界书规则/MVU/变量列表.txt'), correction = read('./黑白ADV轮盘终端/correction.js'), main = read('./黑白ADV轮盘终端/main.js');
const plain = value => JSON.parse(JSON.stringify(value));
function between(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'Maintained terminal source is missing: ' + start);
  return source.slice(from, to);
}
const wiring = between(main, '  function wireEvents() {', '  function onResize() {');
const destroy = between(main, '  function destroy() {', '  /*__INJECT_STATE_PANEL__*/');
function state({ time = '2013-06-01', status = '进行中', volume = 1, chapter = '第一章' } = {}) {
  const value = structuredClone(INITIAL_STATE);
  Object.assign(value.系统, { 开局状态: '已建档', 主角模式: '自定义角色' });
  value.玩家.姓名 = '测试选手';
  value.玩家.额外能力 = { 程序战况: '同名业务字段应保留' };
  Object.assign(value.场景, { 当前卷: volume, 当前章: chapter, 时间: time, 地点: '破军学园', 选拔赛: {
    版本: 'T01', 赛季: '破军学园选拔赛', 状态: status, 名册: {
      player: { 姓名: '测试选手', 来源: '玩家', 参赛状态: '参赛' },
      rival: { 姓名: '实际对手', 来源: '原创', 参赛状态: '参赛' },
    }, 比赛: { saved: { 轮次: 1, 甲方: 'player', 乙方: 'rival', 状态: '已完成', 胜者: 'player',
      甲赛前胜场: 0, 乙赛前胜场: 0, 日期: '2013-04-22', 时间: '下午', 地点: '演武场', 依据: '本局已确认赛果' } },
    程序战况: { 版本: 'T02', 日期: '2013-06-01', 名册: [{ 姓名: '只读号池缓存' }] },
  }, 额外剧情事实: { 天气: '晴' } });
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
// Execute every maintained EJS block; filtering is deliberately absent here.
function renderPrompt(current) {
  let code = "let rendered = '';\n", offset = 0;
  for (const match of template.matchAll(/<%([=-]?)([\s\S]*?)%>/g)) {
    code += 'rendered += ' + JSON.stringify(template.slice(offset, match.index)) + ';\n';
    code += match[1] ? 'rendered += String(' + match[2] + ');\n' : match[2] + '\n';
    offset = match.index + match[0].length;
  }
  code += 'rendered += ' + JSON.stringify(template.slice(offset)) + ';\nrendered;';
  return vm.runInContext(code, vm.createContext({ getvar(key) { assert.equal(key, 'stat_data'); return current; } }), { timeout: 1000 });
}
function promptState(text) {
  const json = text.match(/<status_current_variable>\s*([\s\S]*?)\s*<\/status_current_variable>/)?.[1];
  assert.ok(json, 'The actual variable list must render a status JSON block.');
  return JSON.parse(json);
}

function fixture(initial) {
  let failRead = false, reads = 0;
  const snapshot = { state: initial, source: { messageId: 0, swipeId: 0 }, targetSource: { messageId: 0, swipeId: 0 }, pending: false };
  const bus = new Map(), tailCalls = [], TE = Object.fromEntries([
    'CHAT_COMPLETION_SETTINGS_READY', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS',
  ].map(name => [name, 'host:' + name]));
  const context = { chatId: 'pool-fixture', characterId: 1, groupId: null, chat: [{ mes: '已保存正文', variables: [{ stat_data: initial }] }] };
  function remove(name, callback) { bus.set(name, (bus.get(name) || []).filter(item => item !== callback)); }
  const helpers = {
    eventOn(name, callback) {
      bus.set(name, [...(bus.get(name) || []), callback]);
      return { stop() { remove(name, callback); } };
    },
    // Same verified helper return contract as correction-exclusions-test: no stop wrapper.
    eventMakeLast(name, callback) {
      remove(name, callback); bus.set(name, [...(bus.get(name) || []), callback]); tailCalls.push(name);
    },
    eventRemoveListener: remove,
  };
  const SS = { destroyed: false, disposers: [] }, HW = { SillyTavern: { getContext: () => context }, removeEventListener() {} };
  const realm = vm.createContext({
    window: { tavern_events: TE, RakudaiStateController: { shouldInjectTournament } }, HW, SS,
    LS: { get: () => ({ autoApply: false }) }, structuredClone, AbortController, console,
    fn: name => helpers[name], readSnapshot() { reads++; if (failRead) throw new Error('MVU尚未保存'); return snapshot; },
    generationPending: false, playerBubbleBinder: null, terminalStateReader: { clear() {} }, updateCbs: [],
    readTimer: null, clearInterval() {}, disposeStatePanel() {}, emit() {}, onResize() {}, toggle() {}, SLOT: 'pool-fixture',
  });
  // Feature source and whole wireEvents/destroy bodies remain real. Only unrelated
  // correction scheduling is stubbed; no request or MVU writer exists in this fixture.
  vm.runInContext(correction + '\nwireAutomaticCorrection = () => {}; startAutomaticCorrection = () => {}; endAutomaticCorrection = () => {};\n' +
    wiring + '\n' + destroy + '\nwireEvents(); globalThis.api = { filterTournamentPoolPrompt, destroy };', realm);
  return { api: realm.api, bus, SS, context, tailCalls,
    on: (name, callback) => helpers.eventOn(TE[name], callback),
    emit(name, ...args) { for (const callback of [...(bus.get(TE[name]) || [])]) callback(...args); },
    failRead(value = true) { failRead = value; }, reads: () => reads,
    setSource(source, targetSource, pending = false) { Object.assign(snapshot, { source, targetSource, pending }); },
    listenerCount: () => [...bus.values()].reduce((sum, callbacks) => sum + callbacks.length, 0),
  };
}

const cases = [
  ['下界前一天', '2013-04-21', '进行中', false],
  ['下界当天', '2013-04-22', '未开始', true],
  ['中文下界日期', '西历 2013 年 4 月 22 日 · 早晨', '进行中', true],
  ['黄金周期间', '2013-04-30', '进行中', true],
  ['上界当天', '2013-07-08', '进行中', true],
  ['上界后一天', '2013-07-09', '进行中', false],
  ['旧缓存跨年', '2014-06-01', '进行中', false],
  ['未知日期', '次日清晨', '进行中', false],
  ['缺少年份', '6月1日', '进行中', false],
  ['不存在的日期', '2013-04-31', '进行中', false],
  ['时间为null', null, '进行中', false],
  ['日期区间内已结束', '2013-06-01', '已结束', false],
];
for (const [label, time, status, expected] of cases) test(label + '：真实主请求接线仅过滤程序号池，原存档与账本保留', () => {
  const current = freeze(state({ time, status })), before = plain(current), f = fixture(current);
  assert.equal(shouldInjectTournament(current), expected); assert.equal(shouldInjectTournament({ stat_data: current }), expected);
  const raw = renderPrompt(current);
  assert.deepEqual(promptState(raw).场景.选拔赛, before.场景.选拔赛, '原世界书模板不得预先删池或删账本。');
  const messages = [{ role: 'system', content: '系统前文\n' + raw + '\n系统后文' }, { role: 'user', content: '玩家本轮操作' }];
  const message = messages[0], untouched = plain(messages[1]);
  f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  const sent = promptState(messages[0].content), expectedLedger = plain(before.场景.选拔赛);
  if (!expected) delete expectedLedger.程序战况;
  assert.deepEqual(sent.场景.选拔赛, expectedLedger);
  assert.equal(sent.场景.时间, time); assert.equal(sent.场景.地点, before.场景.地点);
  assert.deepEqual(sent.场景.额外剧情事实, before.场景.额外剧情事实); assert.deepEqual(sent.玩家.额外能力, before.玩家.额外能力);
  assert.equal(messages[0], message); assert.deepEqual(messages[1], untouched);
  assert.ok(messages[0].content.startsWith('系统前文\n')); assert.ok(messages[0].content.endsWith('\n系统后文'));
  assert.deepEqual(current, before); assert.deepEqual(f.context.chat[0].variables[0].stat_data, before); f.api.destroy();
});

test('使用当前MVU日期关池，即便请求块包含区间内旧状态；重复执行幂等', () => {
  const current = freeze(state({ time: '2014-06-01' })), cached = state({ time: '2013-06-01' }), f = fixture(current);
  const messages = [{ role: 'system', content: renderPrompt(cached) }]; f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  const sent = promptState(messages[0].content);
  assert.equal(sent.场景.时间, cached.场景.时间); assert.equal(Object.hasOwn(sent.场景.选拔赛, '程序战况'), false);
  const once = plain(messages); f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  assert.deepEqual(messages, once); assert.equal(f.reads(), 2); assert.ok(current.场景.选拔赛.程序战况); f.api.destroy();
});
test('使用当前MVU放行，不受请求块旧日期或卷章order影响', () => {
  const current = state({ time: '2013-06-01', volume: 4, chapter: '序章' }), f = fixture(current);
  const messages = [{ role: 'system', content: renderPrompt(state({ time: '2014-06-01' })) }], before = plain(messages);
  assert.equal(shouldInjectTournament(current), true); f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  assert.deepEqual(messages, before); f.api.destroy();
});
for (const event of ['GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS']) test(event + '将过滤器重新移到后加载模板之后，且不重复订阅', () => {
  const current = state({ time: '2013-07-09' }), f = fixture(current), before = plain(current); let expansions = 0;
  f.on('CHAT_COMPLETION_SETTINGS_READY', request => { expansions++; request.messages[0].content = renderPrompt(current); });
  f.emit(event, 'normal', {}, false); f.emit(event, 'normal', {}, false);
  const messages = [{ role: 'system', content: '<% 尚未展开模板 %>' }]; f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  assert.equal(expansions, 1); assert.equal(f.reads(), 1); assert.equal(f.bus.get('host:CHAT_COMPLETION_SETTINGS_READY').length, 2);
  assert.equal(Object.hasOwn(promptState(messages[0].content).场景.选拔赛, '程序战况'), false);
  assert.deepEqual(current, before); f.api.destroy();
});
test('销毁真实终端接线释放全部监听，包括多次移尾的号池监听', () => {
  const current = state({ time: '2013-07-09' }), f = fixture(current);
  f.emit('GENERATION_STARTED', 'normal', {}, false); f.emit('GENERATION_AFTER_COMMANDS', 'normal', {}, false);
  assert.ok(f.listenerCount() > 0); f.api.destroy(); assert.equal(f.SS.destroyed, true); assert.equal(f.listenerCount(), 0);
  const messages = [{ role: 'system', content: renderPrompt(current) }], before = plain(messages);
  f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages }); assert.deepEqual(messages, before);
});
test('文本parts保留对象和位置，媒体与普通正文保持原样，仅删精确号池字段', () => {
  const current = state({ time: '次日清晨' }), f = fixture(current), text = { type: 'text', text: renderPrompt(current) },
    media = { type: 'image_url', image_url: { url: 'fixture:image' } }, prose = { type: 'text', text: '普通正文中的程序战况不是缓存。' };
  const parts = [media, text, prose], messages = [{ role: 'user', content: parts }, { role: 'assistant', content: '原有助手正文' }];
  const mediaBefore = plain(media), proseBefore = plain(prose); f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  assert.equal(messages[0].content, parts); assert.equal(parts[0], media); assert.equal(parts[1], text); assert.equal(parts[2], prose);
  assert.deepEqual(media, mediaBefore); assert.deepEqual(prose, proseBefore); assert.equal(messages[1].content, '原有助手正文');
  assert.equal(Object.hasOwn(promptState(text.text).场景.选拔赛, '程序战况'), false); f.api.destroy();
});
test('坏JSON或非JSON模板块不猜补、不修改；其它有效块仍过滤', () => {
  const current = state({ time: '2013-07-09' }), f = fixture(current), bad = '<status_current_variable>{broken}</status_current_variable>',
    ejs = '<status_current_variable><%- JSON.stringify(stat_data) %></status_current_variable>';
  const messages = [{ role: 'system', content: bad + '\n' + ejs }, { role: 'system', content: renderPrompt(current) }];
  f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages }); assert.equal(messages[0].content, bad + '\n' + ejs);
  assert.equal(Object.hasOwn(promptState(messages[1].content).场景.选拔赛, '程序战况'), false);
  assert.doesNotThrow(() => f.api.filterTournamentPoolPrompt(null, current)); f.api.destroy();
});
test('当前MVU读取失败时关闭程序池，仍保留块内实际账本', () => {
  const current = state(), f = fixture(current), messages = [{ role: 'system', content: renderPrompt(current) }];
  f.failRead(); f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages }); const sent = promptState(messages[0].content);
  assert.equal(Object.hasOwn(sent.场景.选拔赛, '程序战况'), false);
  assert.deepEqual(sent.场景.选拔赛.比赛, current.场景.选拔赛.比赛); f.api.destroy();
});
for (const [name, source, target] of [
  ['当前回复页已有同源MVU且pending=true', { messageId: 0, swipeId: 0 }, { messageId: 0, swipeId: 0 }],
  ['新楼层回退旧数据', { messageId: 0, swipeId: 0 }, { messageId: 1, swipeId: 0 }],
  ['新swipe回退旧数据', { messageId: 0, swipeId: 0 }, { messageId: 0, swipeId: 1 }],
  ['目标来源缺失', { messageId: 0, swipeId: 0 }, null],
]) test(name + '：只用当前活动页，不凭pending或旧缓存放行', () => {
  const current = state(), f = fixture(current), messages = [{ role: 'system', content: renderPrompt(current) }];
  f.setSource(source, target, true); f.emit('CHAT_COMPLETION_SETTINGS_READY', { messages });
  assert.equal(Object.hasOwn(promptState(messages[0].content).场景.选拔赛, '程序战况'), name.startsWith('当前'));
  assert.ok(current.场景.选拔赛.程序战况); f.api.destroy();
});
test('注入范围不改变UI日历与旧账本查看；缺时间仅关闭程序提示', () => {
  for (const time of ['2013-04-21', '2013-07-09', '2014-06-01']) {
    const current = state({ time }), before = plain(current); assert.equal(shouldInjectTournament(current), false);
    assert.equal(tournamentCalendar(current).valid, time.startsWith('2013'));
    assert.equal(deriveTournament(current).matches.find(row => row.id === 'saved')?.胜者, 'player'); assert.deepEqual(current, before);
  }
  const missingTime = state(); delete missingTime.场景.时间; assert.equal(shouldInjectTournament(missingTime), false);
  for (const current of [null, undefined, {}, { 场景: null }, { stat_data: {} }]) assert.equal(shouldInjectTournament(current), false);
});
