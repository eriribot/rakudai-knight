import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { buildTerminal, extractScripts } from './bundle.mjs';
import { RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../世界书规则/MVU/schema.mjs';
import { parseFragment } from 'parse5';
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const built = buildTerminal();
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
function readerFixture() {
  const ctx = { chat: [{ role: 'assistant', swipe: 0, pages: [{ stat_data: { 人际: {} } }] }] };
  const realm = vm.createContext({ structuredClone });
  vm.runInContext(read('state-reader.js'), realm);
  const get = realm.createTerminalStateReader((id, options) => {
    assert.equal(options.include_swipes, true);
    assert.equal(options.role, 'assistant');
    const msg = ctx.chat[id];
    return msg.role === 'assistant' ? [{ message_id: id, role: msg.role, swipe_id: msg.swipe, swipes: msg.pages.map((_, index) => '回复 ' + index), swipes_data: structuredClone(msg.pages) }] : [];
  }, () => ctx);
  return { ctx, get: () => get().state, getSnapshot: get };
}
function uiFixture() {
  const elements = new Map(), listeners = new Map(), documentListeners = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', title: '', style: {}, writes: 0, _html: '',
      set innerHTML(value) { this._html = value; this.writes++; }, get innerHTML() { return this._html; },
      contains(child) { return child.container === this; },
      classList: { add() {}, remove() {}, toggle() {} },
    });
    return elements.get(id);
  }
  const realm = vm.createContext({
    structuredClone, console, setTimeout, clearTimeout,
    document: { getElementById: element, querySelectorAll: () => [], querySelector: () => null,
      addEventListener: (type, fn) => documentListeners.set(type, fn) },
    addEventListener: (type, fn) => listeners.set(type, fn),
  });
  realm.window = realm;
  for (const script of extractScripts(built.html)) vm.runInContext(script.content, realm);
  realm.currentStack = ['scr-home', 'scr-blazer'];
  realm.blazerSubTab = 'roster';
  return { ui: realm, element, listeners, documentListeners, html: () => element('blazer-body').innerHTML };
}
const relation = (name, extra = {}) => ({ 关系: name, 态度印象: '', 好感: null, 羁绊阶段: '未建立', 变化依据: '', ...extra });
const state = (people = {}) => ({ 系统: { 主角模式: '自定义角色' }, 玩家: { 姓名: '测试玩家', 所属: '破军学园 / 教官', 登记等级: null }, 人际: people });
const settle = () => new Promise(resolve => setImmediate(resolve));
const bridgeRules = { relationshipRules: RELATIONSHIP_SCORING, supportStage, romanceStage };
async function show(f, value) { f.ui.bridge = { ...bridgeRules, getStat: () => structuredClone(value) }; await f.ui.refreshTerminalState(); }
const slot = (messageId = 0, swipeId = 0, chatId = 'test-chat') => ({ messageId, swipeId, swipeCount: 2, chatId });
async function showSnapshot(f, value, source, event = { type: 'poll' }) {
  f.ui.bridge = { ...bridgeRules, getSnapshot: () => structuredClone({ state: value, source }) };
  await f.ui.refreshTerminalState(event);
}
function nodesIn(html, tagName) {
  const found = [];
  function visit(node) {
    if (node.tagName === tagName) found.push(node);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parseFragment(html)); return found;
}
function visibleText(html) {
  let text = '';
  function visit(node) {
    if (node.nodeName === '#text') text += node.value;
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parseFragment(html)); return text;
}

