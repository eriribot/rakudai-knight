import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../世界书规则/MVU/schema.mjs';

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const main = read('main.js');
const version = JSON.parse(read('package.json')).version;
function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, '真实主壳代码段缺失：' + start);
  return source.slice(from, to);
}
const versionDeclaration = main.match(/  const BUILD_VERSION = [^\n]+/)[0].replace('/*__INJECT_VERSION__*/', JSON.stringify(version));
const stateDeclaration = between(main, '  const SS = {', '  const LS = {');
const shellFunctions = between(main, '  function toggle()', '  /*__INJECT_STATE_PANEL__*/')
  .replace('/*__INJECT_APP_HTML__*/', JSON.stringify('<!doctype html><title>测试终端</title>'))
  .replace('/*__INJECT_PORTRAIT_RESERVED_NAMES__*/', '[]')
  .replace('/*__INJECT_CORRECTION__*/', read('correction.js'));
const lifecycleWiring = between(main, "  HW.addEventListener('resize', onResize);", "  console.info('[Hagun-Blazer-Terminal] initialized');");
const pageRefresh = between(read('terminal-app.js'), 'function refreshTerminalState(event)', 'window.RKBoot = function(b)');
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const intervals = new Map(), timeouts = new Map(), hostListeners = new Map(), pageListeners = new Map(), events = new Map();
  const frames = [], boots = [], revoked = [], tips = [], errors = [];
  // 使用真实校正/读取模块；连接配置仅留在本夹具内存，不请求副 API。
  const storage = new Map();
  const requests = [], writes = [];
  const context = { characterId: 8, groupId: null, chatId: 'shell-test', name1: '清泉朝阳', chat: [],
    ChatCompletionService: { processRequest(...args) { requests.push(args); throw new Error('首楼隔离测试禁止联网'); } } };
  let timerId = 0;
  function listen(map, type, callback) {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(callback);
  }
  function unlisten(map, type, callback) {
    map.get(type)?.delete(callback);
    if (!map.get(type)?.size) map.delete(type);
  }
  function node() {
    const classes = new Set();
    return {
      style: {}, children: [], removed: false,
      classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
      appendChild(child) { this.children.push(child); },
      setAttribute() {}, focus() {}, querySelector() { return null; },
      remove() { this.removed = true; },
    };
  }
  const urls = { createObjectURL: () => 'blob:test-' + frames.length, revokeObjectURL: url => revoked.push(url) };
  const HW = {
    URL: urls,
    SillyTavern: { getContext: () => context },
    localStorage: { getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    addEventListener: (name, fn) => listen(hostListeners, name, fn),
    removeEventListener: (name, fn) => unlisten(hostListeners, name, fn),
  };
  const eventNames = ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'CHARACTER_FIRST_MESSAGE_SELECTED', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'GENERATION_STOPPED'];
  const W = {
    Mvu: { events: { COMMAND_PARSED: 'mvu:parsed', VARIABLE_UPDATE_ENDED: 'mvu:ended' } },
    tavern_events: Object.fromEntries(eventNames.map(name => [name, 'event:' + name])),
    addEventListener: (name, fn) => listen(pageListeners, name, fn),
    removeEventListener: (name, fn) => unlisten(pageListeners, name, fn),
  };
  const realm = vm.createContext({
    RELATIONSHIP_SCORING, supportStage, romanceStage, structuredClone, AbortController,
    CORRECTION_RULES: '', CORRECTION_FORMAT: '',
    LS: { get: (key, fallback) => storage.has(key) ? storage.get(key) : fallback, set: (key, value) => storage.set(key, value) },
    window: W, HW, HD: {
      createElement(tag) {
        assert.equal(tag, 'iframe');
        const frame = node();
        frame.contentWindow = { RKBoot: bridge => boots.push(bridge) };
        frames.push(frame);
        return frame;
      },
    },
    URL: urls, Blob, console: { error: (...args) => errors.push(args) },
    setInterval: (fn, ms) => { const id = ++timerId; intervals.set(id, { fn, ms }); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, ms) => { const id = ++timerId; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    fn: name => ({
      eventOn(event, callback) {
        listen(events, event, callback);
        return { stop: () => unlisten(events, event, callback) };
      },
      getChatMessages(id) {
        const message = context.chat[Number(id)];
        return message && !message.is_user
          ? [{ message_id: Number(id), swipe_id: message.swipe_id ?? 0, message: message.mes }]
          : [];
      },
      updateVariablesWith(...args) { writes.push(args); throw new Error('首楼隔离测试禁止变量写入'); },
    })[name] || null,
    closeWheel() {}, clearOrbTip() {}, setMode() {}, preferDrawer: () => false,
    refreshStatePanel() {}, disposeStatePanel() {}, statePanel: null,
    showOrbTip: (...args) => tips.push(args), recenter() {}, toggleWheel() {}, openPhoneApp() {},
  });
  vm.runInContext("const SLOT = '__RK_PHONE_SHELL__';\n" + versionDeclaration + '\n' + stateDeclaration + '\n' + read('state-reader.js') + '\n' + read('player-display-store.js') + '\n' + read('player-portrait.js') + '\n' + shellFunctions + '\n' +
    'globalThis.shell = { SS, show, hide, destroy, makeBridge, wireEvents, emit, getCorrectionStatus, ' +
    'generation: () => ({ pending: generationPending, turn: correctionMainTurn }), setBubbleBinder(value) { playerBubbleBinder = value; } };', realm);
  realm.shell.SS.host = node();
  realm.shell.SS.orb = node();
  realm.shell.SS.style = node();
  vm.runInContext(lifecycleWiring + '\nwireEvents();', realm);
  function dispatch(map, name, ...args) { [...(map.get(name) || [])].forEach(callback => callback(...args)); }
  return { api: realm.shell, realm, HW, context, requests, writes, intervals, timeouts, hostListeners, pageListeners, events, eventNames, frames, boots, revoked, tips, errors,
    event: (name, ...args) => dispatch(events, W.tavern_events[name], ...args),
    pagehide: () => dispatch(pageListeners, 'pagehide'),
  };
}

