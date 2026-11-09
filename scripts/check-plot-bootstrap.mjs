import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inlineStoryCatalog, stripModuleSyntax } from './story-build.mjs';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';

const clone = structuredClone, plain = value => JSON.parse(JSON.stringify(value));
const customArtifact = process.argv[process.argv.indexOf('--artifact') + 1];
const useCustomArtifact = process.argv.includes('--artifact');
const built = process.argv.includes('--built') || useCustomArtifact;
const noWrite = process.argv.includes('--no-write');
const artifactPath = '../世界书规则/MVU/落第骑士-卷章剧情注入器-v3.0.0.json';
const source = built ? JSON.parse(fs.readFileSync(useCustomArtifact ? customArtifact : new URL(artifactPath, import.meta.url), 'utf8')).content
  : `${inlineStoryCatalog({ summaries: true })}\n${stripModuleSyntax(fs.readFileSync(new URL('./rakudai-mvu-structure.mjs', import.meta.url), 'utf8'))}\n${fs.readFileSync(new URL('./rakudai-worldbook-reader.js', import.meta.url), 'utf8')}\n${fs.readFileSync(new URL('./rakudai-plot-runtime.js', import.meta.url), 'utf8')}\n${fs.readFileSync(new URL('./rakudai-plot-bootstrap.js', import.meta.url), 'utf8')}`;
const sourceLabel = built ? '玩家导入产物：' + (useCustomArtifact ? customArtifact : '世界书规则/MVU/落第骑士-卷章剧情注入器-v3.0.0.json') : '实际目录、runtime 和 bootstrap 源码';
assert.equal(typeof source, 'string'); assert.ok(source.trim());
// Verified against installed TH 4.12.0 src/function/event.ts and ST 1.19.0 scripts/events.js.
const nativeEvents = {
  GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
  CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
  CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready',
  GENERATION_ENDED: 'generation_ended', GENERATION_STOPPED: 'generation_stopped', CHAT_CHANGED: 'chat_changed',
};
const helperEvents = { GENERATION_STARTED: 'js_generation_started', GENERATION_ENDED: 'js_generation_ended' };
const results = [];

