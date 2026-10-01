import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE, createSchema } from '../世界书规则/MVU/schema.mjs';
import { deriveTournament, prepareTournamentAction, enforceTournamentState, normalizeTournament, suggestTournamentOpponents } from './rakudai-tournament.mjs';
import { TOURNAMENT_CANON } from './rakudai-tournament-background.mjs';

// 真实公共接口的离线回归；不调用AI，不写存档，不把派生结果当作实际比赛。
const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), clone = structuredClone, results = [];
function test(name, run) {
  try { run(); results.push({ name, passed: true }); console.log('通过：' + name); }
  catch (error) { results.push({ name, passed: false }); console.error('失败：' + name + '\n' + error.stack); }
}
function state(date = '2013-05-29', mode = '自定义角色') {
  const value = clone(INITIAL_STATE);
  value.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: mode };
  value.玩家.姓名 = mode === '黑铁一辉' ? '黑铁一辉' : '测试原创玩家';
  Object.assign(value.场景, { 当前卷: 1, 当前章: '第一章', 阶段: '进行中', 时间: date, 地点: '破军学园' });
  return schema.parse(value);
}
function at(value, date) { const next = clone(value); next.场景.时间 = date; return next; }
function person(view, name) { const row = view.roster.find(entry => entry.name === name); assert.ok(row, '缺少参赛者：' + name); return row; }
function player(view) { const row = view.roster.find(entry => entry.id === view.playerId); assert.ok(row, '缺少玩家'); return row; }
function actualMatch(value, { id = 'actual_player_r9', round = 9, date = '2013-05-28', opponent = '黑铁珠雫', status = '已完成' } = {}) {
  const view = deriveTournament(value);
  const match = { 轮次: round, 甲方: view.playerId, 乙方: person(view, opponent).id, 日期: date,
    时间: '午后', 地点: '第一对决场', 状态: status, 依据: '本局已确认的实际比赛记录', ...(status === '已完成' ? { 胜者: view.playerId } : {}) };
  return { action: 'upsertMatch', id, match };
}
function winAgainstShizuku() { const initial = state(); return prepareTournamentAction(initial, actualMatch(initial)); }
function recordPairs(view) {
  return view.matches.filter(match => ['已完成', '已安排'].includes(match.状态))
    .map(match => JSON.stringify([match.甲方, match.乙方].sort()));
}

test('无账本按日期预览正典和玩家，开幕两组首战相差一天', () => {
  const initial = state('2013-04-22'), before = clone(initial), day22 = deriveTournament(initial);
  assert.equal(day22.virtual, true); assert.equal(day22.exists, true);
  assert.equal(day22.roster.length, TOURNAMENT_CANON.length + 1);
  assert.deepEqual([person(day22, '史黛菈·法米利昂').recordedWins, person(day22, '黑铁一辉').recordedWins], [0, 0]);
  const day23 = deriveTournament(at(initial, '2013-04-23'));
  assert.deepEqual([person(day23, '史黛菈·法米利昂').recordedWins, person(day23, '黑铁一辉').recordedWins], [1, 0]);
  assert.equal(person(deriveTournament(at(initial, '2013-04-24')), '黑铁一辉').recordedWins, 1);
  assert.deepEqual(initial, before); assert.equal(initial.场景.选拔赛, undefined);
});

test('黄金周不增场，五月二十九日主要正典已打九场', () => {
  const before = deriveTournament(state('2013-04-27')), end = deriveTournament(state('2013-05-06'));
  for (const name of ['黑铁一辉', '史黛菈·法米利昂', '黑铁珠雫', '东堂刀华']) {
    const a = person(before, name), b = person(end, name);
    assert.deepEqual([a.wins, a.losses, a.simulatedMatches], [2, 0, 2]);
    assert.deepEqual([b.wins, b.losses, b.simulatedMatches], [2, 0, 2]);
    const may29 = person(deriveTournament(state()), name);
    assert.deepEqual([may29.wins, may29.losses, may29.simulatedMatches, may29.throughRound], [9, 0, 9, 9]);
  }
  assert.equal(before.calendar.suspended, true); assert.equal(end.calendar.suspended, true);
});

