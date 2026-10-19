// Offline checks exercise the maintained module through rendered controls; no live saves or exported artifacts.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFragment } from 'parse5';
import { buildTerminal } from './bundle.mjs';
import { tournamentSnapshotKey } from './terminal-tournament.js';
import { read as readTournamentState } from '../../七星剑武祭-晋级面板预览/mvu-model.mjs';
import { deriveNationalTournament, prepareNationalTournamentAction } from '../rakudai-national-tournament.mjs';

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));
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
function formValues(html) {
  const values = {};
  const text = node => node.value || (node.childNodes || []).map(text).join('');
  const visit = node => {
    const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
    if (attrs.name && ['input', 'select', 'textarea'].includes(node.tagName)) {
      const options = (node.childNodes || []).filter(child => child.tagName === 'option');
      const selected = options.find(option => option.attrs.some(attr => attr.name === 'selected')) || options[0];
      values[attrs.name] = node.tagName === 'select' ? selected?.attrs.find(attr => attr.name === 'value')?.value || '' :
        node.tagName === 'textarea' ? text(node) : attrs.value || '';
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(parseFragment(html));
  return values;
}
function uiFixture() {
  const elements = new Map(), requests = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', title: '', style: {},
      classList: { add() {}, remove() {}, toggle() {} }, contains: () => true });
    return elements.get(id);
  };
  const ui = vm.createContext({ structuredClone, setTimeout, clearTimeout,
    document: { getElementById: element, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }, addEventListener() {} });
  ui.window = ui;
  vm.runInContext(read('terminal-tournament.js').replace(/^export /gm, '') + '\n' + read('terminal-app.js'), ui);
  const view = makeView();
  ui.stat = structuredClone(originalState);
  ui.stateSource = { characterId: 1, chatId: 'test', messageId: 2, swipeId: 0 };
  ui.hasDisplayedState = true; ui.dataStatus = 'ready';
  ui.refreshTerminalState = async () => {};
  ui.refreshTerminalView = () => ui.renderSchedule();
  ui.bridge = { tournament: { view: () => view, nationalView: deriveNationalTournament, snapshotKey: tournamentSnapshotKey,
    participant: () => ({ id: 'oc_new' }), action: request => { requests.push(plain(request)); return { ok: true }; } } };
  const html = () => element('schedule-body').innerHTML;
  const click = (action, id = '') => {
    ui.renderSchedule();
    const button = { disabled: false, getAttribute: key => key === 'data-rk-t-action' ? action : id };
    element('schedule-body').onclick({ target: { closest: () => button } });
  };
  const field = (name, value) => {
    const target = { name, value, matches: () => true };
    element('schedule-body')[name === '参赛者' ? 'onchange' : 'oninput']({ target });
    ui.renderSchedule();
  };
  const submit = async () => {
    element('schedule-body').onsubmit({ target: { matches: () => true }, preventDefault() {} });
    await settle();
    return requests.at(-1);
  };
  return { ui, view, element, requests, html, click, field, submit, values: () => formValues(html()) };
}

test('the complete terminal compiles; the shell no longer owns tournament drafts or duplicate snapshot rules', () => {
  assert.ok(buildTerminal().artifact.content.length > 0);
  assert.doesNotMatch(read('terminal-app.js'), /tournamentDraft|tournamentWriting|tournamentMessage|function tournamentSnapshotKey/);
  const { ui } = uiFixture();
  assert.equal(ui.tournamentDraft, undefined);
  assert.equal(ui.tournamentPanelFrame, undefined);
});

