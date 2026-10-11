import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('lime-story.js', import.meta.url), 'utf8');
const realm = vm.createContext({ structuredClone, setTimeout, clearTimeout });
vm.runInContext(source, realm);
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value; }); return { promise, resolve }; };
const lore = name => ({ name, worldbook: '当前角色主世界书', entries: [{ uid: 10, name, content: name + '的明确性格原文' }] });
const relation = extra => ({ 已加联系方式: true, 好感: 850, 支援度: 20, 性别: '女性', 关系: '同学', 态度印象: '熟悉但保持分寸', ...extra });
function fixture(records = [{ contact: '风祭凛奈' }], extra = {}) {
  let context = { chat: [{}], chatId: 'chat-a', characterId: 0, groupId: null, characters: [{ avatar: 'a.png' }] };
  let snapshot = { pending: false, source: { chatId: 'chat-a', characterId: 0, groupId: null, messageId: 0, swipeId: 0, swipeCount: 1 },
    state: { 系统: { 主角模式: '自创OC', 已删除人物: [] }, 场景: { 时间: '2013-05-15 16:20', 当前卷: 5 },
      玩家: { 姓名: '测试玩家' }, 人际: { 风祭凛奈: relation(), 夏洛特: relation({ 好感: null, 支援度: 320 }),
        莎拉: relation(), 药师雾子: relation(), 未通联: relation({ 已加联系方式: false }) } } };
  let destroyed = false, reader = async name => lore(name);
  const calls = [], injections = [], timers = new Map(); let timerId = 0;
  const service = realm.createLimeStoryPersonaService({
    getSnapshot: () => snapshot, getRecords: () => records, getContext: () => context,
    getCharacterLore: name => { calls.push(['lore', name]); return reader(name); },
    injectPrompt: (content, id) => {
      calls.push(['inject', id]); const item = { content, id, disposed: 0 }; injections.push(item);
      return { uninject() { item.disposed++; } };
    },
    isDestroyed: () => destroyed,
    setTimeout: (callback, timeout) => { const id = ++timerId; timers.set(id, { callback, timeout }); return id; },
    clearTimeout: id => timers.delete(id), ...extra,
  });
  return { service, calls, injections, timers,
    get context() { return context; }, set context(value) { context = value; },
    get snapshot() { return snapshot; }, set snapshot(value) { snapshot = value; },
    set reader(value) { reader = value; }, set destroyed(value) { destroyed = value; } };
}

test('先读明确人物词条，再注入合并档案、UID、独立关系和主角模式', async () => {
  const f = fixture([{ contact: '风祭凛奈' }, { contact: '夏洛特' }]);
  const result = plain(await f.service.prepare());
  assert.equal(result.applied, true); assert.deepEqual(result.contacts, ['夏洛特', '风祭凛奈']);
  assert.deepEqual(f.calls.map(call => call[0]), ['lore', 'lore', 'inject']);
  const prompt = f.injections[0].content;
  assert.match(prompt, /世界书：当前角色主世界书.*UID：10/);
  assert.match(prompt, /"主角模式":"自创OC"/); assert.match(prompt, /"好感":null/); assert.match(prompt, /"支援度":320/);
  assert.match(prompt, /支援S不等于恋爱/); assert.match(prompt, /不强迫每轮来信/); assert.match(prompt, /不直接改动或计分/);
  assert.match(prompt, /2013-05-15 16:20/); assert.equal(f.snapshot.state.人际.风祭凛奈.好感, 850);
  assert.equal(f.timers.size, 0);
});

test('倒序去重只读最近三个已通联人物，未通联与删除联系人不取词条', async () => {
  const f = fixture([{ contact: '风祭凛奈' }, { contact: '夏洛特' }, { contact: '莎拉' }, { contact: '药师雾子' },
    { contact: '莎拉' }, { contact: '未通联' }, { contact: '已删除' }]);
  f.snapshot.state.人际.已删除 = relation(); f.snapshot.state.系统.已删除人物 = ['已删除'];
  const result = plain(await f.service.prepare());
  assert.deepEqual(result.contacts, ['莎拉', '药师雾子', '夏洛特']);
  assert.deepEqual(f.calls.filter(call => call[0] === 'lore').map(call => call[1]), ['莎拉', '药师雾子', '夏洛特']);
  assert.equal(result.skipped.length, 2);
});

test('缺词条和不完整档案只跳过人物，不阻止其余人物和正常剧情', async () => {
  const f = fixture([{ contact: '夏洛特' }, { contact: '莎拉' }, { contact: '风祭凛奈' }]);
  f.reader = async name => { if (name === '风祭凛奈') throw new Error('明确人物词条缺失'); if (name === '莎拉') return {}; return lore(name); };
  const result = plain(await f.service.prepare());
  assert.equal(result.applied, true); assert.deepEqual(result.contacts, ['夏洛特']); assert.equal(result.skipped.length, 2);
  const allMissing = fixture(); allMissing.reader = async () => { throw new Error('没有人物词条'); };
  assert.equal((await allMissing.service.prepare()).applied, false); assert.equal(allMissing.injections.length, 0);
});