const nativeOptions = () => ({ automatic_trigger: false, quiet_prompt: '', quietToLoud: false,
  skipWIAN: false, force_chid: undefined, force_name2: false, signal: undefined, quietImage: undefined });
function assertUntracked(f) {
  assert.equal(f.api.generation().pending, false);
  assert.equal(f.api.generation().turn, null);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'idle');
  assert.equal(f.requests.length, 0);
  assert.equal(f.writes.length, 0);
}

await check('开局建议的孤立 Helper AFTER 不进入主生成或 MVU 保存等待', () => {
  const f = fixture();
  f.event('GENERATION_AFTER_COMMANDS', 'normal', {}, false);
  assertUntracked(f);
  f.api.destroy();
});

for (const type of ['normal', 'continue', 'regenerate', 'swipe']) {
  await check('原生 ' + type + ' START 与等值 AFTER 才开始真实主保存跟踪', () => {
    const f = fixture(), options = nativeOptions();
    f.event('GENERATION_STARTED', type, options, false);
    assertUntracked(f);
    // 宿主两次传参可以是不同对象；以键值快照识别，不能依赖对象引用或键插入顺序。
    f.event('GENERATION_AFTER_COMMANDS', type, Object.fromEntries(Object.entries(options).reverse()), false);
    assert.equal(f.api.generation().pending, true);
    assert.ok(f.api.generation().turn);
    assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
    assert.equal(f.requests.length, 0);
    assert.equal(f.writes.length, 0);
    f.api.destroy();
  });
}

await check('START 中间插入 Helper 空 options 不抢走正式 AFTER 的候选', () => {
  const f = fixture(), options = nativeOptions();
  f.event('GENERATION_STARTED', 'normal', options, false);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', {}, false);
  assertUntracked(f);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  assert.equal(f.api.generation().pending, true);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  f.api.destroy();
});

await check('正在跟踪正式主轮时 Helper AFTER 不替换主保存任务', () => {
  const f = fixture(), options = nativeOptions(), updates = [];
  f.api.makeBridge().onUpdate(event => updates.push(event));
  f.event('GENERATION_STARTED', 'normal', options, false);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  const turn = f.api.generation().turn;
  assert.ok(turn);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', {}, false);
  assert.equal(f.api.generation().turn, turn);
  assert.equal(f.api.generation().pending, true);
  assert.equal(updates.filter(event => event.type === 'generation-start').length, 1);
  assert.equal(f.requests.length, 0);
  assert.equal(f.writes.length, 0);
  f.api.destroy();
});

