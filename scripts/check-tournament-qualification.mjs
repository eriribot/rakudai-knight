import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE, createSchema } from '../世界书规则/MVU/schema.mjs';
import { createStateController, validateStateOperation } from './rakudai-state-core.mjs';
import { prepareTournamentAction, createNationalTournamentSchema } from './rakudai-tournament.mjs';
import { createRakudaiNativeSchema } from './rakudai-mvu-native.mjs';

const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), clone = structuredClone, results = [];
function state(school = '破军学园') {
  const value = clone(INITIAL_STATE);
  Object.assign(value.系统, { 开局状态: '已建档', 主角模式: '自定义角色' });
  Object.assign(value.玩家, { 姓名: '测试玩家', 所属: school });
  return value;
}
const request = (school = '破军学园', status = '已取得', id = 'player') => ({
  action: 'upsertQualification', id,
  qualification: { 姓名: '测试玩家', 学园: school, 资格状态: status, 依据: '' },
});
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}

await check('他校可直接确认资格，不创建破军账本或更改原状态', () => {
  const before = state('武曲学园'), saved = clone(before);
  const next = prepareTournamentAction(before, request('武曲学园'));
  assert.deepEqual(before, saved);
  assert.equal(next.场景.七星剑斗祭.资格名册.player.资格状态, '已取得');
  assert.equal(Object.hasOwn(next.场景, '选拔赛'), false);
  delete next.场景.七星剑斗祭;
  assert.deepEqual(next, saved);
});

await check('部分选拔名册无需补齐全校战绩，确认及撤销沿用同一稳定 ID', () => {
  const before = state();
  before.场景.选拔赛 = { 状态: '已结束', 名册: { oc_1: { 姓名: '测试玩家', 来源: '玩家', 参赛状态: '参赛' } }, 比赛: {} };
  const next = prepareTournamentAction(before, request('破军学园', '已取得', 'oc_1'));
  const revoked = prepareTournamentAction(next, request('破军学园', '已取消', 'oc_1'));
  assert.equal(revoked.场景.七星剑斗祭.资格名册.oc_1.资格状态, '已取消');
  assert.deepEqual(Object.keys(revoked.场景.七星剑斗祭.资格名册), ['oc_1']);
  assert.deepEqual(revoked.场景.选拔赛, before.场景.选拔赛);
});

await check('只更新目标资格，保留旧资格扩展、其他成员、赛事资料和无关坏记录', () => {
  const before = state();
  before.场景.选拔赛 = '旧存档未修复';
  before.玩家.旧扩展 = { 记录: ['保留'] };
  before.场景.七星剑斗祭 = { 旧资料: { 日期: '保留' }, 资格名册: {
    player: { ...request().qualification, 个人备注: '保留' },
    other: { 旧格式: '本次不处理' },
  } };
  const saved = clone(before), next = prepareTournamentAction(before, request('破军学园', '未取得'));
  assert.equal(next.场景.七星剑斗祭.资格名册.player.个人备注, '保留');
  next.场景.七星剑斗祭.资格名册.player.资格状态 = '已取得';
  assert.deepEqual(next, saved);
  assert.deepEqual(before, saved);
});

await check('非法记录和保留 ID 被拒绝，空依据可用，不限制字数', () => {
  const before = state();
  for (const id of ['', ' ', '__proto__', 'constructor', 'prototype', '__rk_bg_1', 'a/b', 'a~b']) {
    assert.throws(() => prepareTournamentAction(before, request('破军学园', '已取得', id)), /ID/);
  }
  for (const patch of [{ 姓名: '' }, { 学园: ' ' }, { 资格状态: '全校第一' }, { 依据: null }]) {
    const input = request(); Object.assign(input.qualification, patch);
    assert.throws(() => prepareTournamentAction(before, input));
  }
  const input = request(); input.qualification.依据 = '本局确认'.repeat(1000);
  assert.equal(prepareTournamentAction(before, input).场景.七星剑斗祭.资格名册.player.依据, input.qualification.依据);
});

await check('完整 schema 接纳全部资格状态及旧扩展，未登记不填充资格', () => {
  assert.equal(Object.hasOwn(schema.parse(state()).场景, '七星剑斗祭'), false);
  for (const status of ['待确认', '已取得', '未取得', '已取消']) {
    const next = prepareTournamentAction(state(), request('破军学园', status));
    next.场景.七星剑斗祭.备注 = '原样保留';
    next.场景.七星剑斗祭.资格名册.player.旧字段 = true;
    assert.deepEqual(schema.parse(next).场景.七星剑斗祭, next.场景.七星剑斗祭);
    assert.equal(createNationalTournamentSchema(z).safeParse(next.场景.七星剑斗祭).success, true);
    assert.ok(createRakudaiNativeSchema(next).properties.场景.properties.七星剑斗祭.properties.资格名册);
  }
  const invalid = prepareTournamentAction(state(), request());
  invalid.场景.七星剑斗祭.资格名册.player.资格状态 = '已夺冠';
  assert.equal(schema.safeParse(invalid).success, false);
});

function fixture(noWrite = false) {
  let data = { stat_data: state('武曲学园'), unrelated: { keep: true } };
  data.stat_data.场景.选拔赛 = '无关旧格式';
  delete data.stat_data.场景.时间;
  delete data.stat_data.玩家.姓名;
  let writes = 0;
  const service = createStateController({
    validate: (value, scope) => scope === 'full' ? schema.parse(value) : validateStateOperation(value, scope, z),
    capture: () => ({ data: clone(data) }),
    current: () => ({ data: clone(data) }),
    write: async (_token, _before, value) => { writes++; if (!noWrite) data = { ...data, stat_data: clone(value) }; },
  });
  return { service, get data() { return data; }, get writes() { return writes; } };
}

await check('资格事务独立校验并回读，未知旧资料不阻断，重试不重复写入', async () => {
  const f = fixture(), before = clone(f.data), { token } = await f.service.capture({ scope: 'qualification' });
  const result = await f.service.tournamentAction(token, request('武曲学园'));
  assert.equal(result.state.场景.七星剑斗祭.资格名册.player.资格状态, '已取得');
  assert.deepEqual(f.data.unrelated, before.unrelated);
  const saved = clone(f.data.stat_data); delete saved.场景.七星剑斗祭;
  assert.deepEqual(saved, before.stat_data);
  await f.service.tournamentAction(token, request('武曲学园'));
  assert.equal(f.writes, 1);
});

await check('资格事务未落地时回读报错，不返回保存成功', async () => {
  const f = fixture(true), { token } = await f.service.capture({ scope: 'qualification' });
  await assert.rejects(f.service.tournamentAction(token, request('武曲学园')), /回读/);
  assert.equal(Object.hasOwn(f.data.stat_data.场景, '七星剑斗祭'), false);
});

const report = { passed: results.filter(row => row.passed).length, total: results.length, results };
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
