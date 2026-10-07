import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { buildRules, applyRules } from '../正文气泡/build.mjs';

const source = fs.readFileSync(new URL('player-portrait.js', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('player-display-store.js', import.meta.url), 'utf8');
// Purpose-built DOM double: no browser parsing, rendering, or host integration claims.
class Node {
  constructor(tag) { this.tagName = tag; this.attrs = new Map(); this.children = []; this.parentNode = null; this.events = new Map(); this._text = ''; this.hidden = false; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  set src(value) { this.attrs.set('src', String(value)); }
  get src() { return this.attrs.get('src') || ''; }
  getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null; }
  removeAttribute(key) { this.attrs.delete(key); }
  set textContent(value) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this._text = String(value); }
  get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
  append(...nodes) { nodes.forEach(node => { node.remove(); node.parentNode = this; this.children.push(node); }); }
  prepend(node) { node.remove(); node.parentNode = this; this.children.unshift(node); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (!this.parentNode) return; const list = this.parentNode.children; const index = list.indexOf(this); if (index >= 0) list.splice(index, 1); this.parentNode = null; }
  matches(selector) { return selector.split(',').some(part => { const match = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part.trim()); return match && this.attrs.has(match[1]) && (match[2] === undefined || this.attrs.get(match[1]) === match[2]); }); }
  closest(selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentNode; } return null; }
  querySelectorAll(selector) { const nodes = []; const visit = node => node.children.forEach(child => { if (child.matches(selector)) nodes.push(child); visit(child); }); visit(this); return nodes; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, listener) { const list = this.events.get(type) || []; list.push(listener); this.events.set(type, list); }
  dispatch(type) { for (const listener of this.events.get(type) || []) listener({ target: this }); }
}
function fixture({ name = '黎恩', text = '黎恩：我来试试。', kind = 'candidate', runtimeAttribute = null } = {}) {
  const head = new Node('head'), body = new Node('body'), chat = new Node('div'); body.append(chat);
  const candidate = new Node('span'); candidate.setAttribute('data-rkd', kind); candidate.setAttribute('data-rkd-name', name);
  if (runtimeAttribute !== null) candidate.setAttribute('data-rkd-runtime-player', runtimeAttribute);
  const original = new Node('span'); original.setAttribute('data-rkd-source', ''); original.textContent = text;
  if (kind === 'candidate') candidate.append(original);
  else { const avatar = new Node('span'); avatar.setAttribute('data-rkd-avatar', ''); candidate.append(avatar); }
  chat.append(candidate);
  let available = true, snapshot = { scope: 'chat-a', revision: '1', primaryName: '黎恩·舒华泽', personaName: '玩家人物', avatarUrl: 'https://example.test/player.png', aliases: ['黎恩'] };
  const service = { get() { if (!available) throw new Error('disabled'); return snapshot; },
    resolve(name, value) { return ['player', '玩家', 'OC', value.primaryName, value.personaName, ...value.aliases].includes(name)
      ? { src: value.avatarUrl, player: true } : null; } };
  const doc = { head, body, createElement: tag => new Node(tag), querySelectorAll: selector => {
    assert.equal(selector, '#chat .mes[is_user="false"] .mes_text [data-rkd]'); return chat.querySelectorAll('[data-rkd]'); } };
  const observers = [];
  const host = { MutationObserver: class { constructor(listener) { this.listener = listener; this.disconnected = false; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; } disconnect() { this.disconnected = true; } } };
  const realm = vm.createContext({ URL, console }); vm.runInContext(storeSource, realm); vm.runInContext(source, realm);
  const binder = realm.createPlayerBubbleBinder({ host, document: doc, service, css: '.test{}' });
  return { binder, service, doc, candidate, original, chat, head, observers,
    set available(value) { available = value; }, get snapshot() { return snapshot; }, set snapshot(value) { snapshot = value; } };
}

for (const name of ['黎恩', '黎恩·舒华泽', '玩家人物', 'player', '玩家', 'OC']) test(`候选 ${name} 提升为玩家气泡并使用共享头像`, () => {
  const f = fixture({ name, text: name + '：我来试试。' });
  assert.equal(f.candidate.getAttribute('data-rkd'), 'bubble');
  assert.equal(f.candidate.getAttribute('data-rkd-player'), 'true');
  assert.equal(f.candidate.querySelector('[data-rkd-oc-image]').src, f.snapshot.avatarUrl);
  assert.equal(f.candidate.querySelector('[data-rkd-speaker]').textContent, name);
  assert.equal(f.candidate.querySelector('[data-rkd-line]').textContent, '我来试试。');
  f.binder.refresh(); assert.equal(f.candidate.querySelectorAll('[data-rkd-oc-image]').length, 1);
});

