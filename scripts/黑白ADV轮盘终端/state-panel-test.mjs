import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseFragment } from 'parse5';
import { INITIAL_STATE, createSchema, prepareStateMigration } from '../../世界书规则/MVU/schema.mjs';
import { createStateController } from '../rakudai-state-core.mjs';
const require = createRequire(import.meta.url), { z } = require('../../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), clone = structuredClone;
const source = fs.readFileSync(new URL('state-panel.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const results = [];
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }

// 用 parse5 解析真实面板 HTML，只替代所需 DOM 行为；动作走真实事件回调与状态控制器。
function documentFixture(downloads) {
  const document = { activeElement: null };
  function element(tag, attributes = {}) {
    const attrs = { ...attributes }, listeners = new Map();
    const node = { tagName: tag, children: [], parent: null, _value: undefined, hidden: Object.hasOwn(attrs, 'hidden'), disabled: Object.hasOwn(attrs, 'disabled'), open: false,
      dataset: new Proxy({}, { get: (_, key) => attrs['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())], set: (_, key, value) => { attrs['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())] = value; return true; } }),
      getAttribute: key => attrs[key] ?? null, setAttribute: (key, value) => { attrs[key] = String(value); },
      get value() { if (tag === 'select') return this._value !== undefined && this.children.some(child => child.value === this._value) ? this._value : this._value === undefined ? this.children[0]?.value || '' : ''; return this._value ?? attrs.value ?? ''; },
      set value(value) { this._value = String(value); },
      get textContent() { return this._text ?? this.children.map(child => child.textContent).join(''); },
      set textContent(value) { this._text = String(value); this.children = []; },
      get elements() { return Object.fromEntries(this.querySelectorAll('input,textarea,select').filter(child => child.getAttribute('name')).map(child => [child.getAttribute('name'), child])); },
      set innerHTML(html) { this._text = undefined; this.replaceChildren(...parseFragment(html).childNodes.map(convert)); },
      appendChild(child) { child.parent = this; this.children.push(child); return child; },
      replaceChildren(...children) { this.children = []; this._value = undefined; for (const child of children) this.appendChild(child); },
      remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
      after(child) { child.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, child); },
      contains(child) { return child === this || this.children.some(item => item.contains(child)); },
      matches(selector) {
        if (selector.startsWith('.')) return (attrs.class || '').split(' ').includes(selector.slice(1));
        const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        return match ? Object.hasOwn(attrs, match[1]) && (match[2] === undefined || attrs[match[1]] === match[2]) : tag === selector;
      },
      querySelectorAll(selector) { const choices = selector.split(','); return this.children.flatMap(child => [...(choices.some(choice => child.matches(choice)) ? [child] : []), ...child.querySelectorAll(selector)]); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; },
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
      dispatch(type, target = this) { const event = { type, target, currentTarget: null, preventDefault() { this.defaultPrevented = true; } }; for (let current = this; current; current = current.parent) { event.currentTarget = current; for (const callback of current._listeners.get(type) || []) callback(event); } },
      click() { if (this.disabled) return; if (tag === 'a') downloads.push({ href: this.href, filename: this.download }); this.dispatch('click'); },
      reset() { for (const control of this.querySelectorAll('input,textarea,select')) control._value = undefined; },
      reportValidity() { return this.querySelectorAll('input,textarea,select').every(control => control.disabled || control.getAttribute('required') === null || !!control.value); },
      focus() { document.activeElement = this; }, _listeners: listeners,
    };
    return node;
  }
  function convert(parsed) {
    const node = element(parsed.tagName || '#text', Object.fromEntries((parsed.attrs || []).map(attribute => [attribute.name, attribute.value])));
    if (parsed.nodeName === '#text') node.textContent = parsed.value;
    else for (const child of parsed.childNodes || []) node.appendChild(convert(child));
    return node;
  }
  document.createElement = element; return document;
}
function saved(volume = 1, chapter = '终章', phase = '已结束') {
  const state = clone(INITIAL_STATE);
  state.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' }; state.玩家.姓名 = '本局玩家';
  state.场景 = { ...state.场景, 当前卷: volume, 当前章: chapter, 阶段: phase, 时间: '当前已确认时间', 地点: '当前已确认地点' };
  return state;
}
function fixture(initial = saved()) {
  let data = { stat_data: clone(initial), extra: { retained: true } }, scope = 0, writes = 0;
  const adapter = {
    capture: () => ({ data: clone(data), scope }), current: snapshot => { if (snapshot.scope !== scope) throw new Error('当前分支已变化'); return { data: clone(data) }; },
    validate: value => { createSchema(z, { normalizeRelationships: false }).parse(value); return clone(value); }, migrate: value => prepareStateMigration(value, z),
    write: (snapshot, expected, state) => { assert.equal(scope, snapshot.scope); assert.deepEqual(data, expected); data = { ...clone(data), stat_data: clone(state) }; writes++; },
  };
  const api = createStateController(adapter), service = { ...api, catalogue: api.catalogue };
  const downloads = [], blobs = new Map(), revoked = [], HD = documentFixture(downloads), host = HD.createElement('section'); host.appendChild(HD.createElement('div', { class: 'bar' }));
  const HW = { Blob, URL: { createObjectURL(blob) { const key = 'blob:backup-' + blobs.size; blobs.set(key, blob); return key; }, revokeObjectURL: value => revoked.push(value) } };
  const SS = { host, visible: true, destroyed: false }, updates = [];
  const emit = event => [...updates].forEach(callback => callback(event));
  const realm = vm.createContext({ window: { RakudaiStateController: service }, HD, HW, SS, updateCbs: updates, emit, structuredClone, Blob, console });
  vm.runInContext(source + '\nglobalThis.panel = { buildStatePanel, refreshStatePanel, disposeStatePanel };', realm); realm.panel.buildStatePanel();
  return { realm, api, service, HW, SS, HD, updates, downloads, blobs, revoked, emit,
    node: selector => host.querySelector(selector), get writes() { return writes; }, get state() { return data.stat_data; },
    mutate: fn => fn(data), switch: state => { data = { stat_data: clone(state) }; scope++; },
    openJump() { const details = host.querySelector('[data-story-jump]'); details.open = true; details.dispatch('toggle'); },
  };
}
function fill(form) { form.elements.time.value = '目标时间'; form.elements.location.value = '目标地点'; form.elements.entryNote.value = '从本局已确认情境继续'; }

