// Offline interaction checks against the maintained LIME UI, with parsed DOM controls.
// No real Tavern connection, saved communication writes, CSS assertions, or generated exports.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFragment } from 'parse5';
import { createLimeChatProtocol } from './lime-chat.mjs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const source = read('terminal-lime.js');
const appPrelude = read('terminal-app.js').split('function resolveKnightAvatar')[0];
const contactA = '风祭凛奈', contactB = '夏洛特·科黛';
const settle = () => new Promise(resolve => setImmediate(resolve));
const block = (contact, text) => '<LIME>' + JSON.stringify({ 对象: contact, 消息: [{ 发言人: contact, 内容: text }] }) + '</LIME>';
const floor = (id, contact, text) => ({ message_id: id, role: 'assistant', swipe_id: 0, message: block(contact, text) });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(options = {}) {
  const listeners = new Map();
  let document;
  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase(); this.nodeName = tagName.toLowerCase();
      this.attrs = new Map(); this.dataset = {}; this.style = {}; this.childNodes = [];
      this.parentNode = null; this.hidden = false; this.disabled = false; this.open = false;
      this.scrollTop = 0; this.scrollHeight = 900; this.clientHeight = 300;
      this.selectionStart = 0; this.selectionEnd = 0; this.selectionDirection = 'none';
      this._value = ''; this._text = ''; this._html = '';
    }
    get id() { return this.getAttribute('id') || ''; }
    get type() { return this.getAttribute('type') || ''; }
    get children() { return this.childNodes.filter(item => item instanceof Element); }
    get value() { return this._value; }
    set value(value) { this._value = String(value); }
    get textContent() { return this._text + this.childNodes.map(child => child.textContent).join(''); }
    set textContent(value) { this.detachChildren(); this._text = String(value); this._html = ''; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this.detachChildren(); this._text = ''; this._html = String(value);
      for (const child of parseFragment(this._html).childNodes) this.appendChild(fromParsed(child));
    }
    detachChildren() {
      if (document && this.contains(document.activeElement)) document.activeElement = null;
      this.childNodes.forEach(child => { child.parentNode = null; }); this.childNodes = [];
    }
    setAttribute(name, value) {
      value = String(value); this.attrs.set(name, value);
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      if (name === 'disabled') this.disabled = true;
      if (name === 'hidden') this.hidden = true;
      if (name === 'open') this.open = true;
      if (name === 'value') this.value = value;
    }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    hasAttribute(name) { return this.attrs.has(name); }
    removeAttribute(name) { this.attrs.delete(name); if (name === 'disabled') this.disabled = false; }
    appendChild(child) { child.parentNode = this; this.childNodes.push(child); return child; }
    contains(item) { for (let next = item; next; next = next.parentNode) if (next === this) return true; return false; }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        if (part === '*') return true;
        if (part.startsWith('#')) return this.id === part.slice(1);
        if (part.startsWith('.')) return (this.getAttribute('class') || '').split(/\s+/).includes(part.slice(1));
        const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part);
        if (attribute) return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
        return this.tagName.toLowerCase() === part.toLowerCase();
      });
    }
    closest(selector) { for (let next = this; next; next = next.parentNode) if (next.matches?.(selector)) return next; return null; }
    querySelectorAll(selector) {
      const result = [];
      function visit(node) { for (const child of node.children || []) { if (child.matches(selector)) result.push(child); visit(child); } }
      visit(this); return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() { document.activeElement = this; }
    setSelectionRange(start, end, direction = 'none') { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }
  }
  function fromParsed(parsed) {
    if (parsed.nodeName === '#text') return { textContent: parsed.value, parentNode: null };
    const element = new Element(parsed.tagName || 'div');
    for (const { name, value } of parsed.attrs || []) element.setAttribute(name, value);
    for (const child of parsed.childNodes || []) element.appendChild(fromParsed(child));
    if (element.tagName === 'TEXTAREA') { element.value = element.textContent; element.scrollHeight = 44; }
    return element;
  }
  const root = new Element('body');
  document = {
    body: root, activeElement: null,
    getElementById: id => root.querySelector('#' + id),
    createElement: tag => new Element(tag),
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
  };
  root.innerHTML = '<section id="scr-lime"><header><span id="lime-title"></span><span id="lime-sub"></span>' +
    '<button id="lime-profile-toggle" type="button">资料</button></header><div id="lime-body"></div></section>';
  const ui = vm.createContext({ document, createLimeChatProtocol, console, setTimeout, clearTimeout });
  ui.window = ui;
  vm.runInContext(appPrelude, ui, { filename: 'terminal-app.js (shared state and text helpers)' });
  ui.renderCompanionAvatar = () => '<span aria-hidden="true">盾</span>';
  ui.goBack = () => { ui.backCalls = (ui.backCalls || 0) + 1; };
  vm.runInContext(source, ui, { filename: 'terminal-lime.js' });
  const contacts = options.contacts || [contactA, contactB];
  ui.stat = { 玩家: { 姓名: '测试玩家' }, 系统: { 主角模式: '自定义角色' },
    人际: Object.fromEntries(contacts.map(name => [name, { 已加联系方式: true, 关系: '同伴' }])) };
  ui.dataStatus = 'ready'; ui.currentStack = ['scr-lime'];
  ui.stateSource = { characterId: 1, groupId: null, chatId: 'chat-a', messageId: 0, swipeId: 0 };
  let result = { source: { ...ui.stateSource }, messages: [], playerName: '测试玩家', generating: false };
  const sent = [];
  ui.bridge = { lime: {
    read: () => options.reader ? options.reader(result) : Promise.resolve(result),
    send: async payload => { sent.push(payload); return options.send ? options.send(payload) : { sent: true }; },
  } };
  const element = id => document.getElementById(id);
  const dispatch = (type, target, fields = {}) => {
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (const listener of listeners.get(type) || []) listener(event);
    return event;
  };
  const click = item => {
    assert.ok(item, 'the rendered control should exist');
    if (!item.disabled) return dispatch('click', item);
    return { defaultPrevented: false };
  };
  const type = value => {
    const input = element('lime-compose'); assert.ok(input); assert.equal(input.disabled, false, 'typing requires an enabled textarea');
    input.value = value; dispatch('input', input); return input;
  };
  const contactButton = name => element('lime-body').querySelectorAll('[data-lime-contact]').find(item => item.dataset.limeContact === name);
  return { ui, document, element, dispatch, click, type, contactButton, sent,
    setResult(value) { result = value; }, get result() { return result; },
    html: () => element('lime-body').innerHTML,
    async ready(name = contactA) { await ui.refreshLimeRecords(); ui.renderLime(); if (name) click(contactButton(name)); },
  };
}

