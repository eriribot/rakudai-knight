import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSchema, INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';

const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const { z } = require('zod');
const schema = createSchema(z);
const results = [];
function test(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
const clone = value => structuredClone(value);
const runtimeState = () => ({
  ...clone(INITIAL_STATE),
  $internal: {
    display_data: { 玩家: { 综合初评: '待填写六维' } },
    delta_data: { 玩家: { 综合初评: { 分数: '+3' } } },
  },
});

test('完整运行时 stat_data 中的评级 replace 保留 $internal 原值', () => {
  const before = runtimeState();
  const beforeSnapshot = clone(before);
  const candidate = clone(before);
  candidate.玩家.综合初评 = {
    规则版本: 'R05-第一版', 分数: 3, 等级: 'D', 拟定登记等级: 'D',
    评定状态: '已计算', 待填写项: [],
  };
  const parsed = schema.parse(candidate);
  assert.equal(parsed.玩家.综合初评.分数, 3);
  assert.strictEqual(parsed.$internal, candidate.$internal);
  assert.deepEqual(parsed.$internal, before.$internal);
  assert.deepEqual(before, beforeSnapshot);
});
test('框架元数据不按业务字段递归校验', () => {
  const state = runtimeState();
  state.$internal = JSON.parse('{"display_data":{"constructor":"framework-only","__proto__":{"prototype":"retained"}},"delta_data":{"arbitrary":true}}');
  const parsed = schema.parse(state);
  assert.strictEqual(parsed.$internal, state.$internal);
  assert.deepEqual(Object.keys(parsed.$internal.display_data), ['constructor', '__proto__']);
});
test('初始化不伪造框架元数据', () => {
  assert.equal(Object.hasOwn(INITIAL_STATE, '$internal'), false);
  assert.equal(Object.hasOwn(schema.parse(clone(INITIAL_STATE)), '$internal'), false);
});
test('旧 v3 缺少切入说明时补空串', () => {
  const state = runtimeState();
  delete state.场景.切入说明;
  assert.equal(schema.parse(state).场景.切入说明, '');
});
test('已填切入说明原样保留', () => {
  const state = runtimeState();
  state.场景.切入说明 = '从宿舍走廊开始，尚未参与决斗。';
  assert.equal(schema.parse(state).场景.切入说明, state.场景.切入说明);
});
test('有框架元数据仍拒绝未知顶层业务字段', () => {
  assert.equal(schema.safeParse({ ...runtimeState(), 未知业务: 1 }).success, false);
});
test('有框架元数据仍拒绝未知嵌套业务字段', () => {
  const state = runtimeState();
  state.玩家.未知评级 = 'A';
  assert.equal(schema.safeParse(state).success, false);
});
test('框架字段仅允许在根层，不能扩散至玩家', () => {
  const state = runtimeState();
  state.玩家.$internal = {};
  assert.equal(schema.safeParse(state).success, false);
});
test('业务记录中的保留键仍被拒绝', () => {
  const state = runtimeState();
  state.玩家.其他能力 = JSON.parse('{"constructor":{"说明":"","条件与代价":"","掌握状态":"待确认"}}');
  assert.equal(schema.safeParse(state).success, false);
});
test('框架元数据不豁免卷数与固定字段约束', () => {
  const state = runtimeState();
  state.场景.当前卷 = 2;
  assert.equal(schema.safeParse(state).success, false);
  state.场景.当前卷 = 1;
  delete state.玩家.姓名;
  assert.equal(schema.safeParse(state).success, false);
});
test('切入说明拒绝非文本值', () => {
  const state = runtimeState();
  state.场景.切入说明 = 1;
  assert.equal(schema.safeParse(state).success, false);
});

const failed = results.filter(item => !item.passed);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
