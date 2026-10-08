import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { stripModuleSyntax } from '../story-build.mjs';
import { createSchema, INITIAL_STATE, supportStage } from '../../世界书规则/MVU/schema.mjs';

const { z } = createRequire(new URL('../../output/worldbook-calibration/dev/package.json', import.meta.url))('zod');
const stateSchema = createSchema(z, { normalizeRelationships: false });

// Run the shipped correction module with only host, MVU and transport replaced.
// This is an offline readiness/lifecycle regression, not a live Tavern acceptance.
const source = fs.readFileSync(new URL('correction.js', import.meta.url), 'utf8');
const nativeSource = ['rakudai-mvu-structure.mjs', 'rakudai-mvu-native.mjs'].map(file =>
  stripModuleSyntax(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'))).join('\n');
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const clone = value => structuredClone(value);
const markerKey = '__RK_MVU_GUARD_V4__';
const bootKey = '__RK_MVU_GUARD_BOOT_V4__';
const block = '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>';
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture({ autoApply = true, connected = true, hostRenderEvent = true, tailEvents = true, respond,
  patch = [{ op: 'replace', path: '/场景/地点', value: '演武场' }] } = {}) {
  let now = 1000000, timerId = 0;
  const timers = new Map(), listeners = new Map(), requests = [], writes = [], parses = [];
  const storage = new Map([['rk:correction:connection', {
    endpoint: connected ? 'https://correction.invalid/v1' : '', model: connected ? 'offline-model' : '', apiKey: '', autoApply,
  }]]);
  const initial = { schema: '没有用别管这个', initialized_lorebooks: { fixture: [] }, stat_data: clone(INITIAL_STATE) };
  Object.assign(initial.stat_data.系统, { 开局状态: '已建档', 主角模式: '自定义角色' });
  Object.assign(initial.stat_data.场景, { 当前章: '第一章', 阶段: '进行中', 地点: '校门' });
  initial.stat_data.玩家.姓名 = '测试角色';
  let persisted = clone(initial);
  const context = {
    chatId: 'readiness-chat', characterId: 1, groupId: null,
    chat: [{ mes: '上一条回复', is_user: false, swipe_id: 0 }],
    ChatCompletionService: {
      async processRequest(payload, _config, _quiet, signal) {
        assert.equal(signal.aborted, false);
        requests.push(clone(payload));
        if (respond) return respond(payload, signal, requests.length);
        return JSON.stringify(patch);
      },
    },
  };
  const mvu = {
    events: { COMMAND_PARSED: 'mvu:parsed', VARIABLE_UPDATE_ENDED: 'mvu:ended' },
    getMvuData(options) {
      assert.equal(options.type, 'message');
      assert.equal(options.message_id, context.chat.length - 1);
      return clone(persisted);
    },
    async parseMessage(content, data) {
      assert.equal(data.schema.type, 'object', 'Native parse must receive a repaired wrapper schema.');
      parses.push({ native: true, content });
      const next = clone(data), operations = JSON.parse(content.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/)[1]);
      for (const op of operations) {
        if (op.path === '/场景/地点') next.stat_data.场景.地点 = op.value;
        else {
          assert.equal(op.op, 'replace');
          assert.equal(op.path, '/人际');
          assert.equal(data.schema.properties.人际.extensible, true, 'Native add must see an extensible record schema.');
          next.stat_data.人际 = clone(op.value);
        }
      }
      if (mvu.onParse) await mvu.onParse();
      next.schema = '没有用别管这个';
      return next;
    },
  };
  const guard = {
    growth: 'G03', growthProtocol: 'final-values-v1', repair: 'P02', repairSource: 'MVU01', storyRepair: 'S01', flexibleRepair: 'F01',
    growthSettlement: 'G04', tournament: 'T01', tournamentEngine: 'T02',
    async parseRepair(patch, data, mvuBlock, saved) {
      parses.push({ patch, mvuBlock, messageId: saved.messageId });
      const next = clone(data);
      const operations = JSON.parse(patch);
      assert.equal(operations.length, 1);
      assert.equal(operations[0].path, '/场景/地点');
      next.stat_data.场景.地点 = operations[0].value;
      return next;
    },
  };
  const top = {};
  top.top = top; top.parent = top;
  const middle = { top, parent: top };
  const HW = { top, parent: middle, SillyTavern: { getContext: () => context }, Mvu: mvu };
  const window = { parent: HW, top, Mvu: mvu };
  const SS = { destroyed: false, disposers: [] };
  const helper = {
    ...(tailEvents ? {
      eventMakeLast(name, callback) {
        helper.eventRemoveListener(name, callback);
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(callback);
        return { stop() { throw new Error('不得依赖 eventMakeLast 返回的包装 stop'); } };
      },
      eventRemoveListener(name, callback) {
        const remaining = (listeners.get(name) || []).filter(item => item !== callback);
        if (remaining.length) listeners.set(name, remaining); else listeners.delete(name);
      },
    } : {}),
    getChatMessages(id) {
      const message = context.chat[id];
      return message && !message.is_user
        ? [{ message_id: id, swipe_id: message.swipe_id, message: message.mes }]
        : [];
    },
    updateVariablesWith(update, options) {
      writes.push({ ...options });
      persisted = clone(update(clone(persisted)));
    },
  };
  class FixtureDate extends Date { static now() { return now; } }
  function setTimer(fn, ms, interval) {
    const id = ++timerId;
    timers.set(id, { fn, due: now + Number(ms), interval: interval ? Number(ms) : 0 });
    return id;
  }
  const realm = vm.createContext({
    window, HW, SS, Date: FixtureDate, AbortController, URL, structuredClone, supportStage,
    LS: { get: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
      set: (key, value) => storage.set(key, value) },
    generationPending: false, terminalStateReader: { clear() {} },
    fn: name => helper[name], emit() {},
    stateService: () => ({ tournamentView: () => ({ calendar: {}, roster: [], warnings: [] }),
      validateState: value => { stateSchema.parse(value); return clone(value); } }),
    setTimeout: (fn, ms) => setTimer(fn, ms, false), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => setTimer(fn, ms, true), clearInterval: id => timers.delete(id),
  });
  vm.runInContext(nativeSource + '\n' + source + '\nglobalThis.api = { requestCorrection, applyCorrection, getCorrectionStatus, ' +
    'wireAutomaticCorrection, startAutomaticCorrection, endAutomaticCorrection, cancelCorrection, correctionHostReset, correctionMainBusy, retryCorrection, correctionMvuBlock, getCorrectionInput, normalizeCorrectionPatch, correctionRules };', realm);
  const api = realm.api;
  const TE = hostRenderEvent ? { CHARACTER_MESSAGE_RENDERED: 'host:rendered' } : {};
  api.wireAutomaticCorrection((event, callback) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
  }, TE);
  function event(name, ...args) {
    for (const callback of listeners.get(name) || []) callback(...args);
  }
  async function advance(ms, awaitTasks = true) {
    const until = now + ms;
    let calls = 0;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= until)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      assert.ok(++calls < 5000, 'Timer failed to settle within the bounded fixture budget.');
      const [id, timer] = next;
      now = timer.due;
      if (timer.interval) timer.due += timer.interval;
      else timers.delete(id);
      const task = timer.fn();
      if (awaitTasks) await task;
      await flush();
    }
    now = until;
    await flush();
  }
  function ready(target = HW, value = guard) {
    target[markerKey] = value;
    target[bootKey] = { state: 'ready', stage: 'ready', message: '约束已就绪', startedAt: now, guard: value };
  }
  function loading(target = HW) {
    target[bootKey] = { state: 'loading', stage: 'dependencies', message: '等待 MVU 与 Zod', startedAt: now };
  }
  function startTurn({ save = true, render = true, end = true, parsed = true, contentBlock = block, location = '走廊', sameSlot = false } = {}) {
    api.startAutomaticCorrection();
    const previous = clone(persisted);
    if (sameSlot) context.chat.at(-1).mes = '本轮同页续写了新剧情。' + contentBlock;
    else context.chat.push({ mes: '本轮抵达走廊。' + contentBlock, is_user: false, swipe_id: 0 });
    const candidate = clone(previous);
    candidate.stat_data.场景.地点 = location;
    if (parsed) event(mvu.events.COMMAND_PARSED, candidate, [], context.chat.at(-1).mes);
    if (end) event(mvu.events.VARIABLE_UPDATE_ENDED, candidate, previous);
    if (save) persisted = clone(candidate);
    if (render) event(TE.CHARACTER_MESSAGE_RENDERED, context.chat.length - 1);
    api.endAutomaticCorrection(false, context.chat.length);
    return candidate;
  }
  function assertNoWork() {
    assert.equal(requests.length, 0, 'Readiness must gate the API request.');
    assert.equal(parses.length, 0, 'Readiness must gate repair parsing.');
    assert.equal(writes.length, 0, 'Readiness must gate MVU writes.');
  }
  return { api, HW, window, middle, top, guard, context, mvu, requests, writes, parses, ready, loading, listeners,
    advance, startTurn, assertNoWork, event, TE,
    dispose() { for (const stop of SS.disposers.slice().reverse()) stop(); },
    now: () => now, state: () => clone(persisted), save: value => { persisted = clone(value); },
  };
}

