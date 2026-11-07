import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const root = 'F:/SillyTavern-Launcher/SillyTavern';
const require = createRequire(import.meta.url);
const lodash = require(root + '/node_modules/lodash');
const distPath = root + '/public/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js';
const emitterPath = root + '/public/lib/eventemitter.js';
const dist = fs.readFileSync(distPath, 'utf8');
const emitter = fs.readFileSync(emitterPath, 'utf8');
const start = dist.indexOf('function mK(e,t,n,r)');
const end = dist.indexOf('async function wK(', start);
assert.ok(start > 0 && end > start, 'installed helper symbol slice must match inspected build');
const functions = dist.slice(start, end);
assert.ok(functions.includes('??5e3') && functions.includes('async function CK('));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture({ global = false, data = false } = {}) {
  const host = global ? { Mvu: {} } : {};
  const realm = vm.createContext({
    _: lodash, window: host, x: data ? [{ variables: [{ stat_data: {} }] }] : [{}],
    setTimeout, clearTimeout, Promise, console: { debug() {}, error() {}, trace() {} },
    localStorage: { getItem() { return null; } },
  });
  vm.runInContext(emitter.replace('export { EventEmitter }', ''), realm);
  vm.runInContext('var k = new EventEmitter();', realm);
  // Match the delegation to installed EventEmitter. Iframe cleanup wrappers are
  // outside this experiment; it does not simulate iframe disposal.
  realm.GU = function (name, listener) { realm.k.once(name, listener); };
  realm.KU = function (name, ...args) { return realm.k.emit(name, ...args); };
  vm.runInContext(functions, realm);
  return { host, realm, wait: target => realm.CK.call(target, 'Mvu'), publish: () => realm.bK('Mvu', {}) };
}

async function missingGlobal() {
  const f = fixture(), target = {};
  let resolved = false;
  const pending = f.wait(target).then(() => { resolved = true; });
  const started = performance.now();
  await sleep(6100);
  assert.equal(resolved, false);
  assert.equal(f.host.Mvu, undefined);
  const observation = { heldMs: Math.round(performance.now() - started), resolved, hostMvu: typeof f.host.Mvu, iframeMvu: typeof target.Mvu };
  f.realm.x[0].variables = [{ stat_data: {} }];
  f.publish();
  await pending;
  return { case: 'global-never-published', observation, resolvesAfterPublishing: resolved };
}

async function missingData() {
  const f = fixture({ global: true }), target = {};
  const started = performance.now();
  await f.wait(target);
  const elapsedMs = Math.round(performance.now() - started);
  assert.ok(elapsedMs >= 4900 && elapsedMs < 6500);
  assert.equal(typeof target.Mvu, 'object');
  return { case: 'global-present-data-absent', elapsedMs, result: 'resolved after swallowed 5-second data timeout' };
}

async function manyWaiters() {
  const f = fixture(), targets = Array.from({ length: 8 }, () => ({}));
  const started = performance.now();
  const waits = targets.map(t => f.wait(t));
  f.publish();
  await Promise.all(waits);
  const elapsedMs = Math.round(performance.now() - started);
  assert.ok(elapsedMs >= 4900 && elapsedMs < 6500);
  return { case: 'eight-global-event-waiters-no-data', elapsedMs, allResolved: true, serialFortySecondQueue: false };
}

async function externallyBlockedEvent() {
  const f = fixture({ data: true }), oldTarget = {}, newTarget = {};
  let release, oldResolved = false;
  const blocker = new Promise(resolve => { release = resolve; });
  f.realm.k.on('global_Mvu_initialized', () => blocker);
  const oldWait = f.wait(oldTarget).then(() => { oldResolved = true; });
  f.publish();
  await sleep(100);
  assert.equal(oldResolved, false);
  assert.equal(typeof f.host.Mvu, 'object');
  assert.equal(oldTarget.Mvu, undefined);
  await f.wait(newTarget);
  const observation = { hostMvu: typeof f.host.Mvu, oldIframeMvu: typeof oldTarget.Mvu, oldWaitResolved: oldResolved, newWaitResolved: true };
  release();
  await oldWait;
  return { case: 'synthetic-third-party-event-listener-block', observation, productionEvidence: false, resolvesAfterReleasingPrecedingListener: oldResolved };
}

const results = await Promise.all([missingGlobal(), missingData(), manyWaiters(), externallyBlockedEvent()]);
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const report = {
  generatedAt: new Date().toISOString(), mode: 'isolated VM using installed helper dist functions and actual ST event emitter',
  helperVersion: '4.12.0', distPath, distSha256: sha256(dist), emitterPath, emitterSha256: sha256(emitter),
  limitations: ['No player device logs', 'Iframe lifecycle wrappers not exercised', 'External blocked listener is intentionally synthetic, not observed in the card'],
  passed: true, results,
};
fs.writeFileSync(new URL('helper-wait-mechanism-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