test('contact rows handle apostrophes and HTML as text through delegated clicks', async () => {
  const name = 'O\'Connor <img src=x onerror="attack()">';
  const f = fixture({ contacts: [name] }); await f.ready(null);
  const button = f.contactButton(name);
  assert.ok(button); assert.equal(button.getAttribute('data-lime-contact'), name);
  assert.equal(button.querySelector('.rk-lime-contact-name').textContent, name);
  for (const item of [button, ...button.querySelectorAll('*')]) {
    for (const attribute of item.attrs.keys()) assert.equal(/^on/i.test(attribute), false, attribute);
  }
  assert.equal(f.element('lime-body').querySelectorAll('img').length, 0);
  f.click(button.querySelector('.rk-lime-contact-name'));
  assert.equal(f.ui.activeChat, name); assert.equal(f.element('lime-title').textContent, name);
});

test('normal native floor refresh retains the open room, draft, selection and scroll', async () => {
  const f = fixture(); await f.ready();
  const old = f.type('尚未发出的长草稿'); old.focus(); old.setSelectionRange(2, 6, 'backward');
  f.element('lime-timeline').scrollTop = 120;
  f.ui.stateSource = { ...f.ui.stateSource, messageId: 1 };
  f.setResult({ ...f.result, source: { ...f.ui.stateSource }, messages: [floor(1, contactA, '新楼层的实际来信')] });
  f.ui.prepareLimeRefresh({ type: 'MESSAGE_RECEIVED' }); await f.ui.refreshLimeRecords();
  const next = f.element('lime-compose');
  assert.notEqual(next, old, 'new mail should cause a real DOM replacement');
  assert.equal(f.ui.activeChat, contactA); assert.equal(next.value, '尚未发出的长草稿');
  assert.equal(f.document.activeElement, next); assert.equal(next.selectionStart, 2); assert.equal(next.selectionEnd, 6);
  assert.equal(next.selectionDirection, 'backward'); assert.equal(f.element('lime-timeline').scrollTop, 120);
  assert.match(f.element('lime-timeline').textContent, /新楼层的实际来信/);
});

