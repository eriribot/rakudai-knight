import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./chapter-runtime-probe.js', import.meta.url), 'utf8');
const clone = structuredClone, plain = value => JSON.parse(JSON.stringify(value)), results = [];
const block = '【RK剧情注入:BEGIN】\n当前剧情节点：第2卷 · 序章（序章 遥远的记忆）\n仅合成剧情背景。\n【RK剧情注入:END】';
function element(tag) {
  return { tag, children: [], style: {}, events: new Map(), textContent: '', parentNode: null,
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    addEventListener(name, fn) { this.events.set(name, fn); },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this); this.parentNode = null; },
    click() { return this.events.get('click')?.(); } };
}
function fixture() {
  const body = element('body'), D = { body, createElement: element }, events = new Map();
  const ctx = { characterId: 0, characters: [{ name: '落第骑士·独立验收副本' }], chat: [{}, {}, {}, {}] };
  const calls = { fetch: [], headers: 0, mvu: [], wait: 0, messageReads: 0 };
  const state = n => ({ 系统: { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' },
    场景: { 当前卷: n, 当前章: '序章', 阶段: '进行中', 时间: '测试时间', 地点: '测试地点', 切入说明: '合成切入',
      已发生事件: { 私密事件标题不得导出: { 卷号: 1, 结果: '私密事件详情不得导出' } } }, 玩家: { 姓名: '验收员', 角色简介: '私密玩家详情不得导出' } });
  const wrappers = { 0: { stat_data: state(2), external: { secret: '包装秘密不得导出' } }, 2: { stat_data: state(3), delta_data: { private: '变化细节不得导出' } } };
  let resolveMvu, behavior = () => ({ originalReturn: true });
  const originalFetch = function (...args) { calls.fetch.push({ thisValue: this, args }); return behavior(...args); };
  const H = { document: D, fetch: originalFetch, location: { origin: 'http://localhost:8000' }, SillyTavern: { getContext: () => ctx }, URL, Blob };
  const W = { top: H, parent: H, SillyTavern: { getContext: () => { throw new Error('iframe不是宿主'); } },
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name); },
    waitGlobalInitialized(name) {
      assert.equal(name, 'Mvu'); calls.wait++;
      return new Promise(resolve => { resolveMvu = () => { W.Mvu = { getMvuData(options) {
        assert.equal(options.type, 'message'); assert.equal(typeof options.message_id, 'number'); calls.mvu.push(clone(options)); return clone(wrappers[options.message_id]);
      } }; resolve(); }; });
    },
    getChatMessages(range, options) {
      assert.equal(range, '0-3'); assert.equal(options.role, 'assistant'); assert.equal(options.include_swipes, true); calls.messageReads++;
      return [{ message_id: 0, swipe_id: 1, swipes_data: [{ stat_data: state(1) }, clone(wrappers[0])], swipes: ['私密旧回复', '私密活动回复'] },
        { message_id: 2, swipe_id: 0, swipes_data: [clone(wrappers[2])], swipes: ['另一个私密回复'] }];
    } };
  let statusPoll;
  const realm = vm.createContext({ window: W, structuredClone, URL, Blob, TextEncoder,
    setInterval: fn => { statusPoll = fn; return 1; }, clearInterval: () => { statusPoll = null; } });
  vm.runInContext(source, realm);
  return { H, W, ctx, D, calls, wrappers, originalFetch, api: H.__RK_CHAPTER_RUNTIME_PROBE__,
    ready: async () => { resolveMvu(); await Promise.resolve(); },
    behavior: fn => { behavior = fn; }, pagehide: () => events.get('pagehide')?.(), poll: () => statusPoll?.(),
    send: data => H.fetch('/api/backends/chat-completions/generate', { body: JSON.stringify(data) }),
  };
}
const payload = () => ({ type: 'normal', messages: [{ role: 'system', content: '私密完整提示词不得导出 RK_EJS_TRUE RK_EJS_NESTED_OK RK_EJS_CUSTOM' },
  { role: 'user', content: '私密用户正文不得导出\n' + block }], api_key: '秘密密钥不得导出', reverse_proxy: '私密上游地址不得导出' });
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }

await check('fetch 包装保持 this、原参数对象、返回对象且完全不读取 headers', () => {
  const f = fixture(), receiver = {}, returned = {}, body = JSON.stringify(payload()); f.behavior(() => returned);
  const options = { body, get headers() { f.calls.headers++; throw new Error('headers不应被读取'); } }, trailing = {};
  const result = Reflect.apply(f.H.fetch, receiver, ['/api/backends/chat-completions/generate', options, trailing]);
  assert.equal(result, returned); assert.equal(f.calls.fetch[0].thisValue, receiver);
  assert.equal(f.calls.fetch[0].args[1], options); assert.equal(f.calls.fetch[0].args[2], trailing); assert.equal(f.calls.headers, 0);
  const [record] = plain(f.api.getRecords()); assert.equal(record.type, 'normal'); assert.equal(record.messageCount, 2);
  assert.equal(record.plotBlockCount, 1); assert.deepEqual(record.plotBlocks, [{ text: block, volume: 2, chapter: '序章' }]);
  assert.deepEqual(record.ejs, { true: true, false: false, nested: true, nestedBad: false, ikki: false, custom: true });
  assert.equal(record.bodyBytes, new TextEncoder().encode(body).length); assert.equal(record.hasRawEjsTags, false);
  for (const secret of ['私密完整提示词', '私密用户正文', '秘密密钥', '私密上游地址']) assert.ok(!JSON.stringify(record).includes(secret));
  f.pagehide();
});

await check('fetch 同步异常和拒绝 Promise 原样传递，不吞错或替换返回值', async () => {
  const f = fixture(), syncError = new Error('原fetch同步异常'); f.behavior(() => { throw syncError; });
  assert.throws(() => f.send(payload()), error => error === syncError);
  const rejection = new Error('原fetch拒绝'), promise = Promise.reject(rejection); f.behavior(() => promise);
  const actual = f.send(payload()); assert.equal(actual, promise); await assert.rejects(actual, error => error === rejection); f.pagehide();
});

await check('非验收角色、非本地目标、其他路径和非JSON字符串均不记录', async () => {
  const f = fixture(); f.ctx.characters[0].name = '正式角色'; f.send(payload()); await f.api.readSnapshot();
  assert.equal(f.api.getRecords().length, 0); assert.equal(f.calls.messageReads, 0); assert.equal(f.calls.mvu.length, 0);
  f.ctx.characters[0].name = '独立验收副本';
  f.H.fetch('https://example.invalid/api/backends/chat-completions/generate', { body: JSON.stringify(payload()) });
  f.H.fetch('/api/other', { body: JSON.stringify(payload()) });
  f.H.fetch('/api/backends/chat-completions/generate', { body: 'invalid-json' });
  f.H.fetch('/api/backends/chat-completions/generate', { body: payload() });
  assert.equal(f.api.getRecords().length, 0); assert.equal(f.calls.fetch.length, 5); f.pagehide();
});

await check('记录只保留最近十条并识别 EJS 错误分支和原始标签', () => {
  const f = fixture();
  for (let i = 0; i < 12; i++) f.send({ type: i === 11 ? 'quiet' : 'normal', messages: [{ role: 'system', content: 'RK_EJS_FALSE_BAD RK_EJS_NESTED_BAD RK_EJS_IKKI <% raw %>' }] });
  const rows = f.api.getRecords(); assert.equal(rows.length, 10); assert.equal(rows[0].type, 'quiet');
  assert.equal(rows[0].ejs.false, true); assert.equal(rows[0].ejs.nestedBad, true); assert.equal(rows[0].ejs.ikki, true); assert.equal(rows[0].hasRawEjsTags, true);
  rows[0].type = '修改副本'; assert.equal(f.api.getRecords()[0].type, 'quiet'); f.pagehide();
});

