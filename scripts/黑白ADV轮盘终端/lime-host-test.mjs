import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimeChatProtocol } from './lime-chat.mjs';

const source = fs.readFileSync(new URL('lime-host.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const reply = (name = '史黛菈', texts = ['明白，待会见。']) => '<LIME>' + JSON.stringify({ 对象: name, 消息: texts.map(内容 => ({ 发言人: name, 内容 })) }) + '</LIME>';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

function fixture(overrides = {}) {
  const state = { 系统: { 结构版本: 4, 已删除人物: [] }, 场景: { 时间: '2013-04-06 08:30', 地点: '破军学园', 当前卷: 1 },
    玩家: { 姓名: '黎恩', 性别: '男性' }, 人际: { 史黛菈: { 已加联系方式: true, 性别: '女性', 好感: 280, 支援度: 320, 态度: '有些在意', 印象: '可靠' } } };
  let ctx = { chatId: 'chat-a', characterId: 1, groupId: null, name1: '玩家名', chat: [{ is_user: false, is_system: false,
    mes: '当前故事', swipe_id: 0, swipes: ['当前故事', '另一个分支'], extra: { untouched: true },
    variables: [{ stat_data: plain(state), schema: { valid: true }, unknown: { keep: 'original' } }, { stat_data: plain(state), schema: { branch: true } }] }] };
  let pending = false, generating = false, destroyed = false, sourceOverrides = {};
  const calls = { generate: [], save: [], lore: [], prompts: [], stops: [], saved: 0, timers: [] };
  const mainInput = { value: '主输入草稿 /delete 0' };
  let loreFn = () => ({ name: '史黛菈', worldbook: '当前主世界书', entries: [{ uid: 8, name: '史黛菈', content: '傲气、热诚；同伴的信任不是恋爱服从。' }] });
  let generateFn = () => reply();
  let saveFn = updates => { for (const update of updates) {
    const row = ctx.chat[update.message_id];
    if ('swipes_data' in update) row.variables = plain(update.swipes_data);
    else row.variables[row.swipe_id] = plain(update.data);
  } };
  const realm = vm.createContext({ Error, Promise, Object, String, Number, Date, Math, structuredClone, setTimeout, clearTimeout });
  vm.runInContext(source, realm);
  const options = { protocol: createLimeChatProtocol(), getContext: () => ctx,
    getSnapshot: () => ({ pending, state: plain(ctx.chat[0].variables[ctx.chat[0].swipe_id].stat_data),
      source: { chatId: ctx.chatId, characterId: ctx.characterId, groupId: ctx.groupId, messageId: 0,
        swipeId: ctx.chat[0].swipe_id, swipeCount: ctx.chat[0].swipes.length, ...sourceOverrides } }),
    getMessages(range, settings) {
      assert.equal(range, '0-' + (ctx.chat.length - 1)); assert.equal(settings.include_swipes, true);
      return plain(ctx.chat.map((message, index) => ({ message_id: index, role: message.is_user ? 'user' : 'assistant',
        name: message.is_user ? '黎恩' : '史黛菈', is_hidden: false, swipe_id: message.swipe_id ?? 0,
        swipes: message.swipes ?? [message.mes], swipes_data: message.variables ?? [{}], swipes_info: [message.extra ?? {}] })));
    }, setMessages: async (updates, settings) => { assert.deepEqual(plain(settings), { refresh: 'none' }); calls.save.push(plain(updates)); return saveFn(updates); },
    getCharacterLore: async name => { calls.lore.push(name); return loreFn(name); },
    generate: async config => { calls.generate.push(plain(config)); return generateFn(config); },
    injectPrompt: (content, id) => {
      const item = { content, id, active: true, cleanups: 0 }; calls.prompts.push(item);
      return { uninject: () => { if (item.active) { item.active = false; item.cleanups++; } } };
    }, stopGeneration: id => { calls.stops.push(id); }, onSaved: () => { calls.saved++; },
    supportStage: value => Number.isInteger(value) ? value >= 320 ? 'S' : value >= 80 ? 'C' : '未建立' : '未定',
    romanceStage: relation => relation.性别 === '女性' && typeof relation.好感 === 'number' ? relation.好感 >= 800 ? '交往' : '在意' : null,
    isDestroyed: () => destroyed, isGenerating: () => generating,
    setTimeout: (callback, ms) => { const timer = { callback, ms, cleared: false }; calls.timers.push(timer); return timer; },
    clearTimeout: timer => { timer.cleared = true; },
    hostWindow: { document: { querySelector() { throw new Error('不得读取原生输入框'); } } }, ...overrides };
  const service = realm.createLimeHostService(options);
  const f = { service, options, calls, mainInput, request: () => ({ name: '史黛菈', text: '你好', expectedSource: plain(service.read().source) }),
    get ctx() { return ctx; }, set ctx(value) { ctx = value; },
    get data() { return ctx.chat[0].variables[ctx.chat[0].swipe_id]; }, get state() { return f.data.stat_data; },
    set pending(value) { pending = value; }, set generating(value) { generating = value; }, set destroyed(value) { destroyed = value; },
    set sourceOverrides(value) { sourceOverrides = value; }, set lore(value) { loreFn = value; }, set generate(value) { generateFn = value; },
    set save(value) { saveFn = value; }, expire: () => { calls.timers.at(-1).callback(); } };
  return f;
}
function exchange(f, id = 'earlier', contact = '史黛菈') {
  return { id, contact, time: '2013-04-06 08:20', player: '稍早的消息', reply: ['稍早的回答'] };
}
function ownStore(f, records = [exchange(f)]) { f.data.rk_lime = { version: 1, owner: { messageId: 0, swipeId: f.ctx.chat[0].swipe_id }, exchanges: records }; }

 test('read读取完整活动分支与MVU姓名，返回副本，不改上下文或原生草稿', () => {
  const f = fixture(), before = plain(f.ctx), read = f.service.read();
  assert.equal(read.playerName, '黎恩'); assert.equal(read.messages[0].swipes.length, 2);
  assert.equal(read.messages[0].swipes_data[0].stat_data.场景.时间, '2013-04-06 08:30');
  read.messages[0].swipes_data[0].stat_data.场景.时间 = '客户端改动';
  assert.deepEqual(plain(f.ctx), before); assert.equal(f.mainInput.value, '主输入草稿 /delete 0');
});

 test('一次即时通讯只请求一次辅助回复，并保存到当前助手页；无新楼、正文或MVU修改', async () => {
  const f = fixture(), before = plain(f.ctx), result = await f.service.send(f.request());
  assert.equal(result.sent, true); assert.equal(result.messageId, 0); assert.equal(result.replyCount, 1);
  assert.equal(result.transport, 'tavern-helper-floor-attachment'); assert.equal(result.time, '2013-04-06 08:30');
  assert.equal(f.ctx.chat.length, before.chat.length); assert.equal(f.ctx.chat[0].mes, before.chat[0].mes);
  assert.deepEqual(f.ctx.chat[0].swipes, before.chat[0].swipes); assert.equal(f.ctx.chat[0].swipe_id, 0);
  assert.deepEqual(f.data.stat_data, before.chat[0].variables[0].stat_data);
  assert.deepEqual(f.data.schema, before.chat[0].variables[0].schema); assert.deepEqual(f.data.unknown, { keep: 'original' });
  assert.deepEqual(f.ctx.chat[0].variables[1], before.chat[0].variables[1]); assert.deepEqual(f.ctx.chat[0].extra, before.chat[0].extra);
  assert.equal(f.calls.generate.length, 1); assert.equal(f.calls.save.length, 1); assert.equal(f.calls.saved, 1);
  assert.deepEqual(Object.keys(f.calls.save[0][0]).sort(), ['data', 'message_id']);
  const config = f.calls.generate[0];
  assert.equal(config.should_silence, true); assert.equal(config.should_stream, false); assert.equal(config.max_chat_history, 'all');
  assert.match(config.generation_id, /^rk-lime:/); assert.equal('injects' in config, false);
  assert.deepEqual(f.data.rk_lime.owner, { messageId: 0, swipeId: 0 });
  assert.deepEqual(f.data.rk_lime.exchanges[0], { id: result.exchangeId, contact: '史黛菈', time: result.time, player: '你好', reply: ['明白，待会见。'], narrativeCount: 0 });
  assert.equal(f.calls.prompts[0].active, false); assert.equal(f.calls.prompts[0].cleanups, 1); assert.equal(f.calls.timers[0].ms, 120000);
  assert.equal(f.calls.timers[0].cleared, true); assert.equal(f.service.isBusy(), false); assert.equal(f.mainInput.value, '主输入草稿 /delete 0');
});

 test('性格材料读当前目标世界书，当前关系与独立支援恋爱阶段进入临时提示', async () => {
  const f = fixture(); await f.service.send(f.request());
  assert.deepEqual(f.calls.lore, ['史黛菈']);
  const prompt = f.calls.prompts[0].content;
  assert.match(prompt, /当前主世界书 \/ 史黛菈 \/ UID 8/); assert.match(prompt, /傲气、热诚/);
  assert.match(prompt, /"好感":280/); assert.match(prompt, /"态度":"有些在意"/);
  assert.match(prompt, /"派生支援阶段":"S"/); assert.match(prompt, /"派生恋爱阶段":"在意"/);
  assert.match(prompt, /支援S不等于恋爱或服从/); assert.match(prompt, /不推进时间/); assert.match(prompt, /未来关系/);
  assert.match(f.calls.generate[0].user_input, /只输出一个闭合的 LIME JSON 块/);
});

 test('未知好感及性别保持未知，缺失支援不按零推断，不自动计算恋爱', async () => {
  const f = fixture(); delete f.state.人际.史黛菈.性别; f.state.人际.史黛菈.好感 = null; delete f.state.人际.史黛菈.支援度;
  await f.service.send(f.request()); const prompt = f.calls.prompts[0].content;
  assert.match(prompt, /"好感":null/); assert.match(prompt, /"派生恋爱阶段":null/); assert.match(prompt, /"派生支援阶段":"未定"/);
  assert.equal(f.state.人际.史黛菈.好感, null); assert.equal('支援度' in f.state.人际.史黛菈, false);
});

 test('合法空回信保存实际玩家消息，不伪造NPC回答', async () => {
  const f = fixture(); f.generate = () => reply('史黛菈', []);
  const result = await f.service.send(f.request()); assert.equal(result.replyCount, 0); assert.deepEqual(f.data.rk_lime.exchanges[0].reply, []);
});

for (const key of ['chatId', 'characterId', 'groupId', 'messageId', 'swipeId', 'swipeCount']) test(`冻结来源 ${key}，过期请求不能发送`, async () => {
  const f = fixture(), request = f.request(); request.expectedSource[key] = '过期';
  await assert.rejects(f.service.send(request), { code: 'SOURCE_CONFLICT' }); assert.equal(f.calls.generate.length, 0); assert.equal(f.calls.save.length, 0);
});

 test('联系人世界书读取期间双击只产生一次回复请求', async () => {
  const f = fixture(), waiting = deferred(); f.lore = () => waiting.promise;
  const sending = f.service.send(f.request()); assert.equal(f.service.isBusy(), true);
  await assert.rejects(f.service.send(f.request()), { code: 'SEND_BUSY' });
  waiting.resolve('指定人物档案'); await sending; assert.equal(f.calls.generate.length, 1); assert.equal(f.calls.save.length, 1);
});

 test('辅助请求忙碌不当成主剧情streaming，不隐藏当前页已保存附件', async () => {
  const f = fixture(), waiting = deferred(); ownStore(f); f.generate = () => waiting.promise;
  const sending = f.service.send(f.request()); await tick();
  const read = f.service.read(); assert.equal(read.generating, false); assert.equal(read.auxiliaryBusy, true);
  assert.match(f.service.narrativeContext(), /earlier|稍早的消息/);
  waiting.resolve(reply()); await sending;
});

for (const phase of ['lore', 'generate']) for (const mutation of ['chat', 'swipe', 'text', 'mvu', 'relation', 'source']) {
  test(`${phase}期间${mutation}变化拒绝写旧附件`, async () => {
    const f = fixture(), waiting = deferred(), request = f.request();
    if (phase === 'lore') f.lore = () => waiting.promise; else f.generate = () => waiting.promise;
    const sending = f.service.send(request); await tick();
    if (mutation === 'chat') f.ctx = { ...f.ctx, chatId: 'chat-b', chat: plain(f.ctx.chat) };
    if (mutation === 'swipe') f.ctx.chat[0].swipe_id = 1;
    if (mutation === 'text') f.ctx.chat[0].swipes[0] = '编辑后的正文';
    if (mutation === 'mvu') f.state.场景.时间 = '2013-04-06 08:31';
    if (mutation === 'relation') f.state.人际.史黛菈.好感 = 500;
    if (mutation === 'source') f.sourceOverrides = { characterId: 2 };
    waiting.resolve(phase === 'lore' ? '人物档案' : reply());
    await assert.rejects(sending, { code: 'SOURCE_CONFLICT' }); assert.equal(f.calls.save.length, 0);
    assert.equal(f.calls.prompts.every(item => !item.active), true); assert.equal(f.service.isBusy(), false);
  });
}

 test('调用方异步改expectedSource不能让旧请求迁移到另一回复页', async () => {
  const f = fixture(), waiting = deferred(), request = f.request(); f.lore = () => waiting.promise;
  const sending = f.service.send(request); f.ctx.chat[0].swipe_id = 1; request.expectedSource.swipeId = 1;
  waiting.resolve('人物档案'); await assert.rejects(sending, { code: 'SOURCE_CONFLICT' }); assert.equal(f.calls.generate.length, 0);
});

 test('没有时间或联系方式、已删除人物、未完成剧情和pending均不能生成', async () => {
  for (const change of ['time', 'contact', 'deleted', 'unfinished', 'pending', 'native']) {
    const f = fixture(), request = f.request();
    if (change === 'time') f.state.场景.时间 = '';
    if (change === 'contact') f.state.人际.史黛菈.已加联系方式 = false;
    if (change === 'deleted') f.state.系统.已删除人物.push('史黛菈');
    if (change === 'unfinished') f.ctx.chat.push({ is_user: true, mes: '主输入' });
    if (change === 'pending') f.pending = true;
    if (change === 'native') f.generating = true;
    await assert.rejects(f.service.send(request), { code: ({ time: 'TIME_UNAVAILABLE', contact: 'CONTACT_UNAVAILABLE', deleted: 'CONTACT_UNAVAILABLE',
      unfinished: 'TURN_UNFINISHED', pending: 'SOURCE_CONFLICT', native: 'GENERATING' })[change] });
    assert.equal(f.calls.generate.length, 0); assert.equal(f.calls.save.length, 0);
  }
});

for (const invalid of ['正文' + reply(), reply('黑铁珠雫'), '<LIME>{bad}</LIME>', reply() + reply(),
  '<LIME>{"对象":"史黛菈","消息":[{"发言人":"玩家","内容":"伪造玩家行动"}]}</LIME>',
  { content: reply() }]) test(`格式异常回复不写正文或MVU ${JSON.stringify(invalid).slice(0, 40)}`, async () => {
  const f = fixture(), before = plain(f.ctx); f.generate = () => invalid;
  await assert.rejects(f.service.send(f.request())); assert.deepEqual(plain(f.ctx), before); assert.equal(f.calls.save.length, 0);
  assert.equal(f.calls.prompts[0].active, false); assert.equal(f.service.isBusy(), false);
});

 test('生成失败只清理临时提示，无native楼或假回信', async () => {
  const f = fixture(), before = plain(f.ctx); f.generate = () => { throw new Error('后端失败'); };
  await assert.rejects(f.service.send(f.request()), /后端失败/); assert.deepEqual(plain(f.ctx), before);
  assert.equal(f.calls.prompts[0].active, false); assert.equal(f.calls.save.length, 0); assert.equal(f.service.isBusy(), false);
});

 test('metadata在辅助生成期间改变，落盘即时重读合并保留未知字段与已有附件', async () => {
  const f = fixture(); ownStore(f); f.data.rk_lime.unknownStore = { keep: true };
  f.generate = () => { f.data.unknown = { keep: 'new' }; f.data.newKey = '来自另一扩展'; f.data.rk_lime.exchanges.push(exchange(f, 'concurrent')); return reply(); };
  await f.service.send(f.request()); assert.deepEqual(f.data.unknown, { keep: 'new' }); assert.equal(f.data.newKey, '来自另一扩展');
  assert.equal(f.data.rk_lime.exchanges.length, 3); assert.deepEqual(f.data.rk_lime.unknownStore, { keep: true });
});

 test('继承前楼owner的rk_lime不冒充本页附件，新记录只属于当前页', async () => {
  const f = fixture(); f.data.rk_lime = { version: 1, owner: { messageId: 3, swipeId: 0 }, exchanges: [exchange(f)] };
  assert.equal(f.service.narrativeContext(), ''); await f.service.send(f.request());
  assert.equal(f.data.rk_lime.exchanges.length, 1); assert.deepEqual(f.data.rk_lime.owner, { messageId: 0, swipeId: 0 });
});

for (const malformed of [{}, { version: 2, owner: { messageId: 0, swipeId: 0 }, exchanges: [] },
  { version: 1, owner: { messageId: 0, swipeId: 0 }, exchanges: [{ id: 'broken' }] }]) test('当前owner坏记录拒绝覆盖 ' + JSON.stringify(malformed), async () => {
  const f = fixture(); f.data.rk_lime = plain(malformed); const before = plain(f.ctx);
  await assert.rejects(f.service.send(f.request()), { code: 'ATTACHMENT_FORMAT' }); assert.deepEqual(plain(f.ctx), before); assert.equal(f.calls.lore.length, 0);
});

 test('只有当前目标人物的附属记忆进入即时回信，其他联系人的私信不交给收信者', async () => {
  const f = fixture(); ownStore(f, [exchange(f, 'same'), exchange(f, 'other', '黑铁珠雫')]);
  f.data.rk_lime.exchanges[1].player = '另一人的私密约定';
  await f.service.send(f.request()); const prompt = f.calls.prompts[0].content;
  assert.match(prompt, /稍早的消息/); assert.doesNotMatch(prompt, /另一人的私密约定/);
  assert.match(f.service.narrativeContext(), /另一人的私密约定/);
});

 test('附件时间冻结MVU发送时间；主系统时钟只用于记录ID', async () => {
  const f = fixture(); ownStore(f); await f.service.send(f.request());
  const context = JSON.parse(f.service.narrativeContext());
  assert.equal(context[0].时间, '2013-04-06 08:20'); assert.equal(context.at(-1).时间, '2013-04-06 08:30');
});

 test('活动页为非零swipe时附件只写该页，另一回复页保持完整', async () => {
  const f = fixture(); f.ctx.chat[0].swipe_id = 1; const before = plain(f.ctx.chat[0].variables[0]);
  await f.service.send(f.request()); assert.deepEqual(f.ctx.chat[0].variables[0], before);
  assert.deepEqual(f.data.rk_lime.owner, { messageId: 0, swipeId: 1 });
});

 test('写入没有回读确认不宣称成功；提示清理，草稿由客户端保留', async () => {
  const f = fixture(); f.save = () => {};
  await assert.rejects(f.service.send(f.request()), error => error.code === 'SAVE_UNCONFIRMED' && error.dispatched === true);
  assert.equal(f.calls.saved, 0); assert.equal(f.calls.prompts[0].active, false); assert.equal('rk_lime' in f.data, false);
});

 test('存储抛错不产生新楼层且清理提示，不调用onSaved', async () => {
  const f = fixture(), before = plain(f.ctx); f.save = () => { throw new Error('存储失败'); };
  await assert.rejects(f.service.send(f.request()), /存储失败/); assert.deepEqual(plain(f.ctx), before);
  assert.equal(f.calls.prompts[0].active, false); assert.equal(f.calls.saved, 0);
});

 test('cancel同步撤销提示且只stop本请求，迟到回信不能保存', async () => {
  const f = fixture(), waiting = deferred(); f.generate = () => waiting.promise;
  const sending = f.service.send(f.request()); await tick(); const id = f.calls.generate[0].generation_id;
  assert.equal(f.calls.prompts[0].active, true); assert.equal(f.service.cancel(), true);
  assert.equal(f.calls.prompts[0].active, false); assert.deepEqual(f.calls.stops, [id]);
  await assert.rejects(sending, { code: 'CANCELLED' }); waiting.resolve(reply()); await tick();
  assert.equal(f.calls.save.length, 0); assert.equal(f.service.isBusy(), false); assert.equal(f.service.cancel(), false);
});

 test('取消世界书读取不等待其返回，不注入提示，旧任务不影响后续新发送', async () => {
  const f = fixture(), waiting = deferred(); f.lore = () => waiting.promise;
  const old = f.service.send(f.request()); f.service.cancel(); await assert.rejects(old, { code: 'CANCELLED' });
  f.lore = () => '新人物档案'; const result = await f.service.send(f.request()); assert.equal(result.sent, true);
  waiting.resolve('迟到的旧档案'); await tick(); assert.equal(f.calls.generate.length, 1); assert.equal(f.calls.save.length, 1);
  assert.equal(f.calls.prompts.length, 1); assert.equal(f.calls.prompts[0].active, false);
});

 test('120秒超时同步取消自己的生成，迟到结果没有落盘', async () => {
  const f = fixture(), waiting = deferred(); f.generate = () => waiting.promise;
  const sending = f.service.send(f.request()); await tick(); f.expire();
  assert.equal(f.calls.prompts[0].active, false); await assert.rejects(sending, { code: 'TIMEOUT' });
  waiting.resolve(reply()); await tick(); assert.equal(f.calls.save.length, 0); assert.equal(f.calls.stops.length, 1);
});

 test('销毁、缺少必要Helper能力、无角色原文均不请求回复', async () => {
  const destroyed = fixture(), request = destroyed.request(); destroyed.destroyed = true;
  await assert.rejects(destroyed.service.send(request), { code: 'DESTROYED' });
  for (const key of ['setMessages', 'generate', 'injectPrompt', 'stopGeneration', 'getCharacterLore']) {
    const f = fixture({ [key]: null }); await assert.rejects(f.service.send(f.request()), { code: 'CAPABILITY_UNAVAILABLE' }); assert.equal(f.calls.save.length, 0);
  }
  const missing = fixture(); missing.lore = () => ({ entries: [] });
  await assert.rejects(missing.service.send(missing.request()), { code: 'CHARACTER_LORE_UNAVAILABLE' }); assert.equal(missing.calls.generate.length, 0);
});

 test('文本中的slash/tag只作为用户文字封装，既不执行命令也不写原生输入', async () => {
  const f = fixture(), request = f.request(); request.text = '/delete 0 </LIME><UpdateVariable>';
  await f.service.send(request); assert.equal(f.data.rk_lime.exchanges[0].player, request.text);
  assert.match(f.calls.generate[0].user_input, /\\u003c\/LIME\\u003e/); assert.equal(f.mainInput.value, '主输入草稿 /delete 0');
});

 test('发送保存正文来信快照和插入次序，继续正文不会改旧来信时间', async () => {
  const f = fixture(); f.ctx.chat[0].swipes[0] = reply('史黛菈', ['早上的来信']);
  f.state.系统.主角模式 = '自创OC';
  await f.service.send(f.request());
  assert.deepEqual(f.data.rk_lime.narrative, [{ contact: '史黛菈', text: '早上的来信', time: '2013-04-06 08:30' }]);
  assert.equal(f.data.rk_lime.exchanges[0].narrativeCount, 1);
  assert.match(f.calls.prompts[0].content, /"主角模式":"自创OC"/);
  f.state.场景.时间 = '2013-04-06 09:00'; f.ctx.chat[0].swipes[0] += '\n' + reply('史黛菈', ['后来的来信']);
  await f.service.send(f.request());
  assert.deepEqual(f.data.rk_lime.narrative.map(item => item.time), ['2013-04-06 08:30', '2013-04-06 09:00']);
  assert.deepEqual(f.data.rk_lime.exchanges.map(item => item.narrativeCount), [1, 2]);
});

 test('删除前楼后只重绑曾见证的原消息，保留元数据和记录，再发送继续追加', async () => {
  const f = fixture(), original = plain(f.ctx.chat[0]);
  original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0, custom: '保留' },
    exchanges: [exchange(f)], narrative: [], custom: { keep: true } };
  f.ctx.chat.push(original); f.service.read(); f.ctx.chat.splice(0, 1);
  const before = plain(f.ctx.chat[0]), stats = await f.service.rebindOwners();
  assert.equal(stats.rebound, 1); assert.equal(stats.shadowsCleared, 0);
  assert.deepEqual(f.data.rk_lime.owner, { messageId: 0, swipeId: 0, custom: '保留' });
  assert.deepEqual(f.data.stat_data, before.variables[0].stat_data); assert.deepEqual(f.data.rk_lime.custom, { keep: true });
  assert.deepEqual(f.ctx.chat[0].swipes, before.swipes); assert.equal(f.calls.save[0][0].data, undefined);
  assert.equal(f.calls.save[0][0].swipes_data.length, 2);
  await f.service.send(f.request()); assert.equal(f.data.rk_lime.exchanges.length, 2);
  assert.equal(f.data.rk_lime.exchanges[0].id, 'earlier');
});

 test('未打开手机时narrativeContext也见证所有inactive页，删除前swipe后以全页数据重绑', async () => {
  const f = fixture(), row = f.ctx.chat[0];
  row.swipes.push('第三分支'); row.variables.push(plain(row.variables[1]));
  row.variables[2].rk_lime = { version: 1, owner: { messageId: 0, swipeId: 2 }, exchanges: [exchange(f)] };
  f.service.narrativeContext(); const before = plain(row.variables[0]);
  row.swipes.splice(1, 1); row.variables.splice(1, 1);
  const stats = await f.service.rebindOwners(); assert.equal(stats.rebound, 1);
  assert.deepEqual(row.variables[1].rk_lime.owner, { messageId: 0, swipeId: 1 });
  assert.deepEqual(row.variables[0], before); assert.equal(row.swipe_id, 0);
  assert.deepEqual(Object.keys(f.calls.save[0][0]).sort(), ['message_id', 'swipes_data']);
});

 test('已见证原页的跨楼继承影子碰巧匹配新索引也清除，仅移除rk_lime命名空间', async () => {
  const f = fixture(), original = plain(f.ctx.chat[0]);
  original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [exchange(f)], narrative: [] };
  const shadow = plain(original); shadow.variables[0].external = { keep: true };
  f.ctx.chat.push(original, shadow); f.service.read(); f.ctx.chat.splice(0, 1);
  const before = plain(shadow.variables[0]); const stats = await f.service.rebindOwners();
  assert.equal(stats.rebound, 1); assert.equal(stats.shadowsCleared, 1);
  assert.equal('rk_lime' in shadow.variables[0], false); delete before.rk_lime;
  assert.deepEqual(shadow.variables[0], before); assert.equal(original.variables[0].rk_lime.exchanges.length, 1);
});

 test('同一消息内已见证副本不接替被删除原swipe，即便正文和索引相同', async () => {
  const f = fixture(); ownStore(f); const row = f.ctx.chat[0];
  row.swipes[1] = row.swipes[0]; row.variables[1] = plain(row.variables[0]);
  f.service.read(); row.swipes.splice(0, 1); row.variables.splice(0, 1);
  const stats = await f.service.rebindOwners(); assert.equal(stats.rebound, 0); assert.equal(stats.shadowsCleared, 1);
  assert.equal('rk_lime' in row.variables[0], false);
});

 test('同页重复影子先清除后重绑仍存活的唯一原swipe，旧时间不变', async () => {
  const f = fixture(), row = f.ctx.chat[0];
  row.swipes.push('保留分支'); row.variables.push(plain(row.variables[0]));
  row.variables[2].rk_lime = { version: 1, owner: { messageId: 0, swipeId: 2 }, exchanges: [exchange(f)] };
  row.swipes[1] = row.swipes[2]; row.variables[1] = plain(row.variables[2]);
  f.service.read(); row.swipes.splice(0, 1); row.variables.splice(0, 1);
  const stats = await f.service.rebindOwners(); assert.equal(stats.rebound, 1); assert.equal(stats.shadowsCleared, 1);
  assert.equal('rk_lime' in row.variables[0], false); assert.deepEqual(row.variables[1].rk_lime.owner, { messageId: 0, swipeId: 1 });
  assert.equal(row.variables[1].rk_lime.exchanges[0].time, '2013-04-06 08:20');
});

 test('未见证记录和未知wrapper替换不凭索引猜测归属，也不清空', async () => {
  const unwitnessed = fixture(); ownStore(unwitnessed); const before = plain(unwitnessed.ctx);
  assert.deepEqual(plain(await unwitnessed.service.rebindOwners()), { rebound: 0, shadowsCleared: 0, skipped: 0 });
  assert.deepEqual(plain(unwitnessed.ctx), before);
  const f = fixture(), original = plain(f.ctx.chat[0]); original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [exchange(f)] };
  f.ctx.chat.push(original); f.service.read(); original.variables[0] = plain(original.variables[0]);
  f.ctx.chat.splice(0, 1); const uncertain = plain(f.ctx);
  const stats = await f.service.rebindOwners(); assert.equal(stats.rebound, 0); assert.equal(stats.shadowsCleared, 0); assert.ok(stats.skipped > 0);
  assert.deepEqual(plain(f.ctx), uncertain);
});

 test('同metadata对象共享两页的歧义副本不晋升为原页', async () => {
  const f = fixture(); ownStore(f); const row = f.ctx.chat[0];
  row.swipes[1] = row.swipes[0]; row.variables[1] = row.variables[0];
  f.service.read(); row.swipes.splice(0, 1); row.variables.splice(0, 1);
  const stats = await f.service.rebindOwners(); assert.equal(stats.rebound, 0); assert.equal(stats.shadowsCleared, 0); assert.ok(stats.skipped > 0);
  assert.equal(row.variables[0].rk_lime.exchanges[0].id, 'earlier');
});

 test('归属修复等待保存期间禁止发送，read报告pending但不是主剧情生成', async () => {
  const f = fixture(), original = plain(f.ctx.chat[0]), waiting = deferred();
  original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [exchange(f)] };
  f.ctx.chat.push(original); f.service.read(); f.ctx.chat.splice(0, 1);
  f.save = async updates => { await waiting.promise; for (const update of updates) f.ctx.chat[update.message_id].variables = plain(update.swipes_data); };
  const repair = f.service.rebindOwners(); await tick();
  assert.equal(f.service.isBusy(), true); assert.equal(f.service.read().pending, true); assert.equal(f.service.read().generating, false);
  await assert.rejects(f.service.send(f.request()), { code: 'SEND_BUSY' });
  waiting.resolve(); await repair; assert.equal(f.service.isBusy(), false); assert.equal(f.service.read().pending, false);
});

 test('归属修复存储失败或无回读确认释放锁，不宣称已保存', async () => {
  for (const failure of ['throw', 'no-write']) {
    const f = fixture(), original = plain(f.ctx.chat[0]); original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [exchange(f)] };
    f.ctx.chat.push(original); f.service.read(); f.ctx.chat.splice(0, 1);
    f.save = failure === 'throw' ? () => { throw new Error('归属存储失败'); } : () => {};
    await assert.rejects(f.service.rebindOwners(), failure === 'throw' ? /归属存储失败/ : { code: 'SAVE_UNCONFIRMED' });
    assert.equal(f.service.isBusy(), false); assert.equal(original.variables[0].rk_lime.owner.messageId, 1); assert.equal(f.calls.saved, 0);
  }
});

 test('归属修复开始前切换聊天不沿用上局见证，也不改新聊天记录', async () => {
  const f = fixture(); ownStore(f); f.service.read();
  f.ctx = { ...f.ctx, chatId: 'chat-b', chat: plain(f.ctx.chat) }; const before = plain(f.ctx);
  assert.deepEqual(plain(await f.service.rebindOwners()), { rebound: 0, shadowsCleared: 0, skipped: 0 }); assert.deepEqual(plain(f.ctx), before);
});

 test('归属修复异步写入后发现聊天切换即停止，不写新聊天', async () => {
  const f = fixture(), original = plain(f.ctx.chat[0]), waiting = deferred();
  original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [exchange(f)] };
  f.ctx.chat.push(original); f.service.read(); f.ctx.chat.splice(0, 1);
  const oldChat = f.ctx.chat;
  f.save = async updates => { await waiting.promise; oldChat[0].variables = plain(updates[0].swipes_data); };
  const repair = f.service.rebindOwners(); await tick();
  f.ctx = { ...f.ctx, chatId: 'chat-b', chat: plain(f.ctx.chat) }; const before = plain(f.ctx); waiting.resolve();
  await assert.rejects(repair, { code: 'SOURCE_CONFLICT' }); assert.deepEqual(plain(f.ctx), before); assert.equal(f.service.isBusy(), false);
});

 test('正在辅助生成时删除结构取消本请求，旧迟到结果不保存', async () => {
  const f = fixture(), waiting = deferred(); ownStore(f); f.generate = () => waiting.promise;
  const sending = f.service.send(f.request()); await tick();
  await f.service.rebindOwners(); await assert.rejects(sending, { code: 'CANCELLED' });
  assert.equal(f.calls.prompts[0].active, false); assert.equal(f.calls.stops.length, 1);
  waiting.resolve(reply()); await tick(); assert.equal(f.calls.save.length, 0);
});

 test('连续删除较早楼层仍保留同一原页记录，修复写入更新见证对象', async () => {
  const f = fixture(), original = plain(f.ctx.chat[0]);
  original.variables[0].rk_lime = { version: 1, owner: { messageId: 2, swipeId: 0 }, exchanges: [exchange(f)] };
  f.ctx.chat.push(plain(f.ctx.chat[0]), original); f.service.read();
  f.ctx.chat.splice(0, 1); assert.equal((await f.service.rebindOwners()).rebound, 1);
  assert.deepEqual(original.variables[0].rk_lime.owner, { messageId: 1, swipeId: 0 });
  f.ctx.chat.splice(0, 1); assert.equal((await f.service.rebindOwners()).rebound, 1);
  assert.deepEqual(original.variables[0].rk_lime.owner, { messageId: 0, swipeId: 0 });
  assert.equal(original.variables[0].rk_lime.exchanges[0].id, 'earlier');
});

 test('归属修复规划后新metadata也由写前fresh merge保留，所有其他页不变', async () => {
  const f = fixture(), original = plain(f.ctx.chat[0]);
  original.variables[0].rk_lime = { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [exchange(f)] };
  f.ctx.chat.push(original); f.service.read(); f.ctx.chat.splice(0, 1);
  const originalReader = f.options.getMessages; let reads = 0;
  f.options.getMessages = (...args) => { const result = originalReader(...args); reads++;
    if (reads === 1) { original.variables[0].externalLate = { keep: true }; original.variables[1].anotherExtension = 'preserved'; }
    return result;
  };
  await f.service.rebindOwners(); assert.deepEqual(original.variables[0].externalLate, { keep: true });
  assert.equal(original.variables[1].anotherExtension, 'preserved'); assert.equal(reads >= 3, true);
});

 test('已见证共享对象歧义仅隔离读取并拒绝发送，不修改不确定原数据', async () => {
  const f = fixture(); ownStore(f); const row = f.ctx.chat[0];
  row.swipes[1] = row.swipes[0]; row.variables[1] = row.variables[0]; f.service.read();
  row.swipes.splice(0, 1); row.variables.splice(0, 1); await f.service.rebindOwners();
  const before = plain(f.ctx); const read = f.service.read();
  assert.equal('rk_lime' in read.messages[0].swipes_data[0], false); assert.equal(f.service.narrativeContext(), '');
  await assert.rejects(f.service.send(f.request()), { code: 'ATTACHMENT_OWNERSHIP' });
  assert.deepEqual(plain(f.ctx), before); assert.equal(f.calls.generate.length, 0); assert.equal(f.calls.save.length, 0);
  assert.equal(f.mainInput.value, '主输入草稿 /delete 0');
});

 test('修复后未知wrapper替换碰巧命中owner索引也隔离，不重新见证为原件', async () => {
  const f = fixture(); ownStore(f); f.service.read();
  f.ctx.chat[0].variables[0] = plain(f.data); await f.service.rebindOwners();
  const before = plain(f.ctx); for (let index = 0; index < 3; index++) {
    assert.equal('rk_lime' in f.service.read().messages[0].swipes_data[0], false);
    assert.equal(f.service.narrativeContext(), '');
  }
  await assert.rejects(f.service.send(f.request()), { code: 'ATTACHMENT_OWNERSHIP' });
  assert.deepEqual(plain(f.ctx), before); assert.equal(f.calls.lore.length, 0);
});

 test('quarantine缓存随聊天切换清除，同内容另一局合法独立存档正常可读发送', async () => {
  const f = fixture(); ownStore(f); f.service.read(); f.ctx.chat[0].variables[0] = plain(f.data);
  await f.service.rebindOwners(); assert.equal(f.service.narrativeContext(), '');
  f.ctx = { ...f.ctx, chatId: 'chat-b', chat: plain(f.ctx.chat) };
  assert.match(f.service.narrativeContext(), /稍早的消息/);
  await f.service.send(f.request()); assert.equal(f.data.rk_lime.exchanges.length, 2);
});
