// Run: node scripts/黑白ADV轮盘终端/tournament-ui-test.mjs
// Offline VM checks use maintained UI/correction sources; no build artifacts or live saves are written.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTerminal } from './bundle.mjs';
import { read as readTournamentState } from '../../七星剑武祭-晋级面板预览/mvu-model.mjs';

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const originalState = { 场景: { 时间: '2013-05-10', 选拔赛: {} }, 玩家: { 姓名: 'OC', 所属: '破军学园 / 一年一班' }, 系统: { 主角模式: '自定义角色' } };
const pendingPlayer = { id: 'oc', name: 'OC', status: '参赛', source: '玩家', player: true,
  wins: null, losses: null, points: null, recordedWins: 0, recordedLosses: 0, recordedPoints: 0, simulatedMatches: 0 };
const projectedMatch = { id: '__bg_1', 程序推演: true, 轮次: 1, 状态: '已完成', 日期: '2013-04-22',
  甲方: 'a', 乙方: 'b', 胜者: 'a', 甲方姓名: '甲', 乙方姓名: '乙', 积分: 10 };
function makeView() {
  return { engine: 'T02', exists: false, virtual: true, playerId: 'oc', warnings: [],
    tournament: { 赛季: '破军学园选拔赛', 状态: '进行中', 总轮次: 20, 代表名额: 6,
      名册: { oc: { 姓名: 'OC', 来源: '玩家', 参赛状态: '参赛' } }, 比赛: {} },
    roster: [pendingPlayer], leaderboard: [pendingPlayer], matches: [projectedMatch],
    calendar: { valid: true, date: { key: '2013-05-10' }, currentRound: 4, elapsedRound: 3, todayRound: 4,
      nextRound: 5, suspended: false, schedule: [{ round: 4, date: '2013-05-10' }, { round: 5, date: '2013-05-14' }] } };
}
function uiFixture() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', title: '', style: {},
      classList: { add() {}, remove() {}, toggle() {} }, contains: () => true });
    return elements.get(id);
  };
  const ui = vm.createContext({ structuredClone, setTimeout, clearTimeout,
    document: { getElementById: element, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }, addEventListener() {} });
  ui.window = ui;
  vm.runInContext(read('terminal-app.js'), ui);
  const view = makeView();
  ui.stat = structuredClone(originalState);
  ui.stateSource = { characterId: 1, chatId: 'test', messageId: 2, swipeId: 0 };
  ui.hasDisplayedState = true; ui.dataStatus = 'ready';
  ui.bridge = { tournament: { view: () => view, participant: () => ({ id: 'oc_new' }) } };
  return { ui, view, element };
}

