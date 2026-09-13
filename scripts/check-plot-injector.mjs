import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { inlineStoryCatalog } from './story-build.mjs';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { resolveStoryChapter } from './rakudai-story-catalog.mjs';

const clone = structuredClone;
const require = createRequire(import.meta.url), ejs = require('../output/worldbook-calibration/dev/node_modules/ejs');
const plain = value => JSON.parse(JSON.stringify(value));
const runtimeSource = fs.readFileSync(new URL('./rakudai-plot-runtime.js', import.meta.url), 'utf8');
const createRuntime = vm.runInNewContext(
  `${inlineStoryCatalog({ summaries: true })}\n${runtimeSource}\ncreateRakudaiPlotRuntime;`,
  { console, structuredClone, AbortController },
  { filename: 'rakudai-plot-runtime.test-bundle.js' },
);
const results = [];

function state(volume = 1, chapter = '序章', phase = '进行中') {
  const value = clone(INITIAL_STATE);
  value.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  value.玩家.姓名 = '测试玩家';
  value.场景 = { ...value.场景, 当前卷: volume, 当前章: chapter, 阶段: phase,
    时间: '已确认的当日傍晚', 地点: '已确认的当前场所', 切入说明: '从玩家确认的位置继续' };
  return value;
}

function assistant(value = state(), text = '已发生的助手正文') {
  return { is_user: false, is_system: false, name: '助手', mes: text, swipe_id: 0,
    swipes: [text], variables: [{ stat_data: clone(value), retained: { wrapper: true } }] };
}

function user(text = '玩家提出新的行动', value) {
  return { is_user: true, is_system: false, name: '玩家', mes: text,
    swipe_id: 0, swipes: [text], variables: [value ? { stat_data: clone(value) } : {}] };
}

/** Mirrors the verified TH message/read surface, without exposing host internals to the runtime. */
function fixture(initialMessages = [assistant(), user()]) {
  let messages = clone(initialMessages), chatId = 'chat-A', clock = 1000;
  let extra = false, mvuAvailable = true, budget = async () => true, wrapperOverride, verifier = () => true;
  const settings = new Map(), calls = [], reports = [], writes = [], budgets = [];
  const context = { getCurrentChatId: () => chatId,
    get chatId() { return chatId; }, get chat() { return messages; } };
  function readMessages(range, options = {}) {
    const text = String(range).replaceAll('{{lastMessageId}}', String(messages.length - 1));
    const match = /^(-?\d+)(?:-(-?\d+))?$/.exec(text);
    assert.ok(match, `消息读取必须使用有效范围，收到 ${text}`);
    const normalize = n => Number(n) < 0 ? messages.length + Number(n) : Number(n);
    let start = normalize(match[1]), end = normalize(match[2] ?? match[1]);
    if (start > end) [start, end] = [end, start];
    return messages.flatMap((message, messageId) => {
      if (messageId < start || messageId > end) return [];
      const role = message.extra?.type === 'narrator' ? 'system' : message.is_user ? 'user' : 'assistant';
      if (options.role && options.role !== 'all' && options.role !== role) return [];
      if (options.hide_state === 'unhidden' && message.is_system) return [];
      if (options.hide_state === 'hidden' && !message.is_system) return [];
      const swipeId = message.swipe_id ?? 0;
      const base = { message_id: messageId, role, name: message.name, is_hidden: message.is_system };
      const swiped = { ...base, swipe_id: swipeId, swipes: clone(message.swipes ?? [message.mes]),
        swipes_data: clone(message.variables ?? [{}]), swipes_info: clone(message.swipe_info ?? [{}]) };
      return [options.include_swipes ? swiped : { ...base, message: message.mes,
        data: clone(message.variables?.[swipeId] ?? {}), extra: clone(message.extra ?? {}) }];
    });
  }
  const mvu = {
    isDuringExtraAnalysis: () => extra,
    getMvuData(options) {
      calls.push(clone(options));
      assert.equal(options?.type, 'message', 'MVU 必须读取 message 作用域');
      assert.equal(typeof options.message_id, 'number', 'MVU 必须读取已解析的数字楼层');
      assert.ok(options.message_id >= 0, 'MVU 不应使用 latest 或负数作为最终凭据');
      const message = messages[options.message_id];
      return clone(wrapperOverride ?? message?.variables?.[message.swipe_id ?? 0] ?? {});
    },
  };
  const api = createRuntime({
    getContext: () => context,
    readMessages,
    getMvu: () => mvuAvailable ? mvu : undefined,
    readSettings: () => settings.get(chatId) ?? true,
    writeSettings: enabled => { assert.equal(typeof enabled, 'boolean'); settings.set(chatId, enabled); writes.push({ chatId, enabled }); },
    report: message => reports.push(String(message)),
    now: () => clock,
    verifyMainRequest: (chat, ticket) => verifier(chat, ticket),
    measureBudget: async (chat, addition, request) => { budgets.push({ chat: clone(chat), addition: clone(addition), request: clone(request) }); return budget(chat, addition, request); },
  });
  return { api, calls, reports, writes, budgets, settings,
    get messages() { return messages; },
    replaceMessages: value => { messages = clone(value); },
    switchChat: (id, value = [assistant(), user()]) => { chatId = id; messages = clone(value); },
    setExtra: value => { extra = value; },
    setMvuAvailable: value => { mvuAvailable = value; },
    setWrapper: value => { wrapperOverride = value; },
    setVerifier: value => { verifier = value; },
    setBudget: value => { budget = value; },
    advance: amount => { clock += amount; },
  };
}