function fixture({ delayedMvu = false, assistantFloors = 1, completeAsterisk = false } = {}) {
  const state = clone(INITIAL_STATE);
  state.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  state.玩家.姓名 = '测试玩家';
  state.场景 = { ...state.场景, 当前卷: 2, 当前章: '序章', 阶段: '进行中', 时间: '当日傍晚', 地点: '已确认场所', 切入说明: '沿用当前情境' };
  const wrapper = { stat_data: state, external: { preserved: true } };
  const chat = Array.from({ length: assistantFloors }, () => [
    { is_user: false, is_system: false, mes: '已有助手正文', swipe_id: 0, swipes: ['已有助手正文'], variables: [clone(wrapper)] },
    { is_user: true, is_system: false, mes: '玩家新行动', swipe_id: 0, swipes: ['玩家新行动'], variables: [{}] },
  ]).flat();
  const originalChat = clone(chat), chatVariables = { existing: '保留聊天配置' }, bus = new Map(), frames = [];
  const worldEntries = [{ uid: 13, name: '[剧情]第一卷.序章', order: 100, enabled: false, content: '落第正文' }, { uid: 15, name: '[剧情]第一卷.第一章', order: 101, enabled: false, content: '落第正文' }, { uid: 20, name: '[剧情]第二卷.序章', order: 106, enabled: false, content: '落第正文' },
    ...['序章.倏然疾风', '第一章.华焰魔女', '第二章.学战都市', '第三章.凛凛眼神', '第四章.回忆与重逢', '第五章.黑炉魔剑', '第六章.两人的假日', '第七章.解放者']
      .map((title, i) => ({ uid: 200 + i, name: '[剧情]第一卷.' + title, order: 200 + i, enabled: false, content: '学战正文 ' + title.split('.')[0] }))];
  if (completeAsterisk) worldEntries.push(
    { uid: 208, name: '[剧情]第一卷.终章.并肩之誓', order: 208, enabled: false, content: '学战正文 终章' },
    ...['第一章.六花园会议', '第二章.昏枭暗跃', '第三章.疾风刃雷', '第四章.错综的思绪', '第五章.少女素颜', '第六章.雾中魔手', '第七章.决意与决斗', '终章.蜀山组队']
      .map((title, i) => ({ uid: 209 + i, name: '[剧情]第二卷.' + title, order: 209 + i, enabled: false, content: '学战正文 第二卷·' + title.split('.')[0] })),
  );
  const calls = { wait: [], mvuReads: [], worldbookReads: [], variableReads: [], variableWrites: [], tokenCounts: [], generation: 0, mvuWrites: 0, contextReads: 0 };
  const forbiddenGeneration = () => { calls.generation++; throw new Error('测试期间不得主动触发生成'); };
  const context = {
    chat, chatId: 'real-host-chat', getCurrentChatId: () => 'real-host-chat', characterId: 7, groupId: null,
    chatCompletionSettings: { openai_max_context: 16384, openai_max_tokens: 1024 },
    getTokenCountAsync: async text => { calls.tokenCounts.push(text); return 300; }, generate: forbiddenGeneration,
  };
  const top = { SillyTavern: { getContext: () => { calls.contextReads++; return context; } } };
  const parent = { SillyTavern: { getContext: () => { throw new Error('不应使用中间 iframe 的代理 context'); } }, top };
  const mvu = {
    isDuringExtraAnalysis: () => false,
    getMvuData(options) {
      assert.equal(options.type, 'message'); assert.equal(chat[options.message_id]?.is_user, false);
      calls.mvuReads.push(clone(options)); return clone(chat[options.message_id].variables[0]);
    },
    replaceMvuData() { calls.mvuWrites++; throw new Error('启动和预览不得改写 MVU'); },
  };
  let registryMvu = delayedMvu ? undefined : mvu;
  function listenerCount() { return [...bus.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
  async function emit(name, ...args) {
    for (const registration of [...(bus.get(name) || [])]) await registration.callback(...args);
  }
  function frame(name, { namespaced = false } = {}) {
    const domEvents = new Map(); let resolveMvu;
    const W = {
      top, parent, SillyTavern: { getContext: () => { throw new Error('TH iframe 自身也提供 SillyTavern，但不应被选作宿主'); } },
      tavern_events: clone(nativeEvents), iframe_events: clone(helperEvents),
      addEventListener(event, callback) { if (!domEvents.has(event)) domEvents.set(event, new Set()); domEvents.get(event).add(callback); },
      removeEventListener(event, callback) { domEvents.get(event)?.delete(callback); },
    };
    const helpers = {
      waitGlobalInitialized(globalName) {
        assert.equal(globalName, 'Mvu'); calls.wait.push(name);
        // TH installs a per-iframe dynamic getter. MVU need not exist on top/window now.
        Object.defineProperty(W, globalName, { configurable: true, get: () => registryMvu });
        return registryMvu ? Promise.resolve() : new Promise(resolve => { resolveMvu = resolve; });
      },
      getChatMessages(range, options) {
        assert.equal(range, `0-${chat.length - 1}`); assert.equal(options.role, 'assistant'); assert.equal(options.include_swipes, true);
        return chat.flatMap((message, messageId) => message.is_user ? [] : [{ message_id: messageId, role: 'assistant', name: '助手', is_hidden: false, swipe_id: 0,
          swipes: clone(message.swipes), swipes_data: clone(message.variables), swipes_info: [{}] }]);
      },
      getVariables(options) { assert.equal(options.type, 'chat'); calls.variableReads.push(clone(options)); return clone(chatVariables); },
      updateVariablesWith(update, options) {
        assert.equal(options.type, 'chat'); const next = update(clone(chatVariables));
        assert.equal(typeof next?.then, 'undefined'); Object.assign(chatVariables, next);
        calls.variableWrites.push({ options: clone(options), value: clone(next) }); return next;
      },
      eventOn(event, callback) {
        assert.ok([...Object.values(nativeEvents), helperEvents.GENERATION_STARTED].includes(event), `未知事件 ${event}`);
        if (!bus.has(event)) bus.set(event, new Set());
        const registration = { owner: name, callback }; bus.get(event).add(registration);
        return { stop: () => bus.get(event)?.delete(registration) };
      },
      generate: forbiddenGeneration, generateRaw: forbiddenGeneration,
      getCharWorldbookNames: async () => ({ primary: '落第骑士英雄谭' }),
      getWorldbook: async name => {
        calls.worldbookReads.push(name);
        return clone(worldEntries);
      },
    };
    if (namespaced) W.TavernHelper = helpers; else Object.assign(W, helpers);
    const logs = [];
    const realm = vm.createContext({ window: W, structuredClone, setTimeout, clearTimeout,
      console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) } });
    const result = { W, realm, logs, domEvents, publish: () => resolveMvu?.(),
      install: () => vm.runInContext(source, realm, { filename: `plot-bootstrap-${name}.js` }),
      pagehide: () => { for (const callback of [...(domEvents.get('pagehide') || [])]) callback(); } };
    frames.push(result); return result;
  }
  return { top, parent, context, chat, originalChat, calls, bus, chatVariables, worldEntries, frame, emit, listenerCount,
    publishMvu: async () => { registryMvu = mvu; frames.forEach(item => item.publish()); await Promise.resolve(); },
    prompt: () => ({ chat: [{ role: 'system', content: '系统规则' }, { role: 'assistant', content: '已有助手正文' },
      { role: 'user', content: '玩家新行动' }], dryRun: false }),
  };
}

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack || String(error) }); }
}

await check('TH iframe 也有 SillyTavern 时仍向最外层宿主发布唯一 API', async () => {
  const f = fixture(), script = f.frame('script-A'); script.install();
  assert.equal(f.top.__RK_PLOT_V3__?.version, '3.0.0');
  assert.equal(script.W.__RK_PLOT_V3__, undefined); assert.equal(f.parent.__RK_PLOT_V3__, undefined);
  assert.equal((await f.top.__RK_PLOT_V3__.preview()).volume, 2); assert.ok(f.calls.contextReads > 0);
  assert.equal(f.listenerCount(), 7); assert.deepEqual(f.calls.wait, ['script-A']); script.pagehide();
});

