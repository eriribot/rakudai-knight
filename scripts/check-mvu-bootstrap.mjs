// Offline startup/lifecycle regression checks; no network, real host, or saved variables are touched.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('./rakudai-mvu-bootstrap.js', import.meta.url), 'utf8');
const key = '__RK_MVU_GUARD_BOOT_V4__';
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function fixture({ zod = true, helper = true, waitMvu = () => Promise.resolve(), install, schema } = {}) {
  let now = 0, nextTimer = 0;
  const timers = new Map(), lifecycle = [], calls = { register: 0, install: 0, loads: [] }, errors = [];
  const parent = {}, top = {}, window = { parent, top, addEventListener: (name, callback) => lifecycle.push([name, callback]) };
  const realm = vm.createContext({ window, Date: { now: () => now },
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { at: now + ms, callback }); return id; },
    clearTimeout: id => timers.delete(id),
    console: { info() {}, error: (...args) => errors.push(args) },
    createSchema: schema || (() => ({})),
    installRakudaiMvuGuard: () => {
      calls.install++;
      if (install) return install(window);
      window.__RK_MVU_GUARD_V4__ = { parseRepair() {} };
    },
  });
  const setZod = () => { realm.z = { preprocess() {}, toJSONSchema() {} }; };
  const setHelper = () => { realm.waitGlobalInitialized = waitMvu; };
  if (zod) setZod();
  if (helper) setHelper();
  vm.runInContext(source, realm, { filename: 'rakudai-mvu-bootstrap.js' });
  const bridge = { registerMvuSchema() { calls.register++; } };
  const start = (loader = async () => bridge) => realm.bootRakudaiMvuGuard(url => { calls.loads.push(url); return loader(url); });
  async function advance(ms) {
    await flush();
    const target = now + ms;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
    }
    now = target; await flush();
  }
  const unload = () => lifecycle.filter(([name]) => name === 'pagehide').forEach(([, callback]) => callback());
  return { window, parent, top, calls, errors, realm, bridge, start, advance, unload, setZod, setHelper, timers, get now() { return now; } };
}

test('publishes loading immediately and ready only after real guard installation', async () => {
  const f = fixture(), loading = deferred(), run = f.start(() => loading.promise);
  const boot = f.window[key];
  assert.equal(boot.state, 'loading'); assert.equal(f.parent[key], boot); assert.equal(f.top[key], boot);
  await flush(); assert.equal(boot.stage, 'bridge'); assert.equal(boot.guard, undefined);
  loading.resolve(f.bridge); await run;
  assert.equal(boot.state, 'ready'); assert.equal(boot.guard, f.window.__RK_MVU_GUARD_V4__);
  assert.deepEqual([f.calls.register, f.calls.install, f.calls.loads.length, f.timers.size], [1, 1, 1, 0]);
});

test('waits for delayed helper, Zod 4 and MVU without treating enabled scripts as failed', async () => {
  const mvu = deferred(), f = fixture({ zod: false, helper: false, waitMvu: () => mvu.promise });
  const run = f.start(); await f.advance(1000);
  assert.equal(f.window[key].stage, 'dependencies');
  f.setZod(); f.setHelper(); await f.advance(100);
  assert.equal(f.window[key].stage, 'mvu'); assert.equal(f.calls.loads.length, 0);
  mvu.resolve(); await run; assert.equal(f.window[key].state, 'ready');
});

test('primary rejection falls back to the same commit and registers exactly once', async () => {
  const f = fixture();
  await f.start(url => url.includes('testingcf.') ? Promise.reject(new Error('private network details')) : Promise.resolve(f.bridge));
  assert.equal(f.window[key].state, 'ready'); assert.equal(f.calls.loads.length, 2);
  assert.equal(new URL(f.calls.loads[0]).pathname, new URL(f.calls.loads[1]).pathname);
  assert.deepEqual([f.calls.register, f.calls.install], [1, 1]);
});

test('hung primary times out; its late result never registers after fallback success', async () => {
  const primary = deferred(), f = fixture();
  const run = f.start(url => url.includes('testingcf.') ? primary.promise : Promise.resolve(f.bridge));
  await f.advance(15000); await run; assert.equal(f.window[key].state, 'ready');
  primary.resolve(f.bridge); await flush();
  assert.deepEqual([f.calls.register, f.calls.install], [1, 1]);
});

test('both entry failures report safe bridge diagnostics and preserve no ready guard', async () => {
  const f = fixture(); await f.start(() => Promise.reject(new Error('secret-address-or-token')));
  const boot = f.window[key];
  assert.equal(boot.state, 'failed'); assert.equal(boot.stage, 'bridge');
  assert.match(boot.message, /主备入口均加载失败/); assert.equal(boot.message.includes('secret-address-or-token'), false);
  assert.equal(boot.guard, undefined); assert.equal(f.calls.install, 0);
});

