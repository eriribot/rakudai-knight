import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inlineStoryCatalog } from './story-build.mjs';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';

const clone = structuredClone, plain = value => JSON.parse(JSON.stringify(value));
const built = process.argv.includes('--built');
const artifactPath = '../世界书规则/MVU/落第骑士-卷章剧情注入器-v3.0.0.json';
const source = built ? JSON.parse(fs.readFileSync(new URL(artifactPath, import.meta.url), 'utf8')).content
  : `${inlineStoryCatalog({ summaries: true })}\n${fs.readFileSync(new URL('./rakudai-worldbook-reader.js', import.meta.url), 'utf8')}\n${fs.readFileSync(new URL('./rakudai-plot-runtime.js', import.meta.url), 'utf8')}\n${fs.readFileSync(new URL('./rakudai-plot-bootstrap.js', import.meta.url), 'utf8')}`;
const sourceLabel = built ? '玩家导入产物：世界书规则/MVU/落第骑士-卷章剧情注入器-v3.0.0.json' : '实际目录、runtime 和 bootstrap 源码';
assert.equal(typeof source, 'string'); assert.ok(source.trim());
// Event names from the fixed TH 4.9.5 / ST 1.18 predefine declarations used by this project.
const nativeEvents = {
  GENERATION_AFTER_COMMANDS: 'generation_after_commands',
  CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
  CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready',
  GENERATION_ENDED: 'generation_ended', GENERATION_STOPPED: 'generation_stopped', CHAT_CHANGED: 'chat_changed',
};
const helperEvents = { GENERATION_STARTED: 'js_generation_started', GENERATION_ENDED: 'js_generation_ended' };
const results = [];

function fixture({ delayedMvu = false, assistantFloors = 1 } = {}) {
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
  const calls = { wait: [], mvuReads: [], variableReads: [], variableWrites: [], tokenCounts: [], generation: 0, mvuWrites: 0, contextReads: 0 };
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
      getWorldbook: async () => [{ uid: 13, name: '[剧情]第一卷.序章', order: 100, enabled: false, content: '正文' }, { uid: 15, name: '[剧情]第一卷.第一章', order: 101, enabled: false, content: '正文' }, { uid: 20, name: '[剧情]第二卷.序章', order: 106, enabled: false, content: '正文' }],
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
  return { top, parent, context, chat, originalChat, calls, bus, chatVariables, frame, emit, listenerCount,
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
  assert.equal(status.revision, '20261029.2');
  assert.ok(status.reason.startsWith('注入器修订 ' + status.revision + '。'));
  script.pagehide();
});

const failed = results.filter(result => !result.passed), passed = results.length - failed.length;
const report = ['# 剧情注入器宿主适配离线验收', '', `结果：${passed}/${results.length} 项通过。`, '',
  `VM 加载${sourceLabel}。宿主、父 iframe 和脚本 iframe 同时提供 SillyTavern；模拟 TH 按 iframe 安装 MVU 动态 getter 的等待接口。事件常量按项目固定 TH 4.9.5 / ST 1.18 证据定义。没有连接实机或发送模型请求。`, '',
  '| 场景 | 结果 |', '|---|---|', ...results.map(result => `| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} |`), '',
  '仍须实机确认终端读取最外层 API、实际 MVU 初始化顺序及旧脚本停用后的监听清理。', '',
  ...failed.flatMap(result => [`## ${result.name}`, '', '```text', result.error, '```', ''])];
fs.mkdirSync(new URL('../output/chapter-v4/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../output/chapter-v4/bootstrap${built ? '-built' : ''}-test-review.md`, import.meta.url), report.join('\n') + '\n');
console.log(JSON.stringify({ source: sourceLabel, passed, total: results.length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
