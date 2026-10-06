// Execute the pinned upstream parser/update/schema bodies, with host/event doubles only.
// --fetch caches immutable upstream sources and actual Lodash/Klona/JSON5 libraries.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';
import { installRakudaiNativeMvu } from './rakudai-mvu-native.mjs';

const commit = '61010dab47bc3a08a1b626320bf7fc8c9573eca4';
const directory = new URL('../output/native-mvu-repair/', import.meta.url);
const sources = Object.fromEntries([
  ['variable-def', 'src/variable_def.ts'], ['schema', 'src/function/schema.ts'],
  ['util', 'src/util.ts'], ['common', 'util/common.ts'],
  ['update-variables', 'src/function/update_variables.ts'],
].map(([key, file]) => [key, `https://raw.githubusercontent.com/MagicalAstrogy/MagVarUpdate/${commit}/${file}`]));
Object.assign(sources, {
  lodash: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.js',
  klona: 'https://cdn.jsdelivr.net/npm/klona@2.0.6/full/index.js',
  json5: 'https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.js',
});
const file = key => new URL(`native-core-${key}.txt`, directory);
if (process.argv.includes('--fetch')) {
  fs.mkdirSync(directory, { recursive: true });
  await Promise.all(Object.entries(sources).map(async ([key, url]) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    fs.writeFileSync(file(key), await response.text());
  }));
}
const hashes = Object.fromEntries(Object.entries(sources).map(([key, url]) => {
  const content = fs.readFileSync(file(key), 'utf8');
  return [key, { url, sha256: createHash('sha256').update(content).digest('hex') }];
}));
const warnings = [], events = [], handlers = new Map();
const unavailable = label => () => { throw new Error(`Uncovered dependency branch: ${label}`); };
const context = vm.createContext({
  console: { info() {}, log() {}, error() {}, warn: message => warnings.push(message) },
  exports: {}, setTimeout, clearTimeout,
  SillyTavern: { saveChat() {}, chat: [] },
  useDataStore: () => ({ should_enable: true, settings: { 通知: { 变量更新出错: false } } }),
  substitudeMacros: value => value,
  tr: (key, values) => key + ':' + JSON.stringify(values || {}),
  YAML: { parse: unavailable('YAML'), parseDocument: unavailable('YAML document'), stringify: unavailable('YAML stringify') },
  math: new Proxy({}, { get: (_object, name) => unavailable(`math.${String(name)}`) }),
  jsonrepair: unavailable('JSON repair'), compare: unavailable('version comparison'),
  eventEmit: async (name, ...args) => {
    events.push(name);
    for (const handler of handlers.get(name) || []) await handler(...args);
  },
});
for (const key of ['lodash', 'klona', 'json5']) vm.runInContext(fs.readFileSync(file(key), 'utf8'), context, { filename: `native-core-${key}.js` });
function loadTypeScript(key) {
  const source = fs.readFileSync(file(key), 'utf8')
    .replace(/^import\b[\s\S]*?;\s*/gm, '')
    .replace(/^export\s+\{[^\n]*\}\s+from[^\n]*;?\s*$/gm, '');
  const code = stripTypeScriptTypes(source, { mode: 'transform' }).replace(/^export\s+/gm, '');
  vm.runInContext(code, context, { filename: `native-core-${key}.js` });
}
for (const key of ['variable-def', 'schema', 'util', 'common', 'update-variables']) loadTypeScript(key);
const clone = value => JSON.parse(JSON.stringify(value));
const sample = () => {
  const data = { stat_data: structuredClone(INITIAL_STATE), schema: '没有用别管这个',
    external: { retained: ['wrapper'] }, initialized_lorebooks: { retained: true } };
  data.stat_data.人际.旧同伴 = { 关系: '同伴', 好感: 19, 未知字段: { 保留: true } };
  data.stat_data.玩家.自定义数组 = ['甲', '乙'];
  return data;
};
const patch = operations => `<UpdateVariable><JSONPatch>${JSON.stringify(operations)}</JSONPatch></UpdateVariable>`;
const person = { 关系: '一年一班同级生', 态度印象: '初次交谈', 性别: '男性', 好感: 20,
  支援度: 10, 羁绊阶段: '未建立', 已知资料: { 身份: '破军学园一年级生', 灵装: '阴铁' } };