function prompt(content = '玩家正文 <% if (active) { %>保留模板<% } %>') {
  return { chat: [{ role: 'system', content: '宿主系统规则' },
    { role: 'assistant', content: '已发生的助手正文' }, { role: 'user', content }], dryRun: false };
}

// SillyTavern makes a shallow array copy between prompt-ready and settings-ready.
// The same message objects identify a request; a matching text string cannot do so.
function settings(event, { type = 'normal', messages = [...event.chat] } = {}) {
  return { type, messages, max_tokens: 512, stream: false };
}

function allText(chat) {
  return chat.flatMap(message => typeof message.content === 'string' ? [message.content] :
    Array.isArray(message.content) ? message.content.filter(part => part.type === 'text').map(part => part.text) : []).join('\n');
}

function countText(chat, text) {
  return allText(chat).split(text).length - 1;
}

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack || String(error) }); }
}

async function unchanged(f, event = prompt(), begin = () => f.api.onGeneration('normal', {}, false)) {
  const before = clone(event.chat);
  await begin();
  await f.api.onPromptReady(event);
  assert.deepEqual(event.chat, before, '被拒绝的请求不得改动出网消息');
}

await check('普通发送忽略末尾用户变量，读取此前助手的活动 swipe', async () => {
  const f = fixture([assistant(state(2, '序章')), user('新行动', state(19, '终章'))]);
  const expected = f.api.preview();
  assert.deepEqual(plain(expected.source), { chatId: 'chat-A', messageId: 0, swipeId: 0 });
  assert.equal(expected.volume, 2); assert.equal(expected.chapter, '序章');
  const event = prompt(), array = event.chat, beforeState = clone(f.messages);
  f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(event);
  assert.equal(event.chat, array, '须原位管理宿主传来的数组');
  assert.equal(countText(event.chat, expected.text), 1);
  assert.deepEqual(f.messages, beforeState, '提示词注入不得改写聊天存档');
  assert.equal(f.writes.length, 0, '读取和注入不得偷偷修改开关');
});

await check('正常发送在生命周期之后新增用户楼层仍使用助手状态', async () => {
  const f = fixture([assistant(state(3, '序章'))]), expected = f.api.preview(), event = prompt();
  f.api.onGeneration('normal', {}, false);
  f.messages.push(user());
  await f.api.onPromptReady(event);
  assert.equal(countText(event.chat, expected.text), 1);
});

await check('活动 swipe 的变量来源与预览来源一致', async () => {
  const message = assistant(state(1, '序章'));
  message.swipes.push('第二候选正文'); message.variables.push({ stat_data: state(2, '第一章') }); message.swipe_id = 1;
  const f = fixture([message, user()]), expected = f.api.preview(), event = prompt();
  assert.equal(expected.volume, 2); assert.equal(expected.chapter, '第一章'); assert.equal(expected.source.swipeId, 1);
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  assert.equal(countText(event.chat, expected.text), 1);
});

await check('MVU 返回值与活动回复页不一致时拒绝，不选择看似有效的一份', async () => {
  const f = fixture(); f.setWrapper({ stat_data: state(2, '序章') }); await unchanged(f);
  assert.match(f.api.getStatus().reason, /不一致/);
});

await check('卷十三旧间章别名解析为间章1，不与间章2混淆', async () => {
  const f = fixture([assistant(state(13, '间章')), user()]), expected = f.api.preview(), event = prompt();
  assert.equal(expected.chapter, '间章1');
  assert.ok(expected.text.includes(resolveStoryChapter(13, '间章1').summary));
  assert.ok(!expected.text.includes(resolveStoryChapter(13, '间章2').summary));
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  assert.equal(countText(event.chat, expected.text), 1);
});

await check('最新助手缺 MVU 时失败关闭，不搜索旧楼层或回退卷一第一章', async () => {
  const missing = assistant(); missing.variables = [{}];
  const f = fixture([assistant(state(1, '第一章')), user(), missing, user()]);
  await unchanged(f);
  assert.ok(f.api.getStatus().reason, '应留下可见失败原因');
});

await check('swipe 排除即将重写的末助手，读取前一助手状态', async () => {
  const f = fixture([assistant(state(2, '序章')), user(), assistant(state(3, '第一章'))]);
  f.api.onGeneration('swipe', {}, false);
  f.messages[2].swipes.push(''); f.messages[2].variables.push({}); f.messages[2].swipe_id = 1;
  const event = prompt(); await f.api.onPromptReady(event);
  assert.ok(allText(event.chat).includes(resolveStoryChapter(2, '序章').summary));
  assert.ok(!allText(event.chat).includes(resolveStoryChapter(3, '第一章').summary));
  assert.ok(f.calls.every(call => call.message_id === 0));
});

await check('regenerate 在宿主已删除末助手后读取剩余最新助手', async () => {
  const f = fixture([assistant(state(2, '序章')), user(), assistant(state(3, '第一章'))]);
  f.api.onGeneration('regenerate', {}, false); f.messages.pop();
  const event = prompt(); await f.api.onPromptReady(event);
  assert.ok(allText(event.chat).includes(resolveStoryChapter(2, '序章').summary));
  assert.ok(!allText(event.chat).includes(resolveStoryChapter(3, '第一章').summary));
});

