import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { prepareRakudaiNativeMvu, rakudaiMvuRuntime, installRakudaiNativeMvu } from './rakudai-mvu-native.mjs';
import { repairRakudaiMvuStructure } from './rakudai-mvu-structure.mjs';
import { normalizeRakudaiMvuCommands } from './rakudai-mvu-patch.mjs';

const checks = [];
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
const sample = () => ({ stat_data: repairRakudaiMvuStructure(structuredClone(INITIAL_STATE)), schema: '没有用别管这个', external: { retained: true } });
const legacy = () => { const data = sample(); delete data.stat_data.玩家.成长; return data; };
await check('新初始化只有经验三轴零初值，不生成申请、收据或奖励', () => {
  assert.deepEqual(INITIAL_STATE.玩家.成长, { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 } });
});
await check('纯结构修复补双缺容器，保留业务值、未知字段与调用方', () => {
  const state = legacy().stat_data;
  state.玩家.未知 = { 保留: ['原值'] }; state.外部资料 = { 保留: true };
  const before = structuredClone(state), repaired = repairRakudaiMvuStructure(state);
  assert.deepEqual(state, before); assert.notEqual(repaired, state); assert.notEqual(repaired.玩家, state.玩家);
  assert.deepEqual(repaired, { ...before, 玩家: { ...before.玩家, 成长: { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 }, 申请: {} } } });
  assert.equal(repaired.场景, state.场景); assert.equal(repaired.人际, state.人际);
  assert.equal(repaired.玩家.未知, state.玩家.未知); assert.equal(repaired.外部资料, state.外部资料);
  assert.equal(repairRakudaiMvuStructure(repaired), repaired);
});
await check('只缺申请时保留经验、旧收据与未知字段；完整状态无变化', () => {
  const state = sample().stat_data;
  state.玩家.成长 = { 经验: { 魔力控制: 40 }, 记录: { 旧收据: { 获得: 7 } }, 未知: ['原样'] };
  const before = structuredClone(state), repaired = repairRakudaiMvuStructure(state);
  assert.deepEqual(state, before);
  assert.deepEqual(repaired.玩家.成长, { ...before.玩家.成长, 经验: { 魔力控制: 40, 体能: 0, 魔力量: 0 }, 申请: {} });
  assert.notEqual(repaired.玩家.成长.经验, state.玩家.成长.经验);
  assert.equal(repaired.玩家.成长.经验.魔力控制, state.玩家.成长.经验.魔力控制);
  assert.equal(repaired.玩家.成长.记录, state.玩家.成长.记录);
  repaired.玩家.成长.申请.既有申请 = { 来源事件: '原事件', 经验: 40 };
  assert.equal(repairRakudaiMvuStructure(repaired), repaired);
});
await check('成长或申请已有null、数组和原始坏值一律保留', () => {
  for (const value of [null, [], [1], 0, false, '坏值', undefined]) {
    const state = sample().stat_data; state.玩家.成长 = value;
    assert.equal(repairRakudaiMvuStructure(state), state); assert.equal(state.玩家.成长, value);
    state.玩家.成长 = { 未知: '保留', 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 }, 申请: value };
    assert.equal(repairRakudaiMvuStructure(state), state); assert.equal(state.玩家.成长.申请, value);
  }
});
await check('经验容器与轴的已有坏值不覆盖；只填真正缺失的轴', () => {
  for (const value of [null, [], 0, false, '坏值', undefined]) {
    const state = sample().stat_data; state.玩家.成长.经验 = value;
    assert.equal(repairRakudaiMvuStructure(state), state);
    assert.equal(state.玩家.成长.经验, value);
    state.玩家.成长.经验 = { 魔力控制: value, 体能: 7 };
    const before = structuredClone(state), repaired = repairRakudaiMvuStructure(state);
    assert.deepEqual(state, before);
    assert.deepEqual(repaired.玩家.成长.经验, { 魔力控制: value, 体能: 7, 魔力量: 0 });
    assert.equal(repairRakudaiMvuStructure(repaired), repaired);
  }
});
await check('新建档模式仅补经验，旧申请历史保持原样且不补新申请', () => {
  const state = legacy().stat_data;
  const repaired = repairRakudaiMvuStructure(state, { legacyRequests: false });
  assert.deepEqual(repaired.玩家.成长, { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 } });
  assert.equal(repairRakudaiMvuStructure(repaired, { legacyRequests: false }), repaired);
  repaired.玩家.成长.申请 = { 历史: { 目标: ['体能', '魔力控制'], 经验: 90 } };
  assert.equal(repairRakudaiMvuStructure(repaired, { legacyRequests: false }), repaired);
});
await check('非本卡v4中文结构不补容器，不猜测坏掉的玩家父对象', () => {
  for (const state of [null, [], { profile: {} }, { 系统: { 结构版本: 4 } }]) assert.equal(repairRakudaiMvuStructure(state), state);
  for (const version of [2, 3, '4', undefined]) {
    const state = legacy().stat_data; state.系统.结构版本 = version;
    assert.equal(repairRakudaiMvuStructure(state), state);
  }
  for (const value of [null, [], 0, '坏值']) {
    const state = legacy().stat_data; state.玩家 = value;
    assert.equal(repairRakudaiMvuStructure(state), state);
  }
});
await check('迁移哨兵/锁定原生结构，保留全部业务值和外部包装，不推导内部镜像', () => {
  for (const old of ['没有用别管这个', { type: 'object', properties: {}, extensible: false }]) {
    const data = sample(); data.schema = old;
    data.stat_data.人际.旧同伴 = { 关系: '同伴', 好感: 20, 自定义资料: { 保留: true } };
    data.stat_data.场景.已发生事件.事件 = { 参与者: ['甲', '乙'] };
    data.stat_data.$internal = { display_data: { 不推导: true } };
    const reference = data.stat_data, before = structuredClone(data.stat_data);
    assert.equal(prepareRakudaiNativeMvu(data), data);
    assert.equal(data.stat_data, reference); assert.deepEqual(data.stat_data, before);
    assert.deepEqual(data.external, { retained: true });
    assert.equal(data.schema.properties.$internal, undefined);
    assert.equal(data.schema.properties.人际.extensible, true);
    assert.equal(data.schema.properties.人际.properties.旧同伴.required, false);
    assert.equal(data.schema.properties.人际.properties.旧同伴.properties.自定义资料.extensible, true);
    assert.equal(data.schema.properties.场景.properties.已发生事件.properties.事件.properties.参与者.type, 'array');
    assert.equal(data.schema.strictSet, true);
    assert.equal(data.schema.extensible, false);
  }
});
await check('原生准备幂等，未知子字段、空/混合数组与模板保存', () => {
  const data = sample(); data.stat_data.玩家.自定义 = { 列表: [null, { 名称: '保持原值' }] };
  prepareRakudaiNativeMvu(data); data.schema.properties.人际.template = { 联系状态: '仅识别' };
  const before = structuredClone(data); prepareRakudaiNativeMvu(data);
  assert.deepEqual(data, before); assert.deepEqual(data.schema.properties.人际.template, { 联系状态: '仅识别' });
});
await check('桥接加载、注册后失败、有效guard与不完整ready都不误入原生', () => {
  const guard = { version: '4.0.0' };
  for (const scope of [
    { __RK_MVU_GUARD_BOOT_V4__: { state: 'loading' } },
    { __RK_MVU_GUARD_BOOT_V4__: { state: 'failed', bridgeActive: true } },
    { __RK_MVU_GUARD_BOOT_V4__: { state: 'ready' } },
    { __RK_MVU_GUARD_V4__: guard },
    { __RK_MVU_GUARD_V3__: { version: '3.0.0' } },
    { __RK_MVU_GUARD_BOOT_V4__: { state: 'ready', bridgeActive: true, guard }, __RK_MVU_GUARD_V4__: guard },
  ]) {
    const data = sample(); prepareRakudaiNativeMvu(data, [scope]); assert.equal(data.schema, '没有用别管这个');
    assert.notEqual(rakudaiMvuRuntime([scope]).mode, 'native');
  }
});
await check('结构修复先于运行模式判断；Zod、加载和失败状态仍保留schema门禁', () => {
  const guard = { version: '4.0.0' };
  for (const [mode, scope] of [
    ['native', {}],
    ['zod', { __RK_MVU_GUARD_V4__: guard }],
    ['loading', { __RK_MVU_GUARD_BOOT_V4__: { state: 'loading' } }],
    ['failed', { __RK_MVU_GUARD_BOOT_V4__: { state: 'failed', bridgeActive: true } }],
  ]) {
    const data = legacy(), wrapper = data.external;
    prepareRakudaiNativeMvu(data, [scope]);
    assert.deepEqual(data.stat_data.玩家.成长, { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 }, 申请: {} }); assert.equal(data.external, wrapper);
    assert.equal(rakudaiMvuRuntime([scope]).mode, mode);
    if (mode === 'native') assert.equal(data.schema.properties.玩家.properties.成长.properties.申请.extensible, true);
    else assert.equal(data.schema, '没有用别管这个');
  }
});
await check('终值约束已就绪时只补经验，不制造空申请或替换Zod schema', () => {
  const data = legacy(), guard = { version: '4.0.0', growthProtocol: 'final-values-v1' };
  const scope = { __RK_MVU_GUARD_V4__: guard,
    __RK_MVU_GUARD_BOOT_V4__: { state: 'ready', guard } };
  prepareRakudaiNativeMvu(data, [scope]);
  assert.deepEqual(data.stat_data.玩家.成长, { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 } });
  assert.equal(data.schema, '没有用别管这个');
  const before = structuredClone(data);
  prepareRakudaiNativeMvu(data, [scope]);
  assert.deepEqual(data, before);
});
await check('跨源top不可访问时仍识别同源parent的实际guard', () => {
  const W = { parent: { __RK_MVU_GUARD_V4__: { version: '4.0.0' } } };
  Object.defineProperty(W, 'top', { get() { throw new Error('Cross-origin'); } });
  assert.equal(rakudaiMvuRuntime([W]).mode, 'zod');
});
function fixture() {
  const handlers = new Set(), unload = new Set(); let ctx = { characterId: 7, groupId: null };
  const W = {
    SillyTavern: { getContext: () => ctx },
    Mvu: { events: { VARIABLE_UPDATE_STARTED: 'started' } },
    waitGlobalInitialized: async () => {},
    eventOn: (event, callback) => { assert.equal(event, 'started'); handlers.add(callback); return { stop: () => handlers.delete(callback) }; },
    addEventListener: (event, callback) => { if (event === 'pagehide') unload.add(callback); },
    removeEventListener: (event, callback) => unload.delete(callback),
  };
  return { W, handlers, emit: value => handlers.forEach(callback => callback(value)),
    switchCard: () => { ctx = { characterId: 8, groupId: null }; }, unload: () => [...unload].forEach(callback => callback()) };
}
await check('独立监听只处理本卡事件参数；关闭/重开不重复注册、不写楼层', async () => {
  const f = fixture(); const first = await installRakudaiNativeMvu(f.W);
  assert.equal(first.state, 'ready'); assert.equal(first.version, 'N04'); assert.equal(f.handlers.size, 1);
  assert.equal(await installRakudaiNativeMvu(f.W), first); assert.equal(f.handlers.size, 1);
  const data = sample(); f.emit(data); assert.equal(data.schema.properties.人际.extensible, true);
  const other = legacy(); f.switchCard(); f.emit(other); assert.equal(other.schema, '没有用别管这个');
  assert.equal(Object.hasOwn(other.stat_data.玩家, '成长'), false);
  f.unload(); assert.equal(f.handlers.size, 0);
  const second = await installRakudaiNativeMvu(f.W); assert.notEqual(second, first); assert.equal(f.handlers.size, 1);
  first.destroy(); assert.equal(f.W.__RK_MVU_NATIVE_N01__, second); assert.equal(f.handlers.size, 1);
  second.destroy();
});
await check('STARTED事件在两种模式及加载/失败状态补齐父容器，仅原生模式重建schema', async () => {
  for (const mode of ['native', 'zod', 'loading', 'failed']) {
    const f = fixture(); await installRakudaiNativeMvu(f.W);
    if (mode === 'zod') f.W.__RK_MVU_GUARD_V4__ = { version: '4.0.0' };
    if (['loading', 'failed'].includes(mode)) f.W.__RK_MVU_GUARD_BOOT_V4__ = { state: mode };
    const data = legacy(); f.emit(data);
    assert.deepEqual(data.stat_data.玩家.成长, { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 }, 申请: {} });
    if (mode === 'native') assert.equal(data.schema.strictSet, true);
    else assert.equal(data.schema, '没有用别管这个');
    f.unload(); assert.equal(f.handlers.size, 0);
  }
});
await check('N04沿用原slot替换N01/N02/N03且重复安装保持唯一监听', async () => {
  for (const version of ['N01', 'N02', 'N03']) {
    const f = fixture(); let destroyed = 0;
    f.W.__RK_MVU_NATIVE_N01__ = { version, state: 'ready', destroy: () => destroyed++ };
    const marker = await installRakudaiNativeMvu(f.W);
    assert.equal(destroyed, 1); assert.equal(marker.version, 'N04'); assert.equal(f.W.__RK_MVU_NATIVE_N01__, marker);
    assert.equal(await installRakudaiNativeMvu(f.W), marker); assert.equal(f.handlers.size, 1);
    f.unload(); assert.equal(f.handlers.size, 0);
  }
});
await check('加载失败可重试；其他结构版本不会被迁移', async () => {
  const f = fixture(), wait = f.W.waitGlobalInitialized;
  f.W.waitGlobalInitialized = async () => { throw new Error('MVU未就绪'); };
  assert.equal((await installRakudaiNativeMvu(f.W)).state, 'failed'); assert.equal(f.handlers.size, 0);
  f.W.waitGlobalInitialized = wait;
  assert.equal((await installRakudaiNativeMvu(f.W)).state, 'ready'); assert.equal(f.handlers.size, 1);
  const other = sample(); other.stat_data.系统.结构版本 = 3; f.emit(other); assert.equal(other.schema, '没有用别管这个'); f.unload();
});
const nativeCommand = (op, path, value) => {
  const parts = path.slice(1).split('/'), commandPath = keys => keys.map(key => '[' + JSON.stringify(key) + ']').join('');
  return { type: op === 'replace' ? 'set' : 'insert', reason: 'json_patch', full_match: JSON.stringify({ op, path, value }),
    args: op === 'replace' ? [commandPath(parts), JSON.stringify(value)] :
      [commandPath(parts.slice(0, -1)), JSON.stringify(parts.at(-1)), JSON.stringify(value)] };
};
await check('N04纯归一合并缺父记录并纠正replace缺字段，不修改输入', () => {
  const state = sample().stat_data;
  const commands = [nativeCommand('replace', '/人际/新人/关系', '同学'), nativeCommand('add', '/人际/新人/好感', 4),
    nativeCommand('replace', '/场景/地点', '教室')];
  const before = structuredClone({ state, commands }), normalized = normalizeRakudaiMvuCommands(commands, state);
  assert.deepEqual({ state, commands }, before);
  assert.equal(normalized.length, 2);
  assert.deepEqual(JSON.parse(normalized[0].full_match), { op: 'add', path: '/人际/新人', value: { 关系: '同学', 好感: 4 } });
  assert.equal(normalized[1], commands[2]);
  assert.equal(normalizeRakudaiMvuCommands(normalized, state), normalized);
});
await check('N04遇到混合操作、数组路径、坏父或既有容器替换时完全保留原命令', () => {
  const state = sample().stat_data;
  state.人际.坏父 = null; state.场景.日程 = [];
  const normal = nativeCommand('replace', '/人际/新人/好感', 4);
  const cases = [
    [normal, { ...normal, reason: 'script' }],
    [normal, { ...normal, full_match: '{"op":"remove","path":"/人际/旧人物"}' }],
    [normal, nativeCommand('add', '/人际/坏父/好感', 4)],
    [normal, nativeCommand('add', '/场景/日程/0', {})],
    [normal, nativeCommand('replace', '/人际', {})],
    [normal, nativeCommand('add', '/系统/新字段', 1)],
    [normal, nativeCommand('add', '/人际/__proto__/污染', true)],
    [normal, { ...normal, args: ['其他监听器已修改'] }],
  ];
  for (const commands of cases) {
    const before = structuredClone({ state, commands });
    assert.equal(normalizeRakudaiMvuCommands(commands, state), commands);
    assert.deepEqual({ state, commands }, before);
  }
});
const report = { passed: checks.every(item => item.passed), checks };
const reportDirectory = new URL('../世界书规则/MVU/验证记录/终值成长/', import.meta.url);
fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(new URL('N04结构兼容验证.json', reportDirectory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (checks.some(item => !item.passed)) process.exitCode = 1;
