import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createNationalTournamentSchema, deriveNationalTournament, shouldInjectNationalTournament } from './rakudai-national-tournament.mjs';
import { prepareTournamentAction } from './rakudai-tournament.mjs';
import { createStateController, validateStateOperation } from './rakudai-state-core.mjs';
import { createSchema, INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { inlineTournamentSource } from './story-build.mjs';

const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const results = [], clone = structuredClone, schema = createSchema(z);
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
function state(date = '2013-08-07') {
  const value = clone(INITIAL_STATE);
  Object.assign(value.系统, { 主角模式: '自定义角色', 开局状态: '已建档' });
  Object.assign(value.玩家, { 姓名: '参赛玩家', 所属: '文曲学园' });
  value.场景.时间 = date;
  value.场景.七星剑斗祭 = { 资格名册: Object.fromEntries(['player', 'b', 'c', 'd', 'e'].map((id, index) => [id, {
    姓名: index ? '选手' + index : '参赛玩家', 学园: index ? '他校' : '文曲学园', 资格状态: '已取得', 依据: '代表确认',
  }])) };
  return value;
}
const upsert = (id, match) => ({ action: 'upsertNationalMatch', id, match });
const match = { 轮次: '第一轮', 分区: 'B', 参赛者: ['player', 'b', 'c', 'd', 'e'], 状态: '已完成', 胜者: 'player', 晋级至: '16强', 日期: '2013-08-07', 依据: '本局比赛结束' };
const decision = { action: 'upsertNationalAdvancement', id: 'b_decision', advancement: { 选手: 'player', 阶段: '4强', 日期: '2013-08-08', 状态: '已确认', 依据: '赛会确认直接晋级' } };

await check('按完整剧情日期开启全国赛窗口，结束后关闭', () => {
  for (const [date, expected] of [['', false], ['8月7日', false], ['2013-08-06', false], ['2013-08-07', true], ['2013-08-12 晚间', true], ['2013-08-13', false], ['2013-02-30', false]]) {
    assert.equal(shouldInjectNationalTournament(state(date)), expected, date);
  }
  const s = state(); s.场景.七星剑斗祭.状态 = '已结束';
  assert.equal(shouldInjectNationalTournament({ stat_data: s }), false);
  assert.equal(deriveNationalTournament(s).matches.length, 0, '日期不生成战果');
});
await check('自定义赛季覆盖默认窗口，手动记录不受剧情日期限制', () => {
  const s = prepareTournamentAction(state('2014-09-01'), { action: 'setNationalSchedule', schedule: { 开始日期: '2014-09-01', 结束日期: '2014-09-08', 状态: '进行中' } });
  assert.equal(shouldInjectNationalTournament(s), true);
  assert.equal(deriveNationalTournament(s).calendar.startDate, '2014-09-01');
  assert.equal(prepareTournamentAction(state('未知'), upsert('m1', match)).场景.七星剑斗祭.比赛.m1.胜者, 'player');
  assert.throws(() => prepareTournamentAction(s, { action: 'setNationalSchedule', 结束日期: '2014-08-31' }), /结束日期/);
  assert.throws(() => prepareTournamentAction(s, { action: 'setNationalSchedule', 开始日期: '2014-02-30' }), /有效/);
});
await check('旧资格名册兼容；逐条登记多人赛，不补全32人，不修改原状态', () => {
  const before = state(), old = clone(before);
  assert.equal(createNationalTournamentSchema(z).safeParse(before.场景.七星剑斗祭).success, true);
  const next = prepareTournamentAction(before, upsert('m1', match)), view = deriveNationalTournament(next);
  assert.deepEqual(before, old);
  assert.deepEqual(schema.parse(next).场景.七星剑斗祭, next.场景.七星剑斗祭);
  assert.equal(view.participants.length, 5);
  assert.deepEqual(view.matches[0].参赛者姓名, ['参赛玩家', '选手1', '选手2', '选手3', '选手4']);
  assert.equal(view.matches[0].胜者姓名, '参赛玩家');
  assert.equal(view.advancement[0].stage, '16强');
  assert.equal(view.calendar.matches[0].date, '2013-08-07');
  assert.equal(Object.hasOwn(next.场景, '选拔赛'), false);
});
await check('比赛与行政晋级分开，撤销裁定和同ID改判实时重算', () => {
  const played = prepareTournamentAction(state(), upsert('m1', match));
  const advanced = prepareTournamentAction(played, decision);
  assert.equal(deriveNationalTournament(advanced).advancement[0].stage, '4强');
  assert.equal(Object.keys(advanced.场景.七星剑斗祭.比赛).length, 1);
  const revoked = prepareTournamentAction(advanced, { ...decision, advancement: { 状态: '已撤销' } });
  assert.equal(deriveNationalTournament(revoked).advancement[0].stage, '16强');
  const corrected = prepareTournamentAction(revoked, upsert('m1', { 胜者: 'b', 依据: '原赛果纠正' }));
  assert.equal(deriveNationalTournament(corrected).advancement[0].id, 'b');
  const cancelled = prepareTournamentAction(corrected, upsert('m1', { 状态: '已取消' }));
  assert.deepEqual(deriveNationalTournament(cancelled).advancement, []);
  assert.equal(Object.keys(cancelled.场景.七星剑斗祭.比赛).length, 1);
});
await check('未完成赛果不产生晋级，资格取消仍保留历史结果', () => {
  let s = prepareTournamentAction(state(), upsert('m1', { ...match, 状态: '进行中' }));
  assert.deepEqual(deriveNationalTournament(s).advancement, []);
  s = prepareTournamentAction(s, upsert('m1', { 状态: '已完成' }));
  s = prepareTournamentAction(s, { action: 'upsertQualification', id: 'player', qualification: { 姓名: '参赛玩家', 学园: '文曲学园', 资格状态: '已取消', 依据: '本局决定' } });
  assert.equal(deriveNationalTournament(s).advancement[0].stage, '16强');
  assert.equal(deriveNationalTournament(s).participants[0].status, '已取消');
});
await check('拒绝无效引用、重复参赛者、越界胜者和错误日期', () => {
  for (const delta of [{ 参赛者: ['player', 'unknown'] }, { 参赛者: ['player', 'player'] }, { 胜者: 'unknown' }, { 日期: '2013-08-32' }, { 晋级至: '神级' }, { 胜者: '' }]) {
    assert.throws(() => prepareTournamentAction(state(), upsert('m1', { ...match, ...delta })));
  }
  assert.throws(() => prepareTournamentAction(state(), upsert('__proto__', match)));
  const invalid = prepareTournamentAction(state(), upsert('m1', match));
  invalid.场景.七星剑斗祭.比赛.m1.胜者 = 'unknown';
  assert.equal(schema.safeParse(invalid).success, false);
});
await check('独立全国赛事务保留无关旧资料，保存回读、重试与并发检查生效', async () => {
  let data = { stat_data: state('未知'), unrelated: true }, writes = 0;
  data.stat_data.场景.选拔赛 = '无关旧账本';
  const before = clone(data);
  const controller = createStateController({
    validate: (value, scope) => validateStateOperation(value, scope, z),
    capture: () => ({ data: clone(data) }), current: () => ({ data: clone(data) }),
    write: async (_snapshot, _old, value) => { writes++; data.stat_data = clone(value); },
  });
  const { token } = await controller.capture({ scope: 'national' });
  await controller.tournamentAction(token, upsert('m1', match));
  await controller.tournamentAction(token, upsert('m1', match));
  assert.equal(writes, 1);
  assert.equal(data.stat_data.场景.选拔赛, before.stat_data.场景.选拔赛);
  assert.equal(data.unrelated, true);
  assert.equal(controller.nationalTournamentView(data.stat_data).advancement[0].stage, '16强');
  const pending = await controller.capture({ scope: 'national' });
  data.stat_data.场景.地点 = '已更换场地';
  await assert.rejects(controller.tournamentAction(pending.token, decision), /其他操作更新/);
});
await check('全国赛单文件内联与模块运行结果一致', () => {
  const realm = vm.createContext({ structuredClone });
  vm.runInContext(inlineTournamentSource() + '\nglobalThis.result = deriveNationalTournament(' + JSON.stringify(prepareTournamentAction(state(), upsert('m1', match))) + ');', realm);
  assert.equal(realm.result.advancement[0].stage, '16强');
  assert.equal(realm.result.calendar.active, true);
});

const report = { passed: results.filter(row => row.passed).length, total: results.length, results };
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