await check('快照通过 MVU 等待和数字助手楼层读取，仅展示许可字段', async () => {
  const f = fixture(), before = clone(f.wrappers); assert.equal(f.calls.wait, 1);
  await f.ready(); await f.api.readSnapshot(); const snapshot = plain(f.api.getSnapshot());
  assert.equal(snapshot.assistantCount, 2); assert.deepEqual(snapshot.floors.map(row => [row.messageId, row.swipeId]), [[0, 1], [2, 0]]);
  assert.deepEqual(snapshot.floors.map(row => row.scene.当前卷), [2, 3]);
  assert.ok(snapshot.floors.every(row => row.activeSlotMatchesMvu)); assert.deepEqual(snapshot.floors[0].eventVolumes, [1]);
  assert.equal(snapshot.floors[0].playerName, '验收员'); assert.deepEqual(snapshot.floors[0].wrapperFields, ['external', 'stat_data']);
  for (const secret of ['私密事件标题', '私密事件详情', '私密玩家详情', '包装秘密', '变化细节', '私密活动回复']) assert.ok(!JSON.stringify(snapshot).includes(secret));
  assert.deepEqual(f.wrappers, before); assert.deepEqual(f.calls.mvu.map(call => call.message_id), [0, 2]); f.pagehide();
});

await check('卸载恢复原 fetch 并移除 DOM，重复卸载安全且不会覆盖后装包装器', () => {
  const f = fixture(); assert.equal(f.D.body.children.length, 1); f.api.dispose();
  assert.equal(f.H.fetch, f.originalFetch); assert.equal(f.D.body.children.length, 0); assert.equal(f.H.__RK_CHAPTER_RUNTIME_PROBE__, undefined);
  assert.doesNotThrow(() => f.api.dispose());
  const g = fixture(), otherWrapper = () => {}; g.H.fetch = otherWrapper; g.pagehide();
  assert.equal(g.H.fetch, otherWrapper); assert.equal(g.D.body.children.length, 0);
});

await check('只读状态发现 fetch 已被替换，不自动夺回；显式重装才恢复观察', () => {
  const f = fixture(), originalProbe = f.H.fetch, replacement = function (...args) { return f.originalFetch.apply(this, args); };
  f.H.fetch = replacement; f.poll(); assert.equal(f.H.fetch, replacement); assert.equal(f.api.getStatus().fetchStillInstalled, false);
  f.send(payload()); assert.equal(f.api.getRecords().length, 0);
  assert.equal(f.api.reinstall(), true); assert.equal(f.api.getStatus().fetchStillInstalled, true);
  const reinstalled = f.H.fetch; assert.notEqual(reinstalled, originalProbe); assert.equal(f.api.reinstall(), false); assert.equal(f.H.fetch, reinstalled);
  f.send(payload()); assert.equal(f.api.getRecords().length, 1); assert.equal(f.api.getStatus().installs, 2);
  f.pagehide(); assert.equal(f.H.fetch, replacement);
});

await check('外层扩展保存旧探针后显式重装无循环、无重复记录且原返回值不变', () => {
  const f = fixture(), oldProbe = f.H.fetch, returned = {}, receiver = {}; f.behavior(() => returned);
  const extension = function (...args) { return oldProbe.apply(this, args); }; f.H.fetch = extension;
  f.api.reinstall(); const options = { body: JSON.stringify(payload()) };
  assert.equal(Reflect.apply(f.H.fetch, receiver, ['/api/backends/chat-completions/generate', options]), returned);
  assert.equal(f.calls.fetch.length, 1); assert.equal(f.calls.fetch[0].thisValue, receiver); assert.equal(f.calls.fetch[0].args[1], options);
  assert.equal(f.api.getRecords().length, 1); assert.equal(f.api.getStatus().fetchCalls, 1);
  f.pagehide(); assert.equal(f.H.fetch, extension); f.H.fetch('/api/backends/chat-completions/generate', options);
  assert.equal(f.api.getRecords().length, 1); assert.equal(f.calls.fetch.length, 2);
});

await check('状态仅公开输入种类和门控原因，其他 endpoint 的 body 也不读取', () => {
  const f = fixture(); let bodyReads = 0;
  f.H.fetch('/api/other', { get body() { bodyReads++; throw new Error('其他body不得读取'); } });
  assert.equal(bodyReads, 0); assert.equal(f.api.getStatus().lastSkip, 'other_endpoint');
  f.H.fetch({}, {}); assert.equal(f.api.getStatus().lastInputKind, 'object'); assert.equal(f.api.getStatus().lastSkip, 'unsupported_input');
  f.ctx.characters[0].name = '正式卡'; f.send(payload()); assert.equal(f.api.getStatus().fixtureMatched, false); assert.equal(f.api.getStatus().lastSkip, 'not_fixture');
  assert.equal(f.api.getRecords().length, 0); f.pagehide();
});

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
