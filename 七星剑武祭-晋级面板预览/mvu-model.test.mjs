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
assert.equal(qualified.view.complete, false);
assert(qualified.view.roster.length < 288);
assert.equal(qualified.qualification.status, 'qualified');
assert.equal(qualified.qualification.representatives.length, 6);
assert(qualified.qualification.representatives.some(row => row.id === qualified.player.id));
assert.equal(read(JSON.parse(JSON.stringify(samples.qualified.state))).qualification.status, 'qualified');
const withoutBasis = structuredClone(samples.qualified.state);
withoutBasis.场景.七星剑斗祭.资格名册.player.依据 = '';
assert.match(read(withoutBasis).qualification.reason, /已确认取得/);
withoutBasis.场景.七星剑斗祭.资格名册.player.资格状态 = '已取消';
assert.match(read(withoutBasis).qualification.reason, /取消/);

const tie = read(samples.tie.state);
assert.equal(tie.view.complete, true);
assert.equal(tie.view.qualificationTie, true);
assert.equal(tie.qualification.status, 'unconfirmed');
assert.equal(tie.qualification.representatives.length, 0);
const completeWithoutQualification = structuredClone(samples.tie.state);
completeWithoutQualification.场景.选拔赛.名册.canon_06.初始战绩.积分 = 1300;
assert.equal(read(completeWithoutQualification).view.complete, true);
assert.equal(read(completeWithoutQualification).view.qualificationTie, false);
assert.equal(read(completeWithoutQualification).qualification.status, 'unconfirmed');

const source = { chatId: 'preview-only', messageId: 3 };
const waiting = read({ state: samples.qualified.state, source, pending: true });
assert.equal(waiting.pending, true);
assert.deepEqual(waiting.source, source);
assert.equal(waiting.qualification.status, 'pending');
assert.equal(waiting.qualification.representatives.length, 0);
assert.equal(read({ state: samples.qualified.state, incomplete: true }).qualification.status, 'unconfirmed');

const other = read(samples.other.state);
assert.equal(other.qualification.status, 'qualified');
assert.equal(other.player.name, '示例骑士');
assert.equal(other.player.id, 'player');
assert.equal(other.view.applicable, false);
assert.equal(other.qualification.representatives.length, 0);
assert.match(other.qualification.label, /武曲学园/);

const ikki = read(samples.ikki.state);
assert.equal(ikki.player.name, '黑铁一辉');
assert.equal(ikki.player.id, 'canon_01');
assert.equal(ikki.view.roster.filter(row => row.name === '黑铁一辉').length, 1);
assert.equal(ikki.view.roster.filter(row => row.source === '玩家').length, 1);

const losesSeat = structuredClone(samples.qualified.state);
losesSeat.场景.七星剑斗祭.资格名册.player.资格状态 = '未取得';
assert.equal(read(losesSeat).qualification.status, 'not-qualified');
losesSeat.场景.七星剑斗祭.资格名册.player.资格状态 = '已取消';
assert.equal(read(losesSeat).qualification.status, 'revoked');
assert.equal(read(losesSeat).qualification.representatives.some(row => row.player), false);
losesSeat.场景.七星剑斗祭.资格名册.player.资格状态 = '待确认';
assert.equal(read(losesSeat).qualification.status, 'unconfirmed');
const ongoing = structuredClone(samples.qualified.state);
ongoing.场景.选拔赛.状态 = '进行中';
assert.equal(read(ongoing).qualification.status, 'qualified');

const beforeRoster = structuredClone(samples.ikki.state);
beforeRoster.场景.七星剑斗祭 = { 资格名册: { player: { 姓名: '黑铁一辉', 学园: '破军学园', 资格状态: '已取得', 依据: '先保存资格，再加入选拔名册。' } } };
assert.equal(read(beforeRoster).player.id, 'canon_01');
assert.equal(read(beforeRoster).qualification.status, 'qualified');
assert.equal(read(beforeRoster).qualification.representatives.find(row => row.id === 'player').player, true);

const mismatch = structuredClone(samples.other.state);
mismatch.场景.七星剑斗祭.资格名册.player.姓名 = '别的玩家';
assert.equal(read(mismatch).qualification.status, 'unconfirmed');
mismatch.场景.七星剑斗祭.资格名册.player.姓名 = '示例骑士';
mismatch.场景.七星剑斗祭.资格名册.player.学园 = '破军学园';
assert.equal(read(mismatch).qualification.status, 'unconfirmed');
assert.equal(read(mismatch).qualification.representatives.some(row => row.player), false);

const sharedName = structuredClone(samples.other.state);
sharedName.场景.七星剑斗祭.资格名册.national_001 = structuredClone(sharedName.场景.七星剑斗祭.资格名册.player);
assert.equal(read(sharedName).qualification.status, 'unconfirmed', '无选拔 ID 时不猜同名同校的重复身份');

const independentRepresentative = structuredClone(samples.qualified.state);
independentRepresentative.场景.七星剑斗祭.资格名册.national_001 = { 姓名: '独立代表', 学园: '破軍學園', 资格状态: '已取得', 依据: '本局已确认。' };
assert.equal(read(independentRepresentative).qualification.representatives.find(row => row.id === 'national_001').name, '独立代表');

const original = JSON.stringify(samples);
const national = read(samples.national.state);
assert.equal(national.bracket.actual, true);
assert.equal(national.bracket.matches.length, 2, '只展示账本已登记的对局');
assert.equal(national.bracket.matches[0].people.length, 5);
assert.equal(national.bracket.matches[0].winner, 'player');
assert.equal(national.bracket.matches[1].winner, '', '排期不生成胜者');
assert.equal(national.bracket.players.player.player, true);
assert.equal(national.bracket.advancement.find(row => row.id === 'guest_1').decisionId, 'preview_advance');
read(samples.selection.state).stat.玩家.姓名 = '不能改原样本';
assert.equal(JSON.stringify(samples), original);

const browser = { window: {}, structuredClone };
vm.runInNewContext(await readFile(new URL('./mvu-model.js', import.meta.url), 'utf8'), browser);
for (const [key, sample] of Object.entries(samples)) {
  const result = browser.window.RK_PREVIEW_MVU.read(browser.window.RK_PREVIEW_MVU.samples[key].state);
  assert.equal(result.qualification.status, read(sample.state).qualification.status, key);
  assert.equal(result.player.id, read(sample.state).player.id, key);
}
const moduleSource = await readFile(new URL('./mvu-model.mjs', import.meta.url), 'utf8');
const embeddedSource = moduleSource.slice(moduleSource.indexOf('export function read('), moduleSource.indexOf('\nfunction sampleState(')).replace(/^export /, '');
const embedded = { structuredClone };
vm.runInNewContext(embeddedSource, embedded);
assert.equal(embedded.read({ state: samples.qualified.state }, deriveTournament(samples.qualified.state)).qualification.status, 'qualified');
console.log('MVU preview adapter: explicit qualification, incomplete ledger, no automatic promotion, other schools, revoked/pending, identity binding, classic and embedded readers passed.');