await check('MVU 后加载时每个 iframe 的 wait 安装动态 getter，预览恢复真实卷章', async () => {
  const f = fixture({ delayedMvu: true }), script = f.frame('late-MVU'); script.install();
  assert.equal(f.top.Mvu, undefined, 'MVU 仅在共享注册表中提供，不伪装成宿主直接属性');
  assert.equal(script.W.Mvu, undefined); await assert.rejects(f.top.__RK_PLOT_V3__.preview(), /MVU/);
  await f.publishMvu(); const preview = await f.top.__RK_PLOT_V3__.preview();
  assert.equal(preview.volume, 2); assert.equal(preview.chapter, '序章');
  assert.deepEqual(plain(preview.source), { chatId: 'real-host-chat', messageId: 0, swipeId: 0 });
  assert.equal(f.listenerCount(), 7); script.pagehide();
});

await check('跨 iframe 热重装移除旧监听，旧 pagehide 不会删除新 API', async () => {
  const f = fixture({ delayedMvu: true }), first = f.frame('first'); first.install(); const oldApi = f.top.__RK_PLOT_V3__;
  const second = f.frame('second', { namespaced: true }); second.install(); const newApi = f.top.__RK_PLOT_V3__;
  assert.notEqual(newApi, oldApi); assert.equal(f.listenerCount(), 7);
  assert.ok([...f.bus.values()].every(listeners => [...listeners].every(item => item.owner === 'second')));
  assert.deepEqual(f.calls.wait, ['first', 'second']); first.pagehide(); assert.equal(f.top.__RK_PLOT_V3__, newApi);
  await f.publishMvu(); assert.equal((await newApi.preview()).volume, 2);
  second.pagehide(); assert.equal(f.listenerCount(), 0); assert.equal(f.top.__RK_PLOT_V3__, undefined);
});

await check('实际事件总线仅形成一次候选和一次尾确认，启动不发送模型请求', async () => {
  const f = fixture(), script = f.frame('event-flow'); script.install(); const event = f.prompt();
  assert.equal(f.calls.tokenCounts.length, 0); assert.equal(f.calls.generation, 0);
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
  assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
  const request = { type: 'normal', messages: [...event.chat], max_tokens: 512 };
  await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
  assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection.volume, 2);
  assert.equal(event.chat.at(-1).content.split('【RK剧情注入:BEGIN】').length - 1, 1);
  assert.equal(f.calls.tokenCounts.length, 2); assert.equal(f.calls.generation, 0);
  assert.equal(f.calls.variableWrites.length, 0); assert.equal(f.calls.mvuWrites, 0); assert.deepEqual(f.chat, f.originalChat);
  script.pagehide();
});

await check('TH START 实际常量触发撤回，缺 END 后下一原生主生成仍可确认', async () => {
  const f = fixture(), script = f.frame('foreign-flow'); script.install(); const event = f.prompt();
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
  await f.emit(helperEvents.GENERATION_STARTED, 'helper-request');
  await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
  assert.ok(!event.chat.at(-1).content.includes('【RK剧情注入:BEGIN】'));
  const next = f.prompt(); await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, next);
  await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...next.chat] });
  assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection.volume, 2); script.pagehide();
});

await check('卸载撤回未确认候选，所有事件监听解除且不改聊天存档', async () => {
  const f = fixture(), script = f.frame('unload'); script.install(); const event = f.prompt();
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event); script.pagehide();
  assert.ok(!event.chat.at(-1).content.includes('【RK剧情注入:BEGIN】'));
  assert.equal(f.listenerCount(), 0); assert.equal(f.top.__RK_PLOT_V3__, undefined);
  const count = f.calls.tokenCounts.length; await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
  assert.equal(f.calls.tokenCounts.length, count); assert.deepEqual(f.chat, f.originalChat);
  assert.equal(f.calls.mvuWrites, 0); assert.equal(f.calls.variableWrites.length, 0); assert.equal(f.calls.generation, 0);
});

await check('MVU 等待尚未完成即卸载，迟到就绪不会重新安装监听', async () => {
  const f = fixture({ delayedMvu: true }), script = f.frame('late-after-unload'); script.install(); script.pagehide();
  await f.publishMvu(); assert.equal(f.listenerCount(), 0); assert.equal(f.top.__RK_PLOT_V3__, undefined);
  assert.equal(f.calls.mvuReads.length, 0); assert.equal(f.calls.generation, 0); assert.deepEqual(f.chat, f.originalChat);
});

const marker = '【RK剧情注入:BEGIN】';
const textOf = event => event.chat.map(message => message.content).join('\n');

