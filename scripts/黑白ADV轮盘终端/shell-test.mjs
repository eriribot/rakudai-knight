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
    addEventListener: (name, fn) => listen(hostListeners, name, fn),
    removeEventListener: (name, fn) => unlisten(hostListeners, name, fn),
  };
  const eventNames = ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_RECEIVED', 'CHARACTER_FIRST_MESSAGE_SELECTED', 'GENERATION_ENDED'];
  const W = {
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
    fn: name => name === 'eventOn' ? (event, callback) => {
      listen(events, event, callback);
      return { stop: () => unlisten(events, event, callback) };
    } : null,
    closeWheel() {}, clearOrbTip() {}, setMode() {}, preferDrawer: () => false,
    refreshStatePanel() {}, disposeStatePanel() {}, statePanel: null,
    showOrbTip: (...args) => tips.push(args), recenter() {}, toggleWheel() {}, openPhoneApp() {},
  });
  vm.runInContext("const SLOT = '__RK_PHONE_SHELL__';\n" + versionDeclaration + '\n' + stateDeclaration + '\n' + read('state-reader.js') + '\n' + shellFunctions + '\n' +
    'globalThis.shell = { SS, show, hide, destroy, makeBridge, wireEvents };', realm);
  realm.shell.SS.host = node();
  realm.shell.SS.orb = node();
  realm.shell.SS.style = node();
  vm.runInContext(lifecycleWiring + '\nwireEvents();', realm);
  function dispatch(map, name) { [...(map.get(name) || [])].forEach(callback => callback()); }
  return { api: realm.shell, realm, HW, intervals, timeouts, hostListeners, pageListeners, events, frames, boots, revoked, tips, errors,
    event: name => dispatch(events, W.tavern_events[name]),
    pagehide: () => dispatch(pageListeners, 'pagehide'),
  };
}

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
    "var bridge = { getStat: () => new Promise(() => {}) };\nfunction refreshTerminalView() {}\n" + pageRefresh +
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

await check('pagehide销毁会注销宿主事件、停止轮询且不再向旧页面推送', async () => {
  const f = fixture(), received = [];
  f.api.SS.booted = true;
  f.api.makeBridge().onUpdate(event => received.push(event));
  await f.api.show();
  assert.equal(f.events.size, 9);
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

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length,
  runtime: '执行主壳真实函数与事件接线；使用离线 DOM/计时器替身，未连接酒馆', results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
