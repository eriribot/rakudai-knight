// Run: node scripts/黑白ADV轮盘终端/calendar-ui-test.mjs
// Executes maintained calendar UI in an offline VM; does not write exports or live saves.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFragment } from 'parse5';

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const source = read('terminal-app.js');
const plain = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));
const modalIds = ['rk-calendar-story', 'rk-calendar-story-title', 'rk-calendar-story-source',
  'rk-calendar-story-choices', 'rk-calendar-story-content'];
const malicious = '<img src=x onerror="globalThis.calendarAttack = true"><script>calendarAttack = true</script>\n世界书正文原文。';

function loreEntry(uid, name, keys, content = '仅供查阅的世界书剧情正文。') {
  return { uid, name, dates: keys.map(key => ({ key, label: key })), dateLabel: keys.join(' 至 '), content };
}
function loreData(entries = [loreEntry(13, '[剧情]同日事件', ['2013-05-10'])]) {
  return { worldbook: '本聊天绑定世界书', entries, undatedCount: entries.filter(entry => !entry.dates.length).length };
}
function sceneState() {
  return { 系统: { 主角模式: '自定义角色' }, 玩家: { 姓名: '本局角色' }, 人际: {},
    场景: { 时间: '2013年5月10日 · 午后', 日程: { 本局午餐: { 日期: '2013-05-10', 类型: '约定',
      时间: '12:00', 地点: '学园食堂', 状态: '待定', 参与者: ['本局角色'], 说明: '本局实际登记。' } },
      选拔赛: { 比赛: { 实际比赛: { 日期: '2013-05-10', 时间: '15:00', 地点: '第一赛场', 状态: '待定',
        轮次: 4, 甲方: 'player', 乙方: 'rival', 依据: '本局明确登记的比赛' } } } } };
}
function fixture(reader = async () => loreData()) {
  const elements = new Map();
  const listeners = new Map();
  function node(tagName = 'div', id = '') {
    let markup = '', ownText = '';
    const attrs = new Map(), classes = new Set(), children = [];
    const item = { id, tagName: tagName.toUpperCase(), style: {}, hidden: id === 'rk-calendar-story',
      open: false, title: '', disabled: false, children, dataset: {}, parentNode: null,
      classList: { add(...values) { values.forEach(value => classes.add(value)); },
        remove(...values) { values.forEach(value => classes.delete(value)); },
        contains: value => classes.has(value),
        toggle(value, force) { const active = force ?? !classes.has(value); active ? classes.add(value) : classes.delete(value); return active; } },
      setAttribute(name, value) { attrs.set(name, String(value)); if (name === 'hidden') this.hidden = true; },
      getAttribute: name => attrs.get(name) ?? null,
      removeAttribute(name) { attrs.delete(name); if (name === 'hidden') this.hidden = false; },
      focus() { document.activeElement = this; },
      addEventListener(name, callback) { if (!listeners.has(this)) listeners.set(this, new Map()); listeners.get(this).set(name, callback); },
      removeEventListener(name) { listeners.get(this)?.delete(name); },
      appendChild(child) { children.push(child); child.parentNode = this; return child; },
      replaceChildren(...next) { children.splice(0, children.length, ...next); markup = ''; ownText = ''; },
      contains(child) { return this === child || children.includes(child); },
      showModal() { this.open = true; this.hidden = false; },
      close() { this.open = false; this.hidden = true; listeners.get(this)?.get('close')?.({ target: this }); },
      querySelector: () => null, querySelectorAll: () => [],
    };
    Object.defineProperties(item, {
      innerHTML: { get: () => markup, set(value) { markup = String(value); ownText = ''; children.length = 0; } },
      textContent: { get: () => ownText + children.map(child => child.textContent || '').join(''),
        set(value) { ownText = String(value); markup = ''; children.length = 0; } },
    });
    return item;
  }
  const element = id => {
    if (!elements.has(id)) elements.set(id, node('div', id));
    return elements.get(id);
  };
  const document = { getElementById: element, createElement: tag => node(tag),
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    body: node('body'), documentElement: node('html'), activeElement: null };
  modalIds.forEach(element);
  const ui = vm.createContext({ structuredClone, setTimeout, clearTimeout, document,
    addEventListener() {}, removeEventListener() {}, console });
  ui.window = ui;
  vm.runInContext(source, ui, { filename: 'terminal-app.js' });
  ui.stat = sceneState();
  ui.stateSource = { characterId: 1, chatId: 'chat-a', messageId: 2, swipeId: 0 };
  ui.hasDisplayedState = true; ui.dataStatus = 'ready'; ui.currentStack = ['scr-calendar'];
  let reads = 0;
  ui.bridge = { worldbookCalendar: { read: (...args) => { reads++; return reader(...args); } },
    tournament: { view: state => ({ matches: Object.entries(state.场景?.选拔赛?.比赛 || {}).map(([id, match]) =>
      ({ ...match, id, 甲方姓名: '本局角色', 乙方姓名: '本局对手', 程序推演: false })), roster: [], warnings: [], calendar: {} }) } };
  return { ui, element, document, get reads() { return reads; },
    html: () => element('calendar-body').innerHTML,
    modal: () => element('rk-calendar-story'),
    dispatch: (id, type, event) => listeners.get(element(id))?.get(type)?.(event) };
}
async function loaded(f) {
  f.ui.renderCalendar();
  await f.ui.loadCalendarLore();
  await settle();
  assert.equal(f.ui.calendarLore.status, 'ready');
}
function htmlNodes(markup, tag) {
  const found = [];
  function visit(node) { if (node.tagName === tag) found.push(node); for (const child of node.childNodes || []) visit(child); }
  visit(parseFragment(markup));
  return found;
}
function attrs(node) { return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value])); }
function textIn(node) { return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(textIn).join(''); }
function dayButton(f, key) {
  return htmlNodes(f.html(), 'button').find(button => (attrs(button)['aria-label'] || '').startsWith(key));
}
function assertOpen(f) { assert.equal(f.modal().open, true, 'worldbook modal should be visible'); }
function assertClosed(f) { assert.equal(f.modal().open, false, 'worldbook modal should be closed'); }

