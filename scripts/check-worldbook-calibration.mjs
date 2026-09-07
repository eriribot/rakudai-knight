import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createSchema, INITIAL_STATE, migrateV2 } from '../世界书规则/MVU/schema.mjs';
import { applyOpening } from './rakudai-state-core.mjs';

// 离线检查只读取维护源与导出；唯一产物为验证结果.json，不写聊天或修补被测实现。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const deps = path.join(root, 'output/worldbook-calibration/dev/node_modules');
const { z } = require(path.join(deps, 'zod'));
const ejs = require(path.join(deps, 'ejs'));
const YAML = require(path.join(deps, 'yaml'));
const schema = createSchema(z);
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
function check(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
const valid = state => assert.equal(schema.safeParse(state).success, true);
const invalid = state => assert.equal(schema.safeParse(state).success, false);
const stateWith = mutate => { const state = clone(INITIAL_STATE); mutate(state); return state; };
const skill = (text = '实际确认的能力') => ({ 说明: text, 条件与代价: '需满足当前条件', 掌握状态: '已掌握' });
const relation = () => ({ 关系: '同学', 态度印象: '初识', 好感: null, 羁绊阶段: '未建立', 变化依据: '' });

check('schema/init-factory-valid', () => valid(INITIAL_STATE));
check('schema/init-yaml-equals-factory', () => assert.deepEqual(YAML.parse(read('世界书规则/MVU/[initvar]变量初始化.yaml')), INITIAL_STATE));
check('schema/multiple-skills-in-both-categories', () => valid(stateWith(s => {
  s.玩家.伐刀能力.招式 = { 火矢: skill(), 火幕: skill() };
  s.玩家.其他能力 = { 剑术: skill(), 包扎: skill() };
})));
for (const [name, mutate] of [
  ['unknown-root', s => { s.意外字段 = true; }],
  ['unknown-player', s => { s.玩家.MP = 10; }],
  ['unknown-skill-field', s => { s.玩家.其他能力.剑术 = { ...skill(), 消耗MP: 1 }; }],
  ['remove-fixed-root', s => { delete s.玩家; }],
  ['remove-fixed-nested', s => { delete s.玩家.伐刀能力.招式; }],
  ['volume-null', s => { s.场景.当前卷 = null; }],
  ['volume-two', s => { s.场景.当前卷 = 2; }],
  ['chapter-invalid-enum', s => { s.场景.当前章 = '第五章'; }],
  ['future-event', s => { s.场景.当前章 = '第一章'; s.场景.已发生事件.未来 = { 章段: '第四章', 结果: '已获胜', 参与者: [], 知情者: [] }; }],
  ['unbuilt-running', s => { s.场景.当前章 = '第一章'; s.场景.阶段 = '进行中'; }],
  ['unbuilt-ended', s => { s.场景.当前章 = '第一章'; s.场景.阶段 = '已结束'; }],
  ['unselected-chapter-running', s => { s.场景.阶段 = '进行中'; }],
  ['ikki-duplicate-npc', s => { s.系统.主角模式 = '黑铁一辉'; s.人际.黑铁一辉 = relation(); }],
  ['bond-without-evidence', s => { s.人际.史黛菈 = { ...relation(), 羁绊阶段: 'C' }; }],
]) check(`schema/reject-${name}`, () => invalid(stateWith(mutate)));
for (const name of ['__proto__', 'constructor', 'prototype', '甲/乙', '甲~乙']) {
  check(`schema/reject-dynamic-key-${name}`, () => invalid(stateWith(s => {
    s.玩家.其他能力 = JSON.parse(JSON.stringify({ [name]: skill() }));
  })));
}
for (const chapter of ['序章', '第一章', '第二章', '第三章', '第四章', '终章']) {
  check(`schema/accept-chapter-${chapter}`, () => valid(stateWith(s => { s.场景.当前章 = chapter; })));
}
check('schema/sequential-build-player-mode-status', () => {
  const s = clone(INITIAL_STATE);
  s.玩家.姓名 = '测试玩家'; valid(s);
  s.系统.主角模式 = '自定义角色'; valid(s);
  s.系统.开局状态 = '已建档'; valid(s);
  s.场景.当前章 = '第一章'; valid(s);
  s.场景.阶段 = '进行中'; valid(s);
});
check('schema/sequential-bond-evidence-before-stage', () => {
  const s = clone(INITIAL_STATE); s.人际.史黛菈 = relation(); valid(s);
  s.人际.史黛菈.变化依据 = '本局共同训练后已确认同道关系'; valid(s);
  s.人际.史黛菈.羁绊阶段 = 'C'; valid(s);
});

function oldState() {
  const s = clone(INITIAL_STATE); s.系统 = { 结构版本: 2, 开局状态: '已建档', 主角模式: '自定义角色' };
  s.场景 = { 当前卷: 1, 时间: '春假早晨', 地点: '宿舍' };
  Object.assign(s.玩家, { 姓名: '旧档玩家', 角色简介: '必须保留的过去', 伐刀绝技: '甲、乙', 能力系别: '自然干涉系', 能力机制: '旧能力原文', 限制与代价: '旧限制原文' });
  delete s.玩家.伐刀能力; delete s.玩家.其他能力;
  s.人际.史黛菈 = { 关系: '同学', 态度印象: '旧态度', 好感: 25, 羁绊阶段: '切磋同道' };
  return s;
}
check('migration/v2-preserves-filled-data-and-source', () => {
  const old = oldState(), before = clone(old), next = migrateV2(old, z);
  assert.deepEqual(old, before); assert.equal(next.玩家.姓名, '旧档玩家');
  assert.equal(next.玩家.角色简介, old.玩家.角色简介);
  assert.equal(next.场景.时间, '春假早晨'); assert.equal(next.场景.地点, '宿舍');
  assert.equal(next.玩家.伐刀能力.能力本质, '旧能力原文');
  assert.equal(next.玩家.伐刀能力.共通限制, '旧限制原文');
  assert.deepEqual(Object.keys(next.玩家.伐刀能力.招式), ['甲、乙']);
  assert.equal(next.人际.史黛菈.好感, 25); assert.equal(next.人际.史黛菈.态度印象, '旧态度');
  assert.match(next.人际.史黛菈.变化依据, /切磋同道/);
});
check('migration/v3-idempotent', () => { const once = migrateV2(oldState(), z); assert.deepEqual(migrateV2(once, z), once); });
check('migration/reject-unknown-field', () => { const old = oldState(); old.玩家.未知字段 = '不可静默吞掉'; assert.throws(() => migrateV2(old, z)); });
check('migration/reject-unknown-version', () => assert.throws(() => migrateV2({ 系统: { 结构版本: 1 } }, z)));

const html = read('第一卷-世界书整理/开局页面/index.html');
const context = vm.createContext({});
check('page/extract-and-load-actual-functions', () => {
  const tag = '<script id="opening-rating-engine">';
  const start = html.indexOf(tag) + tag.length;
  assert(start >= tag.length);
  const blocks = [
    html.slice(start, html.indexOf('// opening-rating-engine:end')),
    html.slice(html.indexOf('var START_PROFILES ='), html.indexOf('var activeStartProfile =')),
    html.match(/var CANON_GREETING = [^\n]+/)[0],
    html.match(/var CHARACTER_SCOPE_PROMPT = [^\n]+/)[0],
    html.slice(html.indexOf('var ARCHIVE_FORMAT ='), html.indexOf('function initializeRatingControls()')),
    html.slice(html.indexOf('function buildOpeningMessage('), html.indexOf('function archiveFeedback(')),
    html.slice(html.indexOf('function validateArchive('), html.indexOf('function showOpeningPreview(')),
  ];
  vm.runInContext(blocks.join('\n'), context, { timeout: 2000 });
  assert.equal(typeof context.buildOpeningVariables, 'function');
  assert.deepEqual(Object.keys(context.SCENE_FIELDS), ['当前章', '时间', '地点', '切入说明']);
  assert.deepEqual(Object.keys(context.CONTEXT_FIELDS), ['当前身体', '当前能力边界', '本局映射']);
});
function draft() {
  const p = Object.fromEntries(Object.keys(context.OPENING_FIELDS).map(key => [key, key]));
  p.stats = Object.fromEntries(Array.from(context.RATING_AXES).map(key => [key, 'C']));
  p.name = '测试玩家'; p.category = '自然干涉系';
  p.nobleArt = '火矢｜小火弹｜须瞄准\n火幕｜阻隔视线｜持续耗魔';
  p.otherAbilities = '基础剑术｜训练所得｜近身';
  return {
    format: context.ARCHIVE_FORMAT, schema_version: 5, profile_key: 'user', profile: p, avatar: null, greeting: '开场白原文',
    scene: { 当前章: '第一章', 时间: '春假早晨', 地点: '破军学园·宿舍走廊', 切入说明: '从走廊开始。' },
    context: { 当前身体: '本局已确认身体状态', 当前能力边界: '只采用已填写能力', 本局映射: '无额外映射' },
  };
}
for (const [mode, expected] of [['user', '自定义角色'], ['kurogane', '黑铁一辉']]) {
  check(`page/${mode}-draft-payload-to-controller-confirmed-state`, () => {
    const d = draft(); d.profile_key = mode;
    const vars = clone(context.buildOpeningVariables(context.validateArchive(d)));
    const before = clone(INITIAL_STATE), payloadBefore = clone(vars);
    assert.equal(vars.系统.主角模式, expected); assert.equal(vars.系统.开局状态, '待建档');
    assert.deepEqual(Object.keys(vars).sort(), ['场景', '玩家', '系统']);
    const confirmed = applyOpening(before, vars);
    valid(confirmed); assert.equal(confirmed.系统.开局状态, '已建档');
    assert.equal(confirmed.场景.阶段, '进行中');
    for (const key of Object.keys(context.SCENE_FIELDS)) assert.equal(confirmed.场景[key], d.scene[key]);
    assert.deepEqual(before, INITIAL_STATE); assert.deepEqual(vars, payloadBefore);
    assert.equal(vars.玩家.登记等级, mode === 'kurogane' ? 'F' : null);
    assert(!Object.hasOwn(vars.玩家, '伐刀绝技'));
    if (mode === 'kurogane') assert(Object.hasOwn(vars.玩家.其他能力, '模仿剑术'));
    else assert.equal(Object.keys(vars.玩家.伐刀能力.招式).length, 2);
  });
}
for (const version of [2, 3, 4]) check(`page/archive-v${version}-to-v5-preserves-input`, () => {
  const d = draft(); d.schema_version = version; d.profile.nobleArt = '甲、乙';
  if (version < 4) delete d.profile.otherAbilities;
  delete d.scene; delete d.context;
  if (version === 2) for (const key of ['ability', 'limits', 'style', 'category']) delete d.profile[key];
  const before = clone(d), next = clone(context.validateArchive(d));
  assert.deepEqual(d, before); assert.equal(next.schema_version, 5);
  assert.equal(next.profile.name, d.profile.name); assert.equal(next.profile.nobleArt, '甲、乙');
  assert.equal(next.profile.otherAbilities, version < 4 ? '' : d.profile.otherAbilities); assert.equal(next.greeting, d.greeting);
  assert.deepEqual(next.scene, { 当前章: '待选择', 时间: '', 地点: '', 切入说明: '' });
  assert.deepEqual(next.context, { 当前身体: '', 当前能力边界: '', 本局映射: '' });
  assert.deepEqual(Object.keys(context.parseAbilityLines(next.profile.nobleArt, '招式')), ['甲、乙']);
});
check('page/empty-ability-lists-remain-draft-until-controller-confirmation', () => {
  const d = draft(); d.profile.nobleArt = ''; d.profile.otherAbilities = '';
  const vars = clone(context.buildOpeningVariables(context.validateArchive(d)));
  assert.equal(vars.系统.开局状态, '待建档'); assert.deepEqual(vars.玩家.伐刀能力.招式, {});
  assert.deepEqual(vars.玩家.其他能力, {});
  const confirmed = applyOpening(clone(INITIAL_STATE), vars);
  valid(confirmed); assert.equal(confirmed.系统.开局状态, '已建档');
});
check('page/multiline-fullwidth-and-ascii-separators', () => {
  const entries = clone(context.parseAbilityLines('甲｜说明甲｜代价甲\r\n乙|说明乙|代价乙', '招式'));
  assert.deepEqual(Object.keys(entries), ['甲', '乙']); assert.equal(entries.乙.条件与代价, '代价乙');
});
for (const bad of ['｜说明｜代价', '甲｜说明', '甲｜说明｜代价｜多余', '甲\n甲', '__proto__', 'prototype', 'constructor', '甲/乙', '甲~乙']) {
  check(`page/reject-ability-${bad.replaceAll('\n', '\\n')}`, () => assert.throws(() => context.parseAbilityLines(bad, '能力')));
}
check('page/rating-top-three-core-values-unchanged', () => {
  const p = draft().profile;
  assert.equal(context.calculateOpeningRating(p.stats).score, 4);
  assert.equal(context.calculateOpeningRating(p.stats).base, 'C');
  Object.assign(p.stats, { attack: 'A', defense: 'B', magic: 'F', control: 'C', physical: 'F', luck: 'F' });
  assert.equal(context.calculateOpeningRating(p.stats).score, 5);
  const rating = clone(context.calculateOpeningRating(p.stats)); p.stats.physical = 'A'; p.stats.luck = 'A';
  assert.deepEqual(clone(context.calculateOpeningRating(p.stats)), rating);
  assert.equal(context.ratingGradeValue('B+'), 5.5);
});
check('page/import-ignores-cached-rating', () => {
  const d = draft(); d.profile.rating = { score: 6, base: 'A' }; d.profile.rank = 'A';
  const next = context.validateArchive(d); assert.equal(next.profile.rating.base, 'C');
  assert.equal(context.buildOpeningVariables(next).玩家.登记等级, null);
});
check('page/draft-does-not-initialize-and-confirmed-request-continues-story', () => {
  const d = context.validateArchive(draft());
  const text = context.buildOpeningMessage(d);
  assert.match(text, /档案草稿，尚未写入聊天/);
  assert.match(text, /不要仅凭此草稿初始化变量或推进第一幕/);
  assert.match(text, /开场白原文/); assert(text.includes(context.CHARACTER_SCOPE_PROMPT));
  const confirmed = applyOpening(clone(INITIAL_STATE), clone(context.buildOpeningVariables(d)));
  const request = context.buildOpeningMessage(d, confirmed);
  assert.match(request, /代码已将本次档案写入 MVU 并成功回读/);
  assert.match(request, /不要求模型重新初始化、重算综合初评或覆盖登记等级/);
  assert.match(request, /有玩家开场白时从其末尾接续/);
  assert.match(request, /开场白原文/); assert(request.includes(context.CHARACTER_SCOPE_PROMPT));
  for (const value of Object.values(d.scene)) assert(request.includes(value));
  for (const value of Object.values(d.context)) assert(request.includes(value));
  assert(!/<JSONPatch>|【已确认的开局变量】/.test(request));
});

function body(relative) {
  const text = read(relative); const marker = text.indexOf('## 世界书词条正文');
  const open = text.indexOf('```xml', marker), start = text.indexOf('\n', open) + 1, end = text.indexOf('```', start);
  assert(open >= 0 && start > open && end > start); return text.slice(start, end).trim();
}
const exportPath = '世界书规则/v0.3/导出/落第骑士英雄谭.json';
let entries;
check('export/valid-json-and-entry-map', () => { entries = JSON.parse(read(exportPath)).entries; assert(entries && typeof entries === 'object'); });
for (const [uid, name] of [[9, '黑铁一辉'], [11, '史黛菈·法米利昂'], [12, '新宫寺黑乃']]) {
  check(`export/source-body-uid-${uid}`, () => assert.equal(entries[String(uid)].content.trim().replaceAll('\r\n', '\n'), body(`第一卷-世界书整理/人物条目/${name}.md`).replaceAll('\r\n', '\n')));
}
check('export/init-yaml-synchronized', () => assert.deepEqual(YAML.parse(entries['3'].content), INITIAL_STATE));
check('export/update-rules-synchronized', () => assert.equal(entries['10'].content.trim().replaceAll('\r\n', '\n'), read('世界书规则/MVU/变量更新规则.txt').trim().replaceAll('\r\n', '\n')));
check('export/preserve-existing-metadata-and-unrelated-entries', () => {
  const original = JSON.parse(read('output/worldbook-calibration/落第骑士英雄谭-修改前.json'));
  const updatedIds = new Set([0, 3, 9, 10, 11, 12, 13, 15]);
  for (const [id, old] of Object.entries(original.entries)) {
    if (!updatedIds.has(Number(id))) assert.deepEqual(entries[id], old);
    else { const previous = { ...old }, current = { ...entries[id] }; delete previous.content; delete current.content; assert.deepEqual(current, previous); }
  }
});
check('component/generated-schema-and-guard-register-and-preserve-protected-fields', () => {
  const script = JSON.parse(read('世界书规则/MVU/落第骑士-MVU-v3字段约束.json'));
  assert.equal(script.type, 'script'); assert.equal(script.enabled, true);
  assert(script.id && script.name && script.content); assert.deepEqual(script.button.buttons, []);
  const compiled = new vm.Script(script.content);
  const ready = [], listeners = [], cleanup = [];
  const surface = { SillyTavern: { getContext() { return {}; } }, addEventListener(name, callback) { cleanup.push({ name, callback }); } };
  const scriptContext = vm.createContext({
    z, structuredClone, console: { info() {}, warn() {}, error() {} }, window: surface,
    $: callback => ready.push(callback), Mvu: { events: { VARIABLE_UPDATE_ENDED: 'test_update_ended' } },
    eventOn: (name, callback) => { listeners.push({ name, callback }); return { stop() {} }; },
  });
  compiled.runInContext(scriptContext, { timeout: 2000 });
  assert.equal(ready.length, 1);
  assert.equal(typeof scriptContext.createSchema, 'function');
  const bundledSchema = scriptContext.createSchema(z);
  assert.deepEqual(clone(bundledSchema.parse(clone(INITIAL_STATE))), INITIAL_STATE);
  assert.equal(bundledSchema.safeParse({ ...clone(INITIAL_STATE), 未知业务: true }).success, false);
  scriptContext.installRakudaiMvuGuard(bundledSchema);
  const ended = listeners.find(listener => listener.name === 'test_update_ended');
  assert(ended, '生成脚本的守护必须实际订阅更新结束事件');
  const previous = { stat_data: clone(INITIAL_STATE) };
  const changed = { stat_data: applyOpening(clone(INITIAL_STATE), clone(context.buildOpeningVariables(context.validateArchive(draft())))) };
  changed.stat_data.$internal = { display_data: {}, delta_data: {} };
  ended.callback(changed, previous);
  for (const key of ['系统', '场景', '玩家', '人际']) assert.deepEqual(clone(changed.stat_data[key]), previous.stat_data[key]);
  assert.deepEqual(changed.stat_data.$internal, { display_data: {}, delta_data: {} });
  assert(cleanup.some(item => item.name === 'pagehide'));
});
for (const origin of ['source', 'export']) {
  for (const [label, locals, ikki] of [
    ['ikki', { stat_data: { 系统: { 主角模式: '黑铁一辉' } } }, true],
    ['custom', { stat_data: { 系统: { 主角模式: '自定义角色' } } }, false],
    ['unselected', { stat_data: { 系统: { 主角模式: '未选择' } } }, false],
    ['missing', {}, false],
  ]) check(`ejs/${origin}-${label}`, () => {
    const text = origin === 'source' ? body('第一卷-世界书整理/人物条目/黑铁一辉.md') : entries['9'].content;
    const rendered = ejs.render(text, locals);
    assert(!rendered.includes('<%'));
    assert.equal(rendered.includes('【当前身份路由：玩家即为黑铁一辉】'), ikki);
    assert.equal(rendered.includes('【当前身份路由：自定义角色模式（一辉为独立 NPC）】'), !ikki);
    if (!ikki) assert.match(rendered, /只处理建档确认，不生成一辉 NPC，也不开始剧情/);
  });
}
const failed = results.filter(result => !result.passed);
const report = {
  createdAt: new Date().toISOString(), scope: '离线 schema、页面纯函数、原文到导出同步与 EJS 模板渲染；不代表真实酒馆验收',
  dependencies: { zod: require(path.join(deps, 'zod/package.json')).version, ejs: require(path.join(deps, 'ejs/package.json')).version, yaml: require(path.join(deps, 'yaml/package.json')).version },
  total: results.length, passed: results.length - failed.length, failed: failed.length, results,
};
const output = path.join(root, 'output/worldbook-calibration/验证结果.json');
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`${report.passed}/${report.total} passed; ${report.failed} failed`);
for (const failure of failed) console.error(`${failure.name}: ${failure.error}`);
console.log(path.relative(root, output));
if (failed.length) process.exitCode = 1;