await check('continue 使用当前助手活动状态，保持卷十六终章Ⅱ的真实键', async () => {
  const f = fixture([assistant(state(16, '终章Ⅱ'))]), expected = f.api.preview(), event = prompt();
  f.api.onGeneration('continue', {}, false); await f.api.onPromptReady(event);
  assert.equal(expected.chapter, '终章Ⅱ'); assert.equal(countText(event.chat, expected.text), 1);
});

await check('未建档、v3、非法卷章或阶段都不得伪装为可用剧情', async () => {
  const cases = [
    value => { value.系统.开局状态 = '待建档'; },
    value => { value.系统.结构版本 = 3; },
    value => { value.场景.当前卷 = 20; },
    value => { value.场景.当前卷 = '2'; },
    value => { value.场景.当前章 = '第五章'; },
    value => { value.场景.当前章 = '待选择'; },
    value => { value.场景.阶段 = '自动跳章'; },
  ];
  for (const change of cases) { const value = state(); change(value); const f = fixture([assistant(value), user()]); await unchanged(f); assert.ok(f.api.getStatus().reason); }
});

await check('MVU 不可用不得使用另一个作用域或全局 stat_data 兜底', async () => {
  const f = fixture(); f.setMvuAvailable(false); await unchanged(f); assert.ok(f.api.getStatus().reason);
});

await check('没有主生成票据的 prompt-ready 不注入', async () => {
  await unchanged(fixture(), prompt(), () => {});
});

await check('即使持有主生成票据，宿主确认请求不属于主聊天也拒绝', async () => {
  const f = fixture(); let inspected = false;
  f.setVerifier((chat, ticket) => { inspected = true; assert.equal(ticket.type, 'normal'); assert.ok(Array.isArray(chat)); return false; });
  await unchanged(f); assert.equal(inspected, true);
  f.setVerifier(() => true); await unchanged(f, prompt(), () => {});
});

await check('quiet、impersonate、未知生成类型不会获得正文剧情', async () => {
  for (const type of ['quiet', 'impersonate', 'unrecognized-background']) {
    const f = fixture(); await unchanged(f, prompt(), () => f.api.onGeneration(type, {}, false));
  }
});

await check('生命周期 dryRun 与 prompt-ready dryRun 分别拒绝', async () => {
  await unchanged(fixture(), prompt(), () => {});
  const f = fixture(); await unchanged(f, prompt(), () => f.api.onGeneration('normal', {}, true));
  const g = fixture(), event = prompt(); event.dryRun = true; await unchanged(g, event);
});

await check('MVU 额外解析开始前或预算等待期间都不得注入正文剧情', async () => {
  const f = fixture(); f.setExtra(true); await unchanged(f);
  const g = fixture(), event = prompt(), before = clone(event.chat); let release;
  g.setBudget(() => new Promise(resolve => { release = resolve; }));
  g.api.onGeneration('normal', {}, false); const work = g.api.onPromptReady(event);
  assert.equal(typeof release, 'function'); g.setExtra(true); release(true); await work;
  assert.deepEqual(event.chat, before);
});

await check('外来生成使旧主票据失效，结束外来生成也不复活票据', async () => {
  const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false);
  f.api.foreignStart('oracle-1'); f.api.foreignEnd('oracle-1');
  await unchanged(f, event, () => {});
  const next = prompt(), expected = f.api.preview(); f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(next); assert.equal(countText(next.chat, expected.text), 1);
});

await check('后台错误缺少 END 不会永久锁住后续显式主生成', async () => {
  const f = fixture(); f.api.foreignStart('oracle-without-end');
  const event = prompt(), expected = f.api.preview(); f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(event); await f.api.onSettingsReady(settings(event));
  assert.equal(countText(event.chat, expected.text), 1); assert.equal(f.api.getStatus().lastInjection.text, expected.text);
});

await check('剧情开关按聊天保存，返回原聊天仍记住禁用状态', async () => {
  const f = fixture(); await f.api.setEnabled(false); assert.equal(f.api.getStatus().enabled, false);
  await unchanged(f); f.switchChat('chat-B'); assert.equal(f.api.getStatus().enabled, true);
  const event = prompt(), expected = f.api.preview(); f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(event); assert.equal(countText(event.chat, expected.text), 1);
  f.switchChat('chat-A'); assert.equal(f.api.getStatus().enabled, false); await unchanged(f);
  assert.deepEqual(f.writes, [{ chatId: 'chat-A', enabled: false }]);
});

await check('票据创建后切聊天不得把前一聊天的剧情带入新聊天', async () => {
  const f = fixture(); f.api.onGeneration('normal', {}, false); f.switchChat('chat-B', [assistant(state(2, '序章')), user()]);
  await unchanged(f, prompt(), () => {});
});

await check('预算等待期间切聊天、切 swipe 或变更状态均拒绝旧快照', async () => {
  for (const change of [f => f.switchChat('chat-B'), f => {
    const m = f.messages[0]; m.swipes.push('新候选'); m.variables.push({ stat_data: state(2, '序章') }); m.swipe_id = 1;
  }, f => { f.messages[0].variables[0].stat_data.场景.当前章 = '第一章'; }]) {
    const f = fixture(), event = prompt(), before = clone(event.chat); let release;
    f.setBudget(() => new Promise(resolve => { release = resolve; }));
    f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
    assert.equal(typeof release, 'function'); change(f); release(true); await work;
    assert.deepEqual(event.chat, before);
  }
});