await check('无需建档写入guard即可读当前楼层；显示不会写入存档', () => {
  const f = readerFixture(), original = structuredClone(f.ctx);
  f.get().人际.临时 = {};
  assert.deepEqual(f.ctx, original);
});
await check('用户消息后的读取仍指向最新助手当前页', () => {
  const f = readerFixture(); f.ctx.chat[0].pages[0].stat_data.玩家 = { 姓名: '本局' };
  f.ctx.chat.push({ role: 'user' });
  assert.equal(f.get().玩家.姓名, '本局');
});
await check('当前页无MVU时不回退到旧页或旧楼层', () => {
  const f = readerFixture(); f.ctx.chat.push({ role: 'assistant', swipe: 1, pages: [{ stat_data: state({ 秘密人物: relation('朋友') }) }, {}] });
  assert.throws(f.get, /尚无 MVU/);
});
await check('swipe、回滚与换聊天读取各自的已存数据', () => {
  const f = readerFixture();
  f.ctx.chat[0].pages = [{ stat_data: state({ 甲: relation('学生') }) }, { stat_data: state({ 乙: relation('同事') }) }];
  assert.deepEqual(Object.keys(f.get().人际), ['甲']);
  f.ctx.chat[0].swipe = 1; assert.deepEqual(Object.keys(f.get().人际), ['乙']);
  f.ctx.chat[0].swipe = 0; assert.deepEqual(Object.keys(f.get().人际), ['甲']);
  f.ctx.chat = [{ role: 'assistant', swipe: 0, pages: [{ stat_data: state() }] }];
  assert.deepEqual(Object.keys(f.get().人际), []);
});
await check('空名册不预填四人或世界书人物', async () => {
  const f = uiFixture(); await show(f, state());
  assert.match(f.html(), /尚无/); assert.doesNotMatch(f.html(), /史黛|一辉|珠雫|有栖|黑乃|宁音/);
});
await check('教官测试特例：仅已确认学生显示学生，黑乃和宁音各按实际关系', async () => {
  const f = uiFixture(), value = state({
    史黛菈: relation('受我指导的学生'), 新宫寺黑乃: relation('聘任我的理事长'), 西京宁音: relation('刚结识的同行'),
    任意新人物: relation('救助过我的旅人'),
  });
  value.玩家.姓名 = '黎恩·舒华泽';
  const original = structuredClone(value); await show(f, value);
  for (const text of ['受我指导的学生', '聘任我的理事长', '刚结识的同行', '任意新人物', '救助过我的旅人']) assert.ok(f.html().includes(text));
  assert.doesNotMatch(f.html(), /室友|剑术同道|珠雫|法米利昂皇女/);
  assert.match(f.element('blazer-head-rank').textContent, /教官/);
  f.ui.blazerSubTab = 'overview'; f.ui.renderBlazer(); assert.doesNotMatch(f.html(), /注册学员/);
  assert.deepEqual(value, original);
});
await check('任意OC不根据所属自动赋予师生关系', async () => {
  const f = uiFixture(), value = state({ 临时人物: relation('委托人') });
  value.玩家 = { 姓名: '普通旅人', 所属: '无所属' }; await show(f, value);
  assert.match(f.html(), /委托人/); assert.doesNotMatch(f.html(), /学生|教官|室友/);
});
await check('已知资料逐项补充，遗漏项不从原作补齐', async () => {
  const f = uiFixture(); await show(f, state({ 史黛菈: relation('新认识的人', { 已知资料: { 身份: '同班同学' } }) }));
  assert.match(f.html(), /身份：同班同学/); assert.doesNotMatch(f.html(), /妃龙|皇女|火焰|A级|card-rank-badge|灵装：/);
  await show(f, state({ 史黛菈: relation('同学', { 已知资料: { 登记等级: 'A级', 灵装: '对方告知的灵装名', 已知能力: '亲眼见到的一招' } }) }));
  for (const text of ['A级', '对方告知的灵装名', '亲眼见到的一招']) assert.ok(f.html().includes(text));
  assert.doesNotMatch(f.html(), /身份：|皇女/);
});
await check('旧记录无已知资料依旧显示；null好感不当作0或自动晋级', async () => {
  const f = uiFixture(), value = state({ 旧友: relation('旧友') }); await show(f, value);
  assert.match(f.html(), /旧友/); assert.doesNotMatch(f.html(), /null|0分|S级/);
  assert.equal(value.人际.旧友.羁绊阶段, '未建立');
});
await check('一辉模式中不显示另一个一辉，自定义模式可以显示', async () => {
  const f = uiFixture(), value = state({ 黑铁一辉: relation('同学') });
  await show(f, value); assert.match(f.html(), /黑铁一辉/);
  value.系统.主角模式 = '黑铁一辉'; await show(f, value); assert.doesNotMatch(f.html(), /黑铁一辉/);
});
await check('人物名、资料长文本和HTML符号作为文字保留', async () => {
  const f = uiFixture(); await show(f, state({ '<人物>': relation('同行', { 已知资料: { 已知能力: '<img src=x onerror=alert(1)>' + '长招式'.repeat(300) } }) }));
  assert.match(f.html(), /&lt;人物&gt;/); assert.doesNotMatch(f.html(), /<img/); assert.ok(f.html().includes('长招式'.repeat(300)));
});
await check('六维 B+ 与 B 有不同数值，未知等级不会落成零分', () => {
  const f = uiFixture();
  assert.equal(f.ui.rankToValue('A'), 6);
  assert.equal(f.ui.rankToValue('B+'), 5.5);
  assert.equal(f.ui.rankToValue('B'), 5);
  assert.equal(f.ui.rankToValue('F'), 1);
  for (const value of [null, undefined, '', '未定', 'Z']) assert.equal(f.ui.rankToValue(value), null);
});
await check('雷达缺失一维时只画五个已知点，不伪造闭合完整六维', async () => {
  const f = uiFixture(), value = state();
  value.玩家.六维 = { 攻击力: 'A', 防御力: 'B+', 魔力量: 'B', 魔力控制: 'A', 体能: 'A', 运气: 'E' };
  await show(f, value); f.ui.blazerSubTab = 'radar'; f.ui.renderBlazer();
  assert.equal((f.html().match(/class="radar-point"/g) || []).length, 6);
  assert.match(f.html(), /class="radar-polygon"/);
  value.玩家.六维.防御力 = null;
  await show(f, value);
  assert.equal((f.html().match(/class="radar-point"/g) || []).length, 5);
  assert.doesNotMatch(f.html(), /class="radar-polygon"/);
});
await check('资料未变而来源换楼、换回复或换聊天时，来源和展开状态仍刷新', async () => {
  const f = uiFixture(), value = state({ 熟人: relation('同行') });
  const sources = [slot(2), slot(4), slot(4, 1), slot(4, 1, 'other-chat')];
  for (const source of sources) {
    f.ui.expandedPeople.add('熟人');
    await showSnapshot(f, value, source);
    assert.equal(f.ui.expandedPeople.size, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(f.ui.stateSource)), source);
  }
  f.ui.expandedPeople.add('熟人');
  await showSnapshot(f, value, sources.at(-1));
  assert.equal(f.ui.expandedPeople.has('熟人'), true);
});
await check('同一次快照优先于旧桥接读法，UI 不向玩家显示聊天内部标识', async () => {
  const f = uiFixture(), source = slot(6, 1, 'internal-private-chat-id');
  f.ui.bridge = { ...bridgeRules,
    getSnapshot: () => ({ state: state({ 当前槽人物: relation('同行') }), source }),
    getStat: () => { throw new Error('不应另读无来源状态'); },
  };
  await f.ui.refreshTerminalState();
  assert.match(f.html(), /当前槽人物/);
  assert.doesNotMatch(visibleText(f.html()), /internal-private-chat-id/);
  assert.doesNotMatch(f.element('mono-source').textContent + f.element('mono-source').title, /internal-private-chat-id/);
  assert.equal(f.element('blazer-head-source').textContent, '第 6 楼 · 回复 2/2 · 已保存 MVU');
});
await check('空 MVU 槽错误仍保留来源，并清除上一个槽的人物', async () => {
  const f = uiFixture(); await showSnapshot(f, state({ 过去人物: relation('同伴') }), slot(6));
  const source = slot(6, 1), error = new Error('当前助手回复尚无 MVU 数据'); error.source = source;
  f.ui.bridge = { ...bridgeRules, getSnapshot: () => { throw error; } };
  await f.ui.refreshTerminalState({ reset: true });
  assert.doesNotMatch(f.html(), /过去人物/);
  assert.deepEqual(JSON.parse(JSON.stringify(f.ui.stateSource)), source);
  assert.equal(f.ui.dataStatus, 'error');
  assert.equal(f.element('blazer-head-source').textContent, '第 6 楼 · 回复 2/2 · 等待本回复的 MVU');
});
await check('人物用原生详情展开，当前槽内记住展开，旧卡迟到 toggle 不污染新槽', async () => {
  const f = uiFixture(), value = state({ 熟人: relation('同行') }), firstSource = slot(8);
  await showSnapshot(f, value, firstSource);
  const details = nodesIn(f.html(), 'details');
  assert.equal(details.length, 1);
  assert.equal(nodesIn(f.html(), 'summary').length, 1);
  assert.equal(details[0].attrs.some(attr => attr.name === 'open'), false);
  const card = { container: f.element('blazer-body'), open: true,
    getAttribute: name => name === 'data-person' ? '熟人' : name === 'data-source' ? f.ui.sourceKey(firstSource) : null };
  f.ui.rememberPersonExpansion(card); f.ui.renderBlazer();
  assert.equal(nodesIn(f.html(), 'details')[0].attrs.some(attr => attr.name === 'open'), true);
  card.open = false; f.ui.rememberPersonExpansion(card);
  assert.equal(f.ui.expandedPeople.has('熟人'), false);
  card.open = true; f.ui.rememberPersonExpansion(card);
  await showSnapshot(f, value, slot(8, 1));
  f.ui.rememberPersonExpansion(card);
  assert.equal(f.ui.expandedPeople.size, 0);
  card.container = null; f.ui.rememberPersonExpansion(card);
  assert.equal(f.ui.expandedPeople.size, 0);
});
await check('好感未计分与真实零分分开呈现，不替旧阶段倒填支援值', () => {
  const f = uiFixture(); f.ui.bridge = bridgeRules;
  const legacy = relation('旧友', { 羁绊阶段: 'S' }), original = structuredClone(legacy);
  const unknown = f.ui.renderRelationshipMetrics(legacy);
  assert.match(visibleText(unknown), /未计分/);
  assert.match(visibleText(unknown), /待核定（原记录：S）/);
  assert.equal(nodesIn(unknown, 'div').filter(node => node.attrs.some(attr => attr.name === 'role' && attr.value === 'meter')).length, 0);
  assert.deepEqual(legacy, original);
  const zero = f.ui.renderRelationshipMetrics(relation('新友', { 好感: 0, 支援度: 0 }));
  assert.match(zero, /data-kind="affection"[^>]+aria-valuenow="0"/);
  assert.match(zero, /data-kind="support"[^>]+aria-valuenow="0"/);
  assert.match(visibleText(zero), /支援阶段未建立/);
});
await check('支援阶段取共享规则函数，临界值正确且不受旧字母和好感替代', () => {
  const f = uiFixture(); f.ui.bridge = bridgeRules;
  const before = f.ui.renderRelationshipMetrics(relation('同伴', { 好感: 100, 支援度: 159, 羁绊阶段: 'S' }));
  assert.match(visibleText(before), /支援阶段C/);
  assert.match(visibleText(before), /距 B 还需 1 点/);
  const after = f.ui.renderRelationshipMetrics(relation('同伴', { 好感: 1, 支援度: 160, 羁绊阶段: 'C' }));
  assert.match(visibleText(after), /支援阶段B/);
  assert.match(after, /data-kind="support"[^>]+aria-valuenow="160"/);
  assert.match(visibleText(after), /距 A 还需 80 点/);
});
await check('旧好感 100 保持原数值，只占新上限十分之一，不被展示成满级', () => {
  const f = uiFixture(); f.ui.bridge = bridgeRules;
  const record = relation('本局旧识', { 性别: '女性', 好感: 100, 支援度: 80, 恋爱阶段: '生死相随' });
  const original = structuredClone(record), html = f.ui.renderRelationshipMetrics(record);
  assert.match(html, /data-kind="affection"[^>]+aria-valuemax="1000"[^>]+aria-valuenow="100"/);
  assert.match(html, /data-kind="affection"[^>]*><span style="width:10\.00%"/);
  assert.match(html, /<span>恋爱阶段<\/span><strong>路人<\/strong>/);
  assert.match(visibleText(html), /距“在意”还需 100 点好感/);
  assert.doesNotMatch(visibleText(html), /已达到最高恋爱阶段/);
  assert.deepEqual(record, original);
});
await check('女性恋爱阶段逐个阈值按好感派生，旧字段和支援 S 不替代数值', () => {
  const f = uiFixture(); f.ui.bridge = bridgeRules;
  const thresholds = [[0, '路人'], [199, '路人'], [200, '在意'], [499, '在意'], [500, '暧昧'], [799, '暧昧'], [800, '交往'], [999, '交往'], [1000, '生死相随']];
  for (const [score, stage] of thresholds) {
    const record = relation('按本局关系保留', { 性别: '女性', 好感: score, 支援度: 320, 羁绊阶段: 'S', 恋爱阶段: '伪造旧标签' });
    const original = structuredClone(record), html = f.ui.renderRelationshipMetrics(record);
    assert.ok(html.includes('<span>恋爱阶段</span><strong>' + stage + '</strong>'), String(score));
    assert.match(visibleText(html), /支援阶段S/);
    assert.doesNotMatch(visibleText(html), /伪造旧标签/);
    assert.equal(nodesIn(html, 'li').filter(node => node.attrs.some(attr => attr.name === 'data-achieved' && attr.value === 'true')).length,
      4 + RELATIONSHIP_SCORING.romance.stages.filter(item => score >= item.min).length);
    assert.deepEqual(record, original);
  }
});
await check('男性好感满值仍保留支援 S，但不显示恋爱阶段或伪造的恋爱字段', () => {
  const f = uiFixture(); f.ui.bridge = bridgeRules;
  const record = relation('师生', { 性别: '男性', 好感: 1000, 支援度: 320, 羁绊阶段: 'S', 恋爱阶段: '生死相随' });
  const original = structuredClone(record), html = f.ui.renderRelationshipMetrics(record);
  assert.match(visibleText(html), /好感1000 \/ 1000/);
  assert.match(visibleText(html), /支援阶段S/);
  assert.doesNotMatch(html, /gba-romance-panel|gba-romance-track|恋爱阶段|生死相随/);
  assert.deepEqual(record, original);
});
await check('未记录性别不根据姓名或满好感猜测恋爱资格，女性 null 不猜阶段', () => {
  const f = uiFixture(); f.ui.bridge = bridgeRules;
  for (const gender of [undefined, null, '', '未确认']) {
    const record = relation('同伴', { 性别: gender, 好感: 1000, 支援度: 320, 恋爱阶段: '生死相随' });
    const html = f.ui.renderRelationshipMetrics(record);
    assert.match(visibleText(html), /性别尚未记录/);
    assert.match(visibleText(html), /支援阶段S/);
    assert.doesNotMatch(html, /gba-romance-panel|gba-romance-track|生死相随/);
  }
  const female = relation('刚认识的同行', { 性别: '女性', 好感: null, 支援度: 0, 恋爱阶段: '交往' });
  const original = structuredClone(female), html = f.ui.renderRelationshipMetrics(female);
  assert.match(visibleText(html), /恋爱阶段好感未计分/);
  assert.doesNotMatch(html, /gba-romance-track|<strong>交往<\/strong>|data-kind="affection"/);
  assert.deepEqual(female, original);
});
await check('相同人物换回复槽后只显示该槽性别和进度，回退不继承未来阶段', async () => {
  const f = uiFixture();
  const earlier = state({ 本局熟人: relation('同行', { 性别: '女性', 好感: 199, 支援度: 79 }) });
  const later = state({ 本局熟人: relation('协作伙伴', { 性别: '女性', 好感: 800, 支援度: 320 }) });
  const alternative = state({ 本局熟人: relation('同事', { 性别: '男性', 好感: 1000, 支援度: 320, 恋爱阶段: '生死相随' }) });
  const originals = structuredClone([earlier, later, alternative]);
  await showSnapshot(f, earlier, slot(6));
  assert.match(f.html(), /<span>恋爱阶段<\/span><strong>路人<\/strong>/);
  await showSnapshot(f, later, slot(8));
  assert.match(f.html(), /<span>恋爱阶段<\/span><strong>交往<\/strong>/);
  await showSnapshot(f, alternative, slot(8, 1));
  assert.doesNotMatch(f.html(), /gba-romance-panel|生死相随/);
  assert.match(visibleText(f.html()), /支援阶段S/);
  await showSnapshot(f, earlier, slot(6));
  assert.match(f.html(), /<span>恋爱阶段<\/span><strong>路人<\/strong>/);
  assert.match(visibleText(f.html()), /支援阶段未建立/);
  assert.deepEqual([earlier, later, alternative], originals);
});
await check('数据不变的轮询不重绘，数据保存后更新当前名册', async () => {
  const f = uiFixture(); let value = state(); f.ui.bridge = { getStat: () => value };
  await f.ui.refreshTerminalState(); const count = f.element('blazer-body').writes;
  await f.ui.refreshTerminalState({ type: 'poll' }); assert.equal(f.element('blazer-body').writes, count);
  value = state({ 新友: relation('同行') }); await f.ui.refreshTerminalState({ type: 'poll' }); assert.match(f.html(), /新友/);
});
await check('分支切换先清空；旧异步读取不能覆盖新分支', async () => {
  const f = uiFixture(); let finishOld;
  f.ui.bridge = { getStat: () => new Promise(resolve => { finishOld = resolve; }) };
  const old = f.ui.refreshTerminalState(); await settle();
  await show(f, state({ 新分支人物: relation('同事') }));
  finishOld(state({ 旧分支秘密: relation('旧友') })); await old;
  assert.match(f.html(), /新分支人物/); assert.doesNotMatch(f.html(), /旧分支秘密/);
  f.ui.bridge = { getStat: () => { throw new Error('当前页无数据'); } };
  const next = f.ui.refreshTerminalState({ reset: true }); assert.doesNotMatch(f.html(), /新分支人物/);
  await next; assert.match(f.html(), /当前页无数据/); assert.equal(f.element('mono-source').textContent, '读取未就绪');
});
await check('重复启动及销毁均移除旧订阅', async () => {
  const f = uiFixture(); let listeners = 0;
  const bridge = { version: built.version, getStat: () => state(), onUpdate: () => { listeners++; return () => listeners--; } };
  f.ui.RKBoot(bridge); f.ui.RKBoot(bridge); await settle(); assert.equal(listeners, 1);
  assert.ok(f.element('mono-source').title.includes(built.version));
  f.ui.renderSettings(); assert.ok(f.element('settings-body').innerHTML.includes('版本：v' + built.version));
  f.listeners.get('pagehide')(); assert.equal(listeners, 0);
});
await check('剧情页显示全部合法卷数，未知卷号不伪装成卷一', async () => {
  const f = uiFixture();
  for (const volume of Array.from({ length: 19 }, (_, index) => index + 1)) {
    await show(f, { ...state(), 场景: { 当前卷: volume, 当前章: '本卷已确认章节', 阶段: '进行中' } });
    assert.equal(f.ui.resolveScene().volume, '第' + volume + '卷');
  }
  for (const volume of [0, 20, '2', null]) {
    await show(f, { ...state(), 场景: { 当前卷: volume } }); assert.equal(f.ui.resolveScene().volume, '卷数未确认');
  }
});
await check('事件历史逐条显示所属卷，旧缺卷事件提示迁移且文本仍转义', async () => {
  const f = uiFixture();
  await show(f, { ...state(), 场景: { 当前卷: 16, 当前章: '序章', 阶段: '进行中', 已发生事件: {
    旧卷记录: { 卷号: 1, 章段: '终章', 结果: '保留的本局事件' },
    本卷记录: { 卷号: 16, 章段: '终章Ⅱ', 结果: '<img src=x>' },
    待升级事件: { 章段: '第一章', 结果: '旧数据' },
  } } });
  f.ui.renderSchedule(); const html = f.element('schedule-body').innerHTML;
  assert.match(html, /第1卷 · 终章/); assert.match(html, /第16卷 · 终章Ⅱ/); assert.match(html, /卷号待迁移 · 第一章/);
  assert.match(html, /&lt;img src=x&gt;/); assert.equal(nodesIn(html, 'img').length, 0);
});
await check('实际导出脚本与所有维护源码逐字一致', () => {
  const version = JSON.parse(read('package.json')).version;
  const artifact = JSON.parse(read('../酒馆助手脚本-小手机-黑白ADV轮盘版-v' + version + '.json'));
  assert.equal(artifact.content, built.artifact.content);
  assert.equal(artifact.name.endsWith(version), true);
});
console.log(JSON.stringify({ evidence: '离线 Node VM 执行真实读取和界面函数；未进行酒馆实机或浏览器布局验收', passed: results.filter(x => x.passed).length, total: results.length, results }, null, 2));
if (results.some(x => !x.passed)) process.exitCode = 1;
