// Execute the pinned upstream parser/update/schema bodies, with host/event doubles only.
// --fetch caches immutable upstream sources and actual Lodash/Klona/JSON5 libraries.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createSchema, INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { installRakudaiNativeMvu } from './rakudai-mvu-native.mjs';
import { repairRakudaiMvuStructure } from './rakudai-mvu-structure.mjs';
import { createRakudaiNativeSchema } from './rakudai-mvu-native.mjs';
import { installRakudaiMvuGrowth } from './rakudai-mvu-growth.mjs';

const commit = '61010dab47bc3a08a1b626320bf7fc8c9573eca4';
const directory = new URL('../output/native-mvu-repair/', import.meta.url);
const cacheDirectory = new URL('../世界书规则/MVU/验证记录/upstream/', import.meta.url);
const reportFile = new URL('../世界书规则/MVU/验证记录/终值成长/N04-native-core-report.json', import.meta.url);
const sources = Object.fromEntries([
  ['variable-def', 'src/variable_def.ts'], ['schema', 'src/function/schema.ts'],
  ['util', 'src/util.ts'], ['common', 'util/common.ts'],
  ['update-variables', 'src/function/update_variables.ts'],
].map(([key, file]) => [key, `https://raw.githubusercontent.com/MagicalAstrogy/MagVarUpdate/${commit}/${file}`]));
Object.assign(sources, {
  lodash: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.js',
  klona: 'https://cdn.jsdelivr.net/npm/klona@2.0.6/full/index.js',
  json5: 'https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.js',
});
const file = key => {
  const current = new URL(`native-core-${key}.txt`, cacheDirectory);
  return fs.existsSync(current) ? current : new URL(`native-core-${key}.txt`, directory);
};
if (process.argv.includes('--fetch')) {
  fs.mkdirSync(cacheDirectory, { recursive: true });
  await Promise.all(Object.entries(sources).map(async ([key, url]) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    fs.writeFileSync(new URL(`native-core-${key}.txt`, cacheDirectory), await response.text());
  }));
}
const hashes = Object.fromEntries(Object.entries(sources).map(([key, url]) => {
  const content = fs.readFileSync(file(key), 'utf8');
  return [key, { url, sha256: createHash('sha256').update(content).digest('hex') }];
}));
const warnings = [], events = [], handlers = new Map();
const unavailable = label => () => { throw new Error(`Uncovered dependency branch: ${label}`); };
const context = vm.createContext({
  console: { info() {}, log() {}, error() {}, warn: message => warnings.push(message) },
  exports: {}, setTimeout, clearTimeout,
  SillyTavern: { saveChat() {}, chat: [] },
  useDataStore: () => ({ should_enable: true, settings: { 通知: { 变量更新出错: false } } }),
  substitudeMacros: value => value,
  tr: (key, values) => key + ':' + JSON.stringify(values || {}),
  YAML: { parse: unavailable('YAML'), parseDocument: unavailable('YAML document'), stringify: unavailable('YAML stringify') },
  math: new Proxy({}, { get: (_object, name) => unavailable(`math.${String(name)}`) }),
  jsonrepair: unavailable('JSON repair'), compare: unavailable('version comparison'),
  eventEmit: async (name, ...args) => {
    events.push(name);
    for (const handler of handlers.get(name) || []) await handler(...args);
  },
});
for (const key of ['lodash', 'klona', 'json5']) vm.runInContext(fs.readFileSync(file(key), 'utf8'), context, { filename: `native-core-${key}.js` });
function loadTypeScript(key) {
  const source = fs.readFileSync(file(key), 'utf8')
    .replace(/^import\b[\s\S]*?;\s*/gm, '')
    .replace(/^export\s+\{[^\n]*\}\s+from[^\n]*;?\s*$/gm, '');
  const code = stripTypeScriptTypes(source, { mode: 'transform' }).replace(/^export\s+/gm, '');
  vm.runInContext(code, context, { filename: `native-core-${key}.js` });
}
for (const key of ['variable-def', 'schema', 'util', 'common', 'update-variables']) loadTypeScript(key);
const clone = value => JSON.parse(JSON.stringify(value));
const sample = () => {
  const data = { stat_data: repairRakudaiMvuStructure(structuredClone(INITIAL_STATE)), schema: '没有用别管这个',
    external: { retained: ['wrapper'] }, initialized_lorebooks: { retained: true } };
  data.stat_data.人际.旧同伴 = { 关系: '同伴', 好感: 19, 未知字段: { 保留: true } };
  data.stat_data.玩家.自定义数组 = ['甲', '乙'];
  return data;
};
const patch = operations => `<UpdateVariable><JSONPatch>${JSON.stringify(operations)}</JSONPatch></UpdateVariable>`;
const person = { 关系: '一年一班同级生', 态度印象: '初次交谈', 性别: '男性', 好感: 20,
  支援度: 10, 羁绊阶段: '未建立', 已知资料: { 身份: '破军学园一年级生', 灵装: '阴铁' } };