test('calendar modal has static DOM targets and the UI exposes all read-only actions', () => {
  const html = read('terminal-app.html');
  for (const id of modalIds) assert.match(html, new RegExp('id=["\']' + id + '["\']'));
  const { ui } = fixture();
  for (const method of ['loadCalendarLore', 'resetCalendarLore', 'calendarLoreItems', 'selectCalendarDay',
    'openCalendarStory', 'openCalendarStoriesForDate', 'closeCalendarStory']) assert.equal(typeof ui[method], 'function', method);
});

test('worldbook references, current scene and actual appointments coexist without changing the save', async () => {
  const range = loreEntry(21, '[剧情]日期区间', ['2013-05-10', '2013-05-11', '2013-05-12']);
  const f = fixture(async () => loreData([loreEntry(13, '[剧情]同日事件', ['2013-05-10']), range]));
  const before = JSON.stringify(f.ui.stat);
  await loaded(f);
  assert.equal(f.reads, 1, 'the initial render and concurrent load should share one read');
  assert.equal(f.ui.calendarLoreItems('2013-05-10').length, 2);
  assert.equal(f.ui.calendarLoreItems('2013-05-11').length, 1);
  assert.equal(f.ui.calendarLoreItems('2013-05-13').length, 0);
  for (const key of ['2013-05-10', '2013-05-11', '2013-05-12']) {
    const button = dayButton(f, key); assert.ok(button, key); assert.match(textIn(button), /剧情/, key);
  }
  const sceneButton = dayButton(f, '2013-05-10');
  assert.match(attrs(sceneButton).class, /is-scene-today/);
  assert.match(textIn(sceneButton), /⚔/);
  assert.match(f.html(), /本局午餐/);
  assert.match(f.html(), /本局角色 对 本局对手/);
  assert.equal(JSON.stringify(f.ui.stat), before);
  assert.equal(plain(f.ui.readSceneSchedule()).length, 2, 'worldbook references never become saved appointments or matches');
});