test('national forms save multiplayer results, schedule changes and direct advancement without a Hagun ledger', async () => {
  const fixture = uiFixture(), { ui, view, click, field, submit, html } = fixture;
  view.applicable = false; view.exists = false; view.virtual = false;
  ui.stat.玩家.所属 = '文曲学园';
  delete ui.stat.场景.选拔赛;
  ui.stat.场景.时间 = '日期待确认';
  ui.stat.场景.七星剑斗祭 = { 资格名册: Object.fromEntries(['oc', 'a', 'b', 'c', 'd'].map(id => [id, { 姓名: id, 学园: '文曲学园', 资格状态: '已取得', 依据: '已登记' }])) };
  click('national-match');
  assert.match(html(), /multiple size="6"/);
  field('全国参赛者', ['oc', 'a', 'b', 'c', 'd']);
  for (const [name, value] of Object.entries({ 轮次: '特别赛', 分区: 'B', 日期: '2013-08-08', 状态: '已完成', 胜者: 'oc', 晋级至: '8强', 依据: '本局已完成' })) field(name, value);
  const request = await submit();
  assert.equal(request.action, 'upsertNationalMatch');
  assert.deepEqual(request.match.参赛者, ['oc', 'a', 'b', 'c', 'd']);
  ui.stat = prepareNationalTournamentAction(ui.stat, request);
  assert.match(ui.tournamentUI().calendarEntries().find(row => row.id === 'national:' + request.id).name, /七星剑斗祭/);
  click('national-match', request.id); field('日期', '2013-08-09');
  const corrected = await submit();
  assert.equal(corrected.id, request.id); assert.equal(corrected.match.日期, '2013-08-09');
  click('national-schedule'); field('开始日期', '2013-08-09'); field('结束日期', '2013-08-15'); field('状态', '进行中');
  const schedule = await submit();
  assert.equal(schedule.action, 'setNationalSchedule'); assert.equal(schedule.开始日期, '2013-08-09');
  click('national-advancement'); field('选手', 'a'); field('阶段', '16强'); field('依据', '已确认直接晋级');
  const advancement = await submit();
  assert.equal(advancement.action, 'upsertNationalAdvancement');
  assert.equal(advancement.advancement.选手, 'a');
  assert.equal(prepareNationalTournamentAction(ui.stat, advancement).场景.选拔赛, undefined);
  assert.match(read('main.js'), /request\.action\.includes\('National'\) \? 'national'/);
});
test('returning from the arena refreshes the entry after a season change', () => {
  const { ui, html } = uiFixture();
  ui.renderSchedule(); assert.match(html(), /预览赛事面板/);
  ui.currentStack = ['scr-home', 'scr-schedule', 'scr-arena'];
  ui.stat.场景.选拔赛.状态 = '已结束';
  ui.goBack();
  assert.match(html(), /class="rk-arena-entry"/); assert.doesNotMatch(html(), /预览赛事面板/);
});