test('未识别人物及未登记简称保留候选原文', () => {
  for (const name of ['史黛菈', '舒华', '旁白', '我']) {
    const f = fixture({ name }); assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate');
    assert.equal(f.candidate.querySelector('[data-rkd-source]'), f.original); assert.equal(f.candidate.textContent, '黎恩：我来试试。');
  }
});

test('服务关闭和聊天身份变化均降级并逐字恢复原 source 节点', () => {
  const text = '  黎恩：  <img src=x onerror=alert(1)> & 引号 "保留"  ';
  const f = fixture({ text });
  assert.equal(f.candidate.querySelector('[data-rkd-line]').textContent, '<img src=x onerror=alert(1)> & 引号 "保留"');
  f.available = false; f.binder.refresh();
  assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate'); assert.equal(f.candidate.textContent, text);
  assert.equal(f.candidate.querySelector('[data-rkd-source]'), f.original);
  assert.equal(f.candidate.getAttribute('data-rkd-runtime-player'), null);
  f.available = true; f.binder.refresh();
  f.snapshot = { ...f.snapshot, scope: 'chat-b', primaryName: '另一人物', aliases: [], revision: '2' };
  f.binder.refresh(); assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate'); assert.equal(f.candidate.textContent, text);
});

test('缺 source 或原文无说话人分隔符时不制造气泡', () => {
  const f = fixture({ text: '没有分隔符' }); assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate');
  f.candidate.replaceChildren(); f.binder.refresh(); assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate');
});

test('已有静态气泡只增减头像装饰，正文与既有标记不丢失', () => {
  const f = fixture({ name: 'player', kind: 'bubble', runtimeAttribute: 'prior' });
  const avatar = f.candidate.querySelector('[data-rkd-avatar]');
  f.available = false; f.binder.refresh();
  assert.equal(f.candidate.getAttribute('data-rkd'), 'bubble'); assert.equal(f.candidate.querySelector('[data-rkd-avatar]'), avatar);
  assert.equal(avatar.querySelectorAll('[data-rkd-oc-image]').length, 0);
  assert.equal(f.candidate.getAttribute('data-rkd-runtime-player'), 'prior');
});

test('加载成功才隐藏首字；图片错误回退首字且不保留损坏图', () => {
  const f = fixture(), avatar = f.candidate.querySelector('[data-rkd-avatar]'), image = avatar.querySelector('[data-rkd-oc-image]'), initial = avatar.querySelector('[data-rkd-oc-initial]');
  assert.equal(initial.hidden, false); image.dispatch('error'); assert.equal(image.parentNode, null); assert.equal(initial.hidden, false);
  f.snapshot = { ...f.snapshot, revision: '2' }; f.binder.refresh();
  const loaded = avatar.querySelector('[data-rkd-oc-image]'); loaded.dispatch('load'); assert.equal(avatar.querySelector('[data-rkd-oc-initial]').hidden, true);
  loaded.dispatch('error'); assert.equal(avatar.querySelector('[data-rkd-oc-initial]').hidden, false);
});

test('空头像仍显示首字，不创建空 src 图片', () => {
  const f = fixture(); f.snapshot = { ...f.snapshot, avatarUrl: '', revision: '2' }; f.binder.refresh();
  assert.equal(f.candidate.querySelector('[data-rkd-oc-image]'), null);
  assert.equal(f.candidate.querySelector('[data-rkd-oc-initial]').textContent, '黎');
});

test('销毁断开观察器、恢复原文、移除 style，重复销毁无副作用', async () => {
  const f = fixture(), observer = f.observers[0];
  assert.equal(f.head.children.length, 1); observer.listener([{ target: f.chat }]);
  f.binder.destroy(); f.binder.destroy(); await Promise.resolve();
  assert.equal(observer.disconnected, true); assert.equal(f.head.children.length, 0);
  assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate'); assert.equal(f.candidate.querySelector('[data-rkd-source]'), f.original);
  f.binder.refresh(); assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate');
});