for (const [name, world] of [['明确未选择', null], ['非法作品', 'unknown-world']]) {
  await check(`${name}即使带有合法落第卷章，实际预览与生成均不读取或注入落第世界书`, async () => {
    const f = fixture(), script = f.frame(`world-${String(world)}`);
    f.chat[0].variables[0].stat_data.系统.作品 = world;
    const before = clone(f.chat), event = f.prompt(), promptBefore = clone(event.chat);
    script.install();
    await assert.rejects(f.top.__RK_PLOT_V3__.preview(), /尚未确认作品/);
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    const request = { type: 'normal', messages: [...event.chat] };
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.deepEqual(f.calls.worldbookReads, []);
    assert.deepEqual(event.chat, promptBefore); assert.deepEqual(request.messages, promptBefore);
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
    assert.match(f.top.__RK_PLOT_V3__.getStatus().reason, /尚未确认作品/);
    assert.equal(f.calls.tokenCounts.length, 0); assert.equal(f.calls.generation, 0);
    assert.equal(f.calls.mvuWrites, 0); assert.equal(f.calls.variableWrites.length, 0);
    assert.deepEqual(f.chat, before); script.pagehide();
  });
}

await check('学战按 order 200–207 注入本章原文，保留卷 null；奇偶两种发送位置均通过尾确认', async () => {
  const chapters = ['序章', '第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章'];
  for (const assistantFloors of [1, 2]) for (const [index, chapter] of chapters.entries()) {
    const f = fixture({ assistantFloors }), script = f.frame(`asterisk-${assistantFloors}-${index}`);
    const state = f.chat.at(-2).variables[0].stat_data;
    state.系统.作品 = 'asterisk'; state.场景.当前卷 = null; state.场景.当前章 = chapter;
    const before = clone(f.chat); script.install();
    const preview = await f.top.__RK_PLOT_V3__.preview();
    assert.equal(preview.entryOrder, 200 + index); assert.ok(preview.text.includes('学战正文 ' + chapter));
    assert.ok(!preview.text.includes('落第正文'));
    if (chapter === '第七章') {
      assert.match(preview.text, /208/); assert.match(preview.text, /不自动切章/);
      assert.ok(!preview.text.includes('"value":"终章"'));
    } else assert.ok(preview.text.includes('"value":"' + chapters[index + 1] + '"'));
    const event = f.prompt();
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    const status = f.top.__RK_PLOT_V3__.getStatus();
    assert.equal(status.lastInjection?.entryOrder, 200 + index);
    assert.equal(status.lastInjection?.placement, assistantFloors === 1 ? 'append-user' : 'standalone-user');
    assert.equal(textOf(event).split(marker).length - 1, 1);
    assert.ok(!textOf(event).includes('落第正文'));
    assert.equal(f.calls.mvuWrites, 0); assert.equal(f.calls.variableWrites.length, 0); assert.equal(f.calls.generation, 0);
    assert.deepEqual(f.chat, before); script.pagehide();
  }
});

await check('学战 208 跨入 209、二卷独立定位与 216 终点，奇偶发送均保留完整章名及卷 null', async () => {
  const cases = [
    { chapter: '终章', order: 208, volume: 1, next: '第二卷·第一章' },
    { chapter: '第二卷·第一章', order: 209, volume: 2, next: '第二卷·第二章' },
    { chapter: '第二卷·终章', order: 216, volume: 2, next: null },
  ];
  for (const assistantFloors of [1, 2]) for (const item of cases) {
    const f = fixture({ assistantFloors, completeAsterisk: true }), script = f.frame(`asterisk-volume2-${assistantFloors}-${item.order}`);
    const state = f.chat.at(-2).variables[0].stat_data;
    state.系统.作品 = 'asterisk'; state.场景.当前卷 = null; state.场景.当前章 = item.chapter;
    const before = clone(f.chat); script.install();
    const preview = await f.top.__RK_PLOT_V3__.preview();
    assert.equal(preview.volume, item.volume); assert.equal(preview.chapter, item.chapter);
    assert.equal(preview.entryOrder, item.order);
    assert.ok(preview.text.includes('学战正文 ' + item.chapter));
    assert.ok(!preview.text.includes('落第正文'));
    if (item.volume === 2) {
      assert.ok(!preview.text.includes('学战正文 第一章'));
      assert.doesNotMatch(preview.text, /当前剧情节点：学战 第一卷/);
      assert.ok(preview.entryName.startsWith('[剧情]第二卷.'));
    }
    const patch = item.next
      ? [{ op: 'replace', path: '/场景/当前章', value: item.next }, { op: 'replace', path: '/场景/阶段', value: '进行中' }]
      : [{ op: 'replace', path: '/场景/阶段', value: '已结束' }];
    assert.ok(preview.text.includes(JSON.stringify(patch)));
    assert.ok(!preview.text.includes('"path":"/场景/当前卷"'));
    if (!item.next) assert.ok(!preview.text.includes('"path":"/场景/当前章"'));
    const event = f.prompt();
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    const last = f.top.__RK_PLOT_V3__.getStatus().lastInjection;
    assert.equal(last?.entryOrder, item.order); assert.equal(last?.volume, item.volume); assert.equal(last?.chapter, item.chapter);
    assert.equal(last?.placement, assistantFloors === 1 ? 'append-user' : 'standalone-user');
    assert.equal(textOf(event).split(marker).length - 1, 1);
    assert.equal(f.calls.mvuWrites, 0); assert.equal(f.calls.variableWrites.length, 0); assert.equal(f.calls.generation, 0);
    assert.deepEqual(f.chat, before); script.pagehide();
  }
});