const checks = [];
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
await check('Actual upstream without N01 reproduces sentinel insert rejection', async () => {
  const data = sample(), before = clone(data.stat_data), start = warnings.length;
  const modified = await context.updateVariables(patch([{ op: 'add', path: '/人际/黑铁一辉', value: person }]), data);
  assert.equal(modified, false); assert.deepEqual(clone(data.stat_data), before);
  assert.ok(warnings.slice(start).some(value => value.includes('assignMissingParent')));
});
const lifecycle = new Map();
const W = {
  SillyTavern: { getContext: () => ({ characterId: 7, groupId: null }) },
  Mvu: { events: vm.runInContext('variable_events', context) }, waitGlobalInitialized: async () => {},
  eventOn: (name, callback) => {
    if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback);
    return { stop: () => handlers.get(name).delete(callback) };
  },
  addEventListener: (name, callback) => lifecycle.set(name, callback),
  removeEventListener: name => lifecycle.delete(name),
};
const installation = await installRakudaiNativeMvu(W);
assert.equal(installation.state, 'ready', installation.message);
await check('Actual upstream add inserts person and preserves all previous business data/wrappers', async () => {
  const data = sample(), expected = clone(data.stat_data), wrapper = data.external, reference = data.stat_data;
  expected.人际.黑铁一辉 = clone(person);
  assert.equal(await context.updateVariables(patch([{ op: 'add', path: '/人际/黑铁一辉', value: person }]), data), true);
  assert.deepEqual(clone(data.stat_data), expected); assert.equal(data.stat_data, reference);
  assert.equal(data.external, wrapper); assert.deepEqual(data.initialized_lorebooks, { retained: true });
  assert.equal(data.schema.properties.人际.extensible, true); assert.equal(data.schema.strictSet, true);
});
await check('Actual upstream same-patch nested map insertion works after a new person', async () => {
  const data = sample(), expected = clone(data.stat_data);
  expected.人际.黑铁一辉 = { ...clone(person), 已知资料: { ...person.已知资料, 已知能力: '本局确认的剑术' } };
  await context.updateVariables(patch([
    { op: 'add', path: '/人际/黑铁一辉', value: person },
    { op: 'add', path: '/人际/黑铁一辉/已知资料/已知能力', value: '本局确认的剑术' },
  ]), data);
  assert.deepEqual(clone(data.stat_data), expected);
});
await check('Actual upstream replace treats two-string array as an ordinary array', async () => {
  const data = sample(), expected = clone(data.stat_data);
  expected.玩家.自定义数组 = ['丙', '丁'];
  await context.updateVariables(patch([{ op: 'replace', path: '/玩家/自定义数组', value: ['丙', '丁'] }]), data);
  assert.deepEqual(clone(data.stat_data), expected);
});
await check('Actual upstream add to another empty nested map preserves existing state', async () => {
  const data = sample(), expected = clone(data.stat_data);
  const value = { 说明: '本局确认', 条件与代价: '已确认', 掌握状态: '待确认' };
  expected.玩家.其他能力.本局能力 = value;
  await context.updateVariables(patch([{ op: 'add', path: '/玩家/其他能力/本局能力', value }]), data);
  assert.deepEqual(clone(data.stat_data), expected);
});
await check('Actual upstream accepts snake and mixed-case JSONPatch tags with update_analysis', async () => {
  for (const tag of ['json_patch', 'JsOn_PaTcH', 'JSONPatch']) {
    const data = sample(), expected = clone(data.stat_data);
    expected.人际.黑铁一辉 = clone(person);
    const input = '<UpdateVariable><update_analysis>First greeting; confirmed profile.</update_analysis><' + tag + '>' +
      JSON.stringify([{ op: 'add', path: '/人际/黑铁一辉', value: person }]) + '</' + tag + '></UpdateVariable>';
    assert.equal(await context.updateVariables(input, data), true);
    assert.deepEqual(clone(data.stat_data), expected);
  }
});
await check('Actual upstream mismatched patch tags do not apply the embedded operation', async () => {
  const data = sample(), expected = clone(data.stat_data);
  const input = '<UpdateVariable><json_patch>' +
    JSON.stringify([{ op: 'add', path: '/人际/黑铁一辉', value: person }]) + '</JSONPatch></UpdateVariable>';
  assert.equal(await context.updateVariables(input, data), false);
  assert.deepEqual(clone(data.stat_data), expected);
});
installation.destroy();
const report = { evidence: 'Actual pinned upstream TypeScript bodies executed after type stripping; host/events doubled; no live Tavern writes.',
  commit, runtime: process.version,
  n01Sha256: createHash('sha256').update(fs.readFileSync(new URL('./rakudai-mvu-native.mjs', import.meta.url))).digest('hex'),
  hashes, checks, passed: checks.every(value => value.passed),
  events: [...new Set(events)], uncovered: ['invalid JSON/YAML/math fallback', 'host floor/swipe persistence', 'real iframe lifecycle', 'Zod bridge listeners'] };
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(new URL('native-core-report.json', directory), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, checks, report: fileURLToPath(new URL('native-core-report.json', directory)) }, null, 2));
if (!report.passed) process.exitCode = 1;