test('完整原文预算 64000，不截断大词条，其他完整人物仍可注入', async () => {
  const f = fixture([{ contact: '夏洛特' }, { contact: '风祭凛奈' }]);
  f.reader = async name => ({ ...lore(name), entries: [{ uid: 1, name, content: '字'.repeat(name === '风祭凛奈' ? 64001 : 64000) }] });
  const result = plain(await f.service.prepare());
  assert.deepEqual(result.contacts, ['夏洛特']); assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /未截断/); assert.ok(f.injections[0].content.includes('字'.repeat(64000)));
});

test('读取期间聊天对象、chat identity、头像、source 或 MVU 关系变化均不注入', async () => {
  const changes = [
    f => { f.context.chat = []; }, f => { f.context.chatId = 'chat-b'; }, f => { f.context.characterId = 1; },
    f => { f.context.groupId = 'new-group'; }, f => { f.context.characters[0].avatar = 'b.png'; },
    f => { f.snapshot.source.swipeId = 1; }, f => { f.snapshot.state.人际.风祭凛奈.好感 = 851; },
  ];
  for (const change of changes) {
    const f = fixture(); f.reader = async name => { change(f); return lore(name); };
    const result = await f.service.prepare(); assert.equal(result.applied, false); assert.equal(f.injections.length, 0);
  }
});

test('cancel 使迟到词条读取无污染，下一次 prepare 仍可正常注入', async () => {
  const f = fixture(), pending = deferred(), reading = deferred();
  f.reader = () => { reading.resolve(); return pending.promise; };
  const first = f.service.prepare(); await reading.promise; f.service.cancel();
  assert.equal((await first).applied, false);
  f.reader = async name => lore(name);
  assert.equal((await f.service.prepare()).applied, true);
  pending.resolve(lore('风祭凛奈')); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.injections.length, 1); assert.equal(f.injections[0].disposed, 0);
});

test('默认最多等 5 秒，超时继续正常剧情并禁止迟到注入', async () => {
  const f = fixture(), pending = deferred(), reading = deferred();
  f.reader = () => { reading.resolve(); return pending.promise; };
  const run = f.service.prepare(); await reading.promise;
  const timer = [...f.timers.values()][0]; assert.equal(timer.timeout, 5000); timer.callback();
  const result = await run; assert.equal(result.applied, false); assert.equal(result.reason, 'timeout'); assert.match(result.skipped[0].reason, /5 秒/);
  pending.resolve(lore('风祭凛奈')); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.injections.length, 0); assert.equal(f.timers.size, 0);
});

test('旧 prepare 的迟到定时器与资料不能取消新提示', async () => {
  const f = fixture(), pending = deferred(), reading = deferred();
  f.reader = () => { reading.resolve(); return pending.promise; };
  const first = f.service.prepare(); await reading.promise; const oldTimer = [...f.timers.values()][0];
  f.reader = async name => lore(name); const second = await f.service.prepare(); assert.equal(second.applied, true);
  oldTimer.callback(); pending.resolve(lore('风祭凛奈')); await first; await Promise.resolve();
  assert.equal(f.injections.length, 1); assert.equal(f.injections[0].disposed, 0);
});

test('prepare 清旧提示，cancel 同步 uninject，重复清理不会重复解除', async () => {
  const f = fixture(); await f.service.prepare(); const old = f.injections[0];
  const next = f.service.prepare(); assert.equal(old.disposed, 1); await next;
  assert.equal(f.injections.length, 2); f.service.cancel(); assert.equal(f.injections[1].disposed, 1);
  f.service.cancel(); assert.equal(f.injections[1].disposed, 1);
});

test('注入后来源核对期间 cancel 只解除旧handle一次，不解除新prepare提示', async () => {
  const pending = deferred(), reading = deferred(); let reads = 0, f;
  f = fixture(undefined, { getSnapshot: () => {
    reads++; if (reads === 5) { reading.resolve(); return pending.promise; } return f.snapshot;
  } });
  const old = f.service.prepare(); await reading.promise;
  assert.equal(f.injections.length, 1); f.service.cancel(); assert.equal(f.injections[0].disposed, 1);
  assert.equal((await old).applied, false);
  assert.equal((await f.service.prepare()).applied, true);
  pending.resolve(f.snapshot); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.injections[0].disposed, 1); assert.equal(f.injections[1].disposed, 0);
});

test('pending MVU、销毁和无通讯记录不注入，native busy 不作为禁止条件', async () => {
  const f = fixture(); f.snapshot.pending = true; assert.equal((await f.service.prepare()).applied, false); assert.equal(f.calls.length, 0);
  f.snapshot.pending = false; f.context.isGenerating = () => true;
  assert.equal((await f.service.prepare()).applied, true);
  f.destroyed = true; assert.equal((await f.service.prepare()).applied, false);
  const empty = fixture([]); assert.equal((await empty.service.prepare()).reason, 'no-contact'); assert.equal(empty.injections.length, 0);
});

test('managed handle 缺失或接口失败只返回诊断，不向主剧情抛异常', async () => {
  const f = fixture(undefined, { injectPrompt: () => ({}) });
  const result = await f.service.prepare(); assert.equal(result.applied, false); assert.equal(result.reason, 'unmanaged-injection');
  const absent = realm.createLimeStoryPersonaService({}); assert.equal((await absent.prepare()).reason, 'capability-unavailable');
});