test('an unchanged read does not replace the active textarea', async () => {
  const f = fixture(); await f.ready(); const input = f.type('继续输入'); input.focus();
  await f.ui.refreshLimeRecords();
  assert.equal(f.element('lime-compose'), input); assert.equal(f.document.activeElement, input); assert.equal(input.value, '继续输入');
});

test('history groups by owning-floor time and never borrows the current shared MVU time', async () => {
  const f = fixture(); await f.ready();
  f.ui.stat.场景 = { 时间: '最新剧情 · 晚上 23:59' };
  const time = '开学日 · 上午 09:10';
  f.ui.limeUI.records = [
    { contact: contactA, sender: 'player', text: '上午发信', time, messageId: 3, swipeId: 0, turn: 1 },
    { contact: contactA, sender: 'contact', text: '上午回复', time, messageId: 3, swipeId: 0, turn: 2 },
    { contact: contactA, sender: 'contact', text: '没有时间快照的旧记录', time: '', messageId: 5, swipeId: 0, turn: 3 },
  ];
  f.ui.renderLime();
  const log = f.element('lime-timeline');
  assert.deepEqual(log.querySelectorAll('.rk-lime-turn-separator').map(item => item.textContent), [time, '时间未记录']);
  assert.deepEqual(log.querySelectorAll('.rk-lime-message-meta').map(item => item.textContent), [time, time, '时间未记录']);
  assert.doesNotMatch(f.element('lime-body').textContent, /酒馆第|回合|最新剧情|23:59/);
  assert.equal(f.element('lime-send').getAttribute('aria-label'), '发送消息');
  assert.equal(f.element('lime-body').querySelector('.rk-lime-send-note').textContent, '通讯附于当前剧情 · Ctrl / ⌘ + Enter 发送');
  f.ui.closeLimeChat();
  assert.equal(f.contactButton(contactA).querySelector('.rk-lime-contact-time').textContent, '时间未记录');
  f.ui.limeUI.records.pop(); f.ui.renderLime();
  assert.equal(f.contactButton(contactA).querySelector('.rk-lime-contact-time').textContent, time);
});

test('message timestamps remain plain text in separators, metadata and contact rows', async () => {
  const f = fixture(); await f.ready();
  const time = '<img src=x onerror="attack()"> · 下午';
  f.ui.limeUI.records = [{ contact: contactA, sender: 'contact', text: '来信', time, messageId: 1, swipeId: 0, turn: 1 }];
  f.ui.renderLime();
  assert.equal(f.element('lime-timeline').querySelector('.rk-lime-turn-separator').textContent, time);
  assert.equal(f.element('lime-timeline').querySelector('.rk-lime-message-meta').textContent, time);
  assert.equal(f.element('lime-timeline').querySelectorAll('img').length, 0);
  f.ui.closeLimeChat();
  assert.equal(f.contactButton(contactA).querySelector('.rk-lime-contact-time').textContent, time);
  assert.equal(f.contactButton(contactA).querySelectorAll('img').length, 0);
});