test('the complete terminal source compiles in memory without exporting artifacts', () => {
  assert.ok(buildTerminal().artifact.content.length > 0);
});
test('returning from the arena refreshes the entry after a season change', () => {
  const { ui, element } = uiFixture();
  ui.renderSchedule();
  assert.match(element('schedule-body').innerHTML, /预览赛事面板/);
  ui.currentStack = ['scr-home', 'scr-schedule', 'scr-arena'];
  ui.destroyTournamentPanel = () => {};
  ui.stat.场景.选拔赛.状态 = '已结束';
  ui.goBack();
  assert.match(element('schedule-body').innerHTML, /class="rk-arena-entry"/);
  assert.doesNotMatch(element('schedule-body').innerHTML, /预览赛事面板/);
});
test('national tournament remains an explicit preview until a saved selection end, regardless of date or projected view', () => {
  for (const selection of [undefined, {}, { 状态: '未开始' }, { 状态: '进行中' }]) {
    const { ui, view, element } = uiFixture();
    if (selection === undefined) delete ui.stat.场景.选拔赛;
    else ui.stat.场景.选拔赛 = structuredClone(selection);
    Object.assign(ui.stat.场景, { 时间: '2013-08-01', 当前卷: 9 });
    Object.assign(view, { complete: true, exists: true });
    view.tournament.状态 = '已结束';
    const before = JSON.stringify(ui.stat);
    ui.renderSchedule();
    assert.equal(ui.tournamentPanelUnlocked(), false);
    assert.match(element('schedule-body').innerHTML, /选拔赛结束后开放/);
    assert.match(element('schedule-body').innerHTML, /预览赛事面板/);
    assert.doesNotMatch(element('schedule-body').innerHTML, /class="rk-arena-entry"/);
    let opened = 0;
    ui.renderTournamentPanel = () => { opened++; };
    ui.openApp('arena');
    assert.equal(opened, 1, 'the player can deliberately open the preview before qualification');
    assert.equal(JSON.stringify(ui.stat), before, 'viewing the preview must not finish selection or change the player');
  }
});
test('saved selection end unlocks viewing without granting qualification from an incomplete or tied ledger', () => {
  for (const [complete, qualificationTie, expectedQualification] of [[false, false, 'unconfirmed'], [true, true, 'tie']]) {
    const { ui, view, element } = uiFixture();
    ui.stat.场景.选拔赛.状态 = '已结束';
    view.tournament.状态 = '已结束';
    Object.assign(view, { applicable: true, exists: true, virtual: false, complete, qualificationTie });
    const before = JSON.stringify(ui.stat);
    ui.renderSchedule();
    assert.equal(ui.tournamentPanelUnlocked(), true);
    assert.match(element('schedule-body').innerHTML, /class="rk-arena-entry"/);
    assert.doesNotMatch(element('schedule-body').innerHTML, /预览赛事面板/);
    assert.equal(readTournamentState({ state: ui.stat }, view).qualification.status, expectedQualification);
    assert.equal(JSON.stringify(ui.stat), before);
  }
});
test('an ended stale snapshot stays in preview while MVU is pending and unlocks after saving', () => {
  const { ui, view, element } = uiFixture();
  ui.stat.场景.选拔赛.状态 = '已结束';
  const before = JSON.stringify(ui.stat);
  for (const dataStatus of ['loading', 'pending', 'error']) {
    ui.dataStatus = dataStatus;
    ui.renderSchedule();
    assert.equal(ui.tournamentPanelUnlocked(), false);
    assert.match(element('schedule-body').innerHTML, /预览赛事面板/);
    assert.equal(readTournamentState({ state: ui.stat, pending: true }, view).qualification.status, 'pending');
  }
  ui.dataStatus = 'ready';
  ui.renderSchedule();
  assert.equal(ui.tournamentPanelUnlocked(), true);
  assert.match(element('schedule-body').innerHTML, /class="rk-arena-entry"/);
  assert.equal(JSON.stringify(ui.stat), before);
});
test('other-school previews and ended historical ledgers do not grant Hagun qualification or edit state', () => {
  for (const ended of [false, true]) {
    const { ui, view, element } = uiFixture();
    ui.stat.玩家.所属 = '武曲学园 / 一年一班';
    if (ended) ui.stat.场景.选拔赛.状态 = '已结束';
    else delete ui.stat.场景.选拔赛;
    Object.assign(view, { applicable: false, exists: ended, virtual: false, calendar: null, complete: ended });
    const before = JSON.stringify(ui.stat);
    ui.renderSchedule();
    const html = element('schedule-body').innerHTML;
    assert.equal(ui.tournamentPanelUnlocked(), ended);
    assert.match(html, /仅适用于所属已确认的破军学园角色/);
    assert.doesNotMatch(html, /data-rk-t-action|data-rk-t-form|维护参赛者资料/);
    assert.equal(readTournamentState({ state: ui.stat }, view).qualification.status, 'not-applicable');
    let opened = 0;
    ui.renderTournamentPanel = () => { opened++; };
    ui.openApp('arena');
    assert.equal(opened, 1);
    assert.equal(JSON.stringify(ui.stat), before);
  }
});
test('unknown history leads with pending labels, while projected results are visibly read-only', () => {
  const { ui, view, element } = uiFixture(), before = JSON.stringify(ui.stat);
  ui.renderSchedule();
  const html = element('schedule-body').innerHTML;
  assert.match(html, /<td>战绩待补/); assert.match(html, /<td>总分待确认/);
  assert.match(html, /背景预览/); assert.match(html, /data-rk-t-action="new-match"/);
  assert.match(html, /场外背景推演/); assert.match(html, /本局实际比赛记录/);
  assert.doesNotMatch(ui.tournamentMatchCard(projectedMatch, true), /data-rk-t-action/);
  assert.match(ui.tournamentMatchCard({ ...projectedMatch, 程序推演: false }, true), /已确认/);
  const withdrawn = { ...pendingPlayer, status: '退选', source: '正典', projectedWithdrawal: true };
  assert.match(ui.tournamentRanking({ roster: [withdrawn], leaderboard: [withdrawn] }), /退选（背景推演）/);
  assert.equal(JSON.stringify(ui.stat), before);
  assert.equal(ui.readSceneSchedule().length, 0, 'virtual school-wide results must not flood the phone calendar');
  view.calendar.suspended = true;
  assert.match(ui.tournamentCalendar(view), /黄金周停赛中/);
});
test('new match follows the current calendar slot; synthetic results cannot prefill a persisted match', () => {
  const { ui, element } = uiFixture();
  ui.openTournamentDraft('new-match', '');
  assert.equal(ui.tournamentDraft.fields.轮次, 4);
  assert.equal(ui.tournamentDraft.fields.日期, '2013-05-10');
  assert.equal(ui.tournamentDraft.fields.甲方, 'oc');
  ui.tournamentDraft = null;
  ui.openTournamentDraft('edit-match', projectedMatch.id);
  assert.equal(ui.tournamentDraft, null);
  assert.match(element('schedule-body').innerHTML, /背景推演为只读/);
});
test('inapplicable players can read old results and ordinary schedules without tournament editing', () => {
  for (const exists of [false, true]) {
    const { ui, view, element } = uiFixture();
    ui.stat.玩家.所属 = '贪狼学园';
    ui.stat.场景.日程 = { 图书馆约定: { 日期: '2013-05-11', 状态: '已安排', 说明: '还书' } };
    Object.assign(view, { applicable: false, exists, virtual: false, calendar: null,
      matches: exists ? [{ ...projectedMatch, id: 'recorded', 程序推演: false }] : [] });
    ui.renderSchedule();
    const html = element('schedule-body').innerHTML;
    assert.match(html, /仅适用于所属已确认的破军学园角色/);
    assert.match(html, /图书馆约定/);
    assert.doesNotMatch(html, /data-rk-t-action|data-rk-t-form|维护参赛者资料/);
    if (exists) {
      assert.match(html, /已确认 · 甲 胜出/);
      ui.renderMoments(); assert.match(element('moments-body').innerHTML, /已确认 · 甲 胜出/);
      ui.renderBbs(); assert.match(element('bbs-body').innerHTML, /战绩待补/);
    }
    for (const action of ['initialize', 'new-match', 'edit-match', 'new-participant', 'edit-participant', 'backfill', 'status', 'detained']) {
      ui.openTournamentDraft(action, 'recorded');
      assert.equal(ui.tournamentDraft, null);
      assert.match(ui.tournamentMessage, /当前所属不适用破军选拔/);
    }
  }
});

