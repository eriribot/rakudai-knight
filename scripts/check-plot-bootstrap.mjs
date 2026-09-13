import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inlineStoryCatalog } from './story-build.mjs';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';

const clone = structuredClone, plain = value => JSON.parse(JSON.stringify(value));
const source = `${inlineStoryCatalog({ summaries: true })}\n${fs.readFileSync(new URL('./rakudai-worldbook-reader.js', import.meta.url), 'utf8')}\n${fs.readFileSync(new URL('./rakudai-plot-runtime.js', import.meta.url), 'utf8')}\n${fs.readFileSync(new URL('./rakudai-plot-bootstrap.js', import.meta.url), 'utf8')}`;
// Event names from the fixed TH 4.9.5 / ST 1.18 predefine declarations used by this project.
const nativeEvents = {
  GENERATION_AFTER_COMMANDS: 'generation_after_commands',
  CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
  CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready',
  GENERATION_ENDED: 'generation_ended', GENERATION_STOPPED: 'generation_stopped', CHAT_CHANGED: 'chat_changed',
};
const helperEvents = { GENERATION_STARTED: 'js_generation_started', GENERATION_ENDED: 'js_generation_ended' };
const results = [];

function fixture({ delayedMvu = false } = {}) {
  const state = clone(INITIAL_STATE);
  state.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  state.玩家.姓名 = '测试玩家';
  state.场景 = { ...state.场景, 当前卷: 2, 当前章: '序章', 阶段: '进行中', 时间: '当日傍晚', 地点: '已确认场所', 切入说明: '沿用当前情境' };
  const wrapper = { stat_data: state, external: { preserved: true } };
  const chat = [{ is_user: false, is_system: false, mes: '已有助手正文', swipe_id: 0, swipes: ['已有助手正文'], variables: [wrapper] },
    { is_user: true, is_system: false, mes: '玩家新行动', swipe_id: 0, swipes: ['玩家新行动'], variables: [{}] }];
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
      assert.equal(options.type, 'message'); assert.equal(options.message_id, 0);
      calls.mvuReads.push(clone(options)); return clone(wrapper);
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
        assert.equal(range, '0-1'); assert.equal(options.role, 'assistant'); assert.equal(options.include_swipes, true);
        return [{ message_id: 0, role: 'assistant', name: '助手', is_hidden: false, swipe_id: 0,
          swipes: ['已有助手正文'], swipes_data: [clone(wrapper)], swipes_info: [{}] }];
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

await check('TH iframe 也有 SillyTavern 时仍向最外层宿主发布唯一 API', () => {
  const f = fixture(), script = f.frame('script-A'); script.install();
  assert.equal(f.top.__RK_PLOT_V3__?.version, '3.0.0');
  assert.equal(script.W.__RK_PLOT_V3__, undefined); assert.equal(f.parent.__RK_PLOT_V3__, undefined);
  assert.equal(f.top.__RK_PLOT_V3__.preview().volume, 2); assert.ok(f.calls.contextReads > 0);
  assert.equal(f.listenerCount(), 7); assert.deepEqual(f.calls.wait, ['script-A']); script.pagehide();
});

await check('MVU 后加载时每个 iframe 的 wait 安装动态 getter，预览恢复真实卷章', async () => {
  const f = fixture({ delayedMvu: true }), script = f.frame('late-MVU'); script.install();
  assert.equal(f.top.Mvu, undefined, 'MVU 仅在共享注册表中提供，不伪装成宿主直接属性');
  assert.equal(script.W.Mvu, undefined); assert.throws(() => f.top.__RK_PLOT_V3__.preview(), /MVU/);
  await f.publishMvu(); const preview = f.top.__RK_PLOT_V3__.preview();
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
  await f.publishMvu(); assert.equal(newApi.preview().volume, 2);
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

const failed = results.filter(result => !result.passed), passed = results.length - failed.length;
const report = ['# 剧情注入器宿主适配离线验收', '', `结果：${passed}/${results.length} 项通过。`, '',
  'VM 加载实际目录、runtime 和 bootstrap 源码。宿主、父 iframe 和脚本 iframe 同时提供 SillyTavern；模拟 TH 按 iframe 安装 MVU 动态 getter 的等待接口。事件常量按项目固定 TH 4.9.5 / ST 1.18 证据定义。没有连接实机或发送模型请求。', '',
  '| 场景 | 结果 |', '|---|---|', ...results.map(result => `| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} |`), '',
  '仍须实机确认终端读取最外层 API、实际 MVU 初始化顺序及旧脚本停用后的监听清理。', '',
  ...failed.flatMap(result => [`## ${result.name}`, '', '```text', result.error, '```', ''])];
fs.mkdirSync(new URL('../output/chapter-v4/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../output/chapter-v4/bootstrap-test-review.md', import.meta.url), report.join('\n') + '\n');
console.log(JSON.stringify({ passed, total: results.length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