test('drafts are separate per contact and survive returning to the list', async () => {
  const f = fixture(); await f.ready(); f.type('凛奈的草稿');
  f.ui.closeLimeChat(); assert.equal(f.ui.activeChat, null);
  f.click(f.contactButton(contactB)); assert.equal(f.element('lime-compose').value, ''); f.type('夏洛特的草稿');
  f.ui.closeLimeChat(); f.click(f.contactButton(contactA)); assert.equal(f.element('lime-compose').value, '凛奈的草稿');
  f.ui.openLimeChat(contactB); assert.equal(f.element('lime-compose').value, '夏洛特的草稿');
});

for (const type of ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'CHARACTER_FIRST_MESSAGE_SELECTED']) {
  test(type + ' clears transient room state before reading the new branch', async () => {
    const f = fixture(); await f.ready(); f.type('旧分支草稿'); f.ui.limeUI.profileOpen = true;
    f.ui.limeUI.records = [{ contact: contactA, text: '旧分支消息' }]; f.ui.limeUI.scroll.set(contactA, { top: 120, bottom: false });
    f.ui.prepareLimeRefresh({ type });
    assert.equal(f.ui.activeChat, null); assert.equal(f.ui.limeUI.drafts.size, 0); assert.equal(f.ui.limeUI.scroll.size, 0);
    assert.equal(f.ui.limeUI.records.length, 0); assert.equal(f.ui.limeUI.profileOpen, false);
    await f.ui.refreshLimeRecords(); f.ui.renderLime(); f.click(f.contactButton(contactA));
    assert.equal(f.element('lime-compose').value, ''); assert.doesNotMatch(f.element('lime-timeline').textContent, /旧分支消息/);
  });
}

test('a changed native chat identity resets drafts even without a change event', async () => {
  const f = fixture(); await f.ready(); f.type('本局 A 草稿');
  f.setResult({ ...f.result, source: { ...f.result.source, chatId: 'chat-b' }, messages: [floor(0, contactB, '本局 B 来信')] });
  await f.ui.refreshLimeRecords();
  assert.equal(f.ui.activeChat, null); assert.equal(f.ui.limeUI.drafts.size, 0);
  f.click(f.contactButton(contactA)); assert.equal(f.element('lime-compose').value, '');
});

test('a stale textarea belonging to another contact cannot update, replace or send that contact draft', async () => {
  const f = fixture(); await f.ready(); const input = f.type('只给凛奈');
  f.ui.activeChat = contactB; f.ui.limeUI.drafts.set(contactB, '夏洛特独立草稿');
  f.ui.rememberLimeView(); f.ui.updateLimeComposer(); f.ui.sendQuickAction('greeting'); await f.ui.sendChatMsg();
  assert.equal(input.value, '只给凛奈'); assert.equal(f.ui.limeUI.drafts.get(contactB), '夏洛特独立草稿'); assert.equal(f.sent.length, 0);
});

test('draft clears only after sent:true, with one submission while acknowledgement is pending', async () => {
  const pending = deferred(), f = fixture({ send: () => pending.promise }); await f.ready(); f.type('  发出内容  ');
  const first = f.ui.sendChatMsg();
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].name, contactA); assert.equal(f.sent[0].text, '发出内容');
  assert.equal(f.element('lime-compose').value, '  发出内容  '); assert.equal(f.element('lime-send').disabled, true);
  await f.ui.sendChatMsg(); assert.equal(f.sent.length, 1);
  pending.resolve({ sent: true }); await first;
  assert.equal(f.element('lime-compose').value, ''); assert.equal(f.ui.limeUI.drafts.get(contactA) || '', '');
  const notice = f.element('lime-body').querySelector('[role="status"]');
  assert.ok(notice, 'successful acknowledgement should produce an accessible status');
  assert.equal(notice.textContent, '已保存到当前剧情的通讯记录。');
});