test('early national scheduling keeps preview gated until saved national progress or selection completion', () => {
  const { ui, html, click, values } = uiFixture();
  ui.stat.场景.七星剑斗祭 = { 状态: '未开始', 比赛: {
    early: { 轮次: '首轮', 分区: 'A', 参赛者: [], 日期: '2013-08-07', 时间: '', 地点: '', 状态: '已安排', 依据: '' },
  } };
  ui.renderSchedule(); assert.match(html(), /预览赛事面板/);
  ui.stat.场景.七星剑斗祭.比赛.early.状态 = '待定';
  ui.renderSchedule(); assert.match(html(), /预览赛事面板/);
  ui.bridge.tournament.nationalView = state => ({ ...deriveNationalTournament(state), calendar: { startDate: '2014-09-01', endDate: '2014-09-08' } });
  click('national-schedule');
  assert.equal(values().开始日期, '2014-09-01'); assert.equal(values().结束日期, '2014-09-08');
  for (const status of ['进行中', '已结束']) {
    ui.stat.场景.七星剑斗祭.状态 = status;
    ui.renderSchedule(); assert.match(html(), /class="rk-arena-entry"/);
  }
});
test('national tournament is an explicit preview until a saved selection end, independent of date and projection', () => {
  for (const selection of [undefined, {}, { 状态: '未开始' }, { 状态: '进行中' }]) {
    const { ui, view, html, click } = uiFixture();
    if (selection === undefined) delete ui.stat.场景.选拔赛; else ui.stat.场景.选拔赛 = selection;
    Object.assign(ui.stat.场景, { 时间: '2013-08-01', 当前卷: 9 });
    Object.assign(view, { complete: true, exists: true }); view.tournament.状态 = '已结束';
    const before = JSON.stringify(ui.stat);
    ui.renderSchedule();
    assert.match(html(), /选拔赛结束后开放/); assert.match(html(), /预览赛事面板/);
    assert.doesNotMatch(html(), /class="rk-arena-entry"/);
    let opened = 0; ui.renderTournamentPanel = () => { opened++; };
    click('open-arena'); assert.equal(opened, 1);
    assert.equal(JSON.stringify(ui.stat), before);
  }
});
test('saved selection end opens viewing but grants no qualification from incomplete or tied history', () => {
  for (const [complete, qualificationTie] of [[false, false], [true, true]]) {
    const { ui, view, html } = uiFixture();
    ui.stat.场景.选拔赛.状态 = '已结束'; view.tournament.状态 = '已结束';
    Object.assign(view, { applicable: true, exists: true, virtual: false, complete, qualificationTie });
    const before = JSON.stringify(ui.stat); ui.renderSchedule();
    assert.match(html(), /class="rk-arena-entry"/);
    assert.equal(readTournamentState({ state: ui.stat }, view).qualification.status, 'unconfirmed');
    assert.equal(JSON.stringify(ui.stat), before);
  }
});
test('pending snapshots retain the preview gate until saving completes', () => {
  const { ui, view, html } = uiFixture(); ui.stat.场景.选拔赛.状态 = '已结束';
  for (const status of ['loading', 'pending', 'error']) {
    ui.dataStatus = status; ui.renderSchedule(); assert.match(html(), /预览赛事面板/);
    assert.equal(readTournamentState({ state: ui.stat, pending: true }, view).qualification.status, 'pending');
  }
  ui.dataStatus = 'ready'; ui.renderSchedule(); assert.match(html(), /class="rk-arena-entry"/);
});
test('other-school players retain schedules and national editing while old Hagun records stay read-only', () => {
  for (const exists of [false, true]) {
    const { ui, view, element, html, click } = uiFixture();
    ui.stat.玩家.所属 = '贪狼学园';
    ui.stat.场景.日程 = { 图书馆约定: { 日期: '2013-05-11', 状态: '已安排', 说明: '还书' } };
    Object.assign(view, { applicable: false, exists, virtual: false, calendar: null,
      matches: exists ? [{ ...projectedMatch, id: 'recorded', 程序推演: false }] : [] });
    const before = JSON.stringify(ui.stat); ui.renderSchedule();
    assert.match(html(), /图书馆约定/); assert.match(html(), /data-rk-t-action="qualification"/);
    assert.doesNotMatch(html(), /data-rk-t-action="(?!qualification|open-arena|national-)[^"]+"|data-rk-t-form|维护参赛者资料/);
    assert.equal(readTournamentState({ state: ui.stat }, view).qualification.status, 'unconfirmed');
    if (exists) {
      ui.renderMoments(); assert.match(element('moments-body').innerHTML, /已确认 · 甲 胜出/);
      ui.renderBbs(); assert.match(element('bbs-body').innerHTML, /战绩待补/);
    }
    for (const action of ['initialize', 'new-match', 'edit-match', 'new-participant', 'edit-participant', 'backfill', 'status', 'detained']) {
      click(action, 'recorded'); assert.doesNotMatch(html(), /data-rk-t-form/); assert.match(html(), /当前所属不适用破军选拔/);
    }
    assert.equal(JSON.stringify(ui.stat), before);
  }
});
test('unknown history stays pending; projected matches stay read-only and never flood the calendar', () => {
  const { ui, view, html, click, element } = uiFixture(), before = JSON.stringify(ui.stat);
  ui.renderSchedule(); assert.match(html(), /<td>战绩待补/); assert.match(html(), /<td>总分待确认/);
  assert.match(html(), /背景预览/); assert.match(html(), /场外背景推演/);
  assert.doesNotMatch(html(), /data-rk-t-id="__bg_1"/);
  assert.equal(ui.readSceneSchedule().length, 0);
  click('edit-match', projectedMatch.id); assert.doesNotMatch(html(), /data-rk-t-form/); assert.match(html(), /背景推演为只读/);
  view.calendar.suspended = true; ui.renderSchedule(); assert.match(html(), /黄金周停赛中/);
  view.leaderboard = [{ ...pendingPlayer, status: '退选', source: '正典', projectedWithdrawal: true }];
  ui.renderBbs(); assert.match(element('bbs-body').innerHTML, /退选（背景推演）/);
  assert.equal(JSON.stringify(ui.stat), before);
});
test('new match follows current calendar; closing and resetting the module clear only its draft', () => {
  const { ui, click, values, html } = uiFixture();
  click('new-match'); assert.equal(values().轮次, '4'); assert.equal(values().日期, '2013-05-10'); assert.equal(values().甲方, 'oc');
  click('close-draft'); assert.doesNotMatch(html(), /data-rk-t-form/);
  click('new-match'); ui.tournamentUI().reset(); ui.renderSchedule(); assert.doesNotMatch(html(), /data-rk-t-form/);
});
test('two module instances keep drafts and pending saves separate; a late save cannot reopen a cleared draft', async () => {
  const first = uiFixture(), second = uiFixture();
  let finish;
  first.ui.bridge.tournament.action = () => new Promise(resolve => { finish = resolve; });
  first.click('qualification', 'oc'); first.field('资格状态', '已取得');
  const pending = first.submit(); await settle(); assert.match(first.html(), /正在保存…/);
  second.click('new-participant'); second.field('姓名', '第二个实例');
  assert.equal(second.values().姓名, '第二个实例'); assert.doesNotMatch(second.html(), /正在保存…/);
  first.ui.stateSource = { ...first.ui.stateSource, chatId: 'another-chat' };
  first.ui.tournamentUI().reset(); first.ui.renderSchedule();
  finish({ ok: true }); await pending;
  assert.doesNotMatch(first.html(), /data-rk-t-form|代表资格已保存/);
  assert.equal(second.values().姓名, '第二个实例');
});
test('date, identity and qualification updates invalidate drafts using the bridge snapshot rule', async () => {
  for (const [section, key, value] of [['场景', '时间', '2013-05-11'], ['系统', '主角模式', '黑铁一辉'], ['玩家', '姓名', '另一玩家'], ['玩家', '所属', '贪狼学园'], ['场景', '七星剑斗祭', { 资格名册: {} }]]) {
    const f = uiFixture(); f.click('qualification', 'oc'); f.ui.stat[section][key] = value;
    assert.notEqual(tournamentSnapshotKey(originalState), tournamentSnapshotKey(f.ui.stat));
    await f.submit(); assert.equal(f.requests.length, 0); assert.match(f.html(), /已变化/);
    f.ui.tournamentUI().onSnapshot(); f.ui.renderSchedule(); assert.doesNotMatch(f.html(), /data-rk-t-form/);
  }
});
test('qualification edits keep the saved ID when a later selection roster gives the player another ID', async () => {
  const f = uiFixture();
  f.ui.stat.场景.七星剑斗祭 = { 资格名册: { player: { 姓名: 'OC', 学园: '破军学园', 资格状态: '已取得', 依据: '' } } };
  f.view.roster.push({ id: 'stella', name: '史黛菈', source: '正典', status: '参赛' });
  const before = JSON.stringify(f.ui.stat); f.ui.renderSchedule();
  assert.match(f.html(), /data-rk-t-id="player">我的资格/);
  f.click('qualification', 'player'); assert.equal(f.values().资格状态, '已取得'); f.field('资格状态', '已取消');
  assert.deepEqual(await f.submit(), { action: 'upsertQualification', id: 'player', qualification: { 姓名: 'OC', 学园: '破军学园', 资格状态: '已取消', 依据: '' } });
  f.click('qualification', 'player'); f.field('参赛者', 'stella');
  assert.equal(f.values().参赛者, 'stella'); assert.equal(f.values().姓名, '史黛菈'); assert.equal(f.values().学园, '破军学园'); assert.equal(f.values().资格状态, '待确认');
  assert.equal(JSON.stringify(f.ui.stat), before);
});
test('other-school and custom entrants register without a selection ledger', async () => {
  const f = uiFixture(); f.ui.stat.玩家.所属 = '武曲学园 / 一年一班'; delete f.ui.stat.场景.选拔赛;
  Object.assign(f.view, { applicable: false, exists: false, virtual: false, playerId: null, roster: [], matches: [] });
  f.click('qualification', 'player'); assert.equal(f.values().学园, '武曲学园'); f.field('资格状态', '已取得');
  assert.deepEqual(await f.submit(), { action: 'upsertQualification', id: 'player', qualification: { 姓名: 'OC', 学园: '武曲学园', 资格状态: '已取得', 依据: '' } });
  f.ui.stat.场景.七星剑斗祭 = { 资格名册: { national_001: { 姓名: '先前角色', 学园: '贪狼学园', 资格状态: '已取得', 依据: '' } } };
  f.click('qualification'); f.field('姓名', '自定义选手'); f.field('学园', '禄存学园'); f.field('资格状态', '已取得');
  assert.equal((await f.submit()).id, 'national_002'); assert.equal(f.ui.stat.场景.选拔赛, undefined);
});
test('an occupied fallback ID preserves earlier characters and their qualification status', async () => {
  const f = uiFixture(); Object.assign(f.view, { playerId: null, roster: [] });
  const saved = { player: { 姓名: '先前玩家', 学园: '武曲学园', 资格状态: '已取得', 依据: '' },
    player_001: { 姓名: '其他角色', 学园: '破军学园', 资格状态: '已取消', 依据: '' } };
  f.ui.stat.场景.七星剑斗祭 = { 资格名册: saved }; const before = structuredClone(saved);
  f.ui.bridge.tournament.action = request => { saved[request.id] = plain(request.qualification); return { ok: true }; };
  f.ui.renderSchedule(); assert.match(f.html(), /data-rk-t-id="player_002">我的资格/);
  f.click('qualification', 'player_002'); f.field('资格状态', '已取得'); await f.submit();
  assert.deepEqual(saved.player, before.player); assert.deepEqual(saved.player_001, before.player_001);
  assert.equal(saved.player_002.姓名, 'OC'); assert.match(f.html(), /先前玩家<\/strong><span>已取得/); assert.match(f.html(), /其他角色<\/strong><span>已取消/);
});
test('host uses the shared snapshot rule, scoped saves, and rejects stale registries', async () => {
  const source = read('main.js'), state = structuredClone(originalState), snapshot = { source: { messageId: 2 }, state, pending: false };
  const captures = [], requests = [];
  const host = vm.createContext({ SS: {}, generationPending: false, correctionMainBusy: () => false,
    rosterEditRevision: 0, readSnapshot: () => snapshot, terminalStateReader: null, emit() {},
    stateService: () => ({ capabilities: { tournament: 'T01', tournamentEngine: 'T02' },
      capture: async options => { captures.push(options.scope); return { state, token: 'saved' }; },
      tournamentAction: async (token, request) => { requests.push(request.action); return { ok: true }; } }) });
  vm.runInContext(source.slice(source.indexOf('  let tournamentWriting = false;'), source.indexOf('  function makeBridge()'))
    .replace('/*__INJECT_TOURNAMENT_SNAPSHOT_KEY__*/', tournamentSnapshotKey.toString()), host);
  await host.writeTournament({ action: 'upsertQualification' }, snapshot.source, tournamentSnapshotKey(state));
  await host.writeTournament({ action: 'setStatus' }, snapshot.source, tournamentSnapshotKey(state));
  assert.deepEqual(captures, ['qualification', 'tournament']); assert.deepEqual(requests, ['upsertQualification', 'setStatus']);
  const oldKey = tournamentSnapshotKey(state); state.场景.七星剑斗祭 = { 资格名册: {} };
  await assert.rejects(host.writeTournament({ action: 'upsertQualification' }, snapshot.source, oldKey), /已变化/); assert.equal(captures.length, 2);
});
test('entry round and detention remain explicit form choices', async () => {
  const f = uiFixture(); f.click('new-participant'); assert.equal(f.values().入赛轮次, '1');
  f.field('姓名', '中途选手'); f.field('入赛轮次', '7'); assert.equal((await f.submit()).participant.入赛轮次, 7);
  f.click('new-participant'); f.field('姓名', '早期选手'); f.field('入赛轮次', ''); assert.equal(Object.hasOwn((await f.submit()).participant, '入赛轮次'), false);
  f.view.exists = true; f.view.virtual = false; f.click('detained'); assert.equal(f.values().detained, 'false');
  f.field('detained', 'true'); assert.deepEqual(await f.submit(), { action: 'setDetained', detained: true });
});
test('cumulative backfill saves totals without replacing match details', async () => {
  const f = uiFixture(), before = JSON.stringify(f.view.tournament); f.click('backfill', 'oc');
  assert.equal(f.values().姓名, 'OC'); assert.match(f.html(), /<details open><summary>手动补录截至某轮的累计战绩/);
  for (const [key, value] of Object.entries({ 初始截至轮次: '8', 初始胜场: '7', 初始败场: '1', 初始积分: '140', 初始依据: '本局已确认累计战绩' })) f.field(key, value);
  assert.deepEqual(await f.submit(), { action: 'upsertParticipant', id: 'oc', participant: { 姓名: 'OC', 来源: '玩家', 参赛状态: '参赛', 入赛轮次: 1,
    初始战绩: { 截至轮次: 8, 胜场: 7, 败场: 1, 积分: 140, 依据: '本局已确认累计战绩' } } });
  assert.equal(JSON.stringify(f.view.tournament), before);
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
