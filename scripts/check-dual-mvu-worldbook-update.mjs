import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildDualMvuWorldbookUpdate, createDualWorldbookPlan, installDualMvuWorldbookUpdater } from './build-dual-mvu-worldbook-update.mjs';
import { resolveMvuWorld } from './rakudai-mvu-structure.mjs';

const require = createRequire(import.meta.url), ejs = require('../output/worldbook-calibration/dev/node_modules/ejs');
const { artifact, payload, sourceHashes } = buildDualMvuWorldbookUpdate(), copy = structuredClone;
const checks = [];
async function check(name, run) { try { await run(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.stack }); } }
await check('packaged templates preserve second-volume keys and independent EJS scopes', () => {
  for (const key of ['update', 'format']) {
    assert.ok(payload.templates[key].includes('第二卷·第一章'));
    assert.ok(!payload.templates[key].includes('学战目前只有第一卷'));
  }
  for (const key of ['list', 'update', 'format']) {
    assert.ok(payload.templates[key].startsWith('<% { /* MVU_ENTRY_SCOPE */ %>'));
  }
});
const names = ['[MVU]变量列表', '[MVU]变量更新规则', '[MVU]变量更新格式', '[initvar]变量初始化', '世界设定', '魔力', '能力与招式', '伐刀者', '觉醒', '魔人', '能力系别'];
function bookFixture() {
  const entries = Object.fromEntries(Array.from({ length: 205 }, (_, index) => {
    const uid = index * 3 + 79, name = names[index] || '用户条目' + index;
    return [String(uid), { uid, comment: name, content: name + '私有原文\r\n<% if (getvar("stat_data.场景.路线") === "B") { %>第十卷私有日本B<% } else { %>第十卷私有欧洲A<% } %>',
      disable: index === 3, constant: index < 8, selective: false, useProbability: false, probability: 63, order: 100 + index,
      displayIndex: 500 + index, key: ['词' + index], keysecondary: [], position: 4, depth: 7, role: 0,
      extra: { user: { keep: true } }, unknownMetadata: { nested: ['保留', index] } }];
  }));
  return { entries, name: '现用205条夹具', extensions: { custom: true }, unknownRoot: ['保留'] };
}
const applyPlan = (book, plan) => { const next = copy(book); for (const change of plan.changes) next.entries[change.key].content = change.content; return next; };
const state = world => ({ 系统: { 结构版本: 4, 开局状态: '已建档', 作品: world, 主角模式: '自定义角色' }, 场景: { 当前卷: world === 'asterisk' ? null : 10, 当前章: '第二章', 路线: 'B' }, 玩家: {}, 人际: {} });
const render = (content, current, options = {}) => ejs.render(content, { getvar: path => path.split('.').reduce((value, key) => value?.[key], { stat_data: current }) }, options);
const renderModes = [{}, { strict: true, _with: false, destructuredLocals: ['getvar'] }];
function fixture() {
  let data = bookFixture(), current = { characterId: 7, groupId: null, chatId: 'one', chat: [] }, binding = '现用世界书', saves = 0, reads = 0;
  const alerts = [], downloads = [], handlers = new Map(), urls = new Map(), after = [], context = {
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    saveWorldInfo: async (name, next, immediate) => { assert.equal(name, binding); assert.equal(immediate, true); saves++; if (!f.dropSave) data = copy(next); },
    reloadWorldInfoEditor: name => after.push(name),
  };
  const host = { SillyTavern: { getContext: () => ({ ...context, ...current }) },
    fetch: async (url, options) => { reads++; assert.equal(url, '/api/worldinfo/get'); assert.equal(options.cache, 'no-store'); assert.equal(JSON.parse(options.body).name, binding); if (f.onRead) await f.onRead(); return { ok: !f.httpFailure, status: f.httpFailure ? 500 : 200, json: async () => copy(data) }; } };
  const W = { parent: host, getCharWorldbookNames: () => ({ primary: binding }), getButtonEvent: name => name,
    eventOn: (name, fn) => { handlers.set(name, fn); return { stop: () => handlers.delete(name) }; },
    addEventListener() {}, removeEventListener() {}, alert: message => alerts.push(message), Blob,
    URL: { createObjectURL: blob => { const id = 'blob:' + urls.size; urls.set(id, blob); return id; }, revokeObjectURL() {} }, setTimeout() {},
    document: { body: { append() {} }, createElement: () => ({ href: '', download: '', click() { downloads.push({ blob: urls.get(this.href), name: this.download }); }, remove() {} }) },
  };
  const f = { W, alerts, downloads, after, handlers, get data() { return data; }, get saves() { return saves; }, get reads() { return reads; },
    switchChat: () => { current = { ...current, chatId: 'two', chat: [] }; }, switchBook: () => { binding = '别的世界书'; },
    click: index => handlers.get(payload.buttons[index])() };
  f.marker = installDualMvuWorldbookUpdater(W, payload);
  return f;
}