await check('同一 prompt-ready 顺序重入只保留一个剧情块', async () => {
  const f = fixture(), event = prompt(), expected = f.api.preview(); f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(event); const once = clone(event.chat);
  await f.api.onPromptReady(event); assert.deepEqual(event.chat, once); assert.equal(countText(event.chat, expected.text), 1);
});

await check('新请求仅替换旧自有剧情块，保留正文、EJS 与其他插件标记', async () => {
  const f = fixture(), expected = f.api.preview();
  const old = '【RK剧情注入:BEGIN】旧卷章参考【RK剧情注入:END】';
  const event = prompt(`前文${old}后文 <%_ if (x) { _%>模板<%_ } _%> 【其他插件:BEGIN】保留【其他插件:END】`);
  event.chat[0].content += old;
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  assert.equal(countText(event.chat, expected.text), 1);
  assert.ok(!allText(event.chat).includes('旧卷章参考'));
  assert.ok(allText(event.chat).includes('前文后文 <%_ if (x) { _%>模板<%_ } _%> 【其他插件:BEGIN】保留【其他插件:END】'));
  assert.equal(event.chat[0].content, '宿主系统规则');
});

await check('遇到未闭合的自有剧情块时保留整个请求并拒绝注入', async () => {
  const f = fixture(); await unchanged(f, prompt('玩家正文【RK剧情注入:BEGIN】残缺旧块'));
  assert.match(f.api.getStatus().reason, /未闭合/);
});

await check('并发 prompt-ready 无法确认归属时拒绝双方，新主生成仍可恢复', async () => {
  const f = fixture(), event = prompt(), before = clone(event.chat), releases = [];
  f.setBudget(() => new Promise(resolve => { releases.push(resolve); })); f.api.onGeneration('normal', {}, false);
  const first = f.api.onPromptReady(event), second = f.api.onPromptReady(event);
  assert.ok(releases.length >= 1); releases.forEach(resolve => resolve(true)); await Promise.all([first, second]);
  assert.deepEqual(event.chat, before);
  f.setBudget(async () => true); const next = prompt(), expected = f.api.preview();
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(next);
  assert.equal(countText(next.chat, expected.text), 1);
});

await check('多模态用户内容完整保留，EJS 源码与其他系统规则不清洗', async () => {
  const content = [{ type: 'text', text: '新输入 <% if (active) { %>条件文本<% } %>' },
    { type: 'image_url', image_url: { url: 'https://example.invalid/test-image.png', detail: 'low' } }];
  const f = fixture(), event = prompt(content), beforeContent = clone(content), beforeSystem = clone(event.chat[0]);
  const originalUser = event.chat.at(-1), originalParts = [...content];
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  assert.equal(event.chat.at(-1), originalUser);
  assert.equal(event.chat.at(-1).content, content);
  assert.deepEqual(content.slice(0, originalParts.length), beforeContent);
  originalParts.forEach((part, index) => assert.equal(content[index], part));
  assert.deepEqual(event.chat[0], beforeSystem);
  assert.equal(content.length, originalParts.length + 1);
  assert.equal(allText(event.chat).split('<% if (active) { %>').length - 1, 1);
});

await check('三个阶段预览明确区分且不把参考概要写入已发生事件', async () => {
  const texts = [];
  for (const phase of ['未开始', '进行中', '已结束']) {
    const value = state(2, '第一章', phase), f = fixture([assistant(value), user()]), before = clone(f.messages);
    const preview = f.api.preview(); assert.equal(preview.phase, phase); assert.ok(preview.text.includes(phase));
    texts.push(preview.text); const event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
    assert.deepEqual(f.messages, before); assert.equal(countText(event.chat, preview.text), 1);
  }
  assert.equal(new Set(texts).size, 3);
});

await check('预算明确拒绝或计量失败时不修改消息并留下原因', async () => {
  for (const measure of [async () => false, async () => { throw new Error('无法取得token计量'); }]) {
    const f = fixture(); f.setBudget(measure); await unchanged(f); assert.ok(f.api.getStatus().reason);
  }
});

await check('预算拒绝会消费主票据，后续无新生命周期的请求不能复用', async () => {
  const f = fixture(); f.setBudget(async () => false); await unchanged(f);
  f.setBudget(async () => true); await unchanged(f, prompt(), () => {});
  assert.equal(f.budgets.length, 1, '无新票据的请求应在预算阶段前被拒绝');
  const next = prompt(), expected = f.api.preview(); f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(next); assert.equal(countText(next.chat, expected.text), 1);
});

await check('预算计量读取完整候选请求，批准之前不触碰宿主数组', async () => {
  const f = fixture(), event = prompt(), before = clone(event.chat), expected = f.api.preview();
  f.setBudget(async (candidate, addition) => {
    assert.deepEqual(event.chat, before);
    assert.notEqual(candidate, event.chat);
    assert.equal(addition, expected.text);
    assert.equal(countText(candidate, expected.text), 1);
    assert.equal(candidate[0].content, before[0].content);
    assert.ok(candidate.at(-1).content.startsWith(before.at(-1).content));
    return true;
  });
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  assert.equal(countText(event.chat, expected.text), 1); assert.equal(f.budgets.length, 1);
});