test('观察器合并外部 DOM 更新，内部头像更新不会重复刷新', async () => {
  const f = fixture(), observer = f.observers[0]; let reads = 0; const get = f.service.get;
  f.service.get = () => { reads++; return get(); };
  observer.listener([{ target: f.chat }]); observer.listener([{ target: f.chat }]); await Promise.resolve(); assert.equal(reads, 1);
  observer.listener([{ target: f.candidate.querySelector('[data-rkd-avatar]') }]); await Promise.resolve(); assert.equal(reads, 1);
});

test('暂时移出聊天再插入，关闭服务仍能恢复候选原文', () => {
  const f = fixture(); f.candidate.remove(); f.binder.refresh(true);
  f.chat.append(f.candidate); f.available = false; f.binder.refresh();
  assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate'); assert.equal(f.candidate.querySelector('[data-rkd-source]'), f.original);
});

test('初始玩家名为空时，Persona 变化也更新 fallback 首字', () => {
  const f = fixture({ name: 'player' });
  f.snapshot = { ...f.snapshot, primaryName: '', personaName: '阿同', revision: '2' }; f.binder.refresh();
  assert.equal(f.candidate.querySelector('[data-rkd-oc-initial]').textContent, '阿');
  f.snapshot = { ...f.snapshot, personaName: '雪莉' }; f.binder.refresh();
  assert.equal(f.candidate.querySelector('[data-rkd-oc-initial]').textContent, '雪');
});

test('同一身份轮询跳过全树遍历，外部 DOM 观察强制绑定新候选', async () => {
  const f = fixture(), originalQuery = f.doc.querySelectorAll; let scans = 0;
  f.doc.querySelectorAll = selector => { scans++; return originalQuery(selector); };
  f.binder.refresh(); f.binder.refresh(); assert.equal(scans, 0);
  const added = new Node('span'); added.setAttribute('data-rkd', 'candidate'); added.setAttribute('data-rkd-name', 'player');
  const source = new Node('span'); source.setAttribute('data-rkd-source', ''); source.textContent = 'player：新楼层。'; added.append(source); f.chat.append(added);
  f.observers[0].listener([{ target: f.chat }]); await Promise.resolve();
  assert.equal(scans, 1); assert.equal(added.getAttribute('data-rkd'), 'bubble');
  assert.equal(added.querySelector('[data-rkd-oc-image]').src, f.snapshot.avatarUrl);
});

test('流式保留气泡外壳而替换 avatar，强制刷新重新附图且多次刷新幂等', () => {
  const f = fixture(), oldAvatar = f.candidate.querySelector('[data-rkd-avatar]');
  const replacement = new Node('span'); replacement.setAttribute('data-rkd-avatar', '');
  oldAvatar.remove(); f.candidate.prepend(replacement); f.binder.refresh(true);
  const image = replacement.querySelector('[data-rkd-oc-image]');
  assert.ok(image); assert.equal(image.src, f.snapshot.avatarUrl);
  assert.equal(oldAvatar.querySelector('[data-rkd-oc-image]'), null);
  for (let i = 0; i < 5; i++) f.binder.refresh(true);
  assert.equal(replacement.querySelector('[data-rkd-oc-image]'), image);
  assert.equal(replacement.querySelectorAll('[data-rkd-oc-image]').length, 1);
  assert.equal(replacement.querySelectorAll('[data-rkd-oc-initial]').length, 1);
});

test('流式清空已有 avatar 内容，观察器独立识别外部删除并补回头像', async () => {
  const f = fixture(), avatar = f.candidate.querySelector('[data-rkd-avatar]');
  avatar.replaceChildren(); f.observers[0].listener([{ target: avatar, type: 'childList' }]); await Promise.resolve();
  assert.equal(avatar.querySelector('[data-rkd-oc-image]').src, f.snapshot.avatarUrl);
  assert.equal(avatar.querySelectorAll('[data-rkd-oc-initial]').length, 1);
});

test('头像节点完全移除时重建槽位，保留已有正文和台词', async () => {
  const f = fixture(), line = f.candidate.querySelector('[data-rkd-line]'), body = f.candidate.querySelector('[data-rkd-body]');
  f.candidate.querySelector('[data-rkd-avatar]').remove();
  f.observers[0].listener([{ target: f.candidate, type: 'childList' }]); await Promise.resolve();
  assert.equal(f.candidate.querySelector('[data-rkd-oc-image]').src, f.snapshot.avatarUrl);
  assert.equal(f.candidate.querySelector('[data-rkd-body]'), body); assert.equal(f.candidate.querySelector('[data-rkd-line]'), line);
  assert.equal(line.textContent, '我来试试。');
});

