import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'parse5';
import { buildTournamentPanel } from './build-tournament-panel.mjs';
import { buildPreview } from './preview.mjs';
import { read as readTournamentState, samples } from '../../七星剑武祭-晋级面板预览/mvu-model.mjs';
import { tournamentSnapshotKey } from './terminal-tournament.js';

const catalog = {
  byName: { 紫乃宫天音: 'amane', 平贺玲泉: 'hiraga', 叶暮牡丹: 'botan', 叶暮桔梗: 'kikyo' },
  entries: Object.fromEntries(['amane', 'hiraga', 'botan', 'kikyo'].map(id => [id, { src: 'https://example.test/' + id + '.png' }]))
};
function scripts(html) {
  const found = [];
  function walk(node) {
    if (node.tagName === 'script') found.push({ attrs: node.attrs, code: node.childNodes.map(child => child.value || '').join('') });
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html));
  return found;
}
test('embedded panel compiles as complete HTML with catalog portraits and no bundled sample/engine', () => {
  const html = buildTournamentPanel(catalog), blocks = scripts(html);
  assert.equal(blocks.length, 6);
  blocks.forEach(block => { assert.equal(block.attrs.length, 0); new vm.Script(block.code); });
  assert.doesNotMatch(html, /<script src=|<link rel="stylesheet"|function sampleState\(|function deriveTournament\(/);
  assert.ok(html.indexOf('id="session-main"') < html.indexOf('window.RK_PREVIEW_MVU ='));
  const realm = vm.createContext({ window: {}, structuredClone });
  blocks.slice(0, 4).forEach(block => vm.runInContext(block.code, realm));
  assert.equal(realm.window.RK_TOURNAMENT_EMBEDDED, true);
  assert.equal(realm.window.TOURNAMENT_PORTRAITS.amane, catalog.entries.amane.src);
  assert.equal(realm.window.TOURNAMENT_PORTRAITS.hiraga, catalog.entries.hiraga.src);
  assert.equal(realm.window.TOURNAMENT_ROLE_PORTRAITS.叶暮牡丹, catalog.entries.botan.src);
  assert.equal(realm.window.TOURNAMENT_ROLE_PORTRAITS.叶暮桔梗, catalog.entries.kikyo.src);
  const view = { applicable: true, exists: false, roster: [], playerId: null };
  const model = realm.window.RK_PREVIEW_MVU.read({ state: { 玩家: { 姓名: '自捏骑士' } }, pending: true, view });
  assert.equal(model.player.name, '自捏骑士');
  assert.equal(model.view, view);
  assert.equal(model.qualification.status, 'pending');
});

test('saved national matches render multiplayer screens and winner updates without interactive demo results', async () => {
  const elements = new Map(), listeners = {};
  const element = key => {
    if (!elements.has(key)) elements.set(key, { innerHTML: '', textContent: '', value: '', hidden: false,
      querySelector: () => element(key + '/label'), querySelectorAll: () => [], prepend() {},
      addEventListener() {}, close() {}, showModal() {}, setAttribute() {} });
    return elements.get(key);
  };
  const realm = vm.createContext({ structuredClone, requestAnimationFrame: fn => fn(), ResizeObserver: class { observe() {} },
    document: { querySelector: element, querySelectorAll: () => [], createElement: () => element('button'), addEventListener: (type, fn) => { listeners[type] = fn; } } });
  realm.window = realm;
  Object.assign(realm, { RK_TOURNAMENT_EMBEDDED: true, RK_PREVIEW_MVU: { read: readTournamentState },
    TOURNAMENT_DATA: { players: {} }, TOURNAMENT_PORTRAITS: {}, RK_TERMINAL_ACTIONS: { editSelection() {} } });
  vm.runInContext(fs.readFileSync(new URL('../../七星剑武祭-晋级面板预览/session-ui.js', import.meta.url), 'utf8'), realm);
  const click = async dataset => listeners.click({ target: { closest: () => ({ dataset, hasAttribute: name => name === 'data-session-back' && dataset.back }) } });
  realm.RK_MATCH_PREVIEW.setSnapshot({ state: samples.national.state }, { reset: true });
  await click({ sessionPage: 'national' });
  await click({ sessionRegion: 'B' });
  assert.match(element('#session-main').innerHTML, /特别赛/);
  assert.match(element('#session-main').innerHTML, /裁定晋级/);
  assert.doesNotMatch(element('#session-main').innerHTML, /data-demo-/);
  await click({ sessionMatch: 'preview_special' });
  assert.match(element('#session-main').innerHTML, /WINNER/);
  assert.match(element('#session-main').innerHTML, /晋级 8强/);
  const updated = structuredClone(samples.national.state);
  updated.场景.七星剑斗祭.比赛.preview_special.状态 = '已安排';
  delete updated.场景.七星剑斗祭.比赛.preview_special.胜者;
  realm.RK_MATCH_PREVIEW.setSnapshot({ state: updated }, { reset: false });
  assert.match(element('#session-main').innerHTML, /tv-special-duel/);
  for (let i = 1; i <= 4; i++) assert.match(element('#session-main').innerHTML, new RegExp('预览选手' + i));
  assert.doesNotMatch(element('#session-main').innerHTML, /WINNER|data-demo-winner/);
  const noDate = structuredClone(updated); noDate.场景.时间 = '';
  realm.RK_MATCH_PREVIEW.setSnapshot({ state: noDate }); await click({ back: true });
  assert.match(element('#session-main').innerHTML, /剧情日期待确认/);
});

function hostFixture() {
  const calls = [], frames = [];
  const body = { replaceChildren(frame) { frames.push(frame); } };
  const elements = { 'arena-body': body, 'arena-title': {}, 'arena-preview-notice': {} };
  const element = id => {
    if (!elements[id]) elements[id] = { style: {}, classList: { add() {}, remove() {}, toggle() {} } };
    return elements[id];
  };
  const realm = vm.createContext({
    document: { getElementById: element, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({
      contentWindow: { RK_MATCH_PREVIEW: { setSnapshot: (...args) => calls.push(args) } }, remove() { this.removed = true; }
    }) },
    addEventListener() {},
    RK_TOURNAMENT_PANEL_HTML: '<p>赛事页</p>',
  });
  realm.window = realm;
  vm.runInContext(fs.readFileSync(new URL('./terminal-tournament.js', import.meta.url), 'utf8').replace(/^export /gm, '') + '\n' +
    fs.readFileSync(new URL('./terminal-app.js', import.meta.url), 'utf8'), realm);
  Object.assign(realm, { stat: { 玩家: { 姓名: '自捏骑士' } }, stateSource: { chatId: 'chat', messageId: 1, swipeId: 0 },
    dataStatus: 'pending', hasDisplayedState: true, currentStack: ['scr-home', 'scr-schedule', 'scr-arena'],
    resolveKnightAvatar: () => ({ src: 'https://example.test/player.png' }), renderSchedule() { calls.push('schedule-render'); },
    bridge: { tournament: { snapshotKey: tournamentSnapshotKey, view: () => ({ roster: [], playerId: 'oc' }) } } });
  return { realm, calls, frames, elements };
}
test('unfinished and pending sessions stay labelled as preview; saved completion opens the same panel without altering state', () => {
  const { realm, frames, elements } = hostFixture();
  realm.stat.场景 = { 选拔赛: { 状态: '进行中' } };
  realm.dataStatus = 'ready';
  let before = JSON.stringify(realm.stat);
  realm.renderTournamentPanel(); frames[0].onload();
  assert.equal(elements['arena-preview-notice'].hidden, false);
  assert.equal(elements['arena-title'].textContent, '七星剑斗祭 · 预览');
  assert.equal(frames[0].title, '七星剑斗祭 · 预览');
  assert.equal(JSON.stringify(realm.stat), before);
  realm.stat.场景.选拔赛.状态 = '已结束';
  before = JSON.stringify(realm.stat);
  realm.renderTournamentPanel();
  assert.equal(elements['arena-preview-notice'].hidden, true);
  assert.equal(elements['arena-title'].textContent, '七星剑斗祭 · 赛事面板');
  assert.equal(frames.length, 1);
  realm.dataStatus = 'pending'; realm.renderTournamentPanel();
  assert.equal(elements['arena-preview-notice'].hidden, false);
  assert.equal(JSON.stringify(realm.stat), before);
  realm.stat = { 玩家: { 姓名: '另一存档' } }; realm.dataStatus = 'ready'; realm.renderTournamentPanel();
  assert.equal(elements['arena-title'].textContent, '七星剑斗祭 · 预览');
});
test('host pushes the displayed snapshot, keeps one iframe, and resets only when source changes', () => {
  const { realm, calls, frames } = hostFixture();
  realm.renderTournamentPanel();
  assert.equal(calls.length, 0);
  frames[0].onload();
  assert.equal(calls[0][0].state, realm.stat);
  assert.equal(calls[0][0].pending, true);
  assert.equal(calls[0][1].avatarUrl, 'https://example.test/player.png');
  assert.equal(calls[0][1].reset, true);
  realm.dataStatus = 'ready'; realm.renderTournamentPanel();
  assert.equal(frames.length, 1);
  assert.equal(calls[1][0].pending, false); assert.equal(calls[1][1].reset, false);
  realm.stateSource.swipeId = 1; realm.renderTournamentPanel();
  assert.equal(calls[2][1].reset, true);
  realm.destroyTournamentPanel();
  assert.equal(frames[0].removed, true); assert.equal(frames[0].onload, null);
  assert.equal(realm.tournamentPanelFrame, undefined, 'the frame reference stays private to the module');
  realm.renderTournamentPanel(); assert.equal(frames.length, 2);
});
test('selection maintenance reuses an existing schedule page instead of stacking duplicate pages', () => {
  const { realm, frames } = hostFixture();
  realm.renderTournamentPanel(); frames[0].onload();
  frames[0].contentWindow.RK_TERMINAL_ACTIONS.editSelection();
  assert.deepEqual([...realm.currentStack], ['scr-home', 'scr-schedule']);
  realm.currentStack = ['scr-home', 'scr-arena'];
  frames[0].contentWindow.RK_TERMINAL_ACTIONS.editSelection();
  assert.deepEqual([...realm.currentStack], ['scr-home', 'scr-schedule']);
});

test('actual terminal preview receives derived OC, qualification, tie and other-school views only as offline fixtures', () => {
  const preview = buildPreview();
  const bootstrap = scripts(preview.html)[0].code;
  const declarations = ['samples', 'tournamentViews'].map(name => {
    const declaration = bootstrap.match(new RegExp('^const ' + name + ' = .*;$', 'm'));
    assert.ok(declaration, name + ' missing from preview bootstrap');
    return declaration[0];
  });
  const realm = {};
  vm.runInNewContext(declarations.join('\n') + '\nglobalThis.result = { samples, tournamentViews };', realm);
  const { samples, tournamentViews } = realm.result;
  const selection = tournamentViews.selection;
  const oc = selection.roster.find(row => row.id === selection.playerId);
  assert.equal(oc.name, samples.selection.玩家.姓名);
  assert.equal(oc.player, true);
  assert.ok(selection.matches.some(match => !match.程序推演 && [match.甲方, match.乙方].includes(selection.playerId)));
  assert.equal(tournamentViews.qualified.complete, false);
  const qualified = readTournamentState({ state: samples.qualified }, tournamentViews.qualified).qualification;
  assert.equal(qualified.status, 'qualified');
  assert.ok(qualified.representatives.some(row => row.player));
  assert.equal(tournamentViews.tie.complete, true);
  assert.equal(tournamentViews.tie.qualificationTie, true);
  assert.equal(tournamentViews.other.applicable, false);
  assert.equal(readTournamentState({ state: samples.other }, tournamentViews.other).qualification.status, 'qualified');
  assert.equal(tournamentViews.ikki.roster.filter(row => row.name === '黑铁一辉').length, 1);
  for (const name of ['紫乃宫天音', '平贺玲泉', '叶暮牡丹', '叶暮桔梗']) assert.ok(samples.avatars.人际[name]);
  assert.match(bootstrap, /赛事离线预览只读/);
  assert.match(bootstrap, /query\.get\('view'\) === 'arena'/);
});