await check('预算等待中正文或包装变量发生编辑时拒绝旧快照', async () => {
  for (const change of [f => { f.messages[0].swipes[0] = '已被用户编辑的新正文'; },
    f => { f.messages[0].variables[0].retained.wrapper = false; }]) {
    const f = fixture(), event = prompt(), before = clone(event.chat); let release;
    f.setBudget(() => new Promise(resolve => { release = resolve; }));
    f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
    change(f); release(true); await work; assert.deepEqual(event.chat, before);
  }
});

await check('预算等待中其他监听器改动请求时保留其改动并放弃旧候选', async () => {
  const f = fixture(), event = prompt(); let release;
  f.setBudget(() => new Promise(resolve => { release = resolve; }));
  f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
  event.chat[0].content += '\n其他监听器刚添加的规则'; const changed = clone(event.chat);
  release(true); await work; assert.deepEqual(event.chat, changed);
});

await check('预算挂起时结束生成立即解除等待，迟到批准不能注入旧请求', async () => {
  const f = fixture(), event = prompt(), before = clone(event.chat); let release;
  f.setBudget(() => new Promise(resolve => { release = resolve; }));
  f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
  assert.equal(typeof release, 'function'); f.api.end();
  const settled = await Promise.race([work.then(() => true), new Promise(resolve => setImmediate(() => resolve(false)))]);
  assert.equal(settled, true, '结束生成必须在预算 Promise 尚未解决时解除 prompt-ready 等待');
  assert.deepEqual(event.chat, before);
  f.setBudget(async () => true); const next = prompt(), expected = f.api.preview();
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(next);
  assert.equal(countText(next.chat, expected.text), 1, '取消后新主请求不能继续被 busy 锁住');
  release(true); await work; await Promise.resolve();
  assert.deepEqual(event.chat, before); assert.equal(countText(next.chat, expected.text), 1);
});

await check('后台生成、关闭开关或卸载也会解除预算等待并拒绝迟到结果', async () => {
  for (const cancel of [f => f.api.foreignStart('background'), f => f.api.setEnabled(false), f => f.api.dispose()]) {
    const f = fixture(), event = prompt(), before = clone(event.chat); let release;
    f.setBudget(() => new Promise(resolve => { release = resolve; }));
    f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
    cancel(f);
    const settled = await Promise.race([work.then(() => true), new Promise(resolve => setImmediate(() => resolve(false)))]);
    assert.equal(settled, true, '取消操作不得被未解决的预算 Promise 阻塞');
    release(true); await work; await Promise.resolve(); assert.deepEqual(event.chat, before);
  }
});

await check('预算等待期间末用户被编辑或新增用户楼层，即使助手状态未变也拒绝', async () => {
  for (const change of [f => { f.messages.at(-1).mes = '玩家已改成另一个行动'; },
    f => { f.messages.push(user('玩家追加的另一条行动')); }]) {
    const f = fixture(), event = prompt(), before = clone(event.chat), assistantBefore = clone(f.messages[0]); let release;
    f.setBudget(() => new Promise(resolve => { release = resolve; }));
    f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
    change(f); assert.deepEqual(f.messages[0], assistantBefore);
    release(true); await work; assert.deepEqual(event.chat, before);
    assert.equal(f.api.getStatus().lastInjection, null);
  }
});

await check('预算批准后重新核对请求归属，期间由匹配变为不匹配时拒绝', async () => {
  const f = fixture(), event = prompt(), before = clone(event.chat); let release, accepted = true, inspections = 0;
  f.setVerifier(() => { inspections++; return accepted; });
  f.setBudget(() => new Promise(resolve => { release = resolve; }));
  f.api.onGeneration('normal', {}, false); const work = f.api.onPromptReady(event);
  assert.equal(inspections, 1); accepted = false; release(true); await work;
  assert.equal(inspections, 2, '预算之后必须再次确认出网请求仍属于该主生成');
  assert.deepEqual(event.chat, before); assert.equal(f.api.getStatus().lastInjection, null);
});

await check('end 与 dispose 使未完成票据失效', async () => {
  const f = fixture(); f.api.onGeneration('normal', {}, false); f.api.end(); await unchanged(f, prompt(), () => {});
  const g = fixture(); g.api.onGeneration('normal', {}, false); g.api.dispose(); await unchanged(g);
});

await check('READY 只建立候选，SETTINGS 浅拷贝通过才记录最近注入', async () => {
  const f = fixture(), event = prompt(), expected = f.api.preview(), originalMessages = [...event.chat];
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  assert.equal(countText(event.chat, expected.text), 1); assert.equal(f.api.getStatus().lastInjection, null);
  const tail = settings(event); assert.notEqual(tail.messages, event.chat);
  tail.messages.forEach((message, index) => assert.equal(message, originalMessages[index]));
  await f.api.onSettingsReady(tail);
  assert.equal(countText(tail.messages, expected.text), 1);
  assert.equal(f.api.getStatus().lastInjection.text, expected.text);
  assert.equal(f.budgets.length, 2);
  assert.deepEqual(f.budgets[1].request, tail, '最终预算必须取得完整发送参数');
});

await check('SETTINGS 没有 READY 候选时永不创建剧情块', async () => {
  const f = fixture(), event = prompt(), before = clone(event.chat);
  f.api.onGeneration('normal', {}, false); await f.api.onSettingsReady(settings(event));
  assert.deepEqual(event.chat, before); assert.equal(f.api.getStatus().lastInjection, null); assert.equal(f.budgets.length, 0);
});