test('candidate 被 morph 重置属性和整棵内部 source 后重新提升，并在销毁时恢复最终原文', async () => {
  const f = fixture(), finalText = '  黎恩： 最终台词更新。  ', replacement = new Node('span');
  replacement.setAttribute('data-rkd-source', ''); replacement.textContent = finalText;
  f.candidate.setAttribute('data-rkd', 'candidate'); f.candidate.removeAttribute('data-rkd-player');
  f.candidate.removeAttribute('data-rkd-runtime-player'); f.candidate.replaceChildren(replacement);
  f.observers[0].listener([{ target: f.candidate, type: 'attributes' }, { target: f.candidate, type: 'childList' }]); await Promise.resolve();
  assert.equal(f.candidate.getAttribute('data-rkd'), 'bubble');
  assert.equal(f.candidate.querySelector('[data-rkd-line]').textContent, '最终台词更新。');
  assert.equal(f.candidate.querySelector('[data-rkd-oc-image]').src, f.snapshot.avatarUrl);
  f.binder.destroy(); assert.equal(f.candidate.textContent, finalText); assert.equal(f.candidate.querySelector('[data-rkd-source]'), replacement);
});

for (const scenario of ['未命中人物', '服务暂不可用', '切换聊天 scope']) {
  test(`宿主的新 source 在${scenario}时保留，缓存恢复不覆盖新台词`, async () => {
    const f = fixture(), replacement = new Node('span');
    const name = scenario === '未命中人物' ? '史黛菈' : '黎恩';
    const finalText = '  ' + name + '：这是重绘后的最终台词。  ';
    replacement.setAttribute('data-rkd-source', ''); replacement.textContent = finalText;
    f.candidate.setAttribute('data-rkd', 'candidate'); f.candidate.setAttribute('data-rkd-name', name);
    f.candidate.replaceChildren(replacement);
    if (scenario === '服务暂不可用') f.available = false;
    if (scenario === '切换聊天 scope') f.snapshot = { ...f.snapshot, scope: 'chat-b', primaryName: '另一人物', aliases: [], revision: '2' };
    f.observers[0].listener([{ target: f.candidate, type: 'childList' }]); await Promise.resolve();
    assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate');
    assert.equal(f.candidate.querySelector('[data-rkd-source]'), replacement);
    assert.equal(f.candidate.textContent, finalText);
    assert.equal(f.candidate.getAttribute('data-rkd-runtime-player'), null);
    assert.equal(f.candidate.getAttribute('data-rkd-player'), null);
    assert.equal(f.candidate.querySelector('[data-rkd-oc-image]'), null);
    f.binder.refresh(true); f.binder.destroy();
    assert.equal(f.candidate.querySelector('[data-rkd-source]'), replacement);
    assert.equal(f.candidate.textContent, finalText);
  });
}

test('运行时标记或 avatar/图的属性被外部重置时恢复装饰，自身已完整的 mutation 不循环', async () => {
  const f = fixture(), observer = f.observers[0]; let reads = 0; const get = f.service.get;
  f.service.get = () => { reads++; return get(); };
  assert.ok(observer.options.attributes); assert.ok(observer.options.attributeFilter.includes('data-rkd-runtime-player'));
  f.candidate.removeAttribute('data-rkd-runtime-player');
  observer.listener([{ target: f.candidate, type: 'attributes', attributeName: 'data-rkd-runtime-player' }]); await Promise.resolve();
  assert.equal(f.candidate.getAttribute('data-rkd-runtime-player'), 'true'); assert.equal(reads, 1);
  const image = f.candidate.querySelector('[data-rkd-oc-image]'); image.removeAttribute('data-rkd-oc-image');
  observer.listener([{ target: image, type: 'attributes', attributeName: 'data-rkd-oc-image' }]); await Promise.resolve();
  assert.equal(reads, 2); assert.equal(f.candidate.querySelectorAll('[data-rkd-oc-image]').length, 1);
  observer.listener([{ target: f.candidate, type: 'attributes' }, { target: f.candidate.querySelector('[data-rkd-avatar]'), type: 'childList' }]);
  await Promise.resolve(); assert.equal(reads, 2);
});

test('正文姓名变为未登记人物时撤销玩家头像和提升，保守恢复原文', async () => {
  const f = fixture(); f.candidate.setAttribute('data-rkd-name', '史黛菈');
  f.observers[0].listener([{ target: f.candidate, type: 'attributes', attributeName: 'data-rkd-name' }]); await Promise.resolve();
  assert.equal(f.candidate.getAttribute('data-rkd'), 'candidate'); assert.equal(f.candidate.querySelector('[data-rkd-oc-image]'), null);
  assert.equal(f.candidate.querySelector('[data-rkd-source]'), f.original);
});

