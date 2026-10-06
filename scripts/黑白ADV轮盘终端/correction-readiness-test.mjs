import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Run the shipped correction module with only host, MVU and transport replaced.
// This is an offline readiness/lifecycle regression, not a live Tavern acceptance.
const source = fs.readFileSync(new URL('correction.js', import.meta.url), 'utf8');
const nativeSource = fs.readFileSync(new URL('../rakudai-mvu-native.mjs', import.meta.url), 'utf8').replace(/^export\s+/gm, '');
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

function fixture({ autoApply = true, connected = true, patch = [{ op: 'replace', path: '/场景/地点', value: '演武场' }] } = {}) {
  let now = 1000000, timerId = 0;
  const timers = new Map(), listeners = new Map(), requests = [], writes = [], parses = [];
  const storage = new Map([['rk:correction:connection', {
    endpoint: connected ? 'https://correction.invalid/v1' : '', model: connected ? 'offline-model' : '', apiKey: '', autoApply,
  }]]);
  const initial = { schema: '没有用别管这个', initialized_lorebooks: { fixture: [] }, stat_data: {
    系统: { 结构版本: 4, 开局状态: '已建档' },
    场景: { 当前卷: 1, 当前章: '第一章', 阶段: '进行中', 地点: '校门' },
    玩家: { 姓名: '测试角色' }, 人际: {},
  } };
  let persisted = clone(initial);
  const context = {
    chatId: 'readiness-chat', characterId: 1, groupId: null,
    chat: [{ mes: '上一条回复', is_user: false, swipe_id: 0 }],
    ChatCompletionService: {
      async processRequest(payload, _config, _quiet, signal) {
        assert.equal(signal.aborted, false);
        requests.push(clone(payload));
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
          assert.equal(op.op, 'add');
          assert.equal(data.schema.properties.人际.extensible, true, 'Native add must see an extensible record schema.');
          next.stat_data.人际[op.path.split('/')[2]] = clone(op.value);
        }
      }
      if (mvu.onParse) await mvu.onParse();
      next.schema = '没有用别管这个';
      return next;
    },
  };
  const guard = {
    growth: 'G03', repair: 'P02', repairSource: 'MVU01', storyRepair: 'S01', flexibleRepair: 'F01',
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
    window, HW, SS, Date: FixtureDate, AbortController, URL, structuredClone,
    LS: { get: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
      set: (key, value) => storage.set(key, value) },
    generationPending: false, terminalStateReader: { clear() {} },
    fn: name => helper[name], emit() {},
    stateService: () => ({ tournamentView: () => ({ calendar: {}, roster: [], warnings: [] }) }),
    setTimeout: (fn, ms) => setTimer(fn, ms, false), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => setTimer(fn, ms, true), clearInterval: id => timers.delete(id),
  });
  vm.runInContext(nativeSource + '\n' + source + '\nglobalThis.api = { requestCorrection, applyCorrection, getCorrectionStatus, ' +
    'wireAutomaticCorrection, startAutomaticCorrection, endAutomaticCorrection, cancelCorrection, correctionHostReset, correctionMainBusy, retryCorrection, correctionMvuBlock, getCorrectionInput };', realm);
  const api = realm.api;
  const TE = { CHARACTER_MESSAGE_RENDERED: 'host:rendered' };
  api.wireAutomaticCorrection((event, callback) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
  }, TE);
  function event(name, ...args) {
    for (const callback of listeners.get(name) || []) callback(...args);
  }
  async function advance(ms) {
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
      await timer.fn();
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
  function startTurn({ save = true, render = true, end = true, parsed = true, contentBlock = block } = {}) {
    api.startAutomaticCorrection();
    const previous = clone(persisted);
    context.chat.push({ mes: '本轮抵达走廊。' + contentBlock, is_user: false, swipe_id: 0 });
    const candidate = clone(previous);
    candidate.stat_data.场景.地点 = '走廊';
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
  return { api, HW, window, middle, top, guard, context, mvu, requests, writes, parses, ready, loading,
    advance, startTurn, assertNoWork, event, TE,
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

await check('约束就绪不能跳过主 MVU 保存一致性和渲染门禁', async () => {
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

await check('补丁别名的半截、混配、多块及非数组不能成为主保存候选', async () => {
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
  f.startTurn({ contentBlock: invalid[2] });
  await f.advance(182000);
  f.assertNoWork();
  assert.equal(f.api.getCorrectionStatus().mainSave, 'failed');
  assert.equal(f.api.getCorrectionStatus().scope, 'main');
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

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length,
  runtime: '真实 correction.js 与事件接线；宿主、MVU、网络和时钟为内存替身，未连接酒馆', results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