await check('最终事件必须保留原始生成类型，normal 不能替代续写重生成或 swipe', async () => {
  for (const type of ['continue', 'regenerate', 'swipe']) {
    for (const correct of [true, false]) {
      const f = fixture([assistant(state(2, '序章')), user(), assistant(state(3, '序章'))]), event = prompt();
      f.api.onGeneration(type, {}, false); if (type === 'regenerate') f.messages.pop();
      await f.api.onPromptReady(event); const candidate = allText(event.chat);
      assert.ok(candidate.includes('【RK剧情注入:BEGIN】'));
      await f.api.onSettingsReady(settings(event, { type: correct ? type : 'normal' }));
      assert.equal(allText(event.chat).includes('【RK剧情注入:BEGIN】'), correct);
      assert.equal(f.api.getStatus().lastInjection !== null, correct);
    }
  }
});

await check('深复制、消息替换或排序改变无法确认身份，只撤回传入请求的自有块', async () => {
  for (const transform of [messages => clone(messages), messages => messages.map((message, i) => i === 2 ? { ...message } : message),
    messages => [messages[1], messages[0], messages[2]]]) {
    const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
    const tail = settings(event, { messages: transform(event.chat) }); await f.api.onSettingsReady(tail);
    assert.ok(!allText(tail.messages).includes('【RK剧情注入:BEGIN】'));
    assert.ok(allText(tail.messages).includes('玩家正文 <% if (active) { %>保留模板<% } %>'));
    assert.equal(f.api.getStatus().lastInjection, null);
  }
});

await check('READY 后 TH START 会撤回候选，普通或自定义 normal 后台 SETTINGS 都无剧情', async () => {
  for (const mode of ['default', 'custom-normal']) {
    const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
    const tail = settings(event); f.api.foreignStart(mode);
    assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
    await f.api.onSettingsReady(tail); assert.ok(!allText(tail.messages).includes('【RK剧情注入:BEGIN】'));
    assert.equal(f.api.getStatus().lastInjection, null);
    const next = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(next);
    await f.api.onSettingsReady(settings(next)); assert.ok(f.api.getStatus().lastInjection);
  }
});

await check('多个后台 START 和 quiet 插入事件链不会遗留候选或永久锁定', async () => {
  const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  f.api.foreignStart('A'); f.api.foreignStart('B'); f.api.foreignEnd('A');
  f.api.onGeneration('quiet', {}, false); await f.api.onSettingsReady(settings(event, { type: 'quiet' }));
  assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】')); assert.equal(f.api.getStatus().lastInjection, null);
  const next = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(next);
  await f.api.onSettingsReady(settings(next)); assert.ok(f.api.getStatus().lastInjection);
});

await check('迟到的旧 SETTINGS 不得撤销或确认新的 pending', async () => {
  const f = fixture(), first = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(first);
  const late = settings(first, { messages: clone(first.chat) });
  const next = prompt(), expected = f.api.preview(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(next);
  await f.api.onSettingsReady(late);
  assert.ok(!allText(late.messages).includes('【RK剧情注入:BEGIN】'));
  assert.equal(countText(next.chat, expected.text), 1); assert.equal(f.api.getStatus().lastInjection, null);
  await f.api.onSettingsReady(settings(next)); assert.equal(f.api.getStatus().lastInjection.text, expected.text);
});

await check('尾段预算挂起时取消立即完成撤回，迟到批准不影响新请求', async () => {
  const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); let release;
  f.setBudget(() => new Promise(resolve => { release = resolve; })); const work = f.api.onSettingsReady(settings(event));
  assert.equal(typeof release, 'function'); f.api.end();
  const settled = await Promise.race([work.then(() => true), new Promise(resolve => setImmediate(() => resolve(false)))]);
  assert.equal(settled, true); assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
  f.setBudget(async () => true); const next = prompt(), expected = f.api.preview();
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(next); await f.api.onSettingsReady(settings(next));
  release(true); await work; await Promise.resolve();
  assert.equal(f.api.getStatus().lastInjection.text, expected.text); assert.equal(countText(next.chat, expected.text), 1);
  assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
});

await check('后台 START、关闭开关和卸载同样立即取消尾段等待', async () => {
  for (const cancel of [f => f.api.foreignStart('late-background'), f => f.api.setEnabled(false), f => f.api.dispose()]) {
    const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); let release;
    f.setBudget(() => new Promise(resolve => { release = resolve; })); const work = f.api.onSettingsReady(settings(event));
    cancel(f);
    const settled = await Promise.race([work.then(() => true), new Promise(resolve => setImmediate(() => resolve(false)))]);
    assert.equal(settled, true); assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
    release(true); await work; assert.equal(f.api.getStatus().lastInjection, null);
  }
});

await check('旧尾段异步回调收尾时不得清空或撤回新主请求的 pending', async () => {
  const f = fixture(), old = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(old); let release;
  f.setBudget(() => new Promise(resolve => { release = resolve; })); const oldWork = f.api.onSettingsReady(settings(old));
  f.messages[0].variables[0].stat_data = state(2, '序章');
  f.setBudget(async () => true); const next = prompt(); f.api.onGeneration('normal', {}, false);
  await f.api.onPromptReady(next); await oldWork;
  assert.ok(!allText(old.chat).includes('【RK剧情注入:BEGIN】'));
  const expected = f.api.preview(); assert.equal(countText(next.chat, expected.text), 1);
  assert.equal(f.api.getStatus().lastInjection, null);
  release(true); await f.api.onSettingsReady(settings(next));
  assert.equal(f.api.getStatus().lastInjection.volume, 2); assert.equal(countText(next.chat, expected.text), 1);
});