test('both hanging imports have bounded waits and late completion cannot restore ready', async () => {
  const pending = deferred(), f = fixture(), run = f.start(() => pending.promise);
  await f.advance(30000); await run;
  assert.equal(f.window[key].state, 'failed'); assert.match(f.window[key].message, /桥接加载超时/);
  pending.resolve(f.bridge); await flush(); assert.equal(f.calls.register, 0); assert.equal(f.timers.size, 0);
});

test('slow dependencies, slow MVU and two hanging bridge attempts finish inside 60 seconds', async () => {
  const mvu = deferred(), f = fixture({ zod: false, waitMvu: () => mvu.promise });
  const run = f.start(() => new Promise(() => {}));
  await f.advance(14800); f.setZod(); await f.advance(100);
  assert.equal(f.window[key].stage, 'mvu');
  await f.advance(14900); mvu.resolve(); await flush();
  await f.advance(30000); await run;
  assert.equal(f.window[key].state, 'failed'); assert.ok(f.now <= 60000); assert.equal(f.timers.size, 0);
});

test('missing Zod and MVU have separate finite diagnostics', async () => {
  const z = fixture({ zod: false }), zRun = z.start(); await z.advance(15000); await zRun;
  assert.equal(z.window[key].stage, 'dependencies'); assert.match(z.window[key].message, /Zod 4/); assert.equal(z.timers.size, 0);
  const m = fixture({ waitMvu: () => new Promise(() => {}) }), mRun = m.start(); await m.advance(15000); await mRun;
  assert.equal(m.window[key].stage, 'mvu'); assert.match(m.window[key].message, /等待 MVU 超时/); assert.equal(m.timers.size, 0);
});

test('unload removes only its own boot status and late imports do not install or fall back', async () => {
  const pending = deferred(), f = fixture(), run = f.start(() => pending.promise);
  await flush(); const replacement = { state: 'loading' }; f.top[key] = replacement;
  f.unload(); await run;
  assert.equal(f.window[key], undefined); assert.equal(f.parent[key], undefined); assert.equal(f.top[key], replacement);
  pending.resolve(f.bridge); await flush();
  assert.deepEqual([f.calls.register, f.calls.install, f.calls.loads.length, f.timers.size], [0, 0, 1, 0]);
});

test('unload during dependencies or MVU stops timers and never starts a bridge import', async () => {
  const dependency = fixture({ zod: false }), dependencyRun = dependency.start();
  dependency.unload(); await dependencyRun; dependency.setZod(); await dependency.advance(60000);
  assert.equal(dependency.calls.loads.length, 0); assert.equal(dependency.timers.size, 0);
  const pending = deferred(), mvu = fixture({ waitMvu: () => pending.promise }), mvuRun = mvu.start();
  await flush(); mvu.unload(); await mvuRun; pending.resolve(); await flush();
  assert.equal(mvu.calls.loads.length, 0); assert.equal(mvu.timers.size, 0);
});

test('unload between bridge scheduling and its microtask prevents the remote import', async () => {
  const pending = deferred(), f = fixture({ waitMvu: () => pending.promise }), run = f.start();
  await flush(); pending.resolve();
  // Run just the MVU settlement/continuation; the loader is queued after this observer.
  for (let i = 0; i < 12 && f.window[key]?.stage !== 'bridge'; i++) await Promise.resolve();
  assert.equal(f.window[key].stage, 'bridge'); f.unload(); await run;
  assert.equal(f.calls.loads.length, 0); assert.equal(f.calls.register, 0);
});

test('superseded boot cannot register over another instance', async () => {
  const pending = deferred(), f = fixture(), run = f.start(() => pending.promise); await flush();
  const replacement = { state: 'loading' }; f.parent[key] = replacement;
  pending.resolve(f.bridge); await run;
  assert.equal(f.parent[key], replacement); assert.equal(f.calls.register, 0); assert.equal(f.calls.install, 0);
});

test('schema or guard registration failures cannot publish ready or reuse an old marker', async () => {
  const badSchema = fixture({ schema: () => { throw new Error('raw schema details'); } }); await badSchema.start();
  assert.equal(badSchema.window[key].state, 'failed'); assert.match(badSchema.window[key].message, /字段约束注册失败/);
  const f = fixture({ install() {} }), old = { parseRepair() {} }; f.window.__RK_MVU_GUARD_V4__ = old;
  await f.start(); assert.equal(f.window[key].state, 'failed'); assert.equal(f.window[key].guard, undefined);
  assert.equal(f.window.__RK_MVU_GUARD_V4__, old);
});