await check('开局建议 STOP 请求 ID 不中断正式主轮，也不消耗尚未配对的 START', () => {
  const f = fixture(), options = nativeOptions(), updates = [];
  f.api.makeBridge().onUpdate(event => updates.push(event));
  f.event('GENERATION_STARTED', 'normal', options, false);
  f.event('GENERATION_STOPPED', 'rk-opening:advice-before-main');
  assertUntracked(f);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  const turn = f.api.generation().turn;
  assert.ok(turn);
  f.event('GENERATION_STOPPED', 'rk-opening:advice-during-main');
  assert.equal(f.api.generation().turn, turn);
  assert.equal(f.api.generation().pending, true);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  assert.equal(updates.filter(event => event.type === 'story-turn').length, 0);
  assert.equal(f.requests.length, 0);
  assert.equal(f.writes.length, 0);
  f.api.destroy();
});

for (const scenario of [
  { name: 'quiet', type: 'quiet', options: nativeOptions(), dryRun: false },
  { name: 'dryRun 参数', type: 'normal', options: nativeOptions(), dryRun: true },
  { name: 'options.dryRun', type: 'normal', options: { ...nativeOptions(), dryRun: true }, dryRun: false },
]) {
  await check(scenario.name + ' 不启动主保存门禁', () => {
    const f = fixture();
    f.event('GENERATION_STARTED', scenario.type, scenario.options, scenario.dryRun);
    f.event('GENERATION_AFTER_COMMANDS', scenario.type, { ...scenario.options }, scenario.dryRun);
    assertUntracked(f);
    f.api.destroy();
  });
}

for (const end of ['GENERATION_ENDED', 'GENERATION_STOPPED']) {
  await check('slash 在 AFTER 前取消时 ' + end + ' 清理候选，迟到 AFTER 不启动', () => {
    const f = fixture(), options = nativeOptions();
    f.event('GENERATION_STARTED', 'normal', options, false);
    assertUntracked(f);
    f.event(end, f.context.chat.length);
    f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
    assertUntracked(f);
    f.api.destroy();
  });
}

for (const reset of ['CHAT_CHANGED', 'CHARACTER_FIRST_MESSAGE_SELECTED']) {
  await check(reset + ' 后旧 START 候选不可复用', () => {
    const f = fixture(), options = nativeOptions();
    f.event('GENERATION_STARTED', 'normal', options, false);
    if (reset === 'CHAT_CHANGED') { f.context.chatId = 'other-chat'; f.context.chat = []; }
    f.event(reset);
    f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
    assertUntracked(f);
    f.api.destroy();
  });
}

await check('即使聊天切换事件尚未送达，旧 chatRef 或 chatKey 不能配对 AFTER', () => {
  for (const change of [f => { f.context.chat = []; }, f => { f.context.chatId = 'other-chat'; }]) {
    const f = fixture(), options = nativeOptions();
    f.event('GENERATION_STARTED', 'normal', options, false);
    change(f);
    f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
    assertUntracked(f);
    f.api.destroy();
  }
});

await check('主壳实例与内嵌桥接均采用当前构建版本', () => {
  const f = fixture();
  assert.equal(f.HW.__RK_PHONE_SHELL__.version, version);
  assert.equal(f.api.makeBridge().version, version);
  assert.equal(f.api.makeBridge().relationshipRules, RELATIONSHIP_SCORING);
  assert.equal(f.api.makeBridge().supportStage, supportStage);
  assert.equal(f.api.makeBridge().romanceStage, romanceStage);
  assert.equal(typeof f.api.makeBridge().getSnapshot, 'function');
  assert.equal(typeof f.api.makeBridge().getStat, 'function');
  f.api.destroy();
});

await check('展开启动轮询，重复展开不叠加，收起停止后可重新展开', async () => {
  const f = fixture(), received = [];
  f.api.SS.booted = true;
  f.api.makeBridge().onUpdate(event => received.push(event));
  await f.api.show();
  assert.equal(f.intervals.size, 1);
  assert.equal([...f.intervals.values()][0].ms, 1000);
  assert.equal(received.at(-1).reset, true);
  [...f.intervals.values()][0].fn();
  assert.equal(received.at(-1).type, 'poll');
  await f.api.show();
  assert.equal(f.intervals.size, 1);
  f.api.hide();
  assert.equal(f.intervals.size, 0);
  assert.equal(f.api.SS.visible, false);
  await f.api.show();
  assert.equal(f.intervals.size, 1);
  f.api.destroy();
});