const checks = [];
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
await check('Actual upstream without N01 reproduces sentinel insert rejection', async () => {
  const data = sample(), before = clone(data.stat_data), start = warnings.length;
  const modified = await context.updateVariables(patch([{ op: 'add', path: '/人际/黑铁一辉', value: person }]), data);
  assert.equal(modified, false); assert.deepEqual(clone(data.stat_data), before);
  assert.ok(warnings.slice(start).some(value => value.includes('assignMissingParent')));
});
const lifecycle = new Map();
const hostContext = { characterId: 7, groupId: null, chatId: 'native-core-offline', chat: [] };
const request = { 来源事件: '战后复盘与弱点剖析', 目标: ['魔力控制'], 经验: 40, 成果: '厘清术伤与确信感关联' };
const requestOp = { op: 'add', path: '/玩家/成长/申请/战后复盘领悟', value: request };
await check('Without N03 the screenshot request fails even with an extensible schema', async () => {
  const data = sample(); delete data.stat_data.玩家.成长;
  data.schema = createRakudaiNativeSchema(data.stat_data);
  const before = clone(data.stat_data), start = warnings.length;
  assert.equal(await context.updateVariables(patch([requestOp]), data), false);
  assert.deepEqual(clone(data.stat_data), before);
  assert.ok(warnings.slice(start).some(value => value.includes('assignPrimitive') && value.includes('undefined')));
});
const W = {
  SillyTavern: { getContext: () => hostContext },
  console: { info() {} },
  Mvu: { events: vm.runInContext('variable_events', context) }, waitGlobalInitialized: async () => {},
  eventOn: (name, callback) => {
    if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback);
    return { stop: () => handlers.get(name).delete(callback) };
  },
  addEventListener: (name, callback) => lifecycle.set(name, callback),
  removeEventListener: name => lifecycle.delete(name),
  getChatMessages: id => {
    const indexes = id.includes('-') ? hostContext.chat.map((_, index) => index) : [Number(id)];
    return indexes.filter(index => hostContext.chat[index]).map(index => ({ message_id: index,
      message: hostContext.chat[index].mes, swipe_id: hostContext.chat[index].swipe_id }));
  },
};
W.Mvu.parseMessage = async (content, original) => {
  const data = clone(original); await context.updateVariables(content, data); return data;
};
const installation = await installRakudaiNativeMvu(W);
assert.equal(installation.state, 'ready', installation.message);
await check('N04 actual upstream folds missing people and schedule parents before applying child fields', async () => {
  const data = sample(), before = clone(data.stat_data);
  const operations = Object.entries(person).map(([key, value]) => ({ op: 'replace', path: '/人际/新同学/' + key, value }));
  operations.push({ op: 'add', path: '/场景/日程/训练约定/类型', value: '训练' },
    { op: 'replace', path: '/场景/日程/训练约定/说明', value: '明天实际安排' });
  const start = warnings.length;
  assert.equal(await context.updateVariables(patch(operations), data), true);
  assert.deepEqual(clone(data.stat_data.人际.新同学), person);
  assert.deepEqual(clone(data.stat_data.场景.日程), { 训练约定: { 类型: '训练', 说明: '明天实际安排' } });
  assert.deepEqual(clone(data.stat_data.人际.旧同伴), before.人际.旧同伴);
  assert.deepEqual(warnings.slice(start), []);
});
await check('N04 actual upstream adapts a missing optional leaf and preserves mixed unsupported batches', async () => {
  const data = sample();
  assert.equal(await context.updateVariables(patch([{ op: 'replace', path: '/人际/旧同伴/联系状态', value: '已建立联系' }]), data), true);
  assert.equal(data.stat_data.人际.旧同伴.联系状态, '已建立联系');
  const start = warnings.length;
  assert.equal(await context.updateVariables(patch([
    { op: 'replace', path: '/场景/地点', value: '教学楼' },
    { op: 'remove', path: '/人际/旧同伴/联系状态' },
    { op: 'add', path: '/人际/缺父新人/好感', value: 3 },
  ]), data), true);
  assert.equal(data.stat_data.场景.地点, '教学楼');
  assert.equal(data.stat_data.人际.旧同伴.联系状态, undefined);
  assert.equal(data.stat_data.人际.缺父新人, undefined);
  assert.ok(warnings.slice(start).some(value => value.includes('assignPrimitive')));
});
await check('N04 folds a complete new record before per-command strict schema validation without inventing missing fields', async () => {
  const { z } = createRequire(import.meta.url)('../output/worldbook-calibration/dev/node_modules/zod');
  const schema = createSchema(z), rejected = [], shapes = [];
  // Matching bridge order, real schema; the bridge listener is the only doubled validation component.
  const validation = W.eventOn(W.Mvu.events.COMMAND_PARSED + '_for_zod', (variables, commands) => {
    for (const command of commands) {
      const op = JSON.parse(command.full_match), next = clone(variables.stat_data), parts = op.path.slice(1).split('/');
      shapes.push(op.path);
      const key = parts.pop(), parent = parts.reduce((node, part) => node[part], next);
      parent[key] = op.value;
      const parsed = schema.safeParse(next);
      if (parsed.success) variables.stat_data = parsed.data;
      else rejected.push(op.path);
    }
    commands.length = 0;
  });
  try {
    const data = { stat_data: repairRakudaiMvuStructure(clone(INITIAL_STATE)) };
    const full = { ...person, 变化依据: '本轮初次交谈' };
    await context.updateVariables(patch(Object.entries(full).map(([key, value]) => ({ op: 'replace', path: '/人际/新同学/' + key, value }))), data);
    assert.deepEqual(shapes, ['/人际/新同学']);
    assert.deepEqual(rejected, []); assert.equal(data.stat_data.人际.新同学.好感, 20);
    await context.updateVariables(patch([{ op: 'replace', path: '/人际/缺资料者/好感', value: 3 }]), data);
    assert.equal(data.stat_data.人际.缺资料者, undefined);
    assert.deepEqual(rejected, ['/人际/缺资料者']);
  } finally { validation.stop(); }
});
await check('N03 repairs parents before the original screenshot request and preserves other data', async () => {
  const data = sample(); delete data.stat_data.玩家.成长;
  const wrapper = clone(data.external), people = clone(data.stat_data.人际);
  assert.equal(await context.updateVariables(patch([requestOp]), data), true);
  assert.deepEqual(clone(data.stat_data.玩家.成长.申请.战后复盘领悟), request);
  assert.deepEqual(clone(data.external), wrapper); assert.deepEqual(clone(data.stat_data.人际), people);
  assert.deepEqual(clone(data.stat_data.玩家.成长.经验), { 魔力控制: 0, 体能: 0, 魔力量: 0 });
});
await check('N03 fills only missing requests and preserves experience and history on replay', async () => {
  const data = sample();
  data.stat_data.玩家.成长 = { 经验: { 魔力控制: 35, 体能: 9 }, 记录: { 既存: { 未知字段: true } } };
  const prior = clone(data.stat_data.玩家.成长);
  assert.equal(await context.updateVariables(patch([requestOp]), data), true);
  const saved = clone(data.stat_data);
  assert.deepEqual(clone(data.stat_data.玩家.成长.经验), { ...prior.经验, 魔力量: 0 });
  assert.deepEqual(clone(data.stat_data.玩家.成长.记录), prior.记录);
  assert.equal(await context.updateVariables(patch([requestOp]), data), false);
  assert.deepEqual(clone(data.stat_data), saved);
});
await check('N03 never replaces an invalid existing growth container', async () => {
  for (const value of [null, 5, '旧坏值', []]) {
    const data = sample(); data.stat_data.玩家.成长 = value;
    const before = clone(data.stat_data);
    assert.equal(await context.updateVariables(patch([requestOp]), data), false);
    assert.deepEqual(clone(data.stat_data), before);
  }
});
await check('N03 lets vanilla MVU replace a final experience leaf when growth or experience was missing', async () => {
  for (const missing of ['成长', '经验', '轴']) {
    const data = sample();
    if (missing === '成长') delete data.stat_data.玩家.成长;
    else if (missing === '经验') delete data.stat_data.玩家.成长.经验;
    else data.stat_data.玩家.成长.经验 = { 体能: 9 };
    const wrapper = clone(data.external);
    assert.equal(await context.updateVariables(patch([
      { op: 'replace', path: '/玩家/成长/经验/魔力控制', value: 130 },
      { op: 'replace', path: '/玩家/六维/魔力控制', value: 'F+' },
    ]), data), true);
    assert.equal(data.stat_data.玩家.成长.经验.魔力控制, 130);
    assert.equal(data.stat_data.玩家.六维.魔力控制, 'F+');
    assert.equal(data.stat_data.玩家.成长.经验.体能, missing === '轴' ? 9 : 0);
    assert.equal(data.stat_data.玩家.成长.经验.魔力量, 0);
    assert.equal(Object.hasOwn(data.stat_data.玩家.成长, '记录'), false);
    assert.deepEqual(clone(data.external), wrapper);
  }
});
await check('Actual upstream add inserts person and preserves all previous business data/wrappers', async () => {
  const data = sample(), expected = clone(data.stat_data), wrapper = data.external, reference = data.stat_data;
  expected.人际.黑铁一辉 = clone(person);
  assert.equal(await context.updateVariables(patch([{ op: 'add', path: '/人际/黑铁一辉', value: person }]), data), true);
  assert.deepEqual(clone(data.stat_data), expected); assert.equal(data.stat_data, reference);
  assert.equal(data.external, wrapper); assert.deepEqual(data.initialized_lorebooks, { retained: true });
  assert.equal(data.schema.properties.人际.extensible, true); assert.equal(data.schema.strictSet, true);
});
await check('Actual upstream same-patch nested map insertion works after a new person', async () => {
  const data = sample(), expected = clone(data.stat_data);
  expected.人际.黑铁一辉 = { ...clone(person), 已知资料: { ...person.已知资料, 已知能力: '本局确认的剑术' } };
  await context.updateVariables(patch([
    { op: 'add', path: '/人际/黑铁一辉', value: person },
    { op: 'add', path: '/人际/黑铁一辉/已知资料/已知能力', value: '本局确认的剑术' },
  ]), data);
  assert.deepEqual(clone(data.stat_data), expected);
});
await check('Actual upstream replace treats two-string array as an ordinary array', async () => {
  const data = sample(), expected = clone(data.stat_data);
  expected.玩家.自定义数组 = ['丙', '丁'];
  await context.updateVariables(patch([{ op: 'replace', path: '/玩家/自定义数组', value: ['丙', '丁'] }]), data);
  assert.deepEqual(clone(data.stat_data), expected);
});
await check('Actual upstream add to another empty nested map preserves existing state', async () => {
  const data = sample(), expected = clone(data.stat_data);
  const value = { 说明: '本局确认', 条件与代价: '已确认', 掌握状态: '待确认' };
  expected.玩家.其他能力.本局能力 = value;
  await context.updateVariables(patch([{ op: 'add', path: '/玩家/其他能力/本局能力', value }]), data);
  assert.deepEqual(clone(data.stat_data), expected);
});
await check('Actual upstream accepts snake and mixed-case JSONPatch tags with update_analysis', async () => {
  for (const tag of ['json_patch', 'JsOn_PaTcH', 'JSONPatch']) {
    const data = sample(), expected = clone(data.stat_data);
    expected.人际.黑铁一辉 = clone(person);
    const input = '<UpdateVariable><update_analysis>First greeting; confirmed profile.</update_analysis><' + tag + '>' +
      JSON.stringify([{ op: 'add', path: '/人际/黑铁一辉', value: person }]) + '</' + tag + '></UpdateVariable>';
    assert.equal(await context.updateVariables(input, data), true);
    assert.deepEqual(clone(data.stat_data), expected);
  }
});
await check('Actual upstream mismatched patch tags do not apply the embedded operation', async () => {
  const data = sample(), expected = clone(data.stat_data);
  const input = '<UpdateVariable><json_patch>' +
    JSON.stringify([{ op: 'add', path: '/人际/黑铁一辉', value: person }]) + '</JSONPatch></UpdateVariable>';
  assert.equal(await context.updateVariables(input, data), false);
  assert.deepEqual(clone(data.stat_data), expected);
});
const growthInstallation = await installRakudaiMvuGrowth(W);
assert.equal(growthInstallation.state, 'ready', growthInstallation.message);
await check('Pinned upstream parser + N03 + standalone G04 save the original legacy request and reward once', async () => {
  const data = sample(); delete data.stat_data.玩家.成长;
  data.stat_data.系统.开局状态 = '已建档'; data.stat_data.玩家.六维.魔力控制 = 'F';
  data.stat_data.场景.当前章 = '第一章';
  const value = { 卷号: 1, 章段: '第一章', 结果: '本轮战后复盘实际完成', 参与者: ['测试玩家'], 知情者: [] };
  const content = patch([{ op: 'add', path: '/场景/已发生事件/战后复盘与弱点剖析', value }, requestOp]);
  hostContext.chat = [{ mes: content, swipe_id: 0 }];
  assert.equal(await context.updateVariables(content, data), true);
  assert.equal(data.stat_data.玩家.成长.经验.魔力控制, 40);
  assert.equal(data.stat_data.玩家.六维.魔力控制, 'F');
  const saved = clone(data.stat_data.玩家.成长);
  await context.updateVariables(content, data);
  assert.equal(data.stat_data.玩家.成长.经验.魔力控制, 40);
  assert.deepEqual(clone(data.stat_data.玩家.成长.记录), saved.记录);
  assert.deepEqual(clone(data.external), { retained: ['wrapper'] });
});
await check('Pinned upstream N03 + G04 preserves ordinary patch data while an enabled guard is loading', async () => {
  const data = sample(); delete data.stat_data.玩家.成长;
  // 已可写的原生 schema 与正在加载的 guard 并存时，N03只补缺项，G04不结算。
  data.schema = createRakudaiNativeSchema(data.stat_data);
  W.__RK_MVU_GUARD_BOOT_V4__ = { state: 'loading' };
  hostContext.chat = [{ mes: patch([requestOp]), swipe_id: 0 }];
  const originalSchema = data.schema;
  let startedSchema;
  const observer = W.eventOn(W.Mvu.events.VARIABLE_UPDATE_STARTED, variables => { startedSchema = variables.schema; });
  await context.updateVariables(hostContext.chat[0].mes, data);
  observer.stop();
  // 上游在补丁应用后会自行重新生成schema；只核对N03在STARTED未换结构。
  assert.equal(startedSchema, originalSchema);
  assert.deepEqual(clone(data.stat_data.玩家.成长.经验), { 魔力控制: 0, 体能: 0, 魔力量: 0 });
  delete W.__RK_MVU_GUARD_BOOT_V4__;
});
growthInstallation.destroy();
installation.destroy();
await check('Pinned handleVariablesInMessage persists a fresh ENDED delta receipt only after the message write, including a >300ms delayed no-op', async () => {
  const oldSettings = context.useDataStore, oldChat = context.SillyTavern.chat;
  try {
    for (const delayAt of ['text', 'chat']) {
      const data = sample(); data.schema = createRakudaiNativeSchema(data.stat_data);
      data.delta_data = { $internal: { __rk_main_save: { id: 'previous' } } };
      const chat = [
        { role: 'assistant', mes: '旧楼层', variables: [clone(data)], swipe_id: 0 },
        { role: 'assistant', mes: '完整正文，没有变量补丁。', variables: [clone(data)], swipe_id: 0 },
      ];
      context.SillyTavern.chat = chat;
      context.useDataStore = () => ({ settings: { 通知: { 变量更新出错: false } }, effective_settings: { 兼容性: { 更新到聊天变量: delayAt === 'chat' } } });
      context.getChatMessages = id => [{ role: chat[id].role, message: chat[id].mes, message_id: id }];
      const id = 'current-' + delayAt, phases = [];
      let unblock, reached;
      const barrier = new Promise(resolve => { unblock = resolve; }), suspended = new Promise(resolve => { reached = resolve; });
      const receipt = W.eventOn(W.Mvu.events.VARIABLE_UPDATE_ENDED, variables => {
        assert.equal(variables.delta_data.$internal, undefined);
        variables.delta_data.$internal = { __rk_main_save: { id } };
        phases.push('receipt');
      });
      context.setChatMessages = async changes => {
        for (const change of changes) if (Object.hasOwn(change, 'message')) {
          chat[change.message_id].mes = change.message;
          if (delayAt === 'text') { reached(); await barrier; }
        }
      };
      context.updateVariablesWith = async (updater, options) => {
        if (options.type === 'chat') { reached(); await barrier; return; }
        phases.push('message-write');
        chat[options.message_id].variables[0] = updater(chat[options.message_id].variables[0]);
      };
      const main = context.handleVariablesInMessage(1);
      try {
        await suspended;
        await new Promise(resolve => setTimeout(resolve, 325));
        assert.notEqual(chat[1].variables[0].delta_data?.$internal?.__rk_main_save?.id, id);
        assert.deepEqual(phases, ['receipt']);
        unblock(); await main;
        assert.equal(chat[1].variables[0].delta_data.$internal.__rk_main_save.id, id);
        assert.deepEqual(phases, ['receipt', 'message-write']);
        receipt.stop();
        const next = clone(chat[1].variables[0]);
        await context.updateVariables(patch([]), next);
        assert.equal(next.delta_data.$internal, undefined, 'next update replaces the old delta and cannot reuse its receipt');
      } finally { unblock(); await main; receipt.stop(); }
    }
  } finally { context.useDataStore = oldSettings; context.SillyTavern.chat = oldChat; }
});
const report = { evidence: 'Actual pinned upstream TypeScript bodies executed after type stripping; host/events doubled; no live Tavern writes.',
  commit, runtime: process.version,
  nativeVersion: 'N04', nativeSha256: createHash('sha256').update(fs.readFileSync(new URL('./rakudai-mvu-native.mjs', import.meta.url))).digest('hex'),
  hashes, checks, passed: checks.every(value => value.passed),
  events: [...new Set(events)], uncovered: ['invalid JSON/YAML/math fallback', 'host floor/swipe persistence', 'real iframe lifecycle', 'Zod bridge listeners'] };
fs.mkdirSync(new URL('./', reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, checks, report: fileURLToPath(reportFile) }, null, 2));
if (!report.passed) process.exitCode = 1;