test('图片失败 fallback 不因自身移图 mutation 或强制重绘反复请求；新 revision 可重试', async () => {
  const f = fixture(), avatar = f.candidate.querySelector('[data-rkd-avatar]'), image = avatar.querySelector('[data-rkd-oc-image]');
  image.dispatch('load'); image.dispatch('error'); const initial = avatar.querySelector('[data-rkd-oc-initial]');
  assert.equal(initial.hidden, false);
  let reads = 0; const get = f.service.get; f.service.get = () => { reads++; return get(); };
  f.observers[0].listener([{ target: avatar, type: 'childList' }]); await Promise.resolve(); assert.equal(reads, 0);
  for (let i = 0; i < 3; i++) f.binder.refresh(true);
  assert.equal(avatar.querySelector('[data-rkd-oc-image]'), null); assert.equal(avatar.querySelector('[data-rkd-oc-initial]'), initial);
  avatar.replaceChildren(); f.observers[0].listener([{ target: avatar, type: 'childList' }]); await Promise.resolve();
  assert.equal(avatar.querySelector('[data-rkd-oc-image]'), null); assert.equal(avatar.querySelector('[data-rkd-oc-initial]').hidden, false);
  f.snapshot = { ...f.snapshot, revision: 'retry' }; f.binder.refresh();
  assert.equal(avatar.querySelector('[data-rkd-oc-image]').src, f.snapshot.avatarUrl);
});

test('宿主 segmenter 拆分首字文本和浏览器 src 规范化不导致误判重建', async () => {
  const f = fixture(); f.snapshot = { ...f.snapshot, avatarUrl: 'https://example.test', revision: 'raw-address' }; f.binder.refresh();
  const avatar = f.candidate.querySelector('[data-rkd-avatar]'), image = avatar.querySelector('[data-rkd-oc-image]'), initial = avatar.querySelector('[data-rkd-oc-initial]');
  const segment = new Node('span'); segment.textContent = '黎'; initial.replaceChildren(segment);
  // Real image.src may normalize a raw HTTPS address; getAttribute retains the supplied value.
  Object.defineProperty(image, 'src', { get: () => 'https://example.test/' });
  f.observers[0].listener([{ target: segment, type: 'characterData' }]); await Promise.resolve(); f.binder.refresh(true);
  assert.equal(avatar.querySelector('[data-rkd-oc-image]'), image); assert.equal(avatar.querySelector('[data-rkd-oc-initial]'), initial);
});

test('重绘带有旧头像副本的 avatar 只保留一组可响应的新装饰，旧图事件不干扰新图', () => {
  const f = fixture(), oldAvatar = f.candidate.querySelector('[data-rkd-avatar]'), oldImage = oldAvatar.querySelector('[data-rkd-oc-image]');
  const replacement = new Node('span'); replacement.setAttribute('data-rkd-avatar', '');
  const copiedInitial = new Node('span'); copiedInitial.setAttribute('data-rkd-oc-initial', ''); copiedInitial.textContent = '黎';
  const copiedImage = new Node('img'); copiedImage.setAttribute('data-rkd-oc-image', ''); copiedImage.src = f.snapshot.avatarUrl;
  replacement.append(copiedInitial, copiedImage); oldAvatar.remove(); f.candidate.prepend(replacement); f.binder.refresh(true);
  assert.equal(replacement.querySelectorAll('[data-rkd-oc-image]').length, 1); assert.equal(replacement.querySelectorAll('[data-rkd-oc-initial]').length, 1);
  const newImage = replacement.querySelector('[data-rkd-oc-image]'), initial = replacement.querySelector('[data-rkd-oc-initial]');
  assert.notEqual(newImage, copiedImage); newImage.dispatch('load'); oldImage.dispatch('error');
  assert.equal(initial.hidden, true); assert.equal(newImage.parentNode, replacement);
});