test('原创或一辉玩家始终不自动产生已完成战果与积分', () => {
  for (const mode of ['自定义角色', '黑铁一辉']) {
    const view = deriveTournament(state('2013-07-09', mode)), row = player(view);
    assert.equal(row.simulatedMatches, 0); assert.equal(row.recordedWins, 0); assert.equal(row.recordedPoints, 0);
    assert.equal(row.points, null);
    assert.ok(!view.matches.some(match => match.状态 === '已完成' && [match.甲方, match.乙方].includes(row.id)));
  }
});

test('无账本直接登记玩家R9胜珠雫：珠雫8-1，本场90分，玩家总分仍待补', () => {
  const initial = state(), before = clone(initial), next = prepareTournamentAction(initial, actualMatch(initial));
  assert.deepEqual(initial, before); assert.ok(schema.safeParse(next).success);
  const view = deriveTournament(next), shizuku = person(view, '黑铁珠雫'), currentPlayer = player(view);
  assert.deepEqual([shizuku.wins, shizuku.losses], [8, 1]);
  assert.equal(view.matches.find(match => match.id === 'actual_player_r9').积分, 90);
  assert.equal(currentPlayer.recordedWins, 1); assert.equal(currentPlayer.recordedPoints, 90);
  assert.equal(currentPlayer.points, null); assert.equal(currentPlayer.complete, false);
  assert.deepEqual(currentPlayer.pendingRounds, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('真实败绩在后续日期重算时保留，不恢复成全胜', () => {
  const next = at(winAgainstShizuku(), '2013-06-06'), before = clone(next), view = deriveTournament(next);
  const shizuku = person(view, '黑铁珠雫');
  assert.deepEqual([shizuku.wins, shizuku.losses, shizuku.throughRound], [10, 1, 11]);
  assert.equal(view.matches.find(match => match.id === 'actual_player_r9').积分, 90);
  assert.deepEqual(deriveTournament(next), view); assert.deepEqual(next, before);
});

test('同ID重放不重复加分，取消后原场槽不会被背景比赛复活', () => {
  const next = winAgainstShizuku(), request = { action: 'upsertMatch', id: 'actual_player_r9', match: clone(next.场景.选拔赛.比赛.actual_player_r9) };
  const replay = prepareTournamentAction(next, request);
  assert.deepEqual(deriveTournament(replay), deriveTournament(next));
  const canceled = prepareTournamentAction(replay, { action: 'cancelMatch', id: request.id });
  const view = deriveTournament(at(canceled, '2013-06-06')), shizuku = person(view, '黑铁珠雫');
  assert.equal(view.matches.find(match => match.id === request.id).状态, '已取消');
  assert.ok(!view.matches.some(match => match.轮次 === 9 && match.id !== request.id && [match.甲方, match.乙方].includes(shizuku.id)));
  assert.equal(player(view).recordedWins, 0); assert.equal(player(view).recordedPoints, 0);
  assert.ok(shizuku.pendingRounds.includes(9));
});

test('真实及背景对局不重复对手，建议也排除已战对手', () => {
  const next = winAgainstShizuku(), view = deriveTournament(at(next, '2013-07-09'));
  const pairs = recordPairs(view); assert.equal(new Set(pairs).size, pairs.length);
  const proposed = suggestTournamentOpponents(next, { participantId: view.playerId, round: 10 });
  assert.ok(!proposed.candidates.some(row => row.name === '黑铁珠雫'));
  const duplicate = actualMatch(next, { id: 'duplicate_pair', round: 10, date: '2013-05-31' });
  assert.throws(() => prepareTournamentAction(next, duplicate), /重复匹配/);
});

test('已安排的真实比赛保留待赛状态，不被场外结果覆盖', () => {
  const initial = state(), request = actualMatch(initial, { status: '已安排' });
  const next = prepareTournamentAction(initial, request), view = deriveTournament(at(next, '2013-06-06'));
  const scheduled = view.matches.find(match => match.id === request.id), shizuku = person(view, '黑铁珠雫');
  assert.equal(scheduled.状态, '已安排'); assert.equal(scheduled.胜者, undefined); assert.equal(scheduled.积分, null);
  assert.equal(view.matches.filter(match => match.轮次 === 9 && [match.甲方, match.乙方].includes(shizuku.id)).length, 1);
  assert.equal(player(view).recordedPoints, 0); assert.ok(shizuku.pendingRounds.includes(9));
});

test('稳定种子可重复，新增名册不重掷已有选手的背景比赛', () => {
  const initial = prepareTournamentAction(state(), { action: 'upsertParticipant', id: 'oc_existing', participant: { 姓名: '原有原创选手', 来源: '原创', 参赛状态: '参赛' } });
  const before = deriveTournament(initial), repeated = deriveTournament(clone(initial));
  assert.deepEqual(repeated, before);
  const added = prepareTournamentAction(initial, { action: 'upsertParticipant', id: 'oc_later', participant: { 姓名: '后来登记选手', 来源: '原创', 参赛状态: '参赛' } });
  const after = deriveTournament(added), ids = new Set(before.matches.map(match => match.id));
  assert.deepEqual(after.matches.filter(match => ids.has(match.id)), before.matches);
  // 新名册可以改变相对排名；既有比赛、胜负与积分不能被重新掷骰。
  const { rank: oldRank, tied: oldTie, ...oldRecord } = person(before, '原有原创选手');
  const { rank: newRank, tied: newTie, ...newRecord } = person(after, '原有原创选手');
  assert.deepEqual(newRecord, oldRecord);
});

test('手动初始战绩可接管正典背景，AI不能重写、移除或注入基线', () => {
  const initial = state(), id = person(deriveTournament(initial), '贵德原彼方').id;
  const baseline = { 截至轮次: 9, 胜场: 6, 败场: 3, 积分: 120, 依据: '用户核对并手工接管旧档' };
  const manual = prepareTournamentAction(initial, { action: 'upsertParticipant', id, participant: { 初始战绩: baseline } });
  assert.ok(schema.safeParse(manual).success);
  const row = person(deriveTournament(manual), '贵德原彼方');
  assert.deepEqual([row.wins, row.losses, row.points, row.simulatedMatches], [6, 3, 120, 0]);
  for (const mutate of [person => { person.初始战绩 = { ...baseline, 胜场: 9, 败场: 0, 积分: 450 }; }, person => { delete person.初始战绩; }]) {
    const previous = { stat_data: clone(manual) }, variables = clone(previous);
    mutate(variables.stat_data.场景.选拔赛.名册[id]);
    assert.ok(enforceTournamentState(variables, previous).length > 0);
    assert.deepEqual(variables.stat_data.场景.选拔赛.名册[id].初始战绩, baseline);
  }
  const previous = { stat_data: clone(manual) }, variables = clone(previous);
  variables.stat_data.场景.选拔赛.名册.injected = { 姓名: 'AI新增选手', 来源: '原创', 参赛状态: '参赛', 初始战绩: baseline };
  enforceTournamentState(variables, previous);
  assert.equal(variables.stat_data.场景.选拔赛.名册.injected.初始战绩, undefined);
});

test('AI删除带有手动基线的名册条目不能绕过基线保护', () => {
  const initial = state(), id = person(deriveTournament(initial), '贵德原彼方').id;
  const baseline = { 截至轮次: 9, 胜场: 6, 败场: 3, 积分: 120, 依据: '人工核对的旧档起点' };
  const manual = prepareTournamentAction(initial, { action: 'upsertParticipant', id, participant: { 初始战绩: baseline } });
  const previous = { stat_data: manual }, variables = clone(previous);
  delete variables.stat_data.场景.选拔赛.名册[id];
  enforceTournamentState(variables, previous);
  const row = person(deriveTournament(variables), '贵德原彼方');
  assert.deepEqual([row.wins, row.losses, row.points], [6, 3, 120]);
});

test('AI删除整个账本会恢复，其他玩家事实仍保留', () => {
  const previous = { stat_data: winAgainstShizuku() }, variables = clone(previous);
  delete variables.stat_data.场景.选拔赛;
  variables.stat_data.玩家.处事风格 = '本回合更新的处事事实';
  const notices = enforceTournamentState(variables, previous);
  assert.ok(notices.some(message => message.includes('恢复')));
  assert.deepEqual(variables.stat_data.场景.选拔赛.比赛, previous.stat_data.场景.选拔赛.比赛);
  assert.deepEqual([person(deriveTournament(variables), '黑铁珠雫').wins, person(deriveTournament(variables), '黑铁珠雫').losses], [8, 1]);
  assert.equal(variables.stat_data.玩家.处事风格, '本回合更新的处事事实');
});

test('坏比赛只局部恢复选拔赛，不回滚玩家字段与剧情时间', () => {
  const previous = { stat_data: winAgainstShizuku() }, variables = clone(previous);
  variables.stat_data.场景.选拔赛.比赛.actual_player_r9.胜者 = '不存在的ID';
  variables.stat_data.玩家.战斗风格 = '本局新确认的战斗方式';
  variables.stat_data.场景.时间 = '2013-05-30';
  const notices = enforceTournamentState(variables, previous);
  assert.ok(notices.some(message => message.includes('仅恢复选拔赛')));
  assert.deepEqual(variables.stat_data.场景.选拔赛, previous.stat_data.场景.选拔赛);
  assert.equal(variables.stat_data.玩家.战斗风格, '本局新确认的战斗方式');
  assert.equal(variables.stat_data.场景.时间, '2013-05-30');
  assert.ok(schema.safeParse(variables.stat_data).success);
});

test('未来日期即使存为已完成也不提前计分，到比赛日真实结果才生效', () => {
  const initial = state(), next = prepareTournamentAction(initial, actualMatch(initial, { date: '2013-06-05' }));
  const before = clone(next), early = deriveTournament(next);
  assert.equal(next.场景.选拔赛.比赛.actual_player_r9.状态, '已完成');
  assert.equal(early.matches.find(match => match.id === 'actual_player_r9').状态, '已安排');
  assert.equal(player(early).recordedWins, 0); assert.equal(player(early).recordedPoints, 0);
  assert.ok(early.warnings.some(message => message.includes('未来赛果')));
  assert.equal(deriveTournament(at(next, '2013-06-05')).matches.find(match => match.id === 'actual_player_r9').积分, 90);
  assert.deepEqual(next, before);
});

test('分支日期回退重新计算，不写原状态且未来真实比赛不污染过去', () => {
  const initial = winAgainstShizuku(), before = clone(initial), branch = at(initial, '2013-04-27'), branchBefore = clone(branch);
  const prior = deriveTournament(branch), current = deriveTournament(initial);
  assert.deepEqual([person(prior, '黑铁珠雫').wins, person(prior, '黑铁珠雫').losses], [2, 0]);
  assert.equal(player(prior).recordedWins, 0); assert.equal(player(prior).recordedPoints, 0);
  assert.deepEqual([person(current, '黑铁珠雫').wins, person(current, '黑铁珠雫').losses], [8, 1]);
  assert.deepEqual(initial, before); assert.deepEqual(branch, branchBefore);
});

test('无有效公历日期的旧T01仍能正常计算真实首轮10分', () => {
  const old = state('旧档：春季午后');
  old.场景.选拔赛 = normalizeTournament({
    名册: { hero: { 姓名: old.玩家.姓名, 来源: '玩家', 参赛状态: '参赛' }, rival: { 姓名: '旧档对手', 来源: '原创', 参赛状态: '参赛' } },
    比赛: { legacy_r1: { 轮次: 1, 甲方: 'hero', 乙方: 'rival', 状态: '已完成', 胜者: 'hero', 依据: '旧档已确认首战获胜' } },
  });
  assert.ok(schema.safeParse(old).success);
  const view = deriveTournament(old);
  assert.equal(view.projected, false); assert.equal(view.matches.length, 1);
  assert.deepEqual([player(view).wins, player(view).losses, player(view).points], [1, 0, 10]);
  assert.equal(view.matches[0].积分, 10);
});

test('AI写派生胜场积分或赛前缓存不会篡改程序重算结果', () => {
  const previous = { stat_data: winAgainstShizuku() }, variables = clone(previous);
  const ledger = variables.stat_data.场景.选拔赛, id = person(deriveTournament(variables), '黑铁珠雫').id;
  ledger.积分 = 999999; ledger.排名 = [ledger.名册[id]];
  Object.assign(ledger.名册[id], { 胜场: 999, 败场: 0, 积分: 999999, 排名: 1 });
  Object.assign(ledger.比赛.actual_player_r9, { 积分: 999999, 甲赛前胜场: 8, 乙赛前胜场: 0 });
  ledger.程序战况 = { 名册: [{ ID: id, 胜场: 999, 积分: 999999 }] };
  enforceTournamentState(variables, previous);
  assert.equal(variables.stat_data.场景.选拔赛.积分, undefined);
  assert.equal(variables.stat_data.场景.选拔赛.名册[id].积分, undefined);
  assert.equal(variables.stat_data.场景.选拔赛.比赛.actual_player_r9.乙赛前胜场, undefined);
  const view = deriveTournament(variables);
  assert.deepEqual([person(view, '黑铁珠雫').wins, person(view, '黑铁珠雫').losses], [8, 1]);
  assert.equal(view.matches.find(match => match.id === 'actual_player_r9').积分, 90);
  assert.equal(player(view).recordedPoints, 90); assert.ok(schema.safeParse(variables.stat_data).success);
});

test('真实Zod拒绝保留生成ID、同选手同轮重复与非法初始战绩', () => {
  const next = winAgainstShizuku();
  const reserved = clone(next); reserved.场景.选拔赛.比赛.__rk_bg_fake = clone(reserved.场景.选拔赛.比赛.actual_player_r9);
  assert.equal(schema.safeParse(reserved).success, false);
  const duplicate = clone(next); duplicate.场景.选拔赛.比赛.another = { ...duplicate.场景.选拔赛.比赛.actual_player_r9, 乙方: person(deriveTournament(next), '东堂刀华').id };
  assert.equal(schema.safeParse(duplicate).success, false);
  const baseline = clone(next), id = person(deriveTournament(next), '贵德原彼方').id;
  baseline.场景.选拔赛.名册[id].初始战绩 = { 截至轮次: 2, 胜场: 3, 败场: 0, 积分: 999, 依据: '非法基线' };
  assert.equal(schema.safeParse(baseline).success, false);
});

test('手动退选保留退选前九场投影，日期前进后不再追加比赛', () => {
  const initial = state(), beforeView = deriveTournament(initial), prior = person(beforeView, '贵德原彼方');
  assert.equal(prior.simulatedMatches, 9);
  const next = prepareTournamentAction(initial, { action: 'upsertParticipant', id: prior.id, participant: { 参赛状态: '退选' } });
  assert.ok(schema.safeParse(next).success);
  for (const date of ['2013-05-29', '2013-06-06', '2013-07-09']) {
    const view = deriveTournament(at(next, date)), row = person(view, '贵德原彼方');
    assert.equal(row.status, '退选');
    assert.deepEqual([row.wins, row.losses, row.points, row.simulatedMatches], [9, 0, prior.points, 9]);
    assert.equal(view.matches.filter(match => [match.甲方, match.乙方].includes(row.id)).length, 9);
    assert.ok(!view.eligible.some(entry => entry.id === row.id));
  }
});

test('取消过的对手组合不阻止后续轮次正典对局，但取消原槽仍保留', () => {
  const initial = state('2013-05-25'), before = deriveTournament(initial);
  const ikki = person(before, '黑铁一辉').id, rabbit = person(before, '兔丸恋恋').id;
  const canceled = prepareTournamentAction(initial, { action: 'upsertMatch', id: 'canceled_early_pair', match: {
    轮次: 8, 甲方: ikki, 乙方: rabbit, 日期: '2013-05-24', 状态: '已取消', 依据: '原安排取消，未实际交手',
  } });
  const view = deriveTournament(at(canceled, '2013-05-29'));
  assert.equal(view.matches.find(match => match.id === 'canceled_early_pair').状态, '已取消');
  const fixture = view.matches.find(match => match.轮次 === 9 && match.甲方 === ikki && match.乙方 === rabbit);
  assert.ok(fixture, '取消旧安排不应占用第九场正典对手');
  assert.equal(fixture.状态, '已完成'); assert.equal(fixture.胜者, ikki);
  assert.ok(!view.matches.some(match => match.轮次 === 8 && match.id !== 'canceled_early_pair' && [match.甲方, match.乙方].some(id => [ikki, rabbit].includes(id))));
});

test('AI不能提前、推迟或删除既有入赛轮次，也不能给既有人物注入轮次', () => {
  const initial = prepareTournamentAction(state(), { action: 'upsertParticipant', id: 'late_oc',
    participant: { 姓名: '第九场入赛的选手', 来源: '原创', 参赛状态: '参赛', 入赛轮次: 9 } });
  const prior = { stat_data: initial };
  for (const changed of [1, 15, undefined]) {
    const variables = clone(prior);
    if (changed === undefined) delete variables.stat_data.场景.选拔赛.名册.late_oc.入赛轮次;
    else variables.stat_data.场景.选拔赛.名册.late_oc.入赛轮次 = changed;
    enforceTournamentState(variables, prior);
    assert.equal(variables.stat_data.场景.选拔赛.名册.late_oc.入赛轮次, 9);
  }
  const variables = clone(prior), canonical = person(deriveTournament(initial), '贵德原彼方').id;
  variables.stat_data.场景.选拔赛.名册[canonical].入赛轮次 = 20;
  enforceTournamentState(variables, prior);
  assert.equal(variables.stat_data.场景.选拔赛.名册[canonical].入赛轮次, undefined);
});

test('首战虚拟待赛不堵一辉对手建议，真实已安排仍会阻止重复安排', () => {
  const initial = state('2013-04-23', '黑铁一辉'), view = deriveTournament(initial);
  const kirihara = person(view, '桐原静矢').id;
  assert.ok(view.matches.some(match => match.程序推演 && match.轮次 === 1 && match.状态 === '已安排' && [match.甲方, match.乙方].includes(view.playerId)));
  const suggested = suggestTournamentOpponents(initial, { participantId: view.playerId, round: 1 });
  assert.ok(suggested.candidates.some(candidate => candidate.id === kirihara));
  assert.equal(suggested.anchorId, kirihara);
  const actual = prepareTournamentAction(initial, actualMatch(initial, { id: 'actual_first', round: 1, date: '2013-04-23', opponent: '桐原静矢', status: '已安排' }));
  const blocked = suggestTournamentOpponents(actual, { participantId: view.playerId, round: 1 });
  assert.deepEqual(blocked.candidates, []); assert.ok(blocked.warnings.length > 0);
});

test('推演中已经退场的人物不再作为后续对手或被安排选手', () => {
  for (const [date, round, names] of [
    ['2013-05-29', 10, ['桐原静矢', '桃谷武士', '碎城雷']],
    ['2013-06-06', 12, ['桐原静矢', '桃谷武士', '碎城雷', '绫辻绚濑']],
  ]) {
    const initial = state(date), view = deriveTournament(initial);
    const suggested = suggestTournamentOpponents(initial, { participantId: view.playerId, round });
    assert.ok(suggested.candidates.length > 0, '仍参赛的选手应继续提供候选');
    for (const name of names) {
      const id = person(view, name).id;
      assert.ok(!suggested.candidates.some(candidate => candidate.id === id), name + ' 已退场，不应再被推荐');
      assert.deepEqual(suggestTournamentOpponents(initial, { participantId: id, round }).candidates, []);
    }
  }
});

test('手动、AI和真实schema均拒绝早于入赛轮次的已安排或已完成比赛', () => {
  const initial = prepareTournamentAction(state(), { action: 'upsertParticipant', id: 'r10_newcomer',
    participant: { 姓名: '第十场加入的选手', 来源: '原创', 参赛状态: '参赛', 入赛轮次: 10 } });
  const view = deriveTournament(initial);
  for (const status of ['已安排', '已完成']) {
    const match = { 轮次: 9, 甲方: view.playerId, 乙方: 'r10_newcomer', 日期: '2013-05-28', 状态: status,
      依据: '不应被接受的入赛前对局', ...(status === '已完成' ? { 胜者: view.playerId } : {}) };
    assert.throws(() => prepareTournamentAction(initial, { action: 'upsertMatch', id: 'before_entry', match }));
    const invalid = clone(initial); invalid.场景.选拔赛.比赛.before_entry = match;
    assert.equal(schema.safeParse(invalid).success, false);
    const previous = { stat_data: initial }, variables = { stat_data: invalid };
    assert.ok(enforceTournamentState(variables, previous).length > 0);
    assert.equal(variables.stat_data.场景.选拔赛.比赛.before_entry, undefined);
  }
});

test('人工赛前五胜接管R9为60分，不补造珠雫早期比赛，后续重算保留该分数', () => {
  const initial = state(), request = actualMatch(initial);
  request.match.乙赛前胜场 = 5;
  const next = prepareTournamentAction(initial, request);
  assert.ok(schema.safeParse(next).success);
  for (const date of ['2013-05-29', '2013-06-01', '2013-06-06']) {
    const view = deriveTournament(at(next, date)), shizuku = person(view, '黑铁珠雫');
    assert.equal(view.matches.find(match => match.id === request.id).积分, 60);
    assert.equal(player(view).recordedPoints, 60); assert.equal(player(view).points, null);
    assert.equal(shizuku.points, null); assert.equal(shizuku.complete, false);
    assert.ok(!view.matches.some(match => match.轮次 < 9 && [match.甲方, match.乙方].includes(shizuku.id)));
    assert.deepEqual(shizuku.pendingRounds, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(shizuku.recordedLosses, 1);
  }
});

test('未来日期的人工赛前胜场不会提前抑制既有背景历史', () => {
  const initial = state(), request = actualMatch(initial, { date: '2013-06-05' });
  request.match.乙赛前胜场 = 5;
  const next = prepareTournamentAction(initial, request), view = deriveTournament(next), shizuku = person(view, '黑铁珠雫');
  const historical = view.matches.filter(match => match.轮次 < 9 && match.状态 === '已完成' && [match.甲方, match.乙方].includes(shizuku.id));
  assert.deepEqual(historical.map(match => match.轮次), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(shizuku.simulatedMatches, 8); assert.equal(shizuku.recordedWins, 8);
  assert.equal(view.matches.find(match => match.id === request.id).状态, '已安排');
  assert.equal(player(view).recordedPoints, 0);
  assert.equal(deriveTournament(at(next, '2013-06-05')).matches.find(match => match.id === request.id).积分, 60);
});

test('人工和AI交换甲乙按人物继承赛前五胜，换对手或轮次不会继承旧快照', () => {
  const initial = state(), request = actualMatch(initial); request.match.乙赛前胜场 = 5;
  const next = prepareTournamentAction(initial, request), original = next.场景.选拔赛.比赛[request.id];
  const swapped = { 甲方: original.乙方, 乙方: original.甲方 };
  const manual = prepareTournamentAction(next, { action: 'upsertMatch', id: request.id, match: swapped });
  const previous = { stat_data: clone(next) }, ai = clone(previous);
  Object.assign(ai.stat_data.场景.选拔赛.比赛[request.id], swapped, { 甲赛前胜场: 7, 乙赛前胜场: 8 });
  enforceTournamentState(ai, previous);
  for (const value of [manual, ai.stat_data]) {
    const stored = value.场景.选拔赛.比赛[request.id];
    assert.equal(stored.甲赛前胜场, 5); assert.equal(stored.乙赛前胜场, undefined);
    assert.equal(deriveTournament(value).matches.find(match => match.id === request.id).积分, 60);
    assert.ok(schema.safeParse(value).success);
  }
  const newOpponent = clone(previous);
  newOpponent.stat_data.场景.选拔赛.比赛[request.id].乙方 = person(deriveTournament(next), '史黛菈·法米利昂').id;
  enforceTournamentState(newOpponent, previous);
  assert.equal(newOpponent.stat_data.场景.选拔赛.比赛[request.id].乙赛前胜场, undefined);
  assert.equal(deriveTournament(newOpponent).matches.find(match => match.id === request.id).积分, 90);
  const newRound = clone(previous);
  newRound.stat_data.场景.时间 = '2013-06-01';
  Object.assign(newRound.stat_data.场景.选拔赛.比赛[request.id], { 轮次: 10, 日期: '2013-05-31' });
  enforceTournamentState(newRound, previous);
  assert.equal(newRound.stat_data.场景.选拔赛.比赛[request.id].乙赛前胜场, undefined);
  assert.equal(deriveTournament(newRound).matches.find(match => match.id === request.id).积分, 100);
});

test('结束赛季保存日期并冻结九场背景，重新进行中才恢复日期推进', () => {
  const initial = state(), priorView = deriveTournament(initial);
  const ended = prepareTournamentAction(initial, { action: 'setStatus', status: '已结束' });
  assert.equal(ended.场景.选拔赛.结束日期, '2013-05-29'); assert.ok(schema.safeParse(ended).success);
  const future = at(ended, '2013-07-09'), frozen = deriveTournament(future);
  for (const name of ['黑铁一辉', '史黛菈·法米利昂', '黑铁珠雫', '东堂刀华']) {
    const before = person(priorView, name), row = person(frozen, name);
    assert.deepEqual([row.wins, row.losses, row.points, row.simulatedMatches], [9, 0, before.points, 9]);
    assert.ok(!frozen.matches.some(match => match.轮次 > 9 && [match.甲方, match.乙方].includes(row.id)));
  }
  const reopened = prepareTournamentAction(future, { action: 'setStatus', status: '进行中' });
  assert.equal(reopened.场景.选拔赛.结束日期, undefined);
  const resumed = person(deriveTournament(reopened), '史黛菈·法米利昂');
  assert.deepEqual([resumed.wins, resumed.losses, resumed.simulatedMatches], [20, 0, 20]);
});

test('AI冒充玩家来源不能抢玩家身份，也不能让正典背景消失', () => {
  const initial = prepareTournamentAction(state(), { action: 'initialize' }), before = deriveTournament(initial);
  const stella = person(before, '史黛菈·法米利昂'), previous = { stat_data: initial }, variables = clone(previous);
  const roster = variables.stat_data.场景.选拔赛.名册;
  roster[stella.id].来源 = '玩家';
  roster[before.playerId].来源 = '原创';
  roster.fake_player = { 姓名: '冒充玩家的原创选手', 来源: '玩家', 参赛状态: '参赛' };
  enforceTournamentState(variables, previous);
  const view = deriveTournament(variables), corrected = person(view, '史黛菈·法米利昂');
  assert.equal(view.playerId, before.playerId);
  assert.equal(view.roster.filter(row => row.source === '玩家').length, 1);
  assert.equal(player(view).name, initial.玩家.姓名);
  assert.equal(corrected.source, '正典'); assert.equal(corrected.simulatedMatches, 9);
  assert.deepEqual([corrected.wins, corrected.losses, corrected.points], [stella.wins, stella.losses, stella.points]);
  assert.equal(person(view, '冒充玩家的原创选手').source, '原创');
  assert.ok(schema.safeParse(variables.stat_data).success);
});

const failed = results.filter(result => !result.passed);
console.log(`选拔赛回归检查：${results.length - failed.length}/${results.length} 项通过。`);
if (failed.length) process.exitCode = 1;
