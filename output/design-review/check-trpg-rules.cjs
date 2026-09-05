'use strict';
// v0.2 方案算例检查：只验证纸面算术与边界，不是酒馆规则引擎测试。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function calculate(power, delta, environment = 1, guard = 0, barrier = 0) {
  for (const n of [power, delta, environment, guard, barrier]) {
    assert.ok(Number.isFinite(n), 'Input must be finite');
  }
  assert.ok(Number.isInteger(delta), 'Score modifiers are integers');
  assert.ok(power >= 0 && guard >= 0 && barrier >= 0);
  const q = delta <= -6 ? 0 : delta < 0 ? 0.5 : delta < 6 ? 1 : 1.25;
  const env = Math.max(0.75, Math.min(1.25, environment));
  const contact = Math.floor(power * q * env);
  const afterGuard = Math.max(0, contact - guard);
  const absorbed = Math.min(afterGuard, barrier);
  return {contact, absorbed, damage: afterGuard - absorbed, barrierLeft: barrier - absorbed};
}

const examples = [
  {input: [24, 0, 1, 0, 18], expected: {contact: 24, absorbed: 18, damage: 6, barrierLeft: 0}},
  {input: [24, -2, 1, 0, 18], expected: {contact: 12, absorbed: 12, damage: 0, barrierLeft: 6}},
  {input: [24, 6, 1, 8, 10], expected: {contact: 30, absorbed: 10, damage: 12, barrierLeft: 0}}
];
for (const example of examples) assert.deepEqual(calculate(...example.input), example.expected);

const thresholds = [-6, -5, -1, 0, 5, 6].map(delta => calculate(24, delta).contact);
assert.deepEqual(thresholds, [0, 12, 12, 24, 24, 30]);
assert.equal(calculate(24, 0, 100).damage, 30);
assert.equal(calculate(24, 0, -100).damage, 18);
assert.throws(() => calculate(NaN, 0));
assert.throws(() => calculate(24, Infinity));
assert.throws(() => calculate(24, 0.5));
assert.throws(() => calculate(24, 0, 1, -1));

let conservationCases = 0;
for (const delta of [-10, -2, 0, 6, 10]) {
  let previousDamage = Infinity;
  for (let barrier = 0; barrier <= 40; barrier++) {
    const result = calculate(24, delta, 1, 8, barrier);
    assert.equal(result.damage + result.absorbed, Math.max(0, result.contact - 8));
    assert.equal(result.absorbed + result.barrierLeft, barrier);
    assert.ok(result.damage <= previousDamage);
    previousDamage = result.damage;
    conservationCases++;
  }
}

// 复现原稿：固定季度处理会令关系阈值永远不可达。
let lastMonth = 0, skill = 0, support = 'C';
for (let month = 3; month <= 24; month += 3) {
  const gap = month - lastMonth;
  if (gap < 3) continue;
  if (skill < 4) skill++;
  if (support === 'C' && gap >= 6) support = 'B';
  else if (support === 'B' && gap >= 12) support = 'A';
  lastMonth = month;
}
assert.equal(skill, 4);
assert.equal(support, 'C');

const oldEfficiencyRatio = (150 / 6) / (15 / 25);
assert.ok(Math.abs(oldEfficiencyRatio - 41.6666666667) < 1e-9);
const newCostAtMax = Math.ceil(25 * 0.8);
assert.equal(newCostAtMax, 20);
assert.equal(25 / newCostAtMax, 1.25);

// 一整个同步交换的资源账：双方斩击 + 招架。
const exchangeDamage = calculate(24, 0, 1, 8).damage;
const physicalExchange = {hp: 100 - exchangeDamage, sp: 100 - 8 - 6 + 4};
const fantasiaExchange = {hp: 100, sp: 100 - 8 - 6 - exchangeDamage + 4};
assert.deepEqual(physicalExchange, {hp: 84, sp: 90});
assert.deepEqual(fantasiaExchange, {hp: 100, sp: 74});
assert.equal(2 + 1, 3);

const report = {
  scope: 'Paper-design arithmetic only; no SillyTavern runtime or balance validation',
  examples: examples.map(e => ({input: e.input, result: calculate(...e.input)})),
  scoreBoundaryContacts: thresholds,
  barrierConservationCases: conservationCases,
  originalQuarterlyCounterexample: {afterMonths: 24, skill, support},
  oldDamagePerMpRatio: oldEfficiencyRatio,
  newEfficiencyOnlyUpperRatio: 1.25,
  simultaneousExchange: {physicalExchange, fantasiaExchange},
  result: 'PASS'
};
fs.writeFileSync(path.join(__dirname, '数值检查结果.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