test('selecting a date with one story opens its complete text and source', async () => {
  const body = '第一段。\n\n第二段保持完整。';
  const f = fixture(async () => loreData([loreEntry(13, '[剧情]单条事件', ['2013-05-11'], body)]));
  await loaded(f);
  f.ui.selectCalendarDay(11);
  assert.equal(f.ui.calendarState.selectedDay, 11);
  assertOpen(f);
  assert.equal(f.element('rk-calendar-story-content').textContent, body);
  assert.match(f.element('rk-calendar-story-title').textContent, /单条事件/);
  assert.match(f.element('rk-calendar-story-source').textContent, /本聊天绑定世界书/);
  f.ui.closeCalendarStory(); assertClosed(f);
});

test('one day with multiple stories asks which entry to read before showing full text', async () => {
  const f = fixture(async () => loreData([loreEntry(13, '[剧情]甲条目', ['2013-05-10'], '甲正文'),
    loreEntry(15, '[剧情]乙条目', ['2013-05-10'], '乙正文')]));
  await loaded(f);
  f.ui.selectCalendarDay(10); assertOpen(f);
  const choices = f.element('rk-calendar-story-choices');
  const choiceText = choices.textContent + choices.innerHTML;
  assert.match(choiceText, /甲条目/); assert.match(choiceText, /乙条目/);
  assert.ok(!['甲正文', '乙正文'].includes(f.element('rk-calendar-story-content').textContent));
  f.ui.openCalendarStory(15);
  assert.equal(f.element('rk-calendar-story-content').textContent, '乙正文');
  assert.match(f.element('rk-calendar-story-title').textContent, /乙条目/);
});

test('worldbook HTML and scripts remain inert text and unsafe labels stay escaped', async () => {
  const f = fixture(async () => loreData([loreEntry(13, '[剧情]<img src=x onerror=attack()>', ['2013-05-10'], malicious)]));
  await loaded(f); f.ui.selectCalendarDay(10); assertOpen(f);
  assert.equal(f.element('rk-calendar-story-content').textContent, malicious);
  assert.equal(f.element('rk-calendar-story-content').innerHTML, '');
  assert.equal(f.ui.calendarAttack, undefined);
  const inlineImages = htmlNodes(f.html(), 'img').filter(image => attrs(image).onerror);
  assert.equal(inlineImages.length, 0, 'worldbook entry names must not create executable markup');
});

test('undated story references can be opened without inventing a date or changing the scene', async () => {
  const entry = { ...loreEntry(80, '[剧情]相对时间事件', [], '时间未精确到日期的全文'), dateLabel: '战后数日' };
  const f = fixture(async () => loreData([entry]));
  const before = JSON.stringify(f.ui.stat);
  await loaded(f);
  assert.match(f.html(), /相对时间事件/); assert.match(f.html(), /战后数日/);
  assert.equal(f.ui.calendarLoreItems('2013-05-10').length, 0);
  f.ui.openCalendarStory(80); assertOpen(f);
  assert.equal(f.element('rk-calendar-story-content').textContent, entry.content);
  assert.equal(JSON.stringify(f.ui.stat), before);
});

test('an unavailable worldbook displays an error and explicit retry can recover', async () => {
  let available = false;
  const f = fixture(async () => { if (!available) throw new Error('主世界书读取暂时失败'); return loreData(); });
  f.ui.renderCalendar();
  await f.ui.loadCalendarLore(); await settle();
  assert.equal(f.ui.calendarLore.status, 'error');
  assert.match(f.html(), /主世界书读取暂时失败/);
  const retry = htmlNodes(f.html(), 'button').find(button => attrs(button).onclick === 'loadCalendarLore(true)');
  assert.ok(retry, 'worldbook failure should leave a usable retry action');
  assert.equal(Object.hasOwn(attrs(retry), 'disabled'), false);
  available = true;
  await f.ui.loadCalendarLore(true); await settle();
  assert.equal(f.ui.calendarLore.status, 'ready');
  assert.equal(f.reads, 2);
  assert.equal(f.ui.calendarLoreItems('2013-05-10').length, 1);
});

