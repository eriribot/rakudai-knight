import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { prepareRakudaiNativeMvu, rakudaiMvuRuntime, installRakudaiNativeMvu } from './rakudai-mvu-native.mjs';

const checks = [];
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
const sample = () => ({ stat_data: structuredClone(INITIAL_STATE), schema: '没有用别管这个', external: { retained: true } });
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
  assert.equal(first.state, 'ready'); assert.equal(f.handlers.size, 1);
  assert.equal(await installRakudaiNativeMvu(f.W), first); assert.equal(f.handlers.size, 1);
  const data = sample(); f.emit(data); assert.equal(data.schema.properties.人际.extensible, true);
  const other = sample(); f.switchCard(); f.emit(other); assert.equal(other.schema, '没有用别管这个');
  f.unload(); assert.equal(f.handlers.size, 0);
  const second = await installRakudaiNativeMvu(f.W); assert.notEqual(second, first); assert.equal(f.handlers.size, 1);
  first.destroy(); assert.equal(f.W.__RK_MVU_NATIVE_N01__, second); assert.equal(f.handlers.size, 1);
  second.destroy();
});
await check('加载失败可重试；其他结构版本不会被迁移', async () => {
  const f = fixture(), wait = f.W.waitGlobalInitialized;
  f.W.waitGlobalInitialized = async () => { throw new Error('MVU未就绪'); };
  assert.equal((await installRakudaiNativeMvu(f.W)).state, 'failed'); assert.equal(f.handlers.size, 0);
  f.W.waitGlobalInitialized = wait;
  assert.equal((await installRakudaiNativeMvu(f.W)).state, 'ready'); assert.equal(f.handlers.size, 1);
  const other = sample(); other.stat_data.系统.结构版本 = 3; f.emit(other); assert.equal(other.schema, '没有用别管这个'); f.unload();
});
console.log(JSON.stringify({ passed: checks.every(item => item.passed), checks }, null, 2));
if (checks.some(item => !item.passed)) process.exitCode = 1;