await check('尾段预算期间请求归属由 true 变 false 时撤回候选', async () => {
  const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); let release;
  let accepted = true, inspections = 0; f.setVerifier(() => { inspections++; return accepted; });
  f.setBudget(() => new Promise(resolve => { release = resolve; })); const work = f.api.onSettingsReady(settings(event));
  assert.equal(inspections, 1); accepted = false; release(true); await work;
  assert.equal(inspections, 2); assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
  assert.equal(f.api.getStatus().lastInjection, null);
});

await check('尾段预算期间源变量、活动 swipe、用户正文或楼层变化均撤回候选', async () => {
  for (const change of [f => { f.messages[0].variables[0].stat_data.场景.当前章 = '第一章'; },
    f => { const m = f.messages[0]; m.swipes.push('新候选'); m.variables.push({ stat_data: state(2, '序章') }); m.swipe_id = 1; },
    f => { f.messages.at(-1).mes = '已编辑的用户消息'; }, f => { f.messages.push(user('追加消息')); },
    f => { f.switchChat('chat-B'); }]) {
    const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); let release;
    f.setBudget(() => new Promise(resolve => { release = resolve; })); const work = f.api.onSettingsReady(settings(event));
    change(f); release(true); await work;
    assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】')); assert.equal(f.api.getStatus().lastInjection, null);
  }
});

await check('尾段预算拒绝或请求参数被更新时撤回候选，不留下成功回执', async () => {
  for (const mutate of [null, data => { data.max_tokens = 4096; }]) {
    const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); let release;
    const tail = settings(event); f.setBudget(() => new Promise(resolve => { release = resolve; }));
    const work = f.api.onSettingsReady(tail); if (mutate) mutate(tail); release(!!mutate); await work;
    assert.ok(!allText(tail.messages).includes('【RK剧情注入:BEGIN】')); assert.equal(f.api.getStatus().lastInjection, null);
  }
});

await check('尾段预算等待中其他监听器加字时只撤回自有块，完整保留新增内容', async () => {
  const f = fixture(), event = prompt(); f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  let release; f.setBudget(() => new Promise(resolve => { release = resolve; }));
  const work = f.api.onSettingsReady(settings(event));
  event.chat.at(-1).content += '\n其他监听器追加 <% untouched %> 【另外的块】';
  event.chat[0].content += '\n新的系统规则';
  release(true); await work;
  assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
  assert.ok(event.chat.at(-1).content.includes('玩家正文 <% if (active) { %>保留模板<% } %>'));
  assert.ok(event.chat.at(-1).content.endsWith('其他监听器追加 <% untouched %> 【另外的块】'));
  assert.equal(event.chat[0].content, '宿主系统规则\n新的系统规则');
  assert.equal(f.api.getStatus().lastInjection, null);
});

await check('真实 EJS 在 READY 与 SETTINGS 间原位展开系统和助手模板，候选仍可确认', async () => {
  const f = fixture(), event = prompt();
  event.chat[0].content = '<% if (mode === "自定义角色") { %>当前玩家：<%= playerName %>。<% } else { %>使用原作身份。<% } %>';
  event.chat[1].content = '<% if (known) { %>这位人物已经认识玩家。<% } else { %>保持尚未相识。<% } %>';
  const refs = [...event.chat], expected = f.api.preview();
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  const context = { mode: '自定义角色', playerName: '本局玩家', known: false };
  for (const message of event.chat.slice(0, 2)) message.content = ejs.render(message.content, context);
  assert.equal(event.chat[0].content, '当前玩家：本局玩家。');
  assert.equal(event.chat[1].content, '保持尚未相识。');
  event.chat.forEach((message, index) => assert.equal(message, refs[index]));
  await f.api.onSettingsReady(settings(event));
  assert.equal(countText(event.chat, expected.text), 1); assert.equal(f.api.getStatus().lastInjection.text, expected.text);
  assert.equal(f.budgets[1].chat[0].content, '当前玩家：本局玩家。', '最终预算必须看到实际 EJS 展开结果');
});

await check('SETTINGS 前自有块正文被改写或完整块重复时拒绝并撤回', async () => {
  for (const mutate of [(event, text) => { event.chat.at(-1).content = event.chat.at(-1).content.replace(text, text.replace('正式阶段：进行中', '正式阶段：已结束')); },
    (event, text) => { event.chat[0].content += '\n' + text; }]) {
    const f = fixture(), event = prompt(), expected = f.api.preview();
    f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); mutate(event, expected.text);
    await f.api.onSettingsReady(settings(event));
    assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】'));
    assert.equal(f.api.getStatus().lastInjection, null); assert.equal(f.budgets.length, 1);
  }
});

await check('SETTINGS 前同对象的非剧情内容增补纳入最终预算且保留', async () => {
  const f = fixture(), event = prompt(), expected = f.api.preview();
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  event.chat[0].content += '\n模板展开后的补充规则';
  event.chat[1].content += '\n模板展开后的角色可见信息';
  await f.api.onSettingsReady(settings(event));
  assert.equal(countText(event.chat, expected.text), 1); assert.equal(f.api.getStatus().lastInjection.text, expected.text);
  assert.ok(f.budgets[1].chat[0].content.endsWith('模板展开后的补充规则'));
  assert.ok(f.budgets[1].chat[1].content.endsWith('模板展开后的角色可见信息'));
});

