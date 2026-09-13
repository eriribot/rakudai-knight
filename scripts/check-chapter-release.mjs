// Local packaging audit. Reads source/artifacts and writes only release-check.json; never contacts SillyTavern.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { STORY_VOLUMES } from './rakudai-story-catalog.mjs';
import { INITIAL_STATE, createSchema, migrateV3 } from '../世界书规则/MVU/schema.mjs';
import { buildTerminal } from './黑白ADV轮盘终端/bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const { z } = require('zod'), YAML = require('yaml');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const clone = structuredClone;
const plain = value => JSON.parse(JSON.stringify(value));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const files = {
  auditor: 'scripts/check-chapter-release.mjs',
  releaseBuilder: 'scripts/build-chapter-release.mjs',
  original: 'output/chapter-v4/runtime-original-card.json',
  originalWorldbook: 'output/chapter-v4/runtime-original-worldbook.json',
  release: 'output/chapter-v4/落第骑士英雄谭-v1.3.6.json',
  releaseWorldbook: 'output/chapter-v4/落第骑士英雄谭-v1.3.6-世界书.json',
  fixture: 'output/chapter-v4/验收副本-v1.3.6.json',
  fixtureProbeSource: 'scripts/chapter-runtime-probe.js',
  worldbook: '世界书规则/v0.3/导出/落第骑士英雄谭.json',
  guard: '世界书规则/MVU/落第骑士-MVU-v4字段约束.json',
  terminal: 'scripts/酒馆助手脚本-小手机-黑白ADV轮盘版-v1.3.6.json',
  injector: 'scripts/tavern_helper_ejs_injector.json',
  controller: 'scripts/rakudai-state-controller.js',
  opening: '第一卷-世界书整理/开局页面/index.html',
  prechange: 'output/chapter-v4/prechange.zip',
};
const sourceFiles = [
  'scripts/build-state-controller.mjs', 'scripts/sync-worldbook-calibration.mjs', 'scripts/build-plot-injector.mjs',
  'scripts/rakudai-story-catalog.mjs', 'scripts/story-build.mjs', 'scripts/story/volumes-01-09.json', 'scripts/story/volumes-10-19.json', 'scripts/story/scene-materials.json',
  '世界书规则/MVU/schema.mjs', 'scripts/rakudai-state-core.mjs', 'scripts/rakudai-state-browser.js', 'scripts/rakudai-mvu-guard.js',
  'scripts/rakudai-plot-runtime.js', 'scripts/rakudai-plot-bootstrap.js',
  '世界书规则/MVU/变量更新规则.txt', '世界书规则/MVU/[initvar]变量初始化.yaml',
  '第一卷-世界书整理/人物条目/黑铁一辉.md', '第一卷-世界书整理/人物条目/史黛菈·法米利昂.md', '第一卷-世界书整理/人物条目/新宫寺黑乃.md',
  '世界书规则/v0.3/10_序章场景.md', '世界书规则/v0.3/09_第一章场景.md', '世界书规则/v0.3/07_能力与招式.md', '世界书规则/v0.3/06_第一卷文风.md',
  ...['bundle.mjs', 'main.js', 'state-reader.js', 'layout.js', 'wheel.js', 'state-panel.js', 'styles.css', 'terminal-app.html', 'terminal-app.js', 'terminal-controls.js', 'terminal-app.css', 'terminal-theme.css', 'terminal-status.css', 'package.json', 'package-lock.json'].map(file => 'scripts/黑白ADV轮盘终端/' + file),
];
for (const file of sourceFiles) files['source:' + file] = file;
const inputHashes = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, sha256(fs.readFileSync(path.join(root, file)))]));
const original = json(files.original), release = json(files.release), fixture = json(files.fixture);
const originalWorldbook = json(files.originalWorldbook), releaseWorldbook = json(files.releaseWorldbook);
const worldbook = json(files.worldbook), guard = json(files.guard), terminal = json(files.terminal), injector = json(files.injector);
const results = [], evidence = {};
function check(name, run) {
  try { const details = run(); results.push({ name, passed: true, ...(details ? { details } : {}) }); }
  catch (error) { results.push({ name, passed: false, error: String(error.message).slice(0, 3000) }); }
}
function unique(items, predicate, message) {
  const matches = items.filter(predicate); assert.equal(matches.length, 1, message); return matches[0];
}
const scripts = card => card.data.extensions.tavern_helper.scripts;
const entries = card => card.data.character_book.entries;
const entry = (card, id) => unique(entries(card), item => item.id === id, '世界书 UID 必须唯一：' + id);
const replacements = [
  ['落第骑士·动态EJS与1~19卷剧情注入综合器 v2.0.0', injector],
  ['落第骑士·黑白ADV轮盘终端 v1.3.5', terminal],
  ['落第骑士·MVU v3 字段与第一卷约束', guard],
];
const sourceEntryIds = [3, 10, 13, 15], entryFields = ['content', 'enabled', 'keys', 'secondary_keys'];
const namingPaths = [['name'], ['data', 'name'], ['data', 'character_version'], ['data', 'character_book', 'name'], ['data', 'extensions', 'world'], ['fav'], ['data', 'extensions', 'fav']];
function at(object, parts) { return parts.reduce((value, key) => value[key], object); }
function assignAt(object, parts, value) { at(object, parts.slice(0, -1))[parts.at(-1)] = clone(value); }
function brief(value) {
  if (typeof value === 'string' && value.length > 180) return { characters: value.length, sha256: sha256(value) };
  return value === undefined ? { absent: true } : value;
}
function differences(before, after, pointer = '') {
  if (Object.is(before, after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => differences(before[key], after[key], pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1')));
  }
  return [{ path: pointer, before: brief(before), after: brief(after) }];
}

check('原卡结构与允许的名称、版本、收藏变更', () => {
  const name = '落第骑士英雄谭 v1.3.6';
  for (const parts of namingPaths) assert.equal(at(release, parts), parts.at(-1) === 'fav' ? false : parts.at(-1) === 'character_version' ? '1.3.6' : name);
  assert.deepEqual(scripts(release).map(item => item.id), scripts(original).map(item => item.id), '脚本数量、顺序和运行时 ID 必须保留');
  assert.deepEqual(entries(release).map(item => item.id), entries(original).map(item => item.id), '世界书条目数量、顺序和 ID 必须保留');
});
check('仅三个指定脚本替换，组件内容一致且保留原运行时 ID', () => {
  for (const [oldName, source] of replacements) {
    const old = unique(scripts(original), item => item.name === oldName, oldName);
    const current = unique(scripts(release), item => item.id === old.id, old.id);
    assert.deepEqual(current, { ...old, ...source, id: old.id });
    assert.equal(scripts(release).filter(item => item.name === source.name).length, 1);
  }
  return replacements.map(([oldName, source]) => ({ from: oldName, to: source.name, id: scripts(original).find(item => item.name === oldName).id }));
});
check('只同步约定世界书字段，开局正则对应完整源页面', () => {
  for (const id of sourceEntryIds) {
    const current = entry(release, id), source = worldbook.entries[id];
    assert.equal(current.content, source.content, 'UID ' + id + ' 正文不同步');
    assert.equal(current.enabled, !source.disable);
    assert.deepEqual(current.keys, source.key);
    assert.deepEqual(current.secondary_keys, source.keysecondary);
  }
  const current = unique(release.data.extensions.regex_scripts, item => item.scriptName === '[开局]', '开局正则');
  assert.equal(current.replaceString, '```\n' + read(files.opening).trim() + '\n```');
});
check('UID 9 仅替换真实 EJS 读取条件，人物正文逐字保留', () => {
  const oldCondition = "<% if ((typeof stat_data !== 'undefined' && stat_data?.系统?.主角模式 === '黑铁一辉') || (typeof locals !== 'undefined' && locals?.stat_data?.系统?.主角模式 === '黑铁一辉')) { %>";
  const condition = "<% if (getvar('stat_data.系统.主角模式') === '黑铁一辉') { %>";
  const old = entry(original, 9).content;
  assert.equal(old.split(oldCondition).length, 2, '预期旧条件必须恰好出现一次');
  assert.deepEqual(entry(release, 9), { ...entry(original, 9), content: old.replace(oldCondition, condition) });
  evidence.protectedCharacterOverride = {
    uid: 9, oldCondition, condition,
    policy: '保留实机原卡 UID 9 的所有人物正文与条目配置，仅精确替换唯一 EJS 条件；作者目录中已存在的另一版正文不回填到发布卡。',
    originalContentSha256: sha256(old), releaseContentSha256: sha256(entry(release, 9).content),
    authoringContentSha256: sha256(worldbook.entries[9].content),
    authoringSourceDiffersFromRelease: worldbook.entries[9].content !== entry(release, 9).content,
  };
  return evidence.protectedCharacterOverride;
});
check('白名单之外的全部原卡字段严格保留', () => {
  const restored = clone(release);
  for (const parts of namingPaths) assignAt(restored, parts, at(original, parts));
  for (const [oldName] of replacements) {
    const index = scripts(original).findIndex(item => item.name === oldName);
    scripts(restored)[index] = clone(scripts(original)[index]);
  }
  for (const id of sourceEntryIds) for (const field of entryFields) {
    if (Object.hasOwn(entry(original, id), field)) entry(restored, id)[field] = clone(entry(original, id)[field]);
    else delete entry(restored, id)[field];
  }
  entry(restored, 9).content = entry(original, 9).content;
  const index = original.data.extensions.regex_scripts.findIndex(item => item.scriptName === '[开局]');
  restored.data.extensions.regex_scripts[index].replaceString = original.data.extensions.regex_scripts[index].replaceString;
  const unexpected = differences(original, restored);
  assert.deepEqual(unexpected, [], '出现未批准的原卡字段变化');
  return { preserved: ['角色文本与问候', '非指定人物及世界书条目', '媒体与其他扩展字段', '其他正则全部字段', '其他脚本全部字段'] };
});
check('发布世界书与保护后的正式卡一致，实机导出元数据完整保留', () => {
  assert.deepEqual(Object.keys(originalWorldbook.entries).map(Number).sort((a, b) => a - b), entries(original).map(item => item.id).sort((a, b) => a - b));
  const expected = clone(originalWorldbook);
  for (const cardEntry of entries(release)) {
    const old = originalWorldbook.entries[cardEntry.id], target = expected.entries[cardEntry.id];
    assert.equal(old.content, entry(original, cardEntry.id).content, '原世界书与原卡正文不一致：UID ' + cardEntry.id);
    Object.assign(target, { content: cardEntry.content, disable: !cardEntry.enabled, key: cardEntry.keys, keysecondary: cardEntry.secondary_keys });
  }
  assert.deepEqual(releaseWorldbook, expected, '发布世界书出现内容漂移、丢失元数据或额外条目');
  const changes = differences(originalWorldbook, releaseWorldbook);
  for (const item of changes) assert.match(item.path, /^\/entries\/(?:3|9|10|13|15)\/(?:content|disable|key|keysecondary)(?:\/|$)/, '发布世界书变更超出边界：' + item.path);
  evidence.releaseWorldbook = { original: files.originalWorldbook, release: files.releaseWorldbook, entries: entries(release).length, changes };
  return evidence.releaseWorldbook;
});
check('MVU 远程脚本逐字段保留，替换脚本未增加远程地址', () => {
  assert.deepEqual(unique(scripts(release), item => item.name === 'MVU', 'MVU'), unique(scripts(original), item => item.name === 'MVU', '原 MVU'));
  const urls = source => [...new Set(source.match(/https?:\/\/[^\s"'`<>\\)]+/g) || [])].sort();
  const dependencies = [];
  for (const [oldName, source] of replacements) {
    const old = scripts(original).find(item => item.name === oldName);
    assert.deepEqual(urls(source.content), urls(old.content), source.name + ' 远程地址变化');
    dependencies.push({ name: source.name, urls: urls(source.content) });
  }
  return { mvu: urls(scripts(release).find(item => item.name === 'MVU').content), dependencies };
});

function schemaExports(source) {
  const context = { $() {}, structuredClone };
  new vm.Script(source + '\nglobalThis.audit = { RELATIONSHIP_SCORING, supportStage, romanceStage, enforceRelationshipScores, INITIAL_STATE };').runInNewContext(context, { timeout: 3000 });
  return context.audit;
}
check('人物关系配置与三项计分/派生函数保持原卡版本', () => {
  const before = schemaExports(scripts(original).find(item => item.name.includes('MVU v3')).content);
  const after = schemaExports(guard.content);
  assert.deepEqual(plain(after.RELATIONSHIP_SCORING), plain(before.RELATIONSHIP_SCORING));
  for (const name of ['supportStage', 'romanceStage', 'enforceRelationshipScores']) assert.equal(after[name].toString().replace(/\r\n/g, '\n'), before[name].toString().replace(/\r\n/g, '\n'), name);
  return { version: after.RELATIONSHIP_SCORING.version, functions: ['supportStage', 'romanceStage', 'enforceRelationshipScores'] };
});
check('初始字段差异仅版本和任务前已有的男性基线，并记录归档证据', () => {
  const before = YAML.parse(entry(original, 3).content), after = YAML.parse(entry(release, 3).content);
  assert.deepEqual(after, INITIAL_STATE);
  const expected = clone(before); expected.系统.结构版本 = 4; expected.玩家.性别 = '男性';
  assert.deepEqual(after, expected);
  const python = `import sys,json,zipfile,hashlib
z=zipfile.ZipFile(sys.argv[1])
names=[n for n in z.namelist() if n.endswith('/MVU/schema.mjs') or ('/MVU/[initvar]' in n and n.endswith('.yaml'))]
out=[]
for name in names:
 raw=z.read(name); text=raw.decode('utf-8-sig')
 lines=[{'line':i+1,'text':s.strip()} for i,s in enumerate(text.splitlines()) if "性别: '男性'" in s or "性别: z.literal('男性')" in s or '性别: 男性' in s]
 out.append({'entry':name,'sha256':hashlib.sha256(raw).hexdigest(),'evidence':lines})
print(json.dumps(out,ensure_ascii=True))`;
  const result = spawnSync('python', ['-c', python, path.join(root, files.prechange)], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const archive = JSON.parse(result.stdout); assert.equal(archive.length, 2);
  assert.ok(archive.every(item => item.evidence.length > 0), '任务前归档须已包含男性基线');
  evidence.initialStateDrift = { differences: differences(before, after), explanation: '原实机卡缺省 玩家.性别；任务前源码与初始化已固定男性。完整卡同步既有源码基线，旧档迁移不补该字段。', archive: files.prechange, members: archive };
  return evidence.initialStateDrift;
});
check('合法 v3 迁移保留缺省性别与未重算的人物历史', () => {
  const before = YAML.parse(entry(original, 3).content);
  before.系统.开局状态 = '已建档'; before.系统.主角模式 = '自定义角色'; before.玩家.姓名 = '迁移审查';
  before.场景.当前章 = '终章'; before.场景.阶段 = '已结束';
  before.场景.已发生事件.原有记录 = { 章段: '序章', 结果: '原有事实', 参与者: [], 知情者: [] };
  before.人际.原有角色 = { 性别: '女性', 关系: '协作', 态度印象: '可信', 好感: 502, 支援度: 181, 羁绊阶段: 'C', 变化依据: '原有记录' };
  const after = migrateV3(before, z), expected = clone(before);
  expected.系统.结构版本 = 4; expected.场景.已发生事件.原有记录.卷号 = 1;
  assert.deepEqual(after, expected);
  assert.deepEqual(differences(before, after).map(item => item.path), ['/系统/结构版本', '/场景/已发生事件/原有记录/卷号']);
});

const catalogueShape = volumes => volumes.map(book => ({ volume: book.volume, title: book.title, chapters: book.chapters.map(chapter => ({ key: chapter.key, title: chapter.title, aliases: chapter.aliases || [] })) }));
function embeddedCatalogue(source) {
  const matches = [...source.matchAll(/^\s*const STORY_VOLUMES = (\[[^\n]+\]);$/gm)];
  assert.equal(matches.length, 1, '内联目录必须恰好一份');
  return JSON.parse(matches[0][1]);
}
check('19 卷 100 节点在约束、控制器、终端、开局和注入器一致', () => {
  const expected = catalogueShape(STORY_VOLUMES);
  assert.equal(expected.length, 19); assert.equal(expected.reduce((sum, book) => sum + book.chapters.length, 0), 100);
  assert.deepEqual(expected.map(book => book.volume), Array.from({ length: 19 }, (_, index) => index + 1));
  for (const [name, source] of [['schema-guard', guard.content], ['controller', read(files.controller)], ['terminal', terminal.content], ['opening', read(files.opening)], ['injector', injector.content]]) {
    assert.deepEqual(catalogueShape(embeddedCatalogue(source)), expected, name + ' 目录不一致');
  }
  evidence.catalogue = { volumes: expected.length, nodes: expected.reduce((sum, book) => sum + book.chapters.length, 0), signature: sha256(JSON.stringify(expected)), perVolume: expected.map(book => ({ volume: book.volume, nodes: book.chapters.length, first: book.chapters[0].key, last: book.chapters.at(-1).key })) };
  return evidence.catalogue;
});
check('schema 接受全部真实节点，并拒绝非法卷章组合', () => {
  const schema = createSchema(z, { normalizeRelationships: false });
  const state = clone(INITIAL_STATE); state.系统.开局状态 = '已建档'; state.系统.主角模式 = '自定义角色'; state.玩家.姓名 = '目录审查';
  for (const book of STORY_VOLUMES) {
    state.场景.当前卷 = book.volume;
    for (const chapter of book.chapters) { state.场景.当前章 = chapter.key; assert.equal(schema.safeParse(state).success, true, `${book.volume}/${chapter.key}`); }
    state.场景.当前章 = '__不在目录中__'; assert.equal(schema.safeParse(state).success, false);
  }
  state.场景.当前章 = '序章';
  for (const volume of [0, 20, 1.5]) { state.场景.当前卷 = volume; assert.equal(schema.safeParse(state).success, false); }
});
check('正式卡不含合成验收数据，副本只含约定测试差异', () => {
  const text = JSON.stringify(release);
  const observerId = 'd03e83b4-5c8a-46a1-9e0c-1a2d46076336', observerName = '仅验收副本·发送请求只读探针';
  for (const marker of ['RK_EJS_TRUE', 'RK_EJS_NESTED_BAD', '验收员', '合成边界测试', '测试日·上午', observerId, observerName, '__RK_CHAPTER_RUNTIME_PROBE__']) assert.equal(text.includes(marker), false, marker + ' 混入正式卡');
  assert.equal(entries(release).some(item => item.id === 900), false);
  const restored = clone(fixture);
  for (const parts of namingPaths) {
    assert.equal(at(fixture, parts), parts.at(-1) === 'fav' ? false : parts.at(-1) === 'character_version' ? '1.3.6' : '落第骑士·v1.3.6 验收副本');
    assignAt(restored, parts, at(release, parts));
  }
  const greeting = '这是独立的卷章集成验收副本。合成测试档位于第一卷终章末，测试事件只用于检查保留行为。请通过终端进入下一卷。';
  assert.equal(fixture.first_mes, greeting); assert.equal(fixture.data.first_mes, greeting);
  restored.first_mes = release.first_mes; restored.data.first_mes = release.data.first_mes;
  const state = YAML.parse(entry(fixture, 3).content);
  const expectedState = clone(INITIAL_STATE);
  expectedState.系统 = { 结构版本: 4, 主角模式: '自定义角色', 开局状态: '已建档' };
  expectedState.玩家.姓名 = '验收员';
  Object.assign(expectedState.场景, { 当前卷: 1, 当前章: '终章', 阶段: '已结束', 时间: '测试日·上午', 地点: '测试训练场', 切入说明: '合成边界测试', 已发生事件: { 测试记录: { 卷号: 1, 章段: '序章', 结果: '这是一条合成验收记录，不代表原作或用户聊天事实。', 参与者: ['验收员'], 知情者: ['验收员'] } } });
  assert.deepEqual(state, expectedState, '验收副本须从第一卷真实卷末出发，只含指定合成事件');
  assert.equal(createSchema(z).safeParse(state).success, true);
  entry(restored, 3).content = entry(release, 3).content;
  const probe = unique(entries(restored), item => item.id === 900, '验收探针');
  const expectedProbe = {
    ...clone(entries(release)[0]), id: 900, comment: '仅验收副本：真实EJS分支探针', constant: true, enabled: true, keys: [],
    content: '<% if (true) { %>RK_EJS_TRUE<% if (false) { %>RK_EJS_NESTED_BAD<% } else { %>RK_EJS_NESTED_OK<% } %><% } else { %>RK_EJS_FALSE_BAD<% } %>\n<% if (getvar("stat_data.系统.主角模式") === "黑铁一辉") { %>RK_EJS_IKKI<% } else { %>RK_EJS_CUSTOM<% } %>',
  };
  assert.deepEqual(probe, expectedProbe, '验收探针须启用并包含完整真实 EJS 条件，不能只留下 marker 文本');
  restored.data.character_book.entries = entries(restored).filter(item => item.id !== 900);
  const observer = unique(scripts(restored), item => item.id === observerId, '验收副本专属发送观察器');
  assert.equal(observer.enabled, true);
  assert.deepEqual(observer, {
    ...clone(injector), id: observerId, name: observerName,
    info: '只观察独立合成副本的实际本地发送参数与助手活动回复页；不触发生成，不改写变量。正式卡不包含本脚本。',
    content: read(files.fixtureProbeSource),
  }, '独立副本观察器必须精确匹配已审查源码与限定脚本配置');
  assert.deepEqual(scripts(restored).map(item => item.id), [...scripts(release).map(item => item.id), observerId], '只允许在副本末尾添加一个指定观察器');
  restored.data.extensions.tavern_helper.scripts = scripts(restored).filter(item => item.id !== observerId);
  assert.deepEqual(restored, release);
});
check('终端导出与源码构建完全一致', () => {
  assert.deepEqual(terminal, buildTerminal().artifact);
});
for (const [name, args] of [
  ['控制器及开局源同步', ['scripts/build-state-controller.mjs', '--page']],
  ['世界书与 MVU 生成源同步', ['scripts/sync-worldbook-calibration.mjs', '--check']],
  ['章节注入器生成源同步', ['scripts/build-plot-injector.mjs', '--check']],
]) check(name, () => {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return { command: ['node', ...args].join(' '), output: result.stdout.trim() };
});
check('审查期间列出的源组件、生成物与备份文件保持不变', () => {
  for (const [name, file] of Object.entries(files)) assert.equal(sha256(fs.readFileSync(path.join(root, file))), inputHashes[name], file + ' 在审查中变化，请重跑');
});

const passed = results.filter(item => item.passed).length;
const report = {
  status: passed === results.length ? 'passed' : 'failed', passed, total: results.length,
  generatedAt: new Date().toISOString(),
  runtime: {
    checked: false, status: 'pending', scope: 'local-only',
    boundary: '本工具仅核对本地最终卡、源组件和独立合成验收副本，不连接酒馆，不能判定当前是否已部署，也不能证明实机集成验收。',
    handoffRecord: {
      asOf: '2026-09-08', source: '本任务主代理在加入副本专属发送观察器时提供的实机交接记录；后续重跑不会重新核验这条记录。',
      formalCardDeployed: false, fixtureImported: true, integrationAccepted: false,
      description: '独立合成验收副本已通过原生界面导入，并在等待最新更新继续实机检查。正式角色卡尚未部署，原聊天进度未修改；集成验收尚未完成。',
    },
  },
  files: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, { path: file, sha256: inputHashes[name] }])),
  changes: differences(original, release), evidence, results,
};
const output = path.join(root, 'output/chapter-v4/release-check.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, passed, total: results.length, runtime: report.runtime.status, output: path.relative(root, output), failures: results.filter(item => !item.passed) }, null, 2));
if (passed !== results.length) process.exitCode = 1;