await check('205-entry raw book updates only eleven target contents and preserves every metadata field', () => {
  const before = bookFixture(), original = copy(before), plan = createDualWorldbookPlan(before, payload), next = applyPlan(before, plan);
  assert.equal(plan.changes.length, 11); assert.deepEqual(before, original);
  for (const [key, entry] of Object.entries(before.entries)) {
    const { content: _a, ...a } = entry, { content: _b, ...b } = next.entries[key]; assert.deepEqual(b, a);
    if (!names.includes(entry.comment)) assert.deepEqual(next.entries[key], entry);
  }
  assert.deepEqual(next.unknownRoot, before.unknownRoot); assert.deepEqual(next.extensions, before.extensions);
  assert.equal(next.entries['88'].disable, true);
});
await check('MVU contents equal the maintained templates; lore keeps original EJS and one shared declaration', () => {
  const book = bookFixture(), plan = createDualWorldbookPlan(book, payload);
  const templates = { '[MVU]变量列表': payload.templates.list, '[MVU]变量更新规则': payload.templates.update, '[MVU]变量更新格式': payload.templates.format };
  for (const change of plan.changes.filter(change => change.comment.startsWith('[MVU]'))) {
    const template = templates[change.comment];
    assert.equal(change.content, template);
    assert.equal(change.content.split(template).length - 1, 1);
    const legacy = state('rakudai'); delete legacy.系统.作品;
    for (const current of [state('rakudai'), state('asterisk'), legacy]) assert.equal(render(change.content, current), render(template, current));
  }
  for (const change of plan.changes.filter(change => !change.comment.startsWith('['))) {
    assert.ok(change.content.includes(change.before.content));
    assert.ok(!change.content.includes('【以下资料的适用范围】'));
    for (const world of ['rakudai', 'asterisk']) {
      const current = state(world), text = render(change.content, current);
      assert.equal(text.includes('第十卷私有日本B'), change.comment !== '世界设定' || world === 'rakudai');
      if (change.comment !== '世界设定') assert.equal(text.trim(), render(change.before.content, current).trim());
    }
    assert.equal(change.content.includes('【同一世界与两座舞台】'), change.comment === '世界设定');
  }
  assert.equal(plan.changes.reduce((count, row) => count + row.content.split('【同一世界与两座舞台】').length - 1, 0), 1);
});
await check('fusion worldview renders shared history and exactly one main-stage branch without mutating state', () => {
  const plan = createDualWorldbookPlan(bookFixture(), payload);
  const worldContent = plan.changes.find(change => change.comment === '世界设定').content;
  const legacy = state('rakudai'); delete legacy.系统.作品;
  const brokenLegacy = copy(legacy); delete brokenLegacy.人际;
  const cases = [
    [state('rakudai'), 'rakudai'], [state('asterisk'), 'asterisk'], [legacy, 'rakudai'],
    [brokenLegacy, null], [undefined, null], [null, null], [{ 系统: [] }, null],
    ...[null, 'unknown', ''].map(world => [state(world), null]),
    [{ ...state('asterisk'), 系统: { 结构版本: 4, 开局状态: '待建档', 作品: 'asterisk' } }, null],
    [{ ...state('rakudai'), 系统: { 结构版本: 3, 开局状态: '已建档', 作品: 'rakudai' } }, null],
  ];
  for (const options of renderModes) for (const [current, expected] of cases) {
    const before = copy(current), text = render(worldContent, current, options);
    for (const token of ['卡尔·爱兰兹', '希朵林', '日光', '封岛', '返乡名额', '原世界', '星辰力与魔力不换算、不互供', '知情边界']) assert.ok(text.includes(token), token);
    assert.equal(text.includes('【本局主线：落第骑士】'), expected === 'rakudai');
    assert.equal(text.includes('【本局主线：学战都市】'), expected === 'asterisk');
    assert.equal(text.includes('【主线尚未确认】'), expected === null);
    assert.equal(text.includes('世界设定私有原文'), expected === 'rakudai');
    assert.equal(text.includes('【六花的社会与学园制度】'), expected === 'asterisk');
    assert.ok(!text.includes('<%') && !text.includes('RK_AW_ORIGINAL_SLOT'));
    assert.deepEqual(current, before);
  }
});
await check('hybrid abilities keep mechanism entries and concatenated EJS scopes independent of main-stage choice', () => {
  const plan = createDualWorldbookPlan(bookFixture(), payload);
  const content = plan.changes.filter(row => row.comment !== '[initvar]变量初始化').map(row => row.content).join('\n');
  for (const options of renderModes) for (const world of ['rakudai', 'asterisk']) {
    const current = state(world);
    current.玩家 = { 伐刀能力: {}, 六维: {}, 学战: { 武装: { 名称: '测试煌武' } } };
    const text = render(content, current, options);
    for (const name of ['魔力', '能力与招式', '伐刀者', '觉醒', '魔人', '能力系别']) assert.ok(text.includes(name + '私有原文'));
    assert.ok(text.includes('测试煌武'));
    assert.ok(!text.includes('当前档案尚缺完整能力或六维'));
  }
});
await check('worldview template slot must be unique and original dollar sequences remain literal', () => {
  for (const world of [undefined, payload.templates.world.replace('@@RK_AW_ORIGINAL_SLOT@@', ''), payload.templates.world + '@@RK_AW_ORIGINAL_SLOT@@']) {
    assert.throws(() => createDualWorldbookPlan(bookFixture(), { ...payload, templates: { ...payload.templates, world } }), /模板缺失或原文插槽不唯一/);
  }
  const book = bookFixture(), entry = Object.values(book.entries).find(row => row.comment === '世界设定');
  entry.content += '\n用户原文 $& $1 $$';
  const plan = createDualWorldbookPlan(book, payload), next = applyPlan(book, plan);
  assert.ok(next.entries[String(entry.uid)].content.includes(entry.content));
  assert.equal(createDualWorldbookPlan(next, payload).changes.length, 0);
});
await check('old wrappers upgrade to single templates; repeated updates are idempotent and malformed wrappers reject', () => {
  const wrapped = bookFixture();
  for (const entry of Object.values(wrapped.entries).filter(row => names.includes(row.comment) && row.comment !== '[initvar]变量初始化')) {
    const prefix = entry.comment === '伐刀者' ? '用户手改过的公共前言' : '旧共用说明';
    entry.content = '<% /* RK_AW_WORLDBOOK_V1 */ %>\n' + prefix + '\n<% if (getvar("stat_data.系统.作品") === "rakudai") { %>\n<% /* RK_AW_ORIGINAL_BEGIN */ %>\n' + entry.content + '\n<% /* RK_AW_ORIGINAL_END */ %>\n<% } else { %>旧学战正文<% } %>';
  }
  const upgraded = applyPlan(wrapped, createDualWorldbookPlan(wrapped, payload));
  const book = bookFixture(), next = applyPlan(book, createDualWorldbookPlan(book, payload));
  assert.deepEqual(upgraded, next);
  assert.equal(createDualWorldbookPlan(next, payload).changes.length, 0);
  for (const mutation of [text => text.replace('RK_AW_WORLDBOOK_V1', 'RK_AW_WORLDBOOK_V99'), text => text.replace('RK_AW_ORIGINAL_END', 'missing-end')]) {
    const malformed = copy(wrapped); malformed.entries['79'].content = mutation(malformed.entries['79'].content);
    assert.throws(() => createDualWorldbookPlan(malformed, payload), /无法识别/);
  }
});
await check('missing or ambiguous comments fail; format alias selection never assumes UIDs', () => {
  const book = bookFixture(); delete book.entries['79']; assert.throws(() => createDualWorldbookPlan(book, payload), /必须唯一/);
  const duplicate = bookFixture(); duplicate.entries['999'] = { ...copy(duplicate.entries['79']), uid: 999 };
  assert.throws(() => createDualWorldbookPlan(duplicate, payload), /必须唯一/);
  const old = bookFixture(); old.entries['999'] = { ...copy(old.entries['85']), uid: 999, comment: '[MVU]变量输出格式', disable: true };
  assert.equal(createDualWorldbookPlan(old, payload).changes.filter(row => /格式/.test(row.comment))[0].uid, 85);
  old.entries['999'].disable = false; assert.throws(() => createDualWorldbookPlan(old, payload), /无法唯一定位/);
});
await check('style replaces only the overbroad numeric ban and preserves examples and metadata', () => {
  const book = bookFixture();
  const old = '严禁正文出现任何数值、好感度、评级或设定集系统术语（如“S级羁绊”、“六维”、“判定”等）。';
  const replacement = '正文不播报后台数值、好感度、羁绊阶段或变量术语；人物可以自然谈及已知的骑士等级、校内排名、时间与距离。';
  const before = { ...copy(book.entries['679']), uid: 900, comment: '文风', content: '用户开头\n' + old + '\n用户例文与结尾' };
  book.entries['900'] = before;
  const next = applyPlan(book, createDualWorldbookPlan(book, payload));
  assert.deepEqual(next.entries['900'], { ...before, content: '用户开头\n' + replacement + '\n用户例文与结尾' });
  assert.equal(createDualWorldbookPlan(next, payload).changes.length, 0);
  book.entries['900'].content = '用户自定义文风，没有那条旧禁令';
  assert.ok(!createDualWorldbookPlan(book, payload).changes.some(change => change.uid === 900));
});
await check('offline apply shares the plan, preserves inactive format and writes nothing on invalid input', () => {
  const sourceUrl = new URL('./apply-dual-mvu-to-card.mjs', import.meta.url);
  const source = fs.readFileSync(sourceUrl, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', 'sourceUrl');
  const file = path.resolve('virtual-worldbook.json'), backup = file.replace(/\.json$/, '.before-dual-mvu.json');
  const before = bookFixture(); before.entries['999'] = { ...copy(before.entries['85']), uid: 999, comment: '[MVU]变量输出格式', disable: true };
  function run(book) {
    const files = new Map([[file, JSON.stringify(book)]]), writes = [];
    const fakeFs = { readFileSync: name => files.has(name) ? files.get(name) : fs.readFileSync(name, 'utf8'),
      existsSync: name => files.has(name), mkdirSync() {}, writeFileSync: (name, text) => { writes.push(name); files.set(name, text); } };
    const execute = () => vm.runInNewContext(source, { fs: fakeFs, path, fileURLToPath, sourceUrl, createDualWorldbookPlan, resolveMvuWorld, structuredClone,
      process: { argv: ['node', fileURLToPath(sourceUrl), file] }, console: { log() {} } });
    return { files, writes, execute };
  }
  const good = run(before); good.execute();
  assert.equal(good.files.get(backup), JSON.stringify(before));
  assert.deepEqual(JSON.parse(good.files.get(file)), applyPlan(before, createDualWorldbookPlan(before, payload)));
  const written = good.writes.filter(name => name === file).length; good.execute();
  assert.equal(good.writes.filter(name => name === file).length, written);
  const invalid = copy(before); invalid.entries['999'].disable = false;
  const bad = run(invalid); assert.throws(bad.execute, /无法唯一定位/); assert.equal(bad.writes.length, 0);
});
await check('import only registers buttons, preview downloads the complete raw book, explicit apply verifies server', async () => {
  const f = fixture(), before = copy(f.data); assert.equal(f.reads, 0); assert.equal(f.saves, 0); assert.equal(f.handlers.size, 2);
  await f.click(0); assert.equal(f.saves, 0); assert.equal(f.downloads.length, 1);
  assert.deepEqual(JSON.parse(await f.downloads[0].blob.text()), before);
  await f.click(1); assert.equal(f.saves, 1); assert.ok(f.alerts.at(-1).includes('已核对服务器保存')); assert.equal(f.after.length, 1);
  await f.click(0); await f.click(1); assert.equal(f.saves, 1); assert.ok(f.alerts.at(-1).includes('无需写入'));
  f.marker.destroy(); assert.equal(f.handlers.size, 0);
});
await check('apply without preview, ambiguous preview and target changes cannot write', async () => {
  const f = fixture(); await f.click(1); assert.equal(f.saves, 0); assert.match(f.alerts.at(-1), /先点击/);
  await f.click(0); f.data.entries['79'].content += '并发编辑'; await f.click(1); assert.equal(f.saves, 0); assert.match(f.alerts.at(-1), /预览后被修改/);
  const duplicate = fixture(); duplicate.data.entries['999'] = { ...copy(duplicate.data.entries['79']), uid: 999 };
  await duplicate.click(0); await duplicate.click(1); assert.equal(duplicate.saves, 0); assert.equal(duplicate.downloads.length, 0);
});
await check('chat and primary switches before apply or during reads stop all writes', async () => {
  for (const change of ['switchChat', 'switchBook']) {
    const f = fixture(); await f.click(0); f[change](); await f.click(1); assert.equal(f.saves, 0); assert.match(f.alerts.at(-1), /已变化/);
  }
  const f = fixture(); await f.click(0); f.onRead = () => f.switchChat(); await f.click(1); assert.equal(f.saves, 0); assert.match(f.alerts.at(-1), /已变化/);
});
await check('unrelated edits after preview survive and newly ambiguous target comments reject', async () => {
  const f = fixture(); await f.click(0); f.data.entries['679'].content = '用户刚编辑的人物正文'; await f.click(1);
  assert.equal(f.saves, 1); assert.equal(f.data.entries['679'].content, '用户刚编辑的人物正文');
  const g = fixture(); await g.click(0); g.data.entries['999'] = { ...copy(g.data.entries['79']), uid: 999 };
  await g.click(1); assert.equal(g.saves, 0); assert.match(g.alerts.at(-1), /必须唯一/);
});
await check('HTTP failures and saves that never persist are not reported as successful', async () => {
  const f = fixture(); f.httpFailure = true; await f.click(0); assert.equal(f.saves, 0); assert.match(f.alerts.at(-1), /HTTP 500/);
  const g = fixture(); await g.click(0); g.dropSave = true; await g.click(1); assert.match(g.alerts.at(-1), /服务器回读与提交内容不一致/); assert.equal(g.after.length, 0);
});
await check('artifact is a compilable helper component with two visible explicit buttons and no auto task', () => {
  new vm.Script(artifact.content); assert.equal(artifact.type, 'script'); assert.equal(artifact.button.enabled, true);
  assert.deepEqual(artifact.button.buttons.map(button => button.name), payload.buttons); assert.equal(artifact.export_with.button, true);
  assert.ok(!artifact.content.includes('setChatMessages')); assert.ok(!artifact.content.includes('replaceMvuData'));
});
await check('generated artifact executes its real serialized functions without hidden build dependencies', async () => {
  const f = fixture(); f.marker.destroy();
  vm.runInNewContext(artifact.content, { window: f.W, structuredClone });
  assert.equal(f.reads, 0); assert.equal(f.saves, 0); assert.equal(f.handlers.size, 2);
  await f.click(0); await f.click(1); assert.equal(f.saves, 1); assert.match(f.alerts.at(-1), /已核对服务器保存/);
});

const report = { component: artifact.name, mode: 'component', liveImported: false, liveVerified: false,
  artifactSha256: createHash('sha256').update(JSON.stringify(artifact, null, 2) + '\n').digest('hex'),
  apiEvidence: { tavernHelper: { version: '4.12.0', commit: '5cbd089f1217d00e1f6851f50bf451223860a9c2' },
    sillyTavern: { version: '1.19.0', commit: '7e8663cd9c184a550b37238218bdd32c6efc68e9' },
    sources: ['https://github.com/N0VI028/JS-Slash-Runner/blob/5cbd089f1217d00e1f6851f50bf451223860a9c2/src/function/worldbook.ts',
      'https://github.com/N0VI028/JS-Slash-Runner/blob/5cbd089f1217d00e1f6851f50bf451223860a9c2/@types/iframe/script.d.ts',
      'https://github.com/SillyTavern/SillyTavern/blob/7e8663cd9c184a550b37238218bdd32c6efc68e9/public/scripts/st-context.js',
      'https://github.com/SillyTavern/SillyTavern/blob/7e8663cd9c184a550b37238218bdd32c6efc68e9/public/scripts/world-info.js'] },
  sourceHashes, passed: checks.every(check => check.passed), total: checks.length, checks,
  limits: ['Host APIs are doubled offline; real iframe buttons/download/import remain unverified.', 'The raw save API has no server-side CAS; avoid concurrent worldbook editing during the write.', 'A/B behavior is tested with a representative private-content fixture, not a new live export.'] };
if (process.argv.includes('--write')) {
  const output = new URL('../output/asterisk-opening/dual-worldbook-update-validation.json', import.meta.url);
  fs.mkdirSync(new URL('./', output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