await check('目录公开副本不能改写控制器的真实目录', () => {
  const f = fixture(), first = f.api.catalogue; first[0].chapters[0].key = '伪造章节'; assert.equal(f.api.catalogue[0].chapters[0].key, '序章'); f.realm.panel.disposeStatePanel();
});
await check('第六卷显示实际目录；阶段按钮按结束、下一章、开始依次写入', async () => {
  const f = fixture(saved(6, '间章1', '进行中')); await settle();
  assert.match(f.node('[data-story-summary]').textContent, /第6卷.*间章1/);
  assert.equal(f.node('[data-story-action="nextVolume"]').hidden, true); assert.equal(f.node('[data-story-action="next"]').hidden, false);
  assert.equal(f.node('[data-story-action="next"]').disabled, true);
  f.node('[data-story-action="end"]').click(); await settle(); f.node('[data-story-action="next"]').click(); await settle();
  assert.equal(f.state.场景.当前章, '第五章'); assert.equal(f.state.场景.阶段, '未开始');
  f.node('[data-story-action="start"]').click(); await settle(); assert.equal(f.state.场景.阶段, '进行中'); assert.equal(f.writes, 3);
});
await check('卷末进入下一卷先打开确认表单，未填场景不写入，确认后采用真实首节点', async () => {
  const f = fixture(saved(5)); await settle();
  assert.equal(f.node('[data-story-action="next"]').disabled, true); assert.equal(f.node('[data-story-action="nextVolume"]').disabled, false);
  assert.equal(f.node('[data-story-action="next"]').hidden, true); assert.equal(f.node('[data-story-action="nextVolume"]').hidden, false);
  f.node('[data-story-action="nextVolume"]').click();
  const form = f.node('[data-story-form="nextVolume"]'); assert.equal(f.node('[data-story-next-volume]').hidden, false); assert.equal(f.writes, 0);
  form.dispatch('submit'); await settle(); assert.equal(f.writes, 0);
  fill(form); form.dispatch('submit'); await settle();
  assert.equal(f.writes, 1); assert.equal(f.state.场景.当前卷, 6); assert.equal(f.state.场景.当前章, '间章1'); assert.equal(f.state.场景.阶段, '未开始');
});
await check('手动切入默认折叠；选项只含当前节点之后的卷章', async () => {
  const f = fixture(saved(16, '序章', '进行中')); await settle();
  assert.equal(f.node('[data-story-jump]').open, false); f.openJump();
  const form = f.node('[data-story-form="jump"]');
  assert.deepEqual(form.elements.volume.children.map(option => option.value), ['16', '17', '18', '19']);
  assert.deepEqual(form.elements.chapter.children.map(option => option.value), ['第一章', '第二章', '第三章']);
  form.elements.volume.value = '19'; form.elements.volume.dispatch('change'); form.elements.chapter.value = '终章'; fill(form);
  assert.equal(f.writes, 0); form.dispatch('submit'); await settle(); assert.equal(f.state.场景.当前卷, 19); assert.equal(f.state.场景.当前章, '终章');
  assert.deepEqual(f.state.场景.已发生事件, {});
});
await check('轮询不抹掉输入；并发状态变化后旧表单凭据拒绝写入并保留草稿', async () => {
  const f = fixture(); await settle(); f.node('[data-story-action="nextVolume"]').click();
  const form = f.node('[data-story-form="nextVolume"]'); fill(form); f.emit({ type: 'poll' }); await settle(); assert.equal(form.elements.entryNote.value, '从本局已确认情境继续');
  f.mutate(data => { data.extra.retained = '发生了另一次更新'; }); form.dispatch('submit'); await settle();
  assert.equal(f.writes, 0); assert.equal(form.elements.time.value, '目标时间'); assert.match(f.node('[data-story-status]').textContent, /草稿保留/);
  f.node('[data-story-action="nextVolume"]').click(); assert.equal(form.elements.time.value, '目标时间'); form.dispatch('submit'); await settle(); assert.equal(f.writes, 1);
});
await check('迁移显示具体差异与下载入口，只有确认升级才写当前活动槽', async () => {
  const before = saved(); before.系统.结构版本 = 3; before.场景.已发生事件.本局事件 = { 章段: '第一章', 结果: '已发生', 参与者: [], 知情者: [] };
  const f = fixture(before); await settle();
  assert.equal(f.writes, 0); assert.equal(f.node('[data-story-migration]').hidden, false); assert.match(f.node('[data-story-migration-diff]').textContent, /系统\/结构版本/);
  assert.match(f.node('[data-story-migration-diff]').textContent, /本局事件\/卷号/);
  assert.equal(f.node('[data-story-action="nextVolume"]').disabled, true);
  f.node('[data-story-action="backup"]').click(); assert.equal(f.downloads.length, 1); assert.equal(f.writes, 0);
  assert.deepEqual(JSON.parse(await f.blobs.get(f.downloads[0].href).text()), before);
  f.node('[data-story-action="migrate"]').click(); await settle(); assert.equal(f.writes, 1); assert.equal(f.state.系统.结构版本, 4); assert.equal(f.state.场景.已发生事件.本局事件.卷号, 1);
  f.realm.panel.disposeStatePanel(); assert.deepEqual(f.revoked, [f.downloads[0].href]);
});
await check('错误 v3 存档不能给出伪迁移候选，也不开放剧情按钮', async () => {
  const before = saved(2); before.系统.结构版本 = 3;
  const f = fixture(before); await settle(); assert.equal(f.writes, 0); assert.equal(f.node('[data-story-migration]').hidden, true); assert.equal(f.node('[data-story-action="start"]').disabled, true);
});
await check('注入预览只读，正文作为纯文本显示；开关只调用注入器设置', async () => {
  const f = fixture(); let enabled = true, previews = 0, toggles = 0;
  const previewText = '<img src=x onerror=alert(1)>仅预览剧情';
  f.HW.__RK_PLOT_V3__ = { version: '3.0.0', getStatus: () => ({ enabled, reason: '', lastInjection: { volume: 2, chapter: '序章', phase: '进行中', source: { messageId: 8, swipeId: 1 } } }),
    preview: () => { previews++; return { text: previewText, source: { messageId: 8, swipeId: 1 } }; }, setEnabled: value => { enabled = value; toggles++; } };
  await settle(); assert.equal(f.node('[data-story-injection-preview]').textContent, previewText); assert.equal(f.node('[data-story-injection-preview]').querySelector('img'), null);
  assert.match(f.node('[data-story-last-injection]').textContent, /第2卷.*第 8 楼.*回复 2/);
  f.node('[data-story-action="preview"]').click(); assert.ok(previews >= 2); assert.equal(f.writes, 0);
  const toggle = f.node('[data-story-injection-enabled]'); toggle.checked = false; toggle.dispatch('change'); assert.equal(enabled, false); assert.equal(toggles, 1); assert.equal(f.writes, 0);
});
await check('注入器缺失明确提示，旧预览不会冒充当前结果', async () => {
  const f = fixture(); await settle(); assert.equal(f.node('[data-story-injection-enabled]').disabled, true); assert.match(f.node('[data-story-injection-status]').textContent, /导入.*3\.0\.0/);
});
await check('切聊天会清理旧表单与凭据；晚到读取不能覆盖新聊天', async () => {
  const f = fixture(); await settle(); f.openJump(); fill(f.node('[data-story-form="jump"]'));
  const capture = f.service.capture, old = await capture(); let resolve;
  f.service.capture = () => new Promise(done => { resolve = done; }); f.realm.panel.refreshStatePanel();
  f.switch(saved(16, '终章Ⅱ', '进行中')); f.service.capture = capture; f.emit({ reset: true }); await settle(); resolve(old); await settle();
  assert.match(f.node('[data-story-summary]').textContent, /第16卷.*终章Ⅱ/); assert.equal(f.node('[data-story-jump]').open, false); assert.equal(f.node('[data-story-form="jump"]').elements.time.value, ''); assert.equal(f.writes, 0);
});
await check('销毁面板会注销现有刷新回调，收起期间轮询不额外读取', async () => {
  const f = fixture(); await settle(); let captures = 0; const capture = f.service.capture; f.service.capture = () => { captures++; return capture(); };
  f.SS.visible = false; f.emit({ type: 'poll' }); await settle(); assert.equal(captures, 0);
  f.realm.panel.disposeStatePanel(); assert.equal(f.updates.length, 0); f.emit({ type: 'poll' }); assert.equal(captures, 0);
});

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, runtime: '真实 state-panel 事件与控制器，parse5 DOM 替身；没有模型调用', results }, null, 2));
if (failed.length) process.exitCode = 1;