await check('分支变动清空旧名册，主回复更新保留只读展示等待 MVU', () => {
  const f = fixture();
  vm.runInContext("var bridgeRevision = 0, stateSignature = '', dataStatus = 'ready', dataError = '', stateSource = null, expandedPeople = new Set();\n" +
    "var stat = {}, stateTargetSource = null, stateMessage = '', hasDisplayedState = false, hiddenPeopleOpen = false, activeChat = null, rosterDeleteDraft = null, calendarState = { _initialized: false };\n" +
    "var bridge = { getStat: () => new Promise(() => {}) };\nfunction refreshTerminalView() {}\nfunction resetCalendarLore() {}\n" + pageRefresh +
    '\nshell.makeBridge().onUpdate(refreshTerminalState);', f.realm);
  for (const name of ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'CHARACTER_FIRST_MESSAGE_SELECTED']) {
    vm.runInContext("stat = { 人际: { 旧分支人物: {} } }; dataStatus = 'ready'; hasDisplayedState = true;", f.realm);
    f.event(name);
    assert.equal(vm.runInContext('JSON.stringify(stat)', f.realm), '{}', name);
    assert.equal(f.realm.dataStatus, 'loading', name);
  }
  // 正常收到/保存主回复不会回放旧分支；保留当前展示时明确标记等待状态。
  for (const name of ['MESSAGE_UPDATED', 'MESSAGE_RECEIVED']) {
    vm.runInContext("stat = { 人际: { 本局人物: {} } }; dataStatus = 'ready'; hasDisplayedState = true;", f.realm);
    f.event(name);
    assert.equal(vm.runInContext('JSON.stringify(stat)', f.realm), '{"人际":{"本局人物":{}}}', name);
    assert.equal(f.realm.dataStatus, 'pending', name);
    assert.equal(f.realm.stateMessage, '等待当前回复 MVU', name);
  }
  const received = [];
  f.api.makeBridge().onUpdate(event => received.push(event));
  f.event('GENERATION_ENDED');
  assert.equal(received.at(-1).type, 'story-turn');
  assert.equal(received.at(-1).reset, undefined);
  f.api.destroy();
});

await check('消息重绘、完成和中止事件在终端收起时仍强制核对头像，普通轮询保持缓存', () => {
  const f = fixture(), refreshes = [], updates = [];
  f.api.setBubbleBinder({ refresh: force => refreshes.push(force), destroy() {} });
  f.api.makeBridge().onUpdate(event => updates.push(event));
  assert.equal(f.api.SS.visible, false);
  for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED',
    'CHARACTER_MESSAGE_RENDERED', 'GENERATION_ENDED', 'GENERATION_STOPPED']) {
    const before = updates.length;
    f.event(name); assert.equal(refreshes.at(-1), true, name);
    if (name === 'CHARACTER_MESSAGE_RENDERED') assert.equal(updates.length, before, '纯重绘不重置 MVU 读取或编辑草稿');
  }
  assert.equal(refreshes.length, 7);
  f.api.emit({ type: 'poll' }); assert.equal(refreshes.at(-1), false);
  f.api.destroy();
  const count = refreshes.length;
  f.event('CHARACTER_MESSAGE_RENDERED'); assert.equal(refreshes.length, count);
});

await check('pagehide销毁会注销宿主事件、停止轮询且不再向旧页面推送', async () => {
  const f = fixture(), received = [];
  f.api.SS.booted = true;
  f.api.makeBridge().onUpdate(event => received.push(event));
  await f.api.show();
  assert.equal(f.events.size, f.eventNames.length + 2, '宿主事件与两个 MVU 事件都已注册');
  assert.ok(f.events.has('event:GENERATION_STARTED'));
  assert.ok(f.events.has('event:GENERATION_AFTER_COMMANDS'));
  const count = received.length;
  f.pagehide();
  assert.equal(f.api.SS.destroyed, true);
  assert.equal(f.events.size, 0);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.hostListeners.size, 0);
  assert.equal(f.pageListeners.size, 0);
  assert.equal(f.HW.__RK_PHONE_SHELL__, undefined);
  f.event('CHAT_CHANGED');
  await f.api.show();
  f.api.destroy();
  assert.equal(received.length, count);
  assert.equal(f.intervals.size, 0);
});