await check('学战缺少第二卷 209 时只完成 208，不输出跨卷或卷号补丁', async () => {
  const f = fixture({ completeAsterisk: true }), script = f.frame('asterisk-missing-volume2');
  f.worldEntries.splice(f.worldEntries.findIndex(entry => entry.order === 209), 1);
  const state = f.chat[0].variables[0].stat_data;
  state.系统.作品 = 'asterisk'; state.场景.当前卷 = null; state.场景.当前章 = '终章';
  const before = clone(f.chat); script.install();
  const preview = await f.top.__RK_PLOT_V3__.preview();
  assert.equal(preview.entryOrder, 208); assert.match(preview.text, /209/); assert.match(preview.text, /不自动切章/);
  assert.ok(preview.text.includes('[{"op":"replace","path":"/场景/阶段","value":"已结束"}]'));
  assert.ok(!preview.text.includes('"path":"/场景/当前章"')); assert.ok(!preview.text.includes('"path":"/场景/当前卷"'));
  const event = f.prompt();
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
  await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
  assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.entryOrder, 208);
  assert.equal(f.calls.mvuWrites, 0); assert.equal(f.calls.variableWrites.length, 0); assert.equal(f.calls.generation, 0);
  assert.deepEqual(f.chat, before); script.pagehide();
});

await check('学战条目标题卷章与 order 错位时拒绝注入，不再把二卷一章标为一卷终章', async () => {
  const f = fixture({ completeAsterisk: true }), script = f.frame('asterisk-misaligned-entry');
  f.worldEntries.find(entry => entry.order === 208).name = '[剧情]第二卷.第一章.六花园会议';
  const state = f.chat[0].variables[0].stat_data;
  state.系统.作品 = 'asterisk'; state.场景.当前卷 = null; state.场景.当前章 = '终章';
  script.install();
  await assert.rejects(f.top.__RK_PLOT_V3__.preview());
  const event = f.prompt(), before = clone(event.chat);
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
  await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
  assert.deepEqual(event.chat, before); assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
  assert.equal(f.calls.mvuWrites, 0); assert.equal(f.calls.variableWrites.length, 0); assert.equal(f.calls.generation, 0);
  script.pagehide();
});

await check('学战未知章名与缺失终章给出失败原因，不能回退注入落第剧情', async () => {
  for (const chapter of ['入学报到', '终章']) {
    const f = fixture(), script = f.frame('asterisk-missing-' + chapter);
    const state = f.chat[0].variables[0].stat_data;
    state.系统.作品 = 'asterisk'; state.场景.当前卷 = null; state.场景.当前章 = chapter;
    script.install();
    await assert.rejects(f.top.__RK_PLOT_V3__.preview(), chapter === '终章' ? /208/ : /正式卷章/);
    const event = f.prompt(), before = clone(event.chat);
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.deepEqual(event.chat, before); assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
    script.pagehide();
  }
});

await check('学战下一章在发送前被删除、开启自动触发或改正文时撤回过期推进提示', async () => {
  for (const change of ['delete', 'enable', 'edit']) {
    const f = fixture(), script = f.frame('asterisk-next-' + change);
    const state = f.chat[0].variables[0].stat_data;
    state.系统.作品 = 'asterisk'; state.场景.当前卷 = null; state.场景.当前章 = '序章';
    script.install(); const event = f.prompt();
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    assert.ok(textOf(event).includes(marker));
    const index = f.worldEntries.findIndex(entry => entry.order === 201);
    if (change === 'delete') f.worldEntries.splice(index, 1);
    else if (change === 'enable') f.worldEntries[index].enabled = true;
    else f.worldEntries[index].content += ' updated';
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.ok(!textOf(event).includes(marker)); assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
    assert.match(f.top.__RK_PLOT_V3__.getStatus().reason, /发送前.*变化/); script.pagehide();
  }
});

await check('新中性待建档与旧未标作品待建档均不读取落第世界书', async () => {
  for (const legacy of [false, true]) {
    const f = fixture(), script = f.frame(`unselected-${legacy}`);
    f.chat[0].variables[0].stat_data = clone(INITIAL_STATE);
    if (legacy) {
      delete f.chat[0].variables[0].stat_data.系统.作品;
      f.chat[0].variables[0].stat_data.场景.当前卷 = 1;
    }
    const before = clone(f.chat), event = f.prompt(), promptBefore = clone(event.chat);
    script.install();
    await assert.rejects(f.top.__RK_PLOT_V3__.preview(), /尚未建档/);
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.deepEqual(f.calls.worldbookReads, []); assert.deepEqual(event.chat, promptBefore);
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
    assert.deepEqual(f.chat, before); script.pagehide();
  }
});

await check('未标作品的已建档旧 v4 仍按落第读取当前世界书并完成发送确认', async () => {
  const f = fixture(), script = f.frame('legacy-rakudai'); script.install();
  assert.equal(Object.hasOwn(f.chat[0].variables[0].stat_data.系统, '作品'), false);
  const event = f.prompt();
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
  await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
  assert.ok(f.calls.worldbookReads.length > 0);
  assert.ok(f.calls.worldbookReads.every(name => name === '落第骑士英雄谭'));
  assert.equal(textOf(event).split(marker).length - 1, 1);
  assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.volume, 2);
  assert.deepEqual(f.chat, f.originalChat); script.pagehide();
});

