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
test('玩家初始化固定男性，人际仍为空对象而不预建 NPC', () => {
  assert.equal(INITIAL_STATE.玩家.性别, '男性');
  const parsed = schema.parse(clone(INITIAL_STATE));
  assert.equal(parsed.玩家.性别, '男性');
  assert.deepEqual(parsed.人际, {});
});
test('v4 缺少玩家性别可读为男性，不改原输入或框架快照', () => {
  const state = runtimeState();
  delete state.玩家.性别;
  const original = clone(state), parsed = schema.parse(state);
  assert.equal(parsed.玩家.性别, '男性');
  assert.equal(Object.hasOwn(state.玩家, '性别'), false);
  assert.deepEqual(state, original);
  assert.strictEqual(parsed.$internal, state.$internal);
});
test('玩家显式女性、未知、null 或其他值均拒绝，不按缺字段处理', () => {
  for (const value of ['女性', '未知', '', '男', null, 1, [], {}]) {
    const state = runtimeState();
    state.玩家.性别 = value;
    const original = clone(state), parsed = schema.safeParse(state);
    assert.equal(parsed.success, false, JSON.stringify(value));
    assert.ok(parsed.error.issues.some(issue => issue.path.join('/') === '玩家/性别'));
    assert.deepEqual(state, original);
  }
});
test('v4 缺少切入说明时补空串', () => {
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
  state.场景.当前卷 = 20;
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

const oldRelation = () => ({ 关系: '任教班级的学生', 态度印象: '初次介绍后尚待了解', 好感: null, 羁绊阶段: '未建立', 变化依据: '本局已完成师生介绍' });
function withKnownProfile(profile) {
  const state = runtimeState();
  state.人际.测试人物 = { ...oldRelation(), 已知资料: profile };
  return state;
}

test('旧人际记录缺少已知资料仍原样通过，不补全人物信息', () => {
  const state = runtimeState();
  state.人际.测试人物 = oldRelation();
  assert.deepEqual(schema.parse(state).人际, state.人际);
  assert.equal(Object.hasOwn(schema.parse(state).人际.测试人物, '已知资料'), false);
});

test('已知资料允许空对象、单项记录与明确空串，不填充未获知字段', () => {
  for (const profile of [{}, { 身份: '任教班级学生' }, { 灵装: '', 已知能力: '' }]) {
    assert.deepEqual(schema.parse(withKnownProfile(profile)).人际.测试人物.已知资料, profile);
  }
});

test('已获知资料四项原样保留，等级允许有来源限定的传闻文字', () => {
  const profile = { 身份: '受聘教官', 登记等级: '听本人称登记为 B 级，尚未核验', 灵装: '本人展示的刀形灵装', 已知能力: '切磋时展示过短暂的身体强化；其他能力未知' };
  const state = withKnownProfile(profile);
  const parsed = schema.parse(state);
  assert.deepEqual(parsed.人际.测试人物.已知资料, profile);
  assert.equal(parsed.人际.测试人物.好感, null);
  assert.equal(parsed.人际.测试人物.羁绊阶段, '未建立');
  assert.equal(parsed.玩家.登记等级, null);
});

test('已知资料字段拒绝非文本，不把数组或对象隐式转成资料', () => {
  for (const key of ['身份', '登记等级', '灵装', '已知能力']) {
    for (const value of [null, 1, true, [], {}]) {
      assert.equal(schema.safeParse(withKnownProfile({ [key]: value })).success, false, key + ':' + JSON.stringify(value));
    }
  }
  for (const profile of [null, [], '未知']) assert.equal(schema.safeParse(withKnownProfile(profile)).success, false);
});

test('已知资料严格限定四项且仍拒绝保留键，不扩展知情者数组', () => {
  for (const profile of [{ 知情者: [] }, { 秘密身份: '未揭露' }, JSON.parse('{"constructor":"非法"}')]) {
    assert.equal(schema.safeParse(withKnownProfile(profile)).success, false);
  }
});

test('自由关系允许教官、理事长等已确认关系，不强制固定学生名单', () => {
  const state = runtimeState();
  for (const [name, relation] of [['新宫寺黑乃', '本局已认识的理事长'], ['西京宁音', '尚无任教关系的同事']]) {
    state.人际[name] = { ...oldRelation(), 关系: relation };
  }
  assert.deepEqual(schema.parse(state).人际, state.人际);
});

test('新增人际字段保持可选，空人际初始化不增加人物或默认关系', () => {
  const initial = clone(INITIAL_STATE);
  assert.deepEqual(schema.parse(initial), initial);
  assert.deepEqual(initial.人际, {});
  const state = runtimeState();
  state.人际.旧人物 = oldRelation();
  const parsed = schema.parse(state).人际.旧人物;
  for (const field of ['性别', '恋爱阶段', '好感突破依据']) assert.equal(Object.hasOwn(parsed, field), false);
});

test('新增性别与突破依据仍按声明类型校验，不接受数组日志或隐式强转', () => {
  for (const [field, values] of [['性别', ['', '男', '女', null, 1, []]], ['好感突破依据', [null, 1, [], {}]]]) {
    for (const value of values) {
      const state = runtimeState();
      state.人际.测试人物 = { ...oldRelation(), [field]: value };
      const parsed = schema.safeParse(state);
      assert.equal(parsed.success, false);
      assert.ok(parsed.error.issues.some(issue => issue.path.join('/') === '人际/测试人物/' + field));
    }
  }
});

test('女性阶段派生保留本楼场景及框架快照，未知和男性不写恋爱阶段', () => {
  const state = runtimeState();
  state.场景.时间 = '本局确认的清晨'; state.场景.地点 = '本局确认的会客室';
  for (const gender of ['男性', '未知', '女性']) state.人际[gender] = { ...oldRelation(), 性别: gender, 好感: 800 };
  const original = clone(state), parsed = schema.parse(state);
  assert.equal(parsed.人际.女性.恋爱阶段, '交往');
  for (const gender of ['男性', '未知']) assert.equal(Object.hasOwn(parsed.人际[gender], '恋爱阶段'), false);
  assert.deepEqual(parsed.场景, state.场景); assert.strictEqual(parsed.$internal, state.$internal);
  assert.deepEqual(state, original);
});

const failed = results.filter(item => !item.passed);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