test('chat reset closes the modal and a late old request cannot replace the new worldbook', async () => {
  let finishOld;
  const old = new Promise(resolve => { finishOld = resolve; });
  const f = fixture(() => old);
  const first = f.ui.loadCalendarLore();
  await settle();
  assert.equal(f.ui.calendarLore.status, 'loading');
  f.modal().showModal();
  f.ui.resetCalendarLore(); assertClosed(f);
  f.ui.stateSource = { ...f.ui.stateSource, chatId: 'chat-b' };
  f.ui.bridge.worldbookCalendar.read = async () => ({ ...loreData([loreEntry(99, '[剧情]新聊天事件', ['2013-05-10'])]), worldbook: '新聊天世界书' });
  await f.ui.loadCalendarLore(); await settle();
  assert.equal(f.ui.calendarLore.worldbook, '新聊天世界书');
  finishOld({ ...loreData([loreEntry(13, '[剧情]旧聊天迟到数据', ['2013-05-10'])]), worldbook: '旧聊天世界书' });
  await first; await settle();
  assert.equal(f.ui.calendarLore.worldbook, '新聊天世界书');
  assert.equal(f.ui.calendarLore.entries.length, 1);
  assert.equal(f.ui.calendarLore.entries[0].uid, 99);
  assert.doesNotMatch(f.html(), /旧聊天迟到数据/);
});

test('the actual chat-change refresh invalidates lore requests and clears the old open modal', async () => {
  let finishOld, nextChat = false;
  const old = new Promise(resolve => { finishOld = resolve; });
  const next = { ...loreData([loreEntry(99, '[剧情]新分支剧情', ['2013-05-10'])]), worldbook: '切聊天后的世界书' };
  const f = fixture(() => nextChat ? Promise.resolve(next) : old);
  const first = f.ui.loadCalendarLore(); await settle();
  f.modal().showModal();
  nextChat = true;
  f.ui.bridge.getSnapshot = async () => ({ state: sceneState(), source: { ...f.ui.stateSource, chatId: 'chat-b' }, pending: false });
  await f.ui.refreshTerminalState({ type: 'CHAT_CHANGED', reset: true });
  await settle();
  assertClosed(f);
  assert.equal(f.ui.calendarLore.worldbook, next.worldbook);
  finishOld({ ...loreData([loreEntry(13, '[剧情]旧分支迟到剧情', ['2013-05-10'])]), worldbook: '此前聊天世界书' });
  await first; await settle();
  assert.equal(f.ui.calendarLore.worldbook, next.worldbook);
  assert.doesNotMatch(f.html(), /旧分支迟到剧情/);
});

for (const [field, nextValue] of [['chatId', 'chat-b'], ['characterId', 2], ['groupId', 'group-b']]) {
  test('a polling snapshot with changed ' + field + ' closes the old modal and loads the new worldbook', async () => {
    let data = loreData([loreEntry(13, '[剧情]原身份资料', ['2013-05-10'], '原身份正文')]);
    const f = fixture(async () => structuredClone(data));
    await loaded(f); f.ui.openCalendarStory(13); assertOpen(f);
    const nextSource = { ...plain(f.ui.stateSource), [field]: nextValue };
    data = { ...loreData([loreEntry(99, '[剧情]新身份资料', ['2013-05-10'], '新身份正文')]), worldbook: '身份变更后的主世界书' };
    f.ui.bridge.getSnapshot = async () => ({ state: sceneState(), source: nextSource, pending: false });
    await f.ui.refreshTerminalState({ type: 'poll' });
    await f.ui.loadCalendarLore(); await settle();
    assertClosed(f);
    assert.equal(f.ui.calendarLore.status, 'ready');
    assert.equal(f.ui.calendarLore.worldbook, data.worldbook);
    assert.equal(f.reads, 2, 'identity change should cause exactly one fresh worldbook read');
    assert.equal(f.element('rk-calendar-story-content').textContent, '');
    assert.equal(f.ui.calendarLore.entries[0].uid, 99);
    assert.doesNotMatch(f.html(), /原身份资料/);
    f.ui.openCalendarStory(99); assertOpen(f);
    assert.equal(f.element('rk-calendar-story-content').textContent, '新身份正文');
  });
}