test('date, player mode, name, and affiliation invalidate both UI and host snapshots and block stale drafts', () => {
  const { ui } = uiFixture();
  const declaration = read('main.js').match(/  const tournamentSnapshotKey = state => JSON.stringify\([\s\S]*?\);/)[0];
  const host = vm.createContext({});
  vm.runInContext(declaration + '\nglobalThis.snapshotKey = tournamentSnapshotKey;', host);
  assert.equal(ui.tournamentSnapshotKey(originalState), host.snapshotKey(originalState));
  for (const [section, field, value] of [['场景', '时间', '2013-05-11'], ['系统', '主角模式', '黑铁一辉'], ['玩家', '姓名', '另一个玩家'], ['玩家', '所属', '贪狼学园']]) {
    const next = structuredClone(originalState); next[section][field] = value;
    assert.notEqual(ui.tournamentSnapshotKey(originalState), ui.tournamentSnapshotKey(next));
    assert.equal(ui.tournamentSnapshotKey(next), host.snapshotKey(next));
  }
  ui.openTournamentDraft('new-match', '');
  let submitted = false;
  ui.submitTournament = () => { submitted = true; };
  ui.stat.场景.时间 = '2013-05-11'; ui.saveTournamentDraft();
  assert.equal(submitted, false); assert.match(ui.tournamentMessage, /剧情日期/);
  ui.stat = structuredClone(originalState);
  ui.openTournamentDraft('new-match', '');
  ui.stat.玩家.所属 = '贪狼学园'; ui.saveTournamentDraft();
  assert.equal(submitted, false); assert.match(ui.tournamentMessage, /玩家身份已变化/);
});
test('manual old-save repair remains available; entry round and detention require explicit input', () => {
  const { ui, view, element } = uiFixture();
  let captured;
  ui.submitTournament = request => { captured = plain(request); };
  ui.openTournamentDraft('new-participant', '');
  assert.equal(ui.tournamentDraft.fields.入赛轮次, 1);
  assert.match(element('schedule-body').innerHTML, /手动补录截至某轮的累计战绩/);
  Object.assign(ui.tournamentDraft.fields, { 姓名: '中途选手', 入赛轮次: 7 });
  ui.saveTournamentDraft(); assert.equal(captured.participant.入赛轮次, 7);
  ui.tournamentDraft.fields.入赛轮次 = ''; ui.saveTournamentDraft();
  assert.equal(Object.hasOwn(captured.participant, '入赛轮次'), false);
  view.exists = true; view.virtual = false;
  ui.openTournamentDraft('detained', '');
  assert.equal(ui.tournamentDraft.fields.detained, 'false');
  ui.tournamentDraft.fields.detained = 'true'; ui.saveTournamentDraft();
  assert.deepEqual(captured, { action: 'setDetained', detained: true });
});
test('cumulative backfill opens the player record directly and saves totals without changing match details', () => {
  const { ui, view, element } = uiFixture();
  const before = JSON.stringify(view.tournament);
  let captured;
  ui.submitTournament = request => { captured = plain(request); };
  ui.renderSchedule();
  assert.match(element('schedule-body').innerHTML, /data-rk-t-action="backfill" data-rk-t-id="oc"/);
  ui.openTournamentDraft('backfill', 'oc');
  assert.equal(ui.tournamentDraft.fields.姓名, 'OC');
  assert.match(element('schedule-body').innerHTML, /<details open><summary>手动补录截至某轮的累计战绩/);
  Object.assign(ui.tournamentDraft.fields, { 初始截至轮次: '8', 初始胜场: '7', 初始败场: '1', 初始积分: '140', 初始依据: '本局已确认累计战绩' });
  ui.saveTournamentDraft();
  assert.deepEqual(captured, { action: 'upsertParticipant', id: 'oc', participant: {
    姓名: 'OC', 来源: '玩家', 参赛状态: '参赛', 入赛轮次: 1,
    初始战绩: { 截至轮次: 8, 胜场: 7, 败场: 1, 积分: 140, 依据: '本局已确认累计战绩' },
  } });
  assert.equal(JSON.stringify(view.tournament), before);
});
test('correction can accept an OC victory while rejecting direct and nested derived score changes', () => {
  const text = read('correction.js'), realm = vm.createContext({ structuredClone });
  vm.runInContext(text.slice(text.indexOf('function correctionValue('), text.indexOf('function correctionRules(')), realm);
  const state = { 场景: { 选拔赛: { 状态: '未开始', 名册: { oc: { 姓名: 'OC', 初始战绩: { 胜场: 0, 积分: 0 } } },
    比赛: { m1: { 胜者: 'shizuku', 甲赛前胜场: 0, 乙赛前胜场: 1 } }, 程序战况: { 版本: 'T02' } } } };
  const patch = realm.normalizeCorrectionPatch([
    { op: 'replace', path: '/场景/选拔赛', value: { 状态: '进行中', 排名: 1, 程序战况: { 版本: '假' },
      名册: { oc: { 姓名: 'OC新名', 胜场: 99, 初始战绩: { 胜场: 99 } } },
      比赛: { m1: { 胜者: 'oc', 甲赛前胜场: 99, 乙赛前胜场: 99, 积分: 9999, 程序推演: true, 推演版本: '假' } } } },
    { op: 'remove', path: '/场景/选拔赛/名册/oc/初始战绩' },
    { op: 'replace', path: '/场景/选拔赛/名册/oc', value: null },
    { op: 'remove', path: '/场景/选拔赛/名册/oc' },
    { op: 'copy', from: '/场景/选拔赛/比赛/m1/乙赛前胜场', path: '/场景/选拔赛/比赛/m1/依据' },
  ], state);
  assert.deepEqual(plain(patch), [
    { op: 'replace', path: '/场景/选拔赛/状态', value: '进行中' },
    { op: 'replace', path: '/场景/选拔赛/名册/oc/姓名', value: 'OC新名' },
    { op: 'replace', path: '/场景/选拔赛/比赛/m1/胜者', value: 'oc' },
  ]);
  assert.ok(patch.skipped.length >= 10);
});
test('correction protects existing entry rounds and core-owned withdrawal dates even through parent objects', () => {
  const text = read('correction.js'), realm = vm.createContext({ structuredClone });
  vm.runInContext(text.slice(text.indexOf('function correctionValue('), text.indexOf('function correctionRules(')), realm);
  const state = { 场景: { 选拔赛: { 名册: {
    late: { 姓名: '中途选手', 入赛轮次: 7, 参赛状态: '参赛' },
    existing: { 姓名: '既有选手', 参赛状态: '参赛' },
    retired: { 姓名: '退赛选手', 入赛轮次: 1, 参赛状态: '退选', 退赛日期: '2013-05-10' },
  } } } };
  const patch = realm.normalizeCorrectionPatch([
    { op: 'replace', path: '/场景', value: { 选拔赛: { 名册: {
      late: { 入赛轮次: 1, 参赛状态: '退选', 退赛日期: '2013-04-22' },
      existing: { 入赛轮次: 8 },
      retired: { 退赛日期: '2013-07-08' },
      newcomer: { 姓名: '新选手', 来源: '原创', 参赛状态: '参赛', 入赛轮次: 8, 退赛日期: '2013-04-22' },
    } } } },
    { op: 'remove', path: '/场景/选拔赛/名册/late/入赛轮次' },
    { op: 'remove', path: '/场景/选拔赛/名册/retired/退赛日期' },
    { op: 'remove', path: '/场景/选拔赛/名册/late' },
    { op: 'add', path: '/场景/选拔赛/名册/late', value: { 姓名: '中途选手', 入赛轮次: 1 } },
  ], state);
  assert.deepEqual(plain(patch), [
    { op: 'replace', path: '/场景/选拔赛/名册/late/参赛状态', value: '退选' },
    { op: 'add', path: '/场景/选拔赛/名册/newcomer', value: { 姓名: '新选手', 来源: '原创', 参赛状态: '参赛', 入赛轮次: 8 } },
  ]);
  assert.ok(patch.skipped.includes('/场景/选拔赛/名册/late/入赛轮次'));
  assert.ok(patch.skipped.includes('/场景/选拔赛/名册/existing/入赛轮次'));
  assert.ok(patch.skipped.includes('/场景/选拔赛/名册/newcomer/退赛日期'));
});
test('correction leaves the core-owned season end date read-only while accepting season status changes', () => {
  const text = read('correction.js'), realm = vm.createContext({ structuredClone });
  vm.runInContext(text.slice(text.indexOf('function correctionValue('), text.indexOf('function correctionRules(')), realm);
  const ended = { 场景: { 选拔赛: { 状态: '已结束', 结束日期: '2013-06-14', 名册: {}, 比赛: {} } } };
  const patch = realm.normalizeCorrectionPatch([
    { op: 'replace', path: '/场景', value: { 选拔赛: { 状态: '进行中', 结束日期: '2013-07-08' } } },
    { op: 'replace', path: '/场景/选拔赛/结束日期', value: '2013-05-01' },
    { op: 'remove', path: '/场景/选拔赛/结束日期' },
    { op: 'remove', path: '/场景/选拔赛' },
  ], ended);
  assert.deepEqual(plain(patch), [{ op: 'replace', path: '/场景/选拔赛/状态', value: '进行中' }]);
  assert.ok(patch.skipped.includes('/场景/选拔赛/结束日期'));
  const ongoing = structuredClone(ended);
  ongoing.场景.选拔赛.状态 = '进行中'; delete ongoing.场景.选拔赛.结束日期;
  assert.deepEqual(plain(realm.normalizeCorrectionPatch([
    { op: 'add', path: '/场景/选拔赛', value: { 状态: '已结束', 结束日期: '2013-07-08' } },
  ], ongoing)), [{ op: 'replace', path: '/场景/选拔赛/状态', value: '已结束' }]);
});
