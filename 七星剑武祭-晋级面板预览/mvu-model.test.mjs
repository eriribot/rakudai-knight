import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { samples, read } from './mvu-model.mjs';
import { deriveTournament } from '../scripts/rakudai-tournament.mjs';

const selection = read(samples.selection.state);
assert.equal(selection.player.name, '示例骑士');
assert.equal(selection.player.school, '破军学园 / 一年一班');
assert.equal(selection.player.device, '星刻');
assert.equal(selection.player.rank, 'C');
assert.equal(selection.player.id, 'player');
assert.equal(selection.qualification.status, 'unconfirmed');
assert.deepEqual(selection.view, deriveTournament(samples.selection.state));
assert(selection.view.roster.some(row => row.name === '黑铁一辉'));
assert(selection.view.matches.some(match => match.id === 'preview_match_1' && !match.程序推演));
assert.deepEqual(read({ stat_data: samples.selection.state }), selection);

const qualified = read(samples.qualified.state);
assert.equal(qualified.view.complete, true);
assert.equal(qualified.view.roster.length, 288);
assert.equal(qualified.qualification.status, 'qualified');
assert.equal(qualified.qualification.representatives.length, 6);
assert(qualified.qualification.representatives.some(row => row.id === qualified.player.id));

const tie = read(samples.tie.state);
assert.equal(tie.view.complete, true);
assert.equal(tie.view.qualificationTie, true);
assert.equal(tie.qualification.status, 'tie');
assert.equal(tie.qualification.representatives.length, 0);

const source = { chatId: 'preview-only', messageId: 3 };
const waiting = read({ state: samples.qualified.state, source, pending: true });
assert.equal(waiting.pending, true);
assert.deepEqual(waiting.source, source);
assert.equal(waiting.qualification.status, 'pending');
assert.equal(waiting.qualification.representatives.length, 0);
assert.equal(read({ state: samples.qualified.state, incomplete: true }).qualification.status, 'unconfirmed');

const other = read(samples.other.state);
assert.equal(other.qualification.status, 'not-applicable');
assert.equal(other.player.name, '示例骑士');
assert.equal(other.view.applicable, false);

const ikki = read(samples.ikki.state);
assert.equal(ikki.player.name, '黑铁一辉');
assert.equal(ikki.player.id, 'canon_01');
assert.equal(ikki.view.roster.filter(row => row.name === '黑铁一辉').length, 1);
assert.equal(ikki.view.roster.filter(row => row.source === '玩家').length, 1);

const losesSeat = structuredClone(samples.qualified.state);
losesSeat.场景.选拔赛.名册.player.初始战绩.积分 = 400;
assert.equal(read(losesSeat).qualification.status, 'not-qualified');
const ongoing = structuredClone(samples.qualified.state);
ongoing.场景.选拔赛.状态 = '进行中';
assert.equal(read(ongoing).qualification.status, 'unconfirmed');

const original = JSON.stringify(samples);
read(samples.selection.state).stat.玩家.姓名 = '不能改原样本';
assert.equal(JSON.stringify(samples), original);

const browser = { window: {}, structuredClone };
vm.runInNewContext(await readFile(new URL('./mvu-model.js', import.meta.url), 'utf8'), browser);
for (const [key, sample] of Object.entries(samples)) {
  const result = browser.window.RK_PREVIEW_MVU.read(browser.window.RK_PREVIEW_MVU.samples[key].state);
  assert.equal(result.qualification.status, read(sample.state).qualification.status, key);
  assert.equal(result.player.id, read(sample.state).player.id, key);
}
console.log('MVU preview adapter: identity, real engine, eligibility, tie, pending, one Ikki, immutability, classic bundle passed.');