await check('srcdoc挂载中销毁立即取消timeout与onload，晚到回调不boot', async () => {
  const f = fixture();
  const showing = f.api.show();
  const frame = f.frames[0], lateLoad = frame.onload;
  assert.equal(f.timeouts.size, 1);
  assert.equal([...f.timeouts.values()][0].ms, 5000);
  f.api.destroy();
  assert.equal(f.timeouts.size, 0);
  assert.equal(frame.onload, null);
  assert.equal(f.api.SS.cancelMount, null);
  lateLoad();
  await showing;
  assert.equal(f.boots.length, 0);
  assert.equal(f.frames.length, 1);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.api.SS.mounting, null);
  assert.equal(f.tips.length, 0);
});

await check('load已回调但尚未继续boot时销毁，仍不创建旧桥接', async () => {
  const f = fixture();
  const showing = f.api.show();
  f.frames[0].onload();
  f.api.destroy();
  await showing;
  assert.equal(f.boots.length, 0);
  assert.equal(f.timeouts.size, 0);
  assert.equal(f.intervals.size, 0);
});

await check('正常srcdoc挂载仅boot一次且释放挂载等待资源', async () => {
  const f = fixture();
  const showing = f.api.show();
  const load = f.frames[0].onload;
  load();
  await showing;
  load();
  assert.equal(f.boots.length, 1);
  assert.equal(f.boots[0].version, version);
  assert.equal(f.frames[0].onload, null);
  assert.equal(f.api.SS.cancelMount, null);
  assert.equal(f.timeouts.size, 0);
  assert.equal(f.api.SS.booted, true);
  assert.equal(f.intervals.size, 1);
  f.api.destroy();
});

await check('srcdoc超时仍按原策略回退blob，blob可成功挂载', async () => {
  const f = fixture();
  const showing = f.api.show();
  [...f.timeouts.values()][0].fn();
  await settle();
  assert.equal(f.frames.length, 2);
  assert.equal(f.frames[0].removed, true);
  assert.equal(f.frames[0].onload, null);
  assert.match(f.frames[1].src, /^blob:/);
  assert.equal([...f.timeouts.values()][0].ms, 3000);
  f.frames[1].onload();
  await showing;
  assert.equal(f.boots.length, 1);
  assert.equal(f.timeouts.size, 0);
  f.api.destroy();
  assert.ok(f.revoked.includes('blob:test-2'));
});

await check('blob回退挂载中销毁同样取消等待且不再显示加载失败通知', async () => {
  const f = fixture();
  const showing = f.api.show();
  [...f.timeouts.values()][0].fn();
  await settle();
  const frame = f.frames[1], lateLoad = frame.onload;
  f.api.destroy();
  lateLoad();
  await showing;
  assert.equal(frame.onload, null);
  assert.equal(f.timeouts.size, 0);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.boots.length, 0);
  assert.equal(f.tips.length, 0);
  assert.equal(f.errors.length, 0);
  assert.ok(f.revoked.includes('blob:test-2'));
});

await check('主壳桥接头像服务可保存别名，宿主只读，销毁后旧桥接不能继续保存', () => {
  const f = fixture(), portrait = f.api.makeBridge().playerPortrait;
  const before = portrait.get();
  const saved = portrait.saveAliases(before, { aliases: ['朝阳'] });
  assert.equal(saved.aliases[0], '朝阳');
  assert.equal(portrait.resolve('朝阳').player, true);
  assert.equal(typeof f.HW.__RK_PHONE_SHELL__.playerPortrait.get, 'function');
  assert.equal(f.HW.__RK_PHONE_SHELL__.playerPortrait.save, undefined);
  assert.equal(portrait.save, undefined);
  assert.equal(portrait.clear, undefined);
  f.api.destroy();
  assert.throws(() => portrait.saveAliases(saved, { aliases: ['朝阳'] }), /终端已关闭/);
});

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length,
  runtime: '执行主壳真实函数与事件接线；使用离线 DOM/计时器替身，未连接酒馆', results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
