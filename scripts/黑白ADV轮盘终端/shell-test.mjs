import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../世界书规则/MVU/schema.mjs';
import { isHagunAffiliation, shouldInjectTournament } from '../rakudai-tournament-calendar.mjs';

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
  .replace('/*__INJECT_LIME_CHARACTER_ALIASES__*/', '[]')
  .replace('/*__INJECT_CORRECTION__*/', read('correction.js'));
const lifecycleWiring = between(main, "  HW.addEventListener('resize', onResize);", "  console.info('[Hagun-Blazer-Terminal] initialized');");
const pageRefresh = between(read('terminal-app.js'), 'function refreshTerminalState(event)', 'window.RKBoot = function(b)');
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(options = {}) {
  const intervals = new Map(), timeouts = new Map(), hostListeners = new Map(), pageListeners = new Map(), events = new Map();
  const frames = [], boots = [], revoked = [], tips = [], errors = [], warnings = [];
  // 使用真实校正/读取模块；连接配置仅留在本夹具内存，不请求副 API。
  const storage = new Map();
  const requests = [], writes = [], nativeSends = [];
  const auxiliaryCalls = [], auxiliaryRequests = [], messageWrites = [], injectedPrompts = [], stopped = [], loreReads = [];
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
  const sendTextarea = { value: '', disabled: false, readOnly: false, dispatchEvent() {} };
  const sendButton = { disabled: false, getAttribute() { return null; }, click() {
    // 替身只模拟原生正常回合的入口；不连接主 API、不构造助手回复。
    nativeSends.push(sendTextarea.value);
    const generationOptions = nativeOptions();
    dispatch(events, W.tavern_events.GENERATION_STARTED, 'normal', generationOptions, false);
    dispatch(events, W.tavern_events.GENERATION_AFTER_COMMANDS, 'normal', { ...generationOptions }, false);
    context.chat.push({ is_user: true, is_system: false, name: context.name1, mes: sendTextarea.value });
    sendTextarea.value = '';
  } };
  HW.Event = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
  if (options.sendControls) HW.document = { querySelector(selector) {
    return selector === '#send_textarea' ? sendTextarea : selector === '#send_but' ? sendButton : null;
  } };
  const eventNames = ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'CHARACTER_FIRST_MESSAGE_SELECTED', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_COMPLETION_SETTINGS_READY'];
  const W = {
    Mvu: { events: { COMMAND_PARSED: 'mvu:parsed', VARIABLE_UPDATE_ENDED: 'mvu:ended' } },
    RakudaiStateController: { isHagunAffiliation, shouldInjectTournament },
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
    URL: urls, Blob, console: { error: (...args) => errors.push(args), warn: (...args) => warnings.push(args) },
    setInterval: (fn, ms) => { const id = ++timerId; intervals.set(id, { fn, ms }); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, ms) => { const id = ++timerId; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    fn: name => ({
      eventOn(event, callback) {
        listen(events, event, callback);
        return { stop: () => unlisten(events, event, callback) };
      },
      eventMakeLast(event, callback) { unlisten(events, event, callback); listen(events, event, callback); },
      eventRemoveListener(event, callback) { unlisten(events, event, callback); },
      getChatMessages(range, settings = {}) {
        const ids = /^\d+-\d+$/.test(String(range))
          ? Array.from({ length: Number(String(range).split('-')[1]) - Number(String(range).split('-')[0]) + 1 }, (_, offset) => Number(String(range).split('-')[0]) + offset)
          : [Number(range)];
        return ids.flatMap(id => {
          const message = context.chat[id];
          if (!message) return [];
          const role = message.is_user ? 'user' : message.is_system ? 'system' : 'assistant';
          if (settings.role && settings.role !== role) return [];
          const swipeId = message.swipe_id ?? 0;
          const pageData = message.variables?.[swipeId] ?? message.swipes_data?.[swipeId] ?? {};
          const record = { message_id: id, role, name: message.name, swipe_id: swipeId,
            data: structuredClone(pageData),
            message: message.swipes?.[message.swipe_id ?? 0] ?? message.mes };
          if (settings.include_swipes) {
            record.swipes = (message.swipes ?? [message.mes]).slice();
            record.swipes_data = structuredClone(message.variables ?? message.swipes_data ?? [{}]);
          }
          return [record];
        });
      },
      getTavernVersion: options.tavernVersion ? () => options.tavernVersion : null,
      updateVariablesWith(...args) { writes.push(args); throw new Error('首楼隔离测试禁止变量写入'); },
      async getCharWorldbookNames(selector) { loreReads.push(['binding', selector]); return { primary: '测试人物世界书' }; },
      async getWorldbook(name) {
        loreReads.push(['worldbook', name]);
        if (options.getWorldbook) return options.getWorldbook(name);
        return structuredClone(options.worldbookEntries ?? [{ uid: 7, name: '史黛菈', enabled: true, content: '测试档案：史黛菈认真好胜，熟人面前会坦率表达关心。' }]);
      },
      injectPrompts(prompts, settings) {
        const injection = { prompts: structuredClone(prompts), settings: structuredClone(settings), cleaned: false };
        injectedPrompts.push(injection); return { uninject() { injection.cleaned = true; } };
      },
      stopGenerationById(id) { stopped.push(id); dispatch(events, W.tavern_events.GENERATION_STOPPED, id); },
      async generate(config) {
        auxiliaryCalls.push(config);
        const request = { messages: [{ role: 'system', content: '公共预设提示' }, { role: 'user', content: '辅助生成输入' }] };
        auxiliaryRequests.push(request);
        await dispatch(events, W.tavern_events.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        await dispatch(events, W.tavern_events.CHAT_COMPLETION_SETTINGS_READY, request);
        if (options.generate) return options.generate(config);
        return '<LIME>' + JSON.stringify({ 对象: '史黛菈', 消息: [{ 发言人: '史黛菈', 内容: '一起练习吧。' }] }) + '</LIME>';
      },
      async setChatMessages(updates, settings) {
        messageWrites.push({ updates: structuredClone(updates), settings: structuredClone(settings) });
        for (const update of updates) {
          const target = context.chat[update.message_id];
          assert.ok(target, 'fixture writes need an existing story floor');
          const swipeId = target.swipe_id ?? 0;
          if (Array.isArray(update.swipes_data)) target.variables = structuredClone(update.swipes_data);
          else {
            if (!target.variables) target.variables = [{}];
            target.variables[swipeId] = structuredClone(update.data);
          }
          target.swipes_data = target.variables;
        }
      },
    })[name] || null,
    closeWheel() {}, clearOrbTip() {}, setMode() {}, preferDrawer: () => false,
    refreshStatePanel() {}, disposeStatePanel() {}, statePanel: null,
    showOrbTip: (...args) => tips.push(args), recenter() {}, toggleWheel() {}, openPhoneApp() {},
  });
  vm.runInContext("const SLOT = '__RK_PHONE_SHELL__';\n" + versionDeclaration + '\n' + stateDeclaration + '\n' + read('state-reader.js') + '\n' + read('player-display-store.js') + '\n' + read('player-portrait.js') + '\n' +
    read('lime-chat.mjs').replace(/^export /gm, '') + '\n' + read('lime-host.js') + '\n' + read('lime-worldbook.js') + '\n' + read('lime-story.js') + '\n' + shellFunctions + '\n' +
    'globalThis.shell = { SS, show, hide, destroy, makeBridge, wireEvents, emit, getCorrectionStatus, ' +
    'generation: () => ({ pending: generationPending, turn: correctionMainTurn }), setBubbleBinder(value) { playerBubbleBinder = value; } };', realm);
  realm.shell.SS.host = node();
  realm.shell.SS.orb = node();
  realm.shell.SS.style = node();
  vm.runInContext(lifecycleWiring + '\nwireEvents();', realm);
  function dispatch(map, name, ...args) {
    // Native ST awaits its START listeners before scanning world info. Invoke synchronously,
    // then return every listener promise so tests can reproduce that lifecycle when needed.
    return Promise.all([...(map.get(name) || [])].map(callback => Promise.resolve(callback(...args))));
  }
  return { api: realm.shell, realm, HW, context, requests, writes, nativeSends, sendTextarea, sendButton,
    auxiliaryCalls, auxiliaryRequests, messageWrites, injectedPrompts, stopped, loreReads,
    intervals, timeouts, hostListeners, pageListeners, events, eventNames, frames, boots, revoked, tips, errors, warnings,
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

await check('分支变动清空旧名册，主回复更新保留只读展示等待 MVU', async () => {
  const f = fixture();
  vm.runInContext("var bridgeRevision = 0, stateSignature = '', dataStatus = 'ready', dataError = '', stateSource = null, expandedPeople = new Set();\n" +
    "var stat = {}, stateTargetSource = null, stateMessage = '', hasDisplayedState = false, hiddenPeopleOpen = false, activeChat = null, rosterDeleteDraft = null, calendarState = { _initialized: false };\n" +
    "var bridge = { getStat: () => new Promise(() => {}) };\nfunction refreshTerminalView() {}\nfunction resetCalendarLore() {}\n" + pageRefresh +
    '\nshell.makeBridge().onUpdate(refreshTerminalState);', f.realm);
  for (const name of ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'CHARACTER_FIRST_MESSAGE_SELECTED']) {
    vm.runInContext("stat = { 人际: { 旧分支人物: {} } }; dataStatus = 'ready'; hasDisplayedState = true;", f.realm);
    await f.event(name);
    assert.equal(vm.runInContext('JSON.stringify(stat)', f.realm), '{}', name);
    assert.equal(f.realm.dataStatus, 'loading', name);
  }
  // 正常收到/保存主回复不会回放旧分支；保留当前展示时明确标记等待状态。
  for (const name of ['MESSAGE_UPDATED', 'MESSAGE_RECEIVED']) {
    vm.runInContext("stat = { 人际: { 本局人物: {} } }; dataStatus = 'ready'; hasDisplayedState = true;", f.realm);
    await f.event(name);
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
  assert.equal(f.events.size, f.eventNames.length + 3, '宿主事件、两个 MVU 事件与选拔赛尾事件都已注册');
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

function seedLimeContext(f) {
  const mvu = { 系统: { 已删除人物: [], 主角模式: '自定义角色' }, 场景: { 时间: '2013-05-15 16:20' }, 玩家: { 姓名: '清泉朝阳' },
    人际: { 史黛菈: { 已加联系方式: true, 关系: '练习伙伴', 态度印象: '愿意约练习，但尚未确认恋爱关系', 好感: 100, 支援度: 80 } } };
  const incoming = '<LIME>\n' + JSON.stringify({ 对象: '史黛菈', 消息: [{ 发言人: '史黛菈', 内容: '收到。' }] }) + '\n</LIME>';
  const otherSwipe = '<LIME>\n' + JSON.stringify({ 对象: '史黛菈', 消息: [{ 发言人: '史黛菈', 内容: '另一回复页。' }] }) + '\n</LIME>';
  const attachment = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [{ id: 'shell-previous', contact: '史黛菈',
    time: mvu.场景.时间, player: '练习集合在东门。', reply: ['我知道集合地点了。'] }] };
  const otherMvu = structuredClone(mvu); otherMvu.场景.时间 = '2013-05-15 16:25';
  const pages = [{ stat_data: mvu, rk_lime: attachment, unrelated: '保留此页其他变量' }, { stat_data: otherMvu }];
  f.context.chat.push({ is_user: true, mes: '普通剧情行动。' }, { is_user: false, mes: incoming,
    name: '史黛菈', swipe_id: 0, swipes: [incoming, otherSwipe],
    variables: pages, swipes_data: pages });
}

await check('主壳 LIME 桥接读取真实当前楼层与活动页，读取不改写上下文', () => {
  const f = fixture(); seedLimeContext(f);
  const lime = f.api.makeBridge().lime, before = JSON.stringify(f.context.chat);
  assert.deepEqual(Object.keys(lime).sort(), ['read', 'send']);
  const current = lime.read();
  assert.equal(current.messages.length, 2); assert.equal(current.messages[0].role, 'user');
  assert.match(current.messages[1].message, /收到。/); assert.equal(current.source.messageId, 1);
  assert.equal(current.source.swipeId, 0); assert.equal(current.playerName, '清泉朝阳'); assert.equal(current.pending, false);
  assert.equal(current.messages[1].data.stat_data.场景.时间, '2013-05-15 16:20');
  assert.equal(current.messages[1].swipes_data[0].rk_lime.owner.swipeId, 0);
  current.messages[1].message = '客户端内容'; assert.equal(JSON.stringify(f.context.chat), before);
  f.context.chat[1].swipe_id = 1;
  assert.match(lime.read().messages[1].message, /另一回复页/); assert.equal(lime.read().source.swipeId, 1);
  assert.equal(lime.read().messages[1].data.stat_data.场景.时间, '2013-05-15 16:25');
  assert.equal(f.requests.length, 0); assert.equal(f.writes.length, 0);
  f.api.destroy(); assert.throws(() => lime.read(), { code: 'DESTROYED' });
});

await check('LIME STOP 请求 ID 不消耗原生 START，也不中断正在等待的正式主轮', () => {
  const f = fixture(), options = nativeOptions();
  f.event('GENERATION_STARTED', 'normal', options, false);
  f.event('GENERATION_STOPPED', 'rk-lime:before-main');
  assertUntracked(f);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  const turn = f.api.generation().turn;
  assert.ok(turn);
  f.event('GENERATION_STOPPED', 'rk-lime:during-main');
  assert.equal(f.api.generation().turn, turn); assert.equal(f.api.generation().pending, true);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  assert.equal(f.requests.length, 0); assert.equal(f.writes.length, 0);
  f.api.destroy();
});

await check('只有配对的正式主请求获得当前分支附属通讯提示，Helper 请求保持原提示', async () => {
  const f = fixture(); seedLimeContext(f);
  const makeRequest = () => ({ messages: [{ role: 'system', content: '原有角色提示' }, { role: 'user', content: '继续训练。' }] });
  const auxiliary = makeRequest(), before = JSON.stringify(auxiliary);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', {}, false);
  f.event('CHAT_COMPLETION_SETTINGS_READY', auxiliary);
  assert.equal(JSON.stringify(auxiliary), before); assertUntracked(f);
  const options = nativeOptions(), story = makeRequest();
  await f.event('GENERATION_STARTED', 'normal', options, false);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  f.event('CHAT_COMPLETION_SETTINGS_READY', story);
  const prompts = story.messages.filter(message => message.content.startsWith('[rk-lime:attached-context:v1]'));
  assert.equal(prompts.length, 1);
  assert.match(prompts[0].content, /练习集合在东门/);
  assert.match(prompts[0].content, /2013-05-15 16:20/);
  assert.equal(story.messages.at(-1).content, '继续训练。');
  f.event('CHAT_COMPLETION_SETTINGS_READY', story);
  assert.equal(story.messages.filter(message => message.content.startsWith('[rk-lime:attached-context:v1]')).length, 1, '同一请求副本不会重复注入');
  f.api.destroy();
});

await check('主壳 LIME 发送读取人物词条及关系，写当前页附件而不增加楼层或覆盖主草稿', async () => {
  const f = fixture({ sendControls: true }); seedLimeContext(f);
  const lime = f.api.makeBridge().lime, expectedSource = lime.read().source;
  f.sendTextarea.value = '宿主已有草稿\n';
  const beforeMvu = JSON.stringify(f.context.chat[1].swipes_data[0].stat_data);
  const otherSwipe = JSON.stringify(f.context.chat[1].swipes_data[1]);
  const sent = await lime.send({ name: '史黛菈', text: '一起训练吗？', expectedSource });
  assert.equal(sent.sent, true); assert.equal(f.auxiliaryCalls.length, 1);
  assert.equal(f.context.chat.length, 2); assert.equal(f.nativeSends.length, 0);
  assert.equal(f.sendTextarea.value, '宿主已有草稿\n');
  assert.ok(f.loreReads.some(([kind]) => kind === 'worldbook'), '真正通过主壳接线读取人物世界书');
  assert.match(JSON.stringify(f.auxiliaryCalls[0]) + JSON.stringify(f.injectedPrompts), /测试档案：史黛菈认真好胜/);
  assert.match(JSON.stringify(f.auxiliaryCalls[0]) + JSON.stringify(f.injectedPrompts), /练习伙伴/);
  assert.equal(f.messageWrites.length, 1); assert.equal(f.messageWrites[0].updates[0].message_id, 1);
  const data = f.context.chat[1].swipes_data[0];
  assert.equal(JSON.stringify(data.stat_data), beforeMvu); assert.equal(data.unrelated, '保留此页其他变量');
  assert.equal(JSON.stringify(f.context.chat[1].swipes_data[1]), otherSwipe);
  assert.equal(data.rk_lime.owner.messageId, 1); assert.equal(data.rk_lime.owner.swipeId, 0);
  const exchange = data.rk_lime.exchanges.at(-1);
  assert.equal(exchange.player, '一起训练吗？'); assert.equal(exchange.time, '2013-05-15 16:20');
  assert.deepEqual(exchange.reply, ['一起练习吧。']);
  assert.equal(f.injectedPrompts.length, 1); assert.equal(f.injectedPrompts[0].cleaned, true);
  assert.equal(f.auxiliaryRequests[0].messages.some(message => message.content.startsWith('[rk-lime:attached-context:v1]')), false);
  assertUntracked(f);
  f.api.destroy(); await assert.rejects(lime.send({ name: '史黛菈', text: '关闭后', expectedSource }), { code: 'DESTROYED' });
});

await check('原生 START 取消待回复 LIME 请求，辅助 STOP 和迟到回复不破坏正式主保存', async () => {
  let reply;
  const f = fixture({ generate: () => new Promise(resolve => { reply = resolve; }) }); seedLimeContext(f);
  const lime = f.api.makeBridge().lime, original = JSON.stringify(f.context.chat);
  const sending = lime.send({ name: '史黛菈', text: '等你确认。', expectedSource: lime.read().source });
  const cancelled = assert.rejects(sending, { code: 'CANCELLED' });
  await settle();
  assert.equal(f.auxiliaryCalls.length, 1);
  const id = f.auxiliaryCalls[0].generation_id;
  const options = nativeOptions();
  await f.event('GENERATION_STARTED', 'normal', options, false);
  await cancelled;
  assert.deepEqual(f.stopped, [id]); assert.equal(f.injectedPrompts[0].cleaned, true);
  assert.equal(f.messageWrites.length, 0); assert.equal(JSON.stringify(f.context.chat), original);
  f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  assert.equal(f.api.generation().pending, true); assert.ok(f.api.generation().turn);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  reply('<LIME>' + JSON.stringify({ 对象: '史黛菈', 消息: [{ 发言人: '史黛菈', 内容: '迟到回复。' }] }) + '</LIME>');
  await settle();
  assert.equal(f.messageWrites.length, 0); assert.equal(JSON.stringify(f.context.chat), original);
  assert.equal(f.api.generation().pending, true); assert.equal(f.requests.length, 0); assert.equal(f.writes.length, 0);
  f.api.destroy();
});

await check('原生 START 被 await 后在世界书扫描前已有当前人物原文、关系与主角模式，结束与切页清理', async () => {
  const f = fixture(); seedLimeContext(f);
  const options = nativeOptions();
  await f.event('GENERATION_STARTED', 'normal', options, false);
  assert.equal(f.injectedPrompts.length, 1);
  const injected = f.injectedPrompts[0], prompt = injected.prompts[0];
  assert.match(prompt.id, /^rk-lime:story-persona:/);
  assert.equal(injected.cleaned, false); assert.equal(prompt.should_scan, false);
  assert.match(prompt.content, /测试档案：史黛菈认真好胜/);
  assert.match(prompt.content, /测试人物世界书/); assert.match(prompt.content, /UID：7/);
  assert.match(prompt.content, /练习伙伴/); assert.match(prompt.content, /"好感":100/);
  assert.match(prompt.content, /"主角模式":"自定义角色"/);
  assert.equal(f.auxiliaryCalls.length, 0); assert.equal(f.messageWrites.length, 0);
  assert.equal(f.api.generation().pending, false, '档案准备不等于主保存开始');
  await f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  assert.equal(f.api.generation().pending, true);
  await f.event('GENERATION_ENDED', f.context.chat.length);
  assert.equal(injected.cleaned, true);
  await f.event('GENERATION_STARTED', 'normal', options, false);
  assert.equal(f.injectedPrompts.length, 2); assert.equal(f.injectedPrompts[1].cleaned, false);
  f.context.chat[1].swipe_id = 1;
  await f.event('MESSAGE_SWIPED');
  assert.equal(f.injectedPrompts[1].cleaned, true);
  f.api.destroy();
});

await check('正式剧情只显式加载最多三名最近已通联人物，不选断联者或更早联系人', async () => {
  const names = ['训练甲', '训练乙', '训练丙', '训练丁', '断联者'];
  const f = fixture({ worldbookEntries: names.map((name, index) => ({ uid: 20 + index, name, enabled: true, content: '独立档案-' + name })) });
  seedLimeContext(f);
  const data = f.context.chat[1].variables[0];
  names.forEach(name => { data.stat_data.人际[name] = { 已加联系方式: name !== '断联者', 关系: '当前练习关系-' + name }; });
  data.rk_lime.exchanges = names.map((contact, index) => ({ id: 'recent-' + index, contact,
    time: data.stat_data.场景.时间, player: '准备练习。', reply: ['知道了。'], narrativeCount: 1 }));
  await f.event('GENERATION_STARTED', 'normal', nativeOptions(), false);
  assert.equal(f.injectedPrompts.length, 1);
  const content = f.injectedPrompts[0].prompts[0].content;
  for (const name of ['训练乙', '训练丙', '训练丁']) {
    assert.ok(content.includes('独立档案-' + name)); assert.ok(content.includes('当前练习关系-' + name));
  }
  assert.equal(content.includes('独立档案-训练甲'), false); assert.equal(content.includes('独立档案-断联者'), false);
  assert.equal(content.includes('测试档案：史黛菈'), false);
  assert.equal(f.loreReads.filter(([kind]) => kind === 'worldbook').length, 3);
  f.api.destroy(); assert.equal(f.injectedPrompts[0].cleaned, true);
});

await check('原生 START 等待人物档案时阻止第二次手机生成，await 完成后才允许进入正式 AFTER', async () => {
  let resolveLore;
  const awaitingLore = new Promise(resolve => { resolveLore = resolve; });
  const f = fixture({ getWorldbook: () => awaitingLore }); seedLimeContext(f);
  const lime = f.api.makeBridge().lime, source = lime.read().source, options = nativeOptions();
  const starting = f.event('GENERATION_STARTED', 'normal', options, false);
  await settle();
  assert.equal(f.api.generation().pending, false); assert.equal(f.injectedPrompts.length, 0);
  await assert.rejects(lime.send({ name: '史黛菈', text: '准备时不能插入辅助请求。', expectedSource: source }), { code: 'GENERATING' });
  assert.equal(f.auxiliaryCalls.length, 0); assert.equal(f.messageWrites.length, 0);
  resolveLore([{ uid: 7, name: '史黛菈', enabled: true, content: '等待后核实的当前人物档案。' }]);
  await starting;
  assert.equal(f.injectedPrompts.length, 1);
  assert.match(f.injectedPrompts[0].prompts[0].content, /等待后核实的当前人物档案/);
  await f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  assert.equal(f.api.generation().pending, true); assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  f.api.destroy(); assert.equal(f.injectedPrompts[0].cleaned, true);
});

await check('准备人物档案期间切聊天会释放 START 等待，迟到档案不进入新聊天或配对旧 AFTER', async () => {
  let resolveLore;
  const awaitingLore = new Promise(resolve => { resolveLore = resolve; });
  const f = fixture({ getWorldbook: () => awaitingLore }); seedLimeContext(f);
  const options = nativeOptions(), starting = f.event('GENERATION_STARTED', 'normal', options, false);
  await settle();
  f.context.chatId = 'changed-while-reading'; f.context.chat = [];
  await f.event('CHAT_CHANGED'); await starting;
  resolveLore([{ uid: 7, name: '史黛菈', enabled: true, content: '旧聊天迟到档案。' }]);
  await settle();
  assert.equal(f.injectedPrompts.length, 0); assert.equal(f.auxiliaryCalls.length, 0); assert.equal(f.messageWrites.length, 0);
  await f.event('GENERATION_AFTER_COMMANDS', 'normal', { ...options }, false);
  assertUntracked(f); f.api.destroy();
});

await check('见证后的删楼和删回复页经主壳 await 修复保留附件归属，不改 MVU 或其他页资料', async () => {
  for (const mode of ['floor', 'swipe']) {
    const f = fixture(); seedLimeContext(f);
    const raw = f.context.chat[1];
    if (mode === 'swipe') {
      raw.variables[1].rk_lime = raw.variables[0].rk_lime;
      raw.variables[1].rk_lime.owner.swipeId = 1;
      delete raw.variables[0].rk_lime; raw.swipe_id = 1;
    }
    await f.event('CHAT_CHANGED'); // main witnesses while the phone remains closed.
    assert.equal(f.api.SS.visible, false);
    const originalMvu = JSON.stringify(raw.variables[raw.swipe_id].stat_data);
    if (mode === 'floor') f.context.chat.splice(0, 1);
    else {
      raw.swipes.splice(0, 1); raw.variables.splice(0, 1); raw.swipe_id = 0; raw.mes = raw.swipes[0];
    }
    await f.event(mode === 'floor' ? 'MESSAGE_DELETED' : 'MESSAGE_SWIPE_DELETED');
    assert.equal(f.messageWrites.length, 1, mode);
    assert.ok(Array.isArray(f.messageWrites[0].updates[0].swipes_data), '通过公开完整 swipes_data 写入 inactive 页');
    const messageId = mode === 'floor' ? 0 : 1, data = raw.variables[0];
    assert.equal(data.rk_lime.owner.messageId, messageId); assert.equal(data.rk_lime.owner.swipeId, 0);
    assert.equal(JSON.stringify(data.stat_data), originalMvu);
    assert.equal(data.rk_lime.exchanges[0].player, '练习集合在东门。');
    assert.equal(f.api.makeBridge().lime.read().source.messageId, messageId);
    assert.equal(f.nativeSends.length, 0); assert.equal(f.requests.length, 0); assert.equal(f.writes.length, 0);
    f.api.destroy();
  }
});

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length,
  runtime: '执行主壳真实函数与事件接线；使用离线 DOM/计时器替身，未连接酒馆', results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