test('实际气泡规则→HTML解析→实际头像服务→绑定器：稳定标记、MVU全名和别名共用头像', () => {
  const fullLine = '  清泉朝阳 ： 我自己来。  ', aliasLine = ' 朝阳:\t我来帮忙。 \t', timeLine = '时间:上午';
  const protection = '<acg_think>\n清泉朝阳:保护思考。\n朝阳:保护别名。\n</acg_think>\n' +
    '<UpdateVariable>\n朝阳:变量保护。\n</UpdateVariable>';
  const input = ['玩家：准备好了。', fullLine, aliasLine, '史黛菈：跟上。', timeLine, protection].join('\n');
  const html = applyRules(input, buildRules(), { user: '不同Persona' });
  assert.ok(html.includes(protection));
  const fragment = parseFragment(html);
  function convert(parsed) {
    const node = new Node(parsed.tagName || parsed.nodeName);
    for (const attribute of parsed.attrs || []) node.setAttribute(attribute.name, attribute.value);
    if (parsed.nodeName === '#text') node.textContent = parsed.value;
    for (const child of parsed.childNodes || []) node.append(convert(child));
    return node;
  }
  const head = new Node('head'), body = new Node('body'), chat = convert(fragment); body.append(chat);
  const displayNodes = () => chat.querySelectorAll('[data-rkd]');
  const candidates = new Map(displayNodes().filter(node => node.getAttribute('data-rkd') === 'candidate')
    .map(node => [node.getAttribute('data-rkd-name'), node]));
  assert.deepEqual([...candidates.keys()], ['清泉朝阳', '朝阳', '时间']);
  assert.equal(candidates.get('清泉朝阳').textContent, fullLine);
  assert.equal(candidates.get('朝阳').textContent, aliasLine);
  assert.equal(candidates.get('时间').textContent, timeLine);
  const originalFullSource = candidates.get('清泉朝阳').querySelector('[data-rkd-source]');
  const originalAliasSource = candidates.get('朝阳').querySelector('[data-rkd-source]');
  const records = new Map(), context = { characterId: 1, groupId: null, chatId: 'oc-chat', name1: '不同Persona' };
  const state = { 玩家: { 姓名: '清泉朝阳' }, 人际: { 史黛菈: {} } };
  const before = JSON.parse(JSON.stringify(state)), realm = vm.createContext({ URL, console }); vm.runInContext(storeSource, realm); vm.runInContext(source, realm);
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, raw) => records.set(key, raw), removeItem: key => records.delete(key) };
  const service = realm.createPlayerPortraitService({
    storage,
    getContext: () => context, getSnapshot: () => ({ state, source: { characterId: 1, groupId: null, chatId: 'oc-chat' } }),
    reservedNames: ['史黛菈'],
  });
  const imageUrl = 'https://images.example.test/oc.png';
  const displayStore = realm.createPlayerDisplayStore({ storage, getContext: () => context });
  displayStore.save(displayStore.get(), { avatarUrl: imageUrl, profileName: '清泉朝阳', source: 'opening' });
  service.saveAliases(service.get(), { aliases: ['朝阳'] });
  const doc = { head, body, createElement: tag => new Node(tag), querySelectorAll: selector => {
    assert.equal(selector, '#chat .mes[is_user="false"] .mes_text [data-rkd]'); return displayNodes();
  } };
  const binder = realm.createPlayerBubbleBinder({ host: {}, document: doc, service });
  const players = displayNodes().filter(node => node.getAttribute('data-rkd-runtime-player') === 'true');
  assert.deepEqual(players.map(node => node.getAttribute('data-rkd-name')), ['玩家', '清泉朝阳', '朝阳']);
  assert.deepEqual(players.map(node => node.querySelector('[data-rkd-oc-image]').src), [imageUrl, imageUrl, imageUrl]);
  const npc = displayNodes().find(node => node.getAttribute('data-rkd-name') === '史黛菈');
  assert.equal(npc.getAttribute('data-rkd'), 'bubble'); assert.equal(npc.getAttribute('data-rkd-runtime-player'), null);
  assert.equal(npc.querySelector('[data-rkd-oc-image]'), null); assert.equal(service.resolve('史黛菈'), null);
  assert.equal(candidates.get('时间').getAttribute('data-rkd'), 'candidate');
  assert.equal(candidates.get('时间').textContent, timeLine);
  assert.deepEqual(state, before);
  binder.destroy();
  for (const [name, line, original] of [['清泉朝阳', fullLine, originalFullSource], ['朝阳', aliasLine, originalAliasSource]]) {
    assert.equal(candidates.get(name).getAttribute('data-rkd'), 'candidate');
    assert.equal(candidates.get(name).textContent, line); assert.equal(candidates.get(name).querySelector('[data-rkd-source]'), original);
  }
  assert.equal(head.children.length, 0);
  assert.equal(displayNodes().filter(node => node.getAttribute('data-rkd-runtime-player') === 'true').length, 0);
});