test('an explicit offline result notice remains visible instead of the default live acknowledgement', async () => {
  const offlineNotice = '离线演示：<b>未发送到酒馆</b>。';
  const f = fixture({ send: async () => ({ sent: true, notice: offlineNotice }) }); await f.ready(); f.type('预览消息');
  await f.ui.sendChatMsg();
  const notice = f.element('lime-body').querySelector('[role="status"]');
  assert.ok(notice); assert.equal(notice.textContent, offlineNotice);
  assert.equal(notice.querySelector('b'), null, 'provided notices are rendered as plain text');
  assert.doesNotMatch(notice.textContent, /已保存到当前剧情的通讯记录/);
});

for (const [label, send] of [['sent:false', async () => ({ sent: false })], ['missing confirmation', async () => ({})],
  ['transport failure', async () => { throw new Error('发送连接中断'); }]]) {
  test(label + ' preserves the exact draft and exposes a retryable error', async () => {
    const f = fixture({ send }); await f.ready(); f.type('  保留空白\n与原文  '); await f.ui.sendChatMsg();
    assert.equal(f.element('lime-compose').value, '  保留空白\n与原文  ');
    assert.equal(f.ui.limeUI.drafts.get(contactA), '  保留空白\n与原文  ');
    assert.ok(f.ui.limeUI.error); assert.equal(f.element('lime-send').disabled, false);
  });
}

test('late confirmation for another contact cannot clear the currently displayed draft', async () => {
  const pending = deferred(), f = fixture({ send: () => pending.promise }); await f.ready(contactB); f.type('夏洛特独立草稿');
  f.ui.openLimeChat(contactA); f.type('寄给凛奈的消息'); const previous = f.ui.sendChatMsg(); f.ui.openLimeChat(contactB);
  assert.equal(f.element('lime-compose').value, '夏洛特独立草稿');
  pending.resolve({ sent: true }); await previous;
  assert.equal(f.ui.activeChat, contactB); assert.equal(f.element('lime-compose').value, '夏洛特独立草稿');
  assert.equal(f.ui.limeUI.drafts.get(contactA) || '', '');
});

test('Enter and composing Ctrl+Enter never send a communication', async () => {
  const f = fixture(); await f.ready(); const input = f.type('尚在编辑');
  for (const fields of [{ key: 'Enter' }, { key: 'Enter', ctrlKey: true, isComposing: true }, { key: 'Enter', metaKey: true, isComposing: true }]) {
    const event = f.dispatch('keydown', input, fields); assert.equal(event.defaultPrevented, false);
  }
  await settle(); assert.equal(f.sent.length, 0); assert.equal(f.element('lime-compose').value, '尚在编辑');
});

for (const modifier of ['ctrlKey', 'metaKey']) {
  test(modifier + '+Enter sends exactly one explicit communication', async () => {
    const f = fixture(); await f.ready(); const input = f.type('准备出发');
    const event = f.dispatch('keydown', input, { key: 'Enter', [modifier]: true, isComposing: false });
    assert.equal(event.defaultPrevented, true); await settle();
    assert.equal(f.sent.length, 1); assert.equal(f.sent[0].text, '准备出发'); assert.equal(f.element('lime-compose').value, '');
  });
}

test('quick actions prepare a draft and never implicitly send', async () => {
  const f = fixture(); await f.ready(); const button = f.element('lime-body').querySelector('[data-lime-quick="greeting"]');
  f.click(button); assert.equal(f.sent.length, 0); assert.equal(f.element('lime-compose').value, '今天过得怎么样？');
  assert.equal(f.document.activeElement, f.element('lime-compose')); assert.equal(f.element('lime-send').disabled, false);
});

test('unconnected contacts have a visible room and disabled sending controls', async () => {
  const f = fixture(); f.ui.stat.人际[contactA].已加联系方式 = false; await f.ready(null);
  f.click(f.element('lime-body').querySelector('[data-lime-tab="contacts"]')); f.click(f.contactButton(contactA));
  assert.equal(f.ui.activeChat, contactA); assert.equal(f.element('lime-compose').disabled, true);
  assert.equal(f.element('lime-send').disabled, true); f.click(f.element('lime-send')); assert.equal(f.sent.length, 0);
  assert.match(f.element('lime-timeline').textContent, /还没有建立专线/);
});