await check('既有完整能力 marker 没有 boot 标记仍可请求并保存', async () => {
  const f = fixture();
  f.HW[markerKey] = f.guard;
  f.context.chat[0].mes += block;
  const preview = await f.api.requestCorrection();
  assert.equal(preview.count, 1);
  await f.api.applyCorrection();
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.state().stat_data.场景.地点, '演武场');
});

await check('多层 iframe 顶层 marker 能被真实自动校正流程找到', async () => {
  const f = fixture();
  f.ready(f.top);
  f.startTurn();
  await f.advance(2000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
});

await check('不可访问的 parent 不阻断可读 top 的能力发现', async () => {
  const f = fixture();
  Object.defineProperty(f.window, 'parent', { get() { throw new Error('Cross-origin access denied'); } });
  Object.defineProperty(f.HW, 'parent', { get() { throw new Error('Cross-origin access denied'); } });
  f.ready(f.top);
  f.startTurn();
  await f.advance(2000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

await check('loading 后 ready 自动续跑原轮次并且只请求和写入一次', async () => {
  const f = fixture();
  f.loading();
  f.startTurn();
  await f.advance(1200);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'waiting');
  f.ready();
  await f.advance(3000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].message_id, 1);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  await f.advance(5000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

await check('依赖启动失败显示明确失败原因且不请求不写入', async () => {
  const f = fixture();
  f.HW[bootKey] = { state: 'failed', stage: 'dependencies', message: 'Zod 依赖 CDN 加载失败', startedAt: f.now() };
  f.startTurn();
  await f.advance(1500);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.match(f.api.getCorrectionStatus().message, /Zod.*CDN.*失败/);
});

await check('完全缺少 marker 和 boot 时副校正使用原生 MVU 并确认保存', async () => {
  const f = fixture();
  f.startTurn();
  await f.advance(2000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.parses[0].native, true);
  assert.equal(f.state().schema.type, 'object');
});

await check('真实旧 guard 不因脚本标题含 G04 而通过 T02 能力门禁', async () => {
  const f = fixture();
  const old = { ...f.guard, tournamentEngine: 'T01', title: 'MVU v4 G04 / T02' };
  f.ready(f.HW, old);
  f.startTurn();
  await f.advance(1500);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.match(f.api.getCorrectionStatus().message, /tournamentEngine|T02/);
  assert.doesNotMatch(f.api.getCorrectionStatus().message, /^请同步启用说明含/);
});

await check('缺少 parseRepair 能力不能通过并指出缺失字段', async () => {
  const f = fixture();
  const old = { ...f.guard }; delete old.parseRepair;
  f.ready(f.HW, old);
  f.startTurn();
  await f.advance(1500);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.match(f.api.getCorrectionStatus().message, /parseRepair/);
});

for (const action of ['切换聊天', '手动取消']) {
  await check('等待约束期间' + action + '，后来 ready 不补跑旧轮', async () => {
    const f = fixture();
    f.loading();
    f.startTurn();
    await f.advance(1200);
    assert.equal(f.api.getCorrectionStatus().state, 'waiting');
    if (action === '切换聊天') {
      f.context.chatId = 'other-chat';
      f.context.chat = [{ mes: '其他聊天' + block, is_user: false, swipe_id: 0 }];
      f.api.correctionHostReset('CHAT_CHANGED');
    } else f.api.cancelCorrection();
    f.ready();
    await f.advance(5000);
    f.assertNoWork();
  });
}

await check('loading 时即使旧完整 marker 残留，也等待当前 boot ready', async () => {
  const f = fixture();
  f.HW[markerKey] = f.guard;
  f.loading();
  f.startTurn();
  await f.advance(1500);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'waiting');
  const replacement = { ...f.guard };
  f.ready(f.HW, replacement);
  await f.advance(2000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

await check('failed boot 不能被同宿主残留的旧完整 marker 掩盖', async () => {
  const f = fixture();
  f.HW[markerKey] = f.guard;
  f.HW[bootKey] = { state: 'failed', stage: 'register', message: 'schema 注册失败', startedAt: f.now() };
  f.startTurn();
  await f.advance(1500);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.match(f.api.getCorrectionStatus().message, /schema.*失败/);
});

await check('ready.guard 与当前 marker 不一致不能放行', async () => {
  const f = fixture();
  f.ready();
  f.HW[markerKey] = { ...f.guard };
  f.startTurn();
  await f.advance(1500);
  f.assertNoWork();
  assert.notEqual(f.api.getCorrectionStatus().state, 'applied');
});

await check('约束加载超过 60 秒后停止并说明约束启动超时', async () => {
  const f = fixture();
  f.loading();
  f.startTurn();
  await f.advance(61500);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.match(f.api.getCorrectionStatus().message, /约束/);
  assert.match(f.api.getCorrectionStatus().message, /超时|超过|未.*就绪/);
});

await check('预览之后约束被替换，旧 guard 不再用于解析或写入', async () => {
  const f = fixture();
  f.ready();
  f.context.chat[0].mes += block;
  const preview = await f.api.requestCorrection();
  assert.equal(preview.count, 1);
  f.ready(f.HW, { ...f.guard });
  await assert.rejects(f.api.applyCorrection(), /约束|变化/);
  assert.equal(f.requests.length, 1);
  assert.equal(f.parses.length, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.state().stat_data.场景.地点, '校门');
});

await check('约束就绪不能跳过主 MVU 保存一致性，渲染本身不证明写入', async () => {
  const f = fixture();
  f.ready();
  const candidate = f.startTurn({ save: false, render: false });
  await f.advance(1200);
  f.assertNoWork();
  await assert.rejects(f.api.requestCorrection(), /等待.*MVU.*保存/);
  f.event(f.TE.CHARACTER_MESSAGE_RENDERED, 1);
  await f.advance(1200);
  f.assertNoWork();
  f.save(candidate);
  await f.advance(2000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
});

await check('渲染早于 MVU ENDED 时，已保存的同页结果仍及时进入全面校正', async () => {
  const f = fixture();
  const candidate = f.startTurn({ end: false, save: false });
  await f.advance(1000);
  f.assertNoWork();
  f.event(f.mvu.events.VARIABLE_UPDATE_ENDED, candidate, f.state());
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

for (const hostRenderEvent of [true, false]) {
  await check((hostRenderEvent ? '漏发渲染事件' : '宿主没有渲染事件常量') + '不阻断已完成解析且同页保存的主结果', async () => {
    const f = fixture({ hostRenderEvent });
    f.startTurn({ render: false });
    await f.advance(1000);
    assert.equal(f.api.getCorrectionStatus().state, 'applied');
    assert.equal(f.requests.length, 1);
    assert.equal(f.writes[0].message_id, 1);
  });
}

await check('保存延迟超时后，已绑定候选可无渲染地重试回读并保留自动校正', async () => {
  const f = fixture();
  const candidate = f.startTurn({ save: false, render: false });
  await f.advance(182000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  f.assertNoWork();
  f.save(candidate);
  await f.api.retryCorrection();
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

await check('真实主 ENDED 迟到时恢复本轮自动意图，不因先前超时静默漏跑', async () => {
  const f = fixture(), previous = f.state();
  const candidate = f.startTurn({ save: false, render: false, end: false });
  await f.advance(182000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  f.assertNoWork();
  f.event(f.mvu.events.VARIABLE_UPDATE_ENDED, candidate, previous);
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

await check('用户取消后迟到的主保存只解锁主轮，不重新开启自动校正', async () => {
  const f = fixture(), previous = f.state();
  const candidate = f.startTurn({ save: false, render: false, end: false });
  await f.advance(182000);
  f.api.cancelCorrection();
  f.event(f.mvu.events.VARIABLE_UPDATE_ENDED, candidate, previous);
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  f.assertNoWork();
});

await check('缺失匹配 ENDED 时，即使当前值相等也不绕过尚未完成的主 writer', async () => {
  const f = fixture();
  const candidate = f.startTurn({ end: false, render: false });
  f.event(f.mvu.events.VARIABLE_UPDATE_ENDED, clone(candidate), f.state());
  await f.advance(182000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  await f.api.retryCorrection();
  await f.advance(1000);
  assert.equal(f.api.correctionMainBusy(), true);
  f.assertNoWork();
});

await check('空补丁同值且 ENDED 已发，delta收据真正保存前不因稳定超过300ms而放行', async () => {
  const f = fixture();
  const candidate = f.startTurn({ save: false, render: false, location: '校门' });
  assert.ok(candidate.delta_data.$internal.__rk_main_save.id);
  assert.equal(f.state().delta_data?.$internal?.__rk_main_save, undefined);
  await f.advance(5000);
  f.assertNoWork();
  assert.equal(f.api.correctionMainBusy(), true);
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
});

await check('宿主不提供 BEFORE 仍可凭delta收据确认；无delta收据且业务同值时继续等待', async () => {
  const f = fixture();
  const candidate = f.startTurn({ save: false, location: '校门' });
  assert.equal(f.mvu.events.BEFORE_MESSAGE_UPDATE, undefined);
  const withoutReceipt = clone(candidate); delete withoutReceipt.delta_data.$internal.__rk_main_save;
  f.save(withoutReceipt);
  await f.advance(5000);
  assert.equal(f.api.correctionMainBusy(), true);
  f.assertNoWork();
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
});

await check('旧主收据不会确认新轮，即使新轮业务值完全相同', async () => {
  const f = fixture({ autoApply: false });
  f.startTurn({ location: '校门' });
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  const oldId = f.state().delta_data.$internal.__rk_main_save.id;
  const next = f.startTurn({ location: '校门', save: false });
  assert.notEqual(next.delta_data.$internal.__rk_main_save.id, oldId);
  await f.advance(5000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  assert.equal(f.api.correctionMainBusy(), true);
  f.assertNoWork();
});

await check('后续约束监听器清除delta收据时安全失败，渲染也不能替代持久化证明', async () => {
  const f = fixture();
  const candidate = f.startTurn({ save: false });
  candidate.delta_data = { 场景: { 地点: '走廊' } };
  f.save(candidate);
  await f.advance(182000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  assert.equal(f.api.correctionMainBusy(), true);
  f.assertNoWork();
});

await check('约束清理delta后尾部重盖同一收据，仍等该收据实际保存才解锁', async () => {
  const f = fixture(); f.ready();
  const tailEvent = f.mvu.events.VARIABLE_UPDATE_ENDED + '_for_zod';
  f.listeners.set(tailEvent, [variables => { variables.delta_data = { 场景: { 地点: '走廊' } }; }]);
  const candidate = f.startTurn({ save: false, render: false });
  const receiptId = candidate.delta_data.$internal.__rk_main_save.id;
  f.event(tailEvent, candidate, f.state());
  assert.equal(candidate.delta_data.$internal.__rk_main_save.id, receiptId);
  assert.deepEqual(candidate.delta_data.场景, { 地点: '走廊' });
  delete candidate.stat_data.$internal;
  await f.advance(5000);
  f.assertNoWork();
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
});

await check('桥接后加载时下一轮重新移尾且不重复订阅，销毁用原回调解绑', async () => {
  const f = fixture({ autoApply: false }), tailEvent = f.mvu.events.VARIABLE_UPDATE_ENDED + '_for_zod';
  f.startTurn(); await f.advance(1000);
  assert.equal(f.listeners.get(tailEvent).length, 1);
  const laterBridge = variables => { variables.delta_data = {}; };
  f.listeners.get(tailEvent).push(laterBridge); f.ready();
  const candidate = f.startTurn({ save: false });
  assert.equal(f.listeners.get(tailEvent).length, 2);
  assert.equal(f.listeners.get(tailEvent)[0], laterBridge);
  f.event(tailEvent, candidate, f.state());
  assert.ok(candidate.delta_data.$internal.__rk_main_save.id);
  f.save(candidate); await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  f.dispose();
  assert.deepEqual(f.listeners.get(tailEvent), [laterBridge]);
});

await check('没有尾部事件能力时原生仍可保存，有约束则明确失败且不退回渲染判定', async () => {
  const native = fixture({ tailEvents: false });
  native.startTurn({ render: false }); await native.advance(1000);
  assert.equal(native.api.getCorrectionStatus().state, 'applied');
  const guarded = fixture({ tailEvents: false }); guarded.ready();
  guarded.startTurn(); await guarded.advance(1000);
  assert.equal(guarded.api.getCorrectionStatus().mainSave, 'failed');
  assert.match(guarded.api.getCorrectionStatus().message, /eventMakeLast.*eventRemoveListener/);
  guarded.assertNoWork();
});

await check('尾部只认当前候选对象，不替其他解析或不同回复页签发保存收据', async () => {
  const f = fixture(), candidate = f.startTurn({ save: false });
  const tailEvent = f.mvu.events.VARIABLE_UPDATE_ENDED + '_for_zod';
  const foreign = clone(candidate); foreign.delta_data = {};
  f.event(tailEvent, foreign, f.state());
  assert.equal(foreign.delta_data.$internal, undefined);
  candidate.delta_data = {};
  f.context.chat.at(-1).swipe_id = 1;
  f.event(tailEvent, candidate, f.state());
  assert.equal(candidate.delta_data.$internal, undefined);
  await f.advance(1000);
  f.assertNoWork();
});

await check('同楼同swipe续写沿用相同主补丁，也凭新保存收据全面校验一次', async () => {
  const f = fixture();
  f.startTurn(); await f.advance(1000);
  const slot = f.context.chat.length - 1, message = f.context.chat[slot];
  const previousReceipt = f.state().delta_data.$internal.__rk_main_save.id;
  const candidate = f.startTurn({ sameSlot: true, location: '演武场' });
  assert.equal(f.context.chat.length - 1, slot);
  assert.equal(f.context.chat[slot], message);
  assert.notEqual(candidate.delta_data.$internal.__rk_main_save.id, previousReceipt);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  assert.equal(f.requests.length, 2);
  await f.advance(1000);
  assert.equal(f.requests.length, 2);
});

await check('同页续写只有旧收据且没有新主ENDED时不解锁，也不重复奖励', async () => {
  const f = fixture(); f.startTurn(); await f.advance(1000);
  const previousReceipt = f.state().delta_data.$internal.__rk_main_save.id;
  f.startTurn({ sameSlot: true, end: false, location: '演武场' });
  assert.equal(f.state().delta_data.$internal.__rk_main_save.id, previousReceipt);
  await f.advance(182000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  assert.equal(f.api.correctionMainBusy(), true);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 1);
});

for (const guardState of ['missing', 'loading', 'failed']) {
  await check('副 API 关闭且约束 ' + guardState + ' 时主保存独立确认，不等待约束', async () => {
    const f = fixture({ autoApply: false });
    if (guardState === 'loading') f.loading();
    if (guardState === 'failed') f.HW[bootKey] = { state: 'failed', message: '测试加载失败' };
    f.startTurn();
    await f.advance(2000);
    f.assertNoWork();
    assert.equal(f.api.getCorrectionStatus().scope, 'main');
    assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
    assert.equal(f.api.getCorrectionStatus().state, 'ready');
    assert.equal(f.api.correctionMainBusy(), false);
    await f.advance(65000);
    assert.equal(f.api.getCorrectionStatus().state, 'ready');
  });
}

await check('未配置副连接也可只凭核心 MVU 确认本页保存', async () => {
  const f = fixture({ connected: false });
  delete f.mvu.parseMessage;
  f.startTurn();
  await f.advance(2000);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  assert.equal(f.api.correctionMainBusy(), false);
});

await check('无约束模式未写入的独立解析仍保持主保存锁并报主保存失败', async () => {
  const f = fixture({ autoApply: false });
  const candidate = f.startTurn({ save: false });
  await f.advance(2000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  assert.equal(f.api.correctionMainBusy(), true);
  await f.advance(180000);
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.equal(f.api.getCorrectionStatus().scope, 'main');
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  f.assertNoWork();
  f.save(candidate);
  await f.api.retryCorrection();
  await f.advance(1500);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
});

await check('没有对应 COMMAND_PARSED 的完整旧数据与独立 ENDED 不算主保存', async () => {
  const f = fixture({ autoApply: false });
  f.startTurn({ parsed: false });
  await f.advance(182000);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  assert.equal(f.api.correctionMainBusy(), true);
});

await check('确认期间换 swipe 即使读回相同变量也拒绝原候选', async () => {
  const f = fixture({ autoApply: false });
  f.startTurn();
  await f.advance(200);
  f.context.chat.at(-1).swipe_id = 1;
  await f.advance(1500);
  f.assertNoWork();
  assert.notEqual(f.api.getCorrectionStatus().mainSave, 'saved');
  assert.equal(f.api.getCorrectionStatus().scope, 'main');
});

await check('副校正约束失败不否认已落地主保存；重试仍核对原变量', async () => {
  const f = fixture();
  f.HW[bootKey] = { state: 'failed', message: '桥接加载失败' };
  f.startTurn();
  await f.advance(2000);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.equal(f.api.getCorrectionStatus().scope, 'correction');
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  assert.equal(f.api.correctionMainBusy(), false);
  f.ready();
  await f.api.retryCorrection();
  await f.advance(1500);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.requests.length, 1);
});

await check('原生副校正新增人物保留外层包装并回读当前页', async () => {
  const person = { 关系: '同学', 态度印象: '初次交谈', 好感: 20, 支援度: 10, 羁绊阶段: '未建立', 变化依据: '晨间交谈' };
  const f = fixture({ patch: [{ op: 'add', path: '/人际/测试同学', value: person }] });
  f.startTurn();
  await f.advance(2000);
  assert.deepEqual(f.state().stat_data.人际.测试同学, person);
  assert.deepEqual(f.state().initialized_lorebooks, { fixture: [] });
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.writes[0].message_id, 1);
});

await check('原生解析在异步返回前切换约束模式时拒绝落地', async () => {
  const f = fixture();
  f.context.chat[0].mes += block;
  await f.api.requestCorrection();
  f.mvu.onParse = () => f.ready();
  await assert.rejects(f.api.applyCorrection(), /变化/);
  assert.equal(f.writes.length, 0);
  assert.equal(f.state().stat_data.场景.地点, '校门');
});

for (const tag of ['JSONPatch', 'json_patch', 'JSONPATCH', 'JSON_PATCH']) {
  await check('标签 ' + tag + ' 经过本轮事件、保存回读及原生副校正，保留 raw 消息', async () => {
    const contentBlock = '<UpdateVariable><update_analysis>本輪抵达走廊，分析不作为补丁。</update_analysis><' + tag +
      '>[{"op":"replace","path":"/场景/地点","value":"走廊"}]</' + tag + '></UpdateVariable>';
    const f = fixture();
    f.startTurn({ contentBlock });
    const raw = f.context.chat.at(-1).mes;
    await f.advance(2000);
    assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
    assert.equal(f.api.getCorrectionStatus().state, 'applied');
    assert.equal(f.requests.length, 1);
    assert.equal(f.writes.length, 1);
    assert.equal(f.parses[0].native, true);
    assert.equal(f.context.chat.at(-1).mes, raw);
    assert.equal(f.api.correctionMvuBlock(raw), contentBlock);
  });
}

await check('json_patch 未真实保存时仍锁住主保存；同页落地后才允许确认', async () => {
  const f = fixture({ autoApply: false });
  const candidate = f.startTurn({ save: false, contentBlock: '<UpdateVariable><json_patch>[]</json_patch></UpdateVariable>' });
  await f.advance(1200);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().mainSave, 'waiting');
  assert.equal(f.api.correctionMainBusy(), true);
  f.save(candidate);
  await f.advance(1200);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  f.assertNoWork();
});

await check('半截、混配、多块及非数组不当作有效补丁，无解析生命周期时不能确认主保存', async () => {
  const f = fixture({ autoApply: false });
  const invalid = [
    '<UpdateVariable><json_patch>[]</UpdateVariable>',
    '<UpdateVariable><JSONPatch>[]</json_patch></UpdateVariable>',
    '<UpdateVariable><JSONPatch>[]</JSONPatch><json_patch>[]</json_patch></UpdateVariable>',
    '<UpdateVariable><JSON_PATCH>[]</JSON_PATCH><JSON_PATCH>[]</JSON_PATCH></UpdateVariable>',
    '<UpdateVariable><json_patch>{"op":"add"}</json_patch></UpdateVariable>',
    '<UpdateVariable><json_patch>无效 JSON</json_patch></UpdateVariable>',
    '<UpdateVariable><update_analysis>[{"op":"add","path":"/人际/仅分析人物","value":{}}]</update_analysis></UpdateVariable>',
    '<UpdateVariable><json_patch><Analysis>[]</Analysis></json_patch></UpdateVariable>',
    '<UpdateVariable><json_patch>[]</json_patch></UpdateVariable><UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>',
  ];
  for (const content of invalid) assert.equal(f.api.correctionMvuBlock(content), '', content);
  f.startTurn({ parsed: false, contentBlock: invalid[2] });
  await f.advance(182000);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  assert.equal(f.api.getCorrectionStatus().scope, 'main');
});

for (const contentBlock of ['', '<UpdateVariable><JSONPatch>[invalid]</JSONPatch></UpdateVariable>', '<UpdateVariable><JSONPatch>[']) {
  await check('缺失或坏主补丁仅在真实解析生命周期及本页收据落地后交给副校正：' + (contentBlock || '缺块'), async () => {
    const f = fixture();
    const candidate = f.startTurn({ contentBlock, location: '校门', save: false, render: false });
    await f.advance(1000);
    f.assertNoWork();
    f.save(candidate);
    await f.advance(1000);
    assert.equal(f.api.getCorrectionStatus().state, 'applied');
    assert.equal(f.requests.length, 1);
    assert.equal(f.writes[0].message_id, 1);
    assert.equal(f.state().stat_data.场景.地点, '演武场');
  });
}

for (const autoApply of [true, false]) {
  await check('MVU02 约束对坏主补丁保留' + (autoApply ? '自动全面校正' : '手动预览与确认保存'), async () => {
    const f = fixture({ autoApply });
    f.guard.repairSource = 'MVU02'; f.ready();
    f.startTurn({ contentBlock: '<UpdateVariable><JSONPatch>[invalid]', location: '校门' });
    await f.advance(1000);
    if (!autoApply) {
      f.assertNoWork();
      assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
      const preview = await f.api.requestCorrection();
      assert.equal(preview.count, 1);
      assert.equal(f.writes.length, 0);
      await f.api.applyCorrection();
    }
    assert.equal(f.api.getCorrectionStatus().state, 'applied');
    assert.equal(f.parses.length, 1);
    assert.match(f.parses[0].mvuBlock, /本轮抵达走廊/);
    assert.equal(f.writes[0].message_id, 1);
    assert.equal(f.state().stat_data.场景.地点, '演武场');
  });
}

await check('旧 MVU01 约束仍处理完整主补丁，但坏来源明确要求升级且不请求不写入', async () => {
  const f = fixture(); f.ready();
  f.startTurn({ contentBlock: '', location: '校门' });
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().mainSave, 'saved');
  assert.match(f.api.getCorrectionStatus().message, /MVU02/);
  f.assertNoWork();
});

await check('收据持久化后新增末尾 StatusPlaceHolderImpl 不使坏主补丁来源失效', async () => {
  const f = fixture();
  const candidate = f.startTurn({ contentBlock: '<UpdateVariable><JSONPatch>[', location: '校门', save: false });
  const receiptId = candidate.delta_data.$internal.__rk_main_save.id;
  f.context.chat.at(-1).mes += '\r\n<StatusPlaceHolderImpl/>';
  f.save(candidate);
  await f.advance(1000);
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.state().delta_data.$internal.__rk_main_save.id, receiptId);
  assert.equal(f.requests.length, 1);
});

await check('坏来源在副请求中被改正文时拒绝旧结果，不把不同剧情补丁写回当前页', async () => {
  let f;
  f = fixture({ respond: () => {
    f.context.chat.at(-1).mes += '\n实际剧情已改为离开校门。';
    return JSON.stringify([{ op: 'replace', path: '/场景/地点', value: '演武场' }]);
  } });
  f.context.chat[0].mes = '正文已有本轮事实，但主补丁缺失。';
  await assert.rejects(f.api.requestCorrection(), /变化/);
  assert.equal(f.requests.length, 1);
  assert.equal(f.parses.length, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.state().stat_data.场景.地点, '校门');
});

await check('副 API 满120秒超时只发一次，保留显式重试而不再自动连等三轮', async () => {
  const f = fixture({ respond: (_payload, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  f.startTurn();
  await f.advance(121000, false);
  assert.equal(f.requests.length, 1);
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
  assert.match(f.api.getCorrectionStatus().message, /超时.*停止自动重试/);
  assert.equal(f.api.getCorrectionStatus().canRetry, true);
  await f.advance(10000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.writes.length, 0);
});

await check('全面校验保留全部真实业务字段，只去重程序战况和内部自动历史', async () => {
  const f = fixture(), data = f.state();
  data.stat_data.玩家 = { 姓名: '测试角色', 六维: { 魔力控制: 'B' }, 魔人觉醒: false,
    成长: { 经验: { 魔力控制: 35 }, 申请: { 旧: {} } }, 其他能力: { 探测: { 说明: '感知魔力' } } };
  data.stat_data.人际 = { 测试同学: { 好感: 23, 支援度: 12, 态度印象: '认可' } };
  data.stat_data.场景.选拔赛 = { 名册: { player: { 姓名: '测试角色' } }, 比赛: { round1: { 状态: '待定' } }, 程序战况: { 只读: true } };
  data.stat_data.场景.自定义事实 = { 天气: '晴' };
  f.save(data); f.context.chat[0].mes += block;
  await f.api.requestCorrection();
  const sent = JSON.parse(f.requests[0].messages[1].content);
  assert.deepEqual(sent.当前变量.玩家.六维, data.stat_data.玩家.六维);
  assert.deepEqual(sent.当前变量.玩家.其他能力, data.stat_data.玩家.其他能力);
  assert.deepEqual(sent.当前变量.玩家.成长, { 经验: { 魔力控制: 35 } });
  assert.deepEqual(sent.当前变量.人际, data.stat_data.人际);
  assert.deepEqual(sent.当前变量.场景.选拔赛.名册, data.stat_data.场景.选拔赛.名册);
  assert.deepEqual(sent.当前变量.场景.选拔赛.比赛, data.stat_data.场景.选拔赛.比赛);
  assert.deepEqual(sent.当前变量.场景.自定义事实, { 天气: '晴' });
  assert.equal(sent.当前变量.场景.选拔赛.程序战况, undefined);
  assert.ok(sent.程序选拔赛);
  assert.deepEqual(f.state(), data);
});

await check('json_patch 的已保存事件、人际和进度提交参与核对，Analysis 不生成补丁', () => {
  const f = fixture({ autoApply: false });
  const eventValue = { 卷号: 1, 章段: '第一章', 结果: '晨间交谈已发生', 参与者: ['测试同学'], 知情者: [] };
  const current = f.state();
  current.stat_data.场景.已发生事件 = { 晨间交谈: eventValue };
  current.stat_data.人际.测试同学 = { 好感: 20, 支援度: 10, 变化依据: '晨间交谈' };
  f.save(current);
  const operations = [
    { op: 'add', path: '/场景/已发生事件/晨间交谈', value: eventValue },
    { op: 'replace', path: '/人际/测试同学/好感', value: 20 },
    { op: 'replace', path: '/场景/当前章', value: '第一章' },
  ];
  f.context.chat[0].mes = '本轮实际正文。<UpdateVariable><Analysis>[{"op":"add","path":"/人际/仅分析人物","value":{}}]</Analysis>' +
    '<JSON_PATCH>' + JSON.stringify(operations) + '</json_patch></UpdateVariable>';
  const input = f.api.getCorrectionInput();
  assert.deepEqual(clone(input.events), { 晨间交谈: eventValue });
  assert.deepEqual(clone(input.submittedRelations), [{ path: '/人际/测试同学/好感', value: 20 }]);
  assert.deepEqual(clone(input.submittedStory), [{ path: '/场景/当前章', value: '第一章' }]);
  assert.equal(input.text, '本轮实际正文。');
  assert.equal(Object.hasOwn(input.state.人际, '仅分析人物'), false);
  f.assertNoWork();
});

await check('关闭约束时，副校正直接走原生终值路径并补缺失经验结构', async () => {
  const f = fixture(); f.context.chat[0].mes += block;
  await f.api.requestCorrection(); await f.api.applyCorrection();
  assert.equal(f.parses[0].native, true); assert.equal(f.writes.length, 1);
  assert.deepEqual(f.state().stat_data.玩家.成长.经验, { 魔力控制: 0, 体能: 0, 魔力量: 0 });
});
await check('旧独立成长仍运行时不请求副API，避免旧申请混入终值模式', async () => {
  const f = fixture(); f.context.chat[0].mes += block;
  f.HW.__RK_MVU_GROWTH_G04__ = { state: 'ready', growthSettlement: 'G04', parseRepair() { throw new Error('不能调用旧解析器'); } };
  await assert.rejects(f.api.requestCorrection(), /关闭旧独立成长/); f.assertNoWork();
});
await check('预览之后开启旧独立成长，旧候选不进入解析或写入', async () => {
  const f = fixture(); f.context.chat[0].mes += block;
  await f.api.requestCorrection();
  f.HW.__RK_MVU_GROWTH_G04__ = { state: 'loading' };
  await assert.rejects(f.api.applyCorrection(), /关闭旧独立成长/);
  assert.equal(f.parses.length, 0); assert.equal(f.writes.length, 0);
});
await check('旧副提示词输出申请时略过申请，合法业务改动仍可预览保存', async () => {
  const f = fixture({ patch: [
    { op: 'add', path: '/玩家/成长/申请/旧协议申请', value: { 来源事件: '训练', 目标: '体能', 经验: 40, 成果: '本轮训练' } },
    { op: 'replace', path: '/场景/地点', value: '演武场' },
  ] });
  f.context.chat[0].mes += block; f.ready();
  const preview = await f.api.requestCorrection();
  assert.equal(preview.count, 1);
  assert.deepEqual(clone(preview.skipped), ['/玩家/成长/申请/旧协议申请']);
  await f.api.applyCorrection();
  assert.equal(f.state().stat_data.玩家.成长.申请?.旧协议申请, undefined);
  assert.equal(f.state().stat_data.场景.地点, '演武场');
});
await check('终值提示投影只送经验，历史申请与收据不请求也不从存档删除', async () => {
  const f = fixture(); f.context.chat[0].mes += block;
  const data = f.state();
  data.stat_data.玩家.成长 = { 经验: { 魔力控制: 35, 体能: 7 }, 申请: { 旧申请: { 目标: ['魔力控制', '体能'], 经验: 40 } },
    记录: { 已结算: { 成果: '旧成长事实' } }, 回合结算: { 标识: 'old' }, 自定义历史: ['保留'] };
  f.save(data);
  await f.api.requestCorrection();
  const sent = JSON.parse(f.requests[0].messages[1].content);
  assert.deepEqual(sent.当前变量.玩家.成长, { 经验: { 魔力控制: 35, 体能: 7 } });
  assert.deepEqual(f.state(), data);
  assert.match(f.requests[0].messages[0].content, /不创建或修改成长申请/);
  assert.match(f.requests[0].messages[0].content, /无约束时由模型完成计算/);
});
await check('旧约束没有终值能力标记时明确提示更新，预览和写入均不启动', async () => {
  const f = fixture(); f.context.chat[0].mes += block;
  delete f.guard.growthProtocol; f.ready();
  await assert.rejects(f.api.requestCorrection(), /final-values-v1/); f.assertNoWork();
});
await check('副模型误加单层代码围栏或MVU标签时本地提取，不另发修复请求', async () => {
  const patch = JSON.stringify([{ op: 'replace', path: '/场景/地点', value: '演武场' }]);
  for (const raw of [patch, '```json\n' + patch + '\n```', '<JSONPatch>' + patch + '</JSONPatch>',
    '<UpdateVariable><Analysis>Checked.</Analysis><json_patch>' + patch + '</json_patch></UpdateVariable>']) {
    const f = fixture(); f.context.chat[0].mes += block;
    let requests = 0;
    f.context.ChatCompletionService.processRequest = async () => { requests++; return raw; };
    const preview = await f.api.requestCorrection();
    assert.equal(preview.count, 1); assert.equal(requests, 1);
    await f.api.applyCorrection();
    assert.equal(f.state().stat_data.场景.地点, '演武场');
  }
});
await check('截断或多块副输出不猜补、不写入、不自动重放', async () => {
  for (const raw of ['[{"op":"replace","path":', '<JSONPatch>[]</JSONPatch><JSONPatch>[]</JSONPatch>',
    '{"op":"replace","path":"/场景/地点","value":"演武场"}']) {
    const f = fixture(); f.context.chat[0].mes += block;
    f.context.ChatCompletionService.processRequest = async () => raw;
    await assert.rejects(f.api.requestCorrection(), /完整 JSON 数组/);
    assert.equal(f.parses.length, 0); assert.equal(f.writes.length, 0);
  }
});
const completePerson = (values = {}) => ({ 关系: '本局认识的同学', 态度印象: '正常交谈', 好感: 20,
  支援度: 0, 羁绊阶段: '未建立', 变化依据: '本轮实际交谈', ...values });
// 模拟真实桥接逐条验证整份状态；不允许测试替身宽松接受中间坏记录。
function useSchemaBridge(f) {
  const rejected = [];
  f.guard.parseRepair = async (patch, data) => {
    f.parses.push({ patch });
    const next = clone(data);
    for (const op of JSON.parse(patch)) {
      const candidate = clone(next.stat_data), parts = op.path.slice(1).split('/'), key = parts.pop();
      const parent = parts.reduce((node, part) => node[part], candidate);
      if (op.op === 'remove') delete parent[key]; else parent[key] = clone(op.value);
      const parsed = stateSchema.safeParse(candidate);
      if (parsed.success) next.stat_data = parsed.data; else rejected.push(op.path);
    }
    return next;
  };
  f.ready();
  return rejected;
}
for (const guarded of [false, true]) await check((guarded ? '约束' : '原生') + '副修复一次提交多人完整名册，先修结构再改场景并保留其他人物', async () => {
  const first = completePerson({ 支援度: 160, 羁绊阶段: 'S', 态度印象: '本轮建立协作' });
  const second = completePerson({ 好感: null, 支援度: null, 羁绊阶段: 'S', 关系: '待确认', 态度印象: '待确认', 变化依据: '本局仅确认姓名，其他待确认' });
  const f = fixture({ patch: [
    { op: 'replace', path: '/场景/地点', value: '演武场' },
    { op: 'replace', path: '/人际/甲', value: first },
    { op: 'remove', path: '/人际/甲/印象' },
    { op: 'remove', path: '/人际/甲/支援' },
    { op: 'replace', path: '/人际/乙', value: second },
  ] });
  const before = f.state();
  before.stat_data.人际 = { 甲: { 好感: 20, 印象: '旧简写', 支援: 160, 已知资料: { 身份: '本局已确认的同学' } },
    乙: { 好感: null }, 丙: completePerson({ 已知资料: { 灵装: '本局已展示的剑' } }) };
  f.save(before); f.context.chat[0].mes += block;
  const rejected = guarded ? useSchemaBridge(f) : [];
  const preview = await f.api.requestCorrection(), operations = JSON.parse(preview.patch);
  assert.deepEqual(operations.map(op => op.path), ['/人际', '/场景/地点']);
  assert.equal(operations[0].op, 'replace');
  assert.deepEqual(operations[0].value.丙, before.stat_data.人际.丙);
  assert.deepEqual(operations[0].value.甲.已知资料, before.stat_data.人际.甲.已知资料);
  assert.equal(Object.hasOwn(operations[0].value.甲, '印象'), false);
  assert.equal(Object.hasOwn(operations[0].value.甲, '支援'), false);
  assert.equal(operations[0].value.甲.羁绊阶段, 'B');
  assert.equal(operations[0].value.乙.羁绊阶段, '未定');
  await f.api.applyCorrection();
  assert.equal(f.api.getCorrectionStatus().state, 'applied');
  assert.equal(f.writes.length, 1); assert.deepEqual(rejected, []);
  assert.equal(stateSchema.safeParse(f.state().stat_data).success, true);
  assert.equal(f.state().stat_data.场景.地点, '演武场');
  assert.deepEqual(f.state().stat_data.人际.丙, before.stat_data.人际.丙);
});
await check('整个人物 replace 不暗删旧错键，未显式移除时明确报结构错误且不写入', async () => {
  const f = fixture({ patch: [{ op: 'replace', path: '/人际/甲', value: completePerson() }] });
  const before = f.state(); before.stat_data.人际.甲 = { 好感: 20, 印象: '旧简写', 已知资料: { 身份: '已确认身份' } };
  f.save(before); f.context.chat[0].mes += block;
  const rejected = useSchemaBridge(f), preview = await f.api.requestCorrection();
  const row = JSON.parse(preview.patch)[0].value.甲;
  assert.equal(row.印象, '旧简写'); assert.equal(row.已知资料.身份, '已确认身份');
  await assert.rejects(f.api.applyCorrection(), /校正结果仍不符合档案结构，未写入.*人际/s);
  assert.deepEqual(rejected, ['/人际']); assert.equal(f.writes.length, 0);
  assert.deepEqual(f.state(), before); assert.equal(f.api.getCorrectionStatus().state, 'failed');
});
await check('约束拒绝名册而接受了其它变化时，最终完整 schema 阻止假成功及部分保存', async () => {
  const f = fixture({ patch: [{ op: 'replace', path: '/人际/甲', value: completePerson() },
    { op: 'replace', path: '/场景/地点', value: '演武场' }] });
  const before = f.state(); before.stat_data.人际.甲 = { 好感: 20 };
  f.save(before); f.context.chat[0].mes += block;
  f.guard.parseRepair = async (_patch, data) => {
    const next = clone(data); next.stat_data.场景.地点 = '演武场'; return next;
  };
  f.ready(); await f.api.requestCorrection();
  await assert.rejects(f.api.applyCorrection(), /校正结果仍不符合档案结构，未写入.*人际\/甲/s);
  assert.equal(f.writes.length, 0); assert.deepEqual(f.state(), before);
  assert.equal(f.api.getCorrectionStatus().state, 'failed');
});
await check('已有阶段不能随意覆盖，但最终支援度按共享公式派生并可补缺阶段', () => {
  const f = fixture(), state = f.state().stat_data;
  state.人际.甲 = completePerson({ 支援度: 80, 羁绊阶段: 'C' });
  const ignored = f.api.normalizeCorrectionPatch([{ op: 'replace', path: '/人际/甲/羁绊阶段', value: 'S' }], state);
  assert.equal(ignored.length, 0); assert.ok(ignored.skipped.includes('/人际/甲/羁绊阶段'));
  const updated = f.api.normalizeCorrectionPatch([{ op: 'replace', path: '/人际/甲/支援度', value: 240 },
    { op: 'replace', path: '/人际/甲/羁绊阶段', value: 'S' }], state);
  assert.equal(updated[0].value.甲.羁绊阶段, 'A');
  delete state.人际.甲.羁绊阶段;
  const repaired = f.api.normalizeCorrectionPatch([{ op: 'replace', path: '/人际/甲/羁绊阶段', value: 'S' }], state);
  assert.equal(repaired[0].value.甲.羁绊阶段, 'C');
});
await check('人物契约使用精确字段名，未知数值不给默认奖励并要求显式删错键', () => {
  const rules = fixture().api.correctionRules({});
  assert.match(rules, /支援度0—320/); assert.doesNotMatch(rules, /支援0—320/);
  assert.match(rules, /关系、态度印象、好感、支援度、羁绊阶段、变化依据/);
  assert.match(rules, /分数无依据时用null/); assert.match(rules, /显式remove旧错键/);
});
console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length,
  runtime: '真实 correction.js 与事件接线；宿主、MVU、网络和时钟为内存替身，未连接酒馆', results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