for (const stage of ['before-prompt', 'candidate-ready']) {
  await check(`生成后在 ${stage} 切为学战，两种奇偶位置均不发送落第剧情`, async () => {
    for (const assistantFloors of [1, 2]) {
      const f = fixture({ assistantFloors }), script = f.frame(`world-switch-${stage}-${assistantFloors}`);
      script.install();
      const event = f.prompt(), originalMessages = [...event.chat], originalText = event.chat.map(message => message.content);
      await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
      if (stage === 'candidate-ready') {
        await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
        assert.ok(textOf(event).includes(marker), '必须先产生真正的落第候选，再验证撤回');
        assert.ok(f.calls.worldbookReads.length > 0);
      }
      // The active MVU slot changes without replacing the chat or message objects.
      f.chat.at(-2).variables[0].stat_data.系统.作品 = 'asterisk';
      const afterSwitch = clone(f.chat);
      if (stage === 'before-prompt') await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
      const request = { type: 'normal', messages: [...event.chat] };
      await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
      if (stage === 'before-prompt') {
        // Before the state snapshot, the current world may be selected anew.
        assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.entryOrder, 200);
        assert.ok(textOf(event).includes('学战正文'));
        assert.ok(!textOf(event).includes('落第正文'));
        assert.deepEqual(f.chat, afterSwitch); script.pagehide(); continue;
      }
      assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
      for (const messages of [event.chat, request.messages]) {
        assert.equal(messages.length, originalMessages.length, '撤回独立剧情消息不能遗留空 user');
        originalMessages.forEach((message, index) => {
          assert.equal(messages[index], message);
          assert.equal(messages[index].content.trim(), originalText[index]);
        });
        assert.ok(!textOf({ chat: messages }).includes(marker));
      }
      assert.deepEqual(f.chat, afterSwitch);
      script.pagehide();
    }
  });
}

async function dryPreview(f, { optionsFlag = false } = {}) {
  const preview = { ...f.prompt(), dryRun: true }, before = clone(preview.chat);
  await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', optionsFlag ? { dryRun: true } : {}, !optionsFlag);
  await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, preview);
  assert.deepEqual(preview.chat, before, '预览请求自身不能获得剧情');
}

await check('初始预览只读且保留等待主生成状态，两种 dryRun 标志均有效', async () => {
  const f = fixture(), script = f.frame('initial-preview'); script.install();
  const before = plain(f.top.__RK_PLOT_V3__.getStatus());
  await dryPreview(f);
  await dryPreview(f, { optionsFlag: true });
  assert.deepEqual(plain(f.top.__RK_PLOT_V3__.getStatus()), before);
  assert.equal(f.calls.tokenCounts.length, 0);
  assert.deepEqual(f.chat, f.originalChat); script.pagehide();
});

await check('奇偶助手楼层分别追加 user 与新增尾消息，只在本次请求注入', async () => {
  for (const assistantFloors of [1, 2]) {
    const f = fixture({ assistantFloors }), script = f.frame(`parity-${assistantFloors}`); script.install();
    const event = f.prompt(), length = event.chat.length, lastUser = event.chat.at(-1), originalUser = lastUser.content;
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection.placement, assistantFloors === 1 ? 'append-user' : 'standalone-user');
    assert.equal(event.chat.length, length + (assistantFloors === 2 ? 1 : 0));
    assert.equal(textOf(event).split(marker).length - 1, 1);
    if (assistantFloors === 2) { assert.equal(lastUser.content, originalUser); assert.equal(event.chat.at(-1).role, 'user'); }
    else { assert.equal(event.chat.at(-1), lastUser); assert.ok(lastUser.content.startsWith(originalUser)); }
    assert.deepEqual(f.chat, f.originalChat); script.pagehide();
  }
});

await check('奇偶位置均清理请求中的旧完整剧情块，保留消息对象与非剧情文本', async () => {
  for (const assistantFloors of [1, 2]) {
    for (const role of ['system', 'user']) {
      const f = fixture({ assistantFloors }), script = f.frame(`stale-${assistantFloors}-${role}`); script.install();
      const event = f.prompt(), stale = { role, content: `旧块前正常文案\n${marker}\n过期章节正文\n【RK剧情注入:END】\n旧块后正常文案` };
      event.chat.unshift(stale);
      const originalArray = event.chat, originalMessages = [...event.chat];
      await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
      await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
      await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
      assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.volume, 2, `助手数 ${assistantFloors}，旧块位置 ${role}`);
      assert.equal(event.chat, originalArray);
      originalMessages.forEach((message, index) => assert.equal(event.chat[index], message));
      assert.equal(stale.content, '旧块前正常文案\n\n旧块后正常文案');
      assert.equal(textOf(event).split(marker).length - 1, 1);
      assert.ok(!textOf(event).includes('过期章节正文'));
      assert.deepEqual(f.chat, f.originalChat); script.pagehide();
    }
  }
});

