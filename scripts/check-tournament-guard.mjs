// Run: node scripts/check-tournament-guard.mjs
// Execute the maintained shared sources and installed MVU event callback in an offline VM.
// Only host event registration is simulated; no browser, API, release artifact, or real save is touched.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { inlineStoryCatalog, inlineTournamentSource, stripModuleSyntax } from './story-build.mjs';

const require = createRequire(import.meta.url);
const { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const plain = value => JSON.parse(JSON.stringify(value));
const source = [inlineStoryCatalog(), inlineTournamentSource(),
  stripModuleSyntax(read('../世界书规则/MVU/schema.mjs')),
  stripModuleSyntax(read('./rakudai-state-core.mjs')), read('./rakudai-mvu-guard.js'),
  'const testSchema = createSchema(z);', 'installRakudaiMvuGuard(testSchema);',
  'globalThis.testApi = { INITIAL_STATE, schema: testSchema, deriveTournament };',
].join('\n');

function fixture() {
  const hooks = new Map(), lifecycle = new Map(), warnings = [];
  const host = { SillyTavern: { getContext: () => ({ chatId: 'offline-tournament', chat: [] }) } };
  const window = { parent: host, top: host, addEventListener: (event, callback) => lifecycle.set(event, callback) };
  const realm = vm.createContext({ window, z, structuredClone,
    Mvu: { events: { VARIABLE_UPDATE_ENDED: 'mvu-ended', COMMAND_PARSED: 'mvu-parsed' } },
    eventOn: (name, callback) => { hooks.set(name, callback); return { stop: () => hooks.delete(name) }; },
    console: { warn: message => warnings.push(message), info() {} },
  });
  vm.runInContext(source, realm, { filename: 'tournament-guard-shared-source.js' });
  const { INITIAL_STATE, schema, deriveTournament } = realm.testApi;
  function state(date = '2013-04-21') {
    const value = structuredClone(INITIAL_STATE);
    value.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
    value.玩家.姓名 = '测试原创玩家';
    Object.assign(value.场景, { 当前卷: 1, 当前章: '第一章', 阶段: '进行中', 时间: date, 地点: '破军学园' });
    return plain(schema.parse(value));
  }
  function update(before, mutate) {
    const previous = { stat_data: structuredClone(before) }, variables = structuredClone(previous);
    mutate(variables.stat_data);
    hooks.get('mvu-ended')(variables, previous);
    assert.deepEqual(plain(previous.stat_data), plain(before), 'the real callback must not mutate its previous-state argument');
    assert.equal(schema.safeParse(variables.stat_data).success, true, 'the saved result must satisfy the real schema');
    return variables.stat_data;
  }
  const bootstrap = () => update(state(), next => { next.场景.时间 = '2013-05-29'; });
  function actualWin(before = bootstrap()) {
    const view = deriveTournament(before), shizuku = view.roster.find(row => row.name === '黑铁珠雫');
    assert.ok(shizuku);
    return update(before, next => {
      next.场景.选拔赛.比赛.oc_r9 = { 轮次: 9, 甲方: view.playerId, 乙方: shizuku.id, 日期: '2013-05-28',
        时间: '午后', 地点: '第一对决场', 状态: '已完成', 胜者: view.playerId, 依据: '本轮实际扮演：OC 战胜珠雫' };
    });
  }
  return { host, window, hooks, lifecycle, warnings, state, update, bootstrap, actualWin, deriveTournament };
}

test('installed guard exposes T02 and initializes a dated T01 ledger with a program summary through ENDED', () => {
  const f = fixture();
  assert.equal(f.host.__RK_MVU_GUARD_V4__.tournament, 'T01');
  assert.equal(f.host.__RK_MVU_GUARD_V4__.tournamentEngine, 'T02');
  assert.equal(f.window.__RK_MVU_GUARD_V4__, f.host.__RK_MVU_GUARD_V4__);
  assert.equal(typeof f.hooks.get('mvu-ended'), 'function');
  const saved = f.bootstrap(), ledger = saved.场景.选拔赛;
  assert.equal(ledger.版本, 'T01'); assert.equal(Object.keys(ledger.比赛).length, 0);
  assert.equal(ledger.程序战况.版本, 'T02'); assert.equal(ledger.程序战况.日期, '2013-05-29');
  assert.equal(ledger.程序战况.当前场次, 9);
  const shizuku = ledger.程序战况.名册.find(row => row.姓名 === '黑铁珠雫');
  assert.deepEqual([shizuku.胜场, shizuku.败场, shizuku.推演场数], [9, 0, 9]);
  f.lifecycle.get('pagehide')();
  assert.equal(f.host.__RK_MVU_GUARD_V4__, undefined); assert.equal(f.hooks.size, 0);
});

test('the real ENDED handler accepts OC victory: Shizuku becomes 8–1 and the actual ninth match awards 90', () => {
  const f = fixture(), saved = f.actualWin(), view = f.deriveTournament(saved);
  const shizuku = view.roster.find(row => row.name === '黑铁珠雫');
  const player = view.roster.find(row => row.id === view.playerId);
  assert.deepEqual([shizuku.wins, shizuku.losses], [8, 1]);
  assert.equal(view.matches.find(match => match.id === 'oc_r9').积分, 90);
  assert.equal(player.recordedPoints, 90); assert.equal(player.points, null);
  assert.equal(saved.场景.选拔赛.比赛.oc_r9.胜者, view.playerId);
  assert.equal(Object.keys(saved.场景.选拔赛.比赛).length, 1, 'background matches must remain outside the real ledger');
  const summary = saved.场景.选拔赛.程序战况.名册.find(row => row.姓名 === '黑铁珠雫');
  assert.deepEqual([summary.胜场, summary.败场], [8, 1]);
});

test('ENDED rejects AI totals, generated flags, pre-match wins, and forged baselines without changing the real winner', () => {
  const f = fixture(), before = f.actualWin(), playerId = f.deriveTournament(before).playerId;
  const saved = f.update(before, next => {
    const ledger = next.场景.选拔赛;
    ledger.积分 = 9999; ledger.排名 = 1;
    ledger.名册[playerId].积分 = 9999;
    ledger.名册[playerId].初始战绩 = { 截至轮次: 8, 胜场: 8, 败场: 0, 积分: 9999, 依据: 'AI 伪造' };
    Object.assign(ledger.比赛.oc_r9, { 积分: 9999, 乙赛前胜场: 99, 程序推演: true, 推演版本: '伪造' });
    ledger.程序战况 = { 版本: '伪造', 名册: [] };
  });
  const ledger = saved.场景.选拔赛, view = f.deriveTournament(saved);
  for (const key of ['积分', '排名']) assert.equal(Object.hasOwn(ledger, key), false);
  for (const key of ['积分', '初始战绩']) assert.equal(Object.hasOwn(ledger.名册[playerId], key), false);
  for (const key of ['积分', '乙赛前胜场', '程序推演', '推演版本']) assert.equal(Object.hasOwn(ledger.比赛.oc_r9, key), false);
  assert.equal(ledger.程序战况.版本, 'T02');
  assert.equal(view.matches.find(match => match.id === 'oc_r9').积分, 90);
  assert.equal(ledger.比赛.oc_r9.胜者, playerId);
  assert.ok(f.warnings.some(message => message.includes('初始战绩')));
});

test('an invalid real match restores only the tournament subtree and preserves unrelated facts from the same update', () => {
  const f = fixture(), before = f.actualWin();
  const saved = f.update(before, next => {
    next.场景.地点 = '医务室';
    next.场景.已发生事件.赛后慰问 = { 卷号: 1, 章段: '第一章', 结果: '本轮实际完成慰问', 参与者: ['测试原创玩家'], 知情者: ['黑铁珠雫'] };
    next.场景.选拔赛.比赛.oc_r9.乙方 = next.场景.选拔赛.比赛.oc_r9.甲方;
  });
  assert.deepEqual(plain(saved.场景.选拔赛), plain(before.场景.选拔赛));
  assert.equal(saved.场景.地点, '医务室');
  assert.equal(saved.场景.已发生事件.赛后慰问.结果, '本轮实际完成慰问');
  assert.ok(f.warnings.some(message => message.includes('仅恢复选拔赛记录')));
});