for (const [field, nextValue] of [['messageId', 3], ['swipeId', 1]]) {
  test('a polling snapshot with only changed ' + field + ' preserves the worldbook cache and open modal', async () => {
    const f = fixture(); await loaded(f); f.ui.openCalendarStory(13); assertOpen(f);
    const before = plain(f.ui.calendarLore);
    const nextSource = { ...plain(f.ui.stateSource), [field]: nextValue };
    f.ui.bridge.getSnapshot = async () => ({ state: sceneState(), source: nextSource, pending: false });
    await f.ui.refreshTerminalState({ type: 'poll' }); await settle();
    assertOpen(f);
    assert.deepEqual(plain(f.ui.calendarLore), before);
    assert.equal(f.reads, 1, 'a new reply on the same chat does not invalidate its primary worldbook');
    assert.equal(f.element('rk-calendar-story-content').textContent, before.entries[0].content);
  });
}

test('closing the native dialog restores keyboard focus to its opening control', async () => {
  const f = fixture(); await loaded(f);
  const opener = f.document.createElement('button'); opener.focus();
  f.ui.openCalendarStory(13); assertOpen(f);
  f.document.createElement('button').focus();
  f.ui.closeCalendarStory(); assertClosed(f);
  assert.equal(f.document.activeElement, opener);
});

test('only Escape stops dialog keydown bubbling and leaves native close behavior available', async () => {
  const f = fixture(); await loaded(f); f.ui.openCalendarStory(13); assertOpen(f);
  const keyboardEvent = key => ({ key, cancelBubble: false, defaultPrevented: false,
    stopPropagation() { this.cancelBubble = true; },
    preventDefault() { this.defaultPrevented = true; } });
  for (const key of ['Enter', 'Tab', 'ArrowDown', 'a']) {
    const event = keyboardEvent(key);
    f.dispatch('rk-calendar-story', 'keydown', event);
    assert.equal(event.cancelBubble, false, key + ' should keep its normal propagation');
    assert.equal(event.defaultPrevented, false, key + ' should keep its native default');
    assertOpen(f);
  }
  const escape = keyboardEvent('Escape');
  f.dispatch('rk-calendar-story', 'keydown', escape);
  assert.equal(escape.cancelBubble, true, 'Escape must not reach the terminal back-navigation listener');
  assert.equal(escape.defaultPrevented, false, 'Escape must leave native dialog dismissal enabled');
  // Model the browser default after dispatch; the application must not cancel it.
  if (!escape.defaultPrevented) f.modal().close();
  assertClosed(f);
});

test('viewing months and stories changes only calendar selection, never plot time or appointments', async () => {
  const f = fixture(); const before = JSON.stringify(f.ui.stat);
  await loaded(f);
  f.ui.changeCalendarMonth(1);
  assert.equal(f.ui.calendarState.month, 6);
  assert.equal(f.ui.calendarState.selectedDay, 1);
  assert.match(f.element('calendar-sub').textContent, /2013-05-10/);
  f.ui.selectCalendarDay(20);
  assert.equal(f.ui.calendarState.selectedDay, 20); assertClosed(f);
  f.ui.jumpToSceneDate();
  assert.equal(f.ui.calendarState.month, 5); assert.equal(f.ui.calendarState.selectedDay, 10);
  f.ui.openCalendarStory(13); f.ui.closeCalendarStory();
  assert.equal(JSON.stringify(f.ui.stat), before);
});

test('missing full scene date still permits dated worldbook references and undated items', async () => {
  const f = fixture(async () => loreData([loreEntry(13, '[剧情]已注明日期', ['2013-05-10']),
    { ...loreEntry(14, '[剧情]未定日', [], '未定日原文'), dateLabel: '某日清晨' }]));
  f.ui.stat.场景.时间 = '春假清晨'; f.ui.stat.场景.日程 = {};
  const before = JSON.stringify(f.ui.stat);
  await loaded(f);
  assert.ok(dayButton(f, '2013-05-10'), 'a dated worldbook entry may anchor browsing without establishing current plot date');
  assert.match(f.element('calendar-sub').textContent, /本局日期未确认/);
  assert.match(f.html(), /未定日/);
  f.ui.selectCalendarDay(10); assertOpen(f);
  assert.equal(JSON.stringify(f.ui.stat), before);
});