for (const stage of ['before-prompt', 'candidate-ready']) {
  await check(`dryRun 在 ${stage} 不取消正式生成，两种奇偶位置均保留`, async () => {
    for (const assistantFloors of [1, 2]) {
      for (const optionsFlag of [false, true]) {
        const f = fixture({ assistantFloors }), script = f.frame(`preview-${stage}`); script.install();
        const event = f.prompt();
        await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        if (stage === 'candidate-ready') await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
        const reason = f.top.__RK_PLOT_V3__.getStatus().reason;
        await dryPreview(f, { optionsFlag });
        assert.equal(f.top.__RK_PLOT_V3__.getStatus().reason, reason, '预览不得覆盖正式请求诊断');
        if (stage === 'before-prompt') await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
        await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
        assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.volume, 2);
        assert.equal(textOf(event).split(marker).length - 1, 1); script.pagehide();
      }
    }
  });
}

for (const stage of ['prompt-budget', 'settings-budget']) {
  await check(`dryRun 在 ${stage} 等待中不能撤回正式剧情`, async () => {
    const f = fixture({ assistantFloors: 2 }), script = f.frame(stage); script.install(); const event = f.prompt();
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    if (stage === 'settings-budget') await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    let started, release;
    const entered = new Promise(resolve => { started = resolve; });
    f.context.getTokenCountAsync = () => { started(); return new Promise(resolve => { release = resolve; }); };
    const work = stage === 'prompt-budget'
      ? f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event)
      : f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    await entered;
    await dryPreview(f);
    release(300); await work;
    assert.ok(textOf(event).includes(marker), `预览撤回了 ${stage} 中的正式剧情：${f.top.__RK_PLOT_V3__.getStatus().reason}`);
    f.context.getTokenCountAsync = async () => 300;
    if (stage === 'prompt-budget') await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.volume, 2); script.pagehide();
  });
}

await check('预览不覆盖正式注入成功或预算失败的记录', async () => {
  for (const success of [true, false]) {
    const f = fixture(), script = f.frame(`status-${success}`); script.install(); const event = f.prompt();
    if (!success) f.context.chatCompletionSettings.openai_max_context = 1;
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    const before = plain(f.top.__RK_PLOT_V3__.getStatus());
    assert.equal(Boolean(before.lastInjection), success);
    if (!success) assert.match(before.reason, /预算/);
    await dryPreview(f);
    assert.deepEqual(plain(f.top.__RK_PLOT_V3__.getStatus()), before); script.pagehide();
  }
});

await check('默认生成类型与 normal 语义一致，空类型不会在发送前被撤回', async () => {
  for (const type of [undefined, null, '', 'normal']) {
    for (const settingsType of [undefined, null, '', 'normal']) {
      const f = fixture(), script = f.frame('default-type'); script.install(); const event = f.prompt();
      await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, type, {}, false);
      await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
      await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: settingsType, messages: [...event.chat] });
      assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection?.volume, 2, `${String(type)} -> ${String(settingsType)}`);
      assert.equal(textOf(event).split(marker).length - 1, 1); script.pagehide();
    }
  }
});

await check('continue 与 normal 不混淆，quiet 与未知后台仍没有剧情', async () => {
  for (const type of ['continue', 'quiet', 'unrecognized-background']) {
    const f = fixture(), script = f.frame(`type-${type}`); script.install(); const event = f.prompt();
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, type, {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
    assert.ok(!textOf(event).includes(marker)); script.pagehide();
  }
});

await check('奇偶候选撤回保留其他监听器追加到同一消息的正常文字', async () => {
  for (const assistantFloors of [1, 2]) {
    const f = fixture({ assistantFloors }), script = f.frame(`cancel-extra-${assistantFloors}`); script.install();
    const event = f.prompt(), lastPlayer = event.chat.at(-1), playerText = lastPlayer.content;
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    const augmented = event.chat.at(-1);
    augmented.content += '\n其他监听器追加的正常文字';
    await f.emit(helperEvents.GENERATION_STARTED, 'background');
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, { type: 'normal', messages: [...event.chat] });
    assert.ok(event.chat.includes(augmented), `助手数 ${assistantFloors}：撤回时删除了含其他内容的消息`);
    assert.ok(augmented.content.includes('其他监听器追加的正常文字'));
    assert.ok(!textOf(event).includes(marker));
    assert.ok(lastPlayer.content.startsWith(playerText));
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
    assert.deepEqual(f.chat, f.originalChat); script.pagehide();
  }
});

await check('奇偶候选均使用独立顺序快照，源数组原地重排不能获得发送确认', async () => {
  for (const assistantFloors of [1, 2]) {
    const f = fixture({ assistantFloors }), script = f.frame(`reorder-${assistantFloors}`); script.install();
    const event = f.prompt();
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    event.chat.reverse();
    const request = { type: 'normal', messages: [...event.chat] };
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null, `助手数 ${assistantFloors}：原地重排被误确认`);
    assert.ok(!textOf({ chat: request.messages }).includes(marker));
    assert.match(f.top.__RK_PLOT_V3__.getStatus().reason, /身份不符/);
    assert.deepEqual(f.chat, f.originalChat); script.pagehide();
  }
});