await check('撤回多模态候选保留原文本图片对象和其他监听器追加 part', async () => {
  const content = [{ type: 'text', text: '原始多模态 <% retain %>' }, { type: 'image_url', image_url: { url: 'https://example.invalid/a.png' } }];
  const f = fixture(), event = prompt(content), original = clone(content), refs = [...content];
  f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
  const extra = { type: 'text', text: '其他监听器的附加内容' }; content.push(extra);
  f.api.foreignStart('background'); await f.api.onSettingsReady(settings(event));
  refs.forEach((part, index) => { assert.equal(content[index], part); assert.deepEqual(part, original[index]); });
  assert.equal(content.at(-1), extra); assert.equal(extra.text, '其他监听器的附加内容');
  assert.ok(!allText(event.chat).includes('【RK剧情注入:BEGIN】')); assert.equal(f.api.getStatus().lastInjection, null);
});

await check('取消遇到先前未闭合标记仍删除完整候选，保留坏标记旁正文且不抛错', async () => {
  const orphan = '其他正文【RK剧情注入:BEGIN】未闭合标记后的正文';
  for (const cancel of [f => f.api.foreignStart('background'), f => f.api.end(), f => f.api.dispose()]) {
    for (const place of [(event) => { event.chat[0].content += orphan; },
      (event) => { event.chat.at(-1).content = orphan + event.chat.at(-1).content; }]) {
      const f = fixture(), event = prompt(), expected = f.api.preview();
      f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event); place(event);
      assert.doesNotThrow(() => cancel(f));
      assert.equal(countText(event.chat, expected.text), 0); assert.ok(allText(event.chat).includes(orphan));
      await assert.doesNotReject(f.api.onSettingsReady(settings(event)));
      assert.equal(countText(event.chat, expected.text), 0); assert.ok(allText(event.chat).includes(orphan));
      assert.ok(allText(event.chat).includes('玩家正文 <% if (active) { %>保留模板<% } %>'));
    }
  }
});

await check('未知拷贝或重排请求的坏首消息不会阻止撤回后续完整候选', async () => {
  for (const transform of [messages => clone(messages), messages => [messages[0], messages[2], messages[1]]]) {
    const f = fixture(), event = prompt(), expected = f.api.preview();
    f.api.onGeneration('normal', {}, false); await f.api.onPromptReady(event);
    const tail = settings(event, { messages: transform(event.chat) });
    tail.messages[0].content += '【RK剧情注入:BEGIN】保留不完整前缀';
    await assert.doesNotReject(f.api.onSettingsReady(tail));
    assert.equal(countText(tail.messages, expected.text), 0);
    assert.ok(allText(tail.messages).includes('【RK剧情注入:BEGIN】保留不完整前缀'));
    assert.ok(allText(tail.messages).includes('玩家正文 <% if (active) { %>保留模板<% } %>'));
  }
});

await check('准备阶段仍拒绝嵌套或残缺旧标记，不擅自吞掉相邻正文', async () => {
  for (const text of ['前文【RK剧情注入:BEGIN】未闭合正文',
    '前文【RK剧情注入:BEGIN】中间正文【RK剧情注入:BEGIN】内部块【RK剧情注入:END】尾文']) {
    const f = fixture(); await unchanged(f, prompt(text)); assert.equal(f.budgets.length, 0);
  }
});

const passed = results.filter(result => result.passed).length;
const report = ['# 剧情注入器离线验收', '',
  `结果：${passed}/${results.length} 项通过。`, '',
  '测试通过 VM 加载实际剧情目录和纯工厂，模拟已核实的 SillyTavern context、Tavern Helper 楼层/活动 swipe 与 MVU 接口；不连接酒馆，不发送生成请求。READY 阶段仅验证候选块；SETTINGS 阶段另外验证最终确认或撤回，只有后者成功才有最近注入记录。另使用本地 EJS 3.1.10 引擎验证 READY→SETTINGS 之间的原位模板展开。', '',
  '| 场景 | 结果 |', '|---|---|', ...results.map(result => `| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} |`), '',
  '## 真实宿主仍需验证', '',
  '- prompt-ready 与主生成的归属关联，尤其故事神谕及其他后台请求并发；离线票据测试不构成所有扩展隔离的证明。',
  '- 当前版本事件到达顺序、token 计量器可用性、脚本单实例注册与卸载，以及 EJS 真正启用后的身份模板输出。',
  '- 真实发送、重生成、swipe、续写、切聊天与刷新后的状态和开关持久化。', '',
  ...results.filter(result => !result.passed).flatMap(result => [`## 失败：${result.name}`, '', '```text', result.error, '```', '']),
];
const reportPath = new URL('../output/chapter-v4/injector-test-review.md', import.meta.url);
fs.mkdirSync(new URL('../output/chapter-v4/', import.meta.url), { recursive: true });
fs.writeFileSync(reportPath, report.join('\n') + '\n');
console.log(JSON.stringify({ passed, total: results.length, failures: results.filter(result => !result.passed) }, null, 2));
if (passed !== results.length) process.exitCode = 1;