await check('宿主先浅复制请求再取消，两种奇偶位置都不遗留旧剧情块或空 user', async () => {
  for (const assistantFloors of [1, 2]) {
    for (const cancelEvent of [nativeEvents.GENERATION_STOPPED, helperEvents.GENERATION_STARTED]) {
      const f = fixture({ assistantFloors }), script = f.frame(`copied-cancel-${assistantFloors}`); script.install();
      const event = f.prompt(), originalMessages = [...event.chat];
      await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
      await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
      // Mirror createGenerationParameters: a new array retaining the original objects.
      const request = { type: 'normal', messages: event.chat.filter(message => message && typeof message === 'object') };
      await f.emit(cancelEvent, 'background');
      await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
      assert.equal(request.messages.length, originalMessages.length, `助手数 ${assistantFloors}：取消后保留了新增尾消息`);
      originalMessages.forEach((message, index) => assert.equal(request.messages[index], message));
      assert.ok(!textOf({ chat: request.messages }).includes(marker));
      assert.ok(!request.messages.some(message => message.role === 'user' && !message.content.trim()));
      assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null);
      assert.deepEqual(f.chat, f.originalChat); script.pagehide();
    }
  }
});

await check('撤回只清理注入器新建消息，原有空 user 即使被追加剧情也保持原对象', async () => {
  for (const assistantFloors of [1, 2]) {
    const f = fixture({ assistantFloors }), script = f.frame(`empty-original-${assistantFloors}`); script.install();
    const event = f.prompt(), originalEmpty = event.chat.at(-1);
    originalEmpty.content = '';
    const untouchedEmpty = { role: 'user', content: '' };
    event.chat.unshift(untouchedEmpty);
    const originalMessages = [...event.chat];
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    const request = { type: 'normal', messages: [...event.chat] };
    await f.emit(helperEvents.GENERATION_STARTED, 'background');
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(request.messages.length, originalMessages.length, `助手数 ${assistantFloors}：原有空 user 被删除`);
    originalMessages.forEach((message, index) => assert.equal(request.messages[index], message));
    assert.equal(originalEmpty.content.trim(), ''); assert.equal(untouchedEmpty.content, '');
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null); script.pagehide();
  }
});

await check('独立 user 转为 text parts 后撤回，保留额外文字并删除纯剧情尾消息', async () => {
  for (const withExtra of [false, true]) {
    const f = fixture({ assistantFloors: 2 }), script = f.frame(`array-cancel-${withExtra}`); script.install();
    const event = f.prompt(), originalLength = event.chat.length;
    await f.emit(nativeEvents.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await f.emit(nativeEvents.CHAT_COMPLETION_PROMPT_READY, event);
    const standalone = event.chat.at(-1), plotPart = { type: 'text', text: standalone.content };
    const extraPart = { type: 'text', text: '其他监听器保留的文字 part' };
    standalone.content = [plotPart, ...(withExtra ? [extraPart] : [])];
    const request = { type: 'normal', messages: [...event.chat] };
    await f.emit(helperEvents.GENERATION_STARTED, 'background');
    await f.emit(nativeEvents.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(request.messages.length, originalLength + (withExtra ? 1 : 0));
    if (withExtra) {
      assert.equal(request.messages.at(-1), standalone);
      assert.equal(standalone.content[0], plotPart); assert.equal(standalone.content[1], extraPart);
      assert.equal(plotPart.text, ''); assert.equal(extraPart.text, '其他监听器保留的文字 part');
    } else assert.ok(!request.messages.includes(standalone));
    assert.equal(f.top.__RK_PLOT_V3__.getStatus().lastInjection, null); script.pagehide();
  }
});

await check('getStatus.reason 公开修订号，旧终端只读取 reason 也能核对实际实例', () => {
  const f = fixture(), script = f.frame('visible-revision'); script.install();
  const status = f.top.__RK_PLOT_V3__.getStatus();
  assert.equal(status.revision, '20261109.1');
  assert.ok(status.reason.startsWith('注入器修订 ' + status.revision + '。'));
  script.pagehide();
});

const failed = results.filter(result => !result.passed), passed = results.length - failed.length;
const report = ['# 剧情注入器宿主适配离线验收', '', `结果：${passed}/${results.length} 项通过。`, '',
  `VM 加载${sourceLabel}。宿主、父 iframe 和脚本 iframe 同时提供 SillyTavern；模拟 TH 按 iframe 安装 MVU 动态 getter 的等待接口。事件常量核对本机 TH 4.12.0 / ST 1.19.0 源码。没有连接实机或发送模型请求。`, '',
  '| 场景 | 结果 |', '|---|---|', ...results.map(result => `| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} |`), '',
  '仍须实机确认终端读取最外层 API、实际 MVU 初始化顺序及旧脚本停用后的监听清理。', '',
  ...failed.flatMap(result => [`## ${result.name}`, '', '```text', result.error, '```', ''])];
if (!noWrite) {
  fs.mkdirSync(new URL('../output/chapter-v4/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL(`../output/chapter-v4/bootstrap${built ? '-built' : ''}-test-review.md`, import.meta.url), report.join('\n') + '\n');
}
console.log(JSON.stringify({ source: sourceLabel, passed, total: results.length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
