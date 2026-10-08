import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { stripModuleSyntax } from './story-build.mjs';
import { buildTerminal } from './黑白ADV轮盘终端/bundle.mjs';
import { canonicalJson, planSpec } from '../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';
import { build } from '../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { validateTarget } from '../.agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs';

// Only standalone components are emitted; the source card is a read-only metadata fixture.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = '世界书规则/MVU';
const RECORDS = `${OUT}/构建记录/N07-已有坏人物修复`;
const NATIVE_ID = '0ad18dbe-5a59-4cad-acfd-50c2bce0d9ec';
const OPENING_ID = '4f9bda79-82bd-4d2f-9a66-2497349df26e';
const PHONE_ROOT = 'scripts/黑白ADV轮盘终端';
const SOURCES = {
  phonePackage: `${PHONE_ROOT}/package.json`,
  phoneBundle: `${PHONE_ROOT}/bundle.mjs`,
  phoneStateController: 'scripts/rakudai-state-controller.js',
  playerDisplayStore: `${PHONE_ROOT}/player-display-store.js`,
  stateBrowser: 'scripts/rakudai-state-browser.js',
  stateControllerBuilder: 'scripts/build-state-controller.mjs',
  avatarManifest: 'resource/knightavatars/manifest.json',
  guard: `${OUT}/落第骑士-MVU-v4字段约束.json`,
  existingNative: `${OUT}/落第骑士-MVU-原生兼容-N04.json`,
  existingOpening: `${OUT}/落第骑士-开局页面-N06.regex.json`,
  structure: 'scripts/rakudai-mvu-structure.mjs',
  patch: 'scripts/rakudai-mvu-patch.mjs',
  native: 'scripts/rakudai-mvu-native.mjs',
  schema: `${OUT}/schema.mjs`,
  initialization: `${OUT}/[initvar]变量初始化.yaml`,
  core: 'scripts/rakudai-state-core.mjs',
  replySource: 'scripts/rakudai-mvu-reply-source.mjs',
  story: 'scripts/rakudai-story-catalog.mjs',
  tournamentCalendar: 'scripts/story/tournament-calendar-2013.json',
  tournamentCalendarCore: 'scripts/rakudai-tournament-calendar.mjs',
  tournamentBackground: 'scripts/rakudai-tournament-background.mjs',
  tournament: 'scripts/rakudai-tournament.mjs',
  cardMetadata: 'output/chapter-v4/runtime-original-card.json',
  opening: '第一卷-世界书整理/开局页面/正则替换文本.txt',
  openingPage: '第一卷-世界书整理/开局页面/index.html',
};
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !['--prepare', '--write'].includes(flag)) || flags.size > 1) {
  throw new Error('Usage: node scripts/build-native-mvu-components.mjs [--prepare|--write]');
}
const preparing = flags.has('--prepare'), writing = flags.has('--write');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const relative = absolute => path.relative(ROOT, absolute).replaceAll('\\', '/');
const json = file => JSON.parse(read(file).toString('utf8'));
const avatarManifest = json(SOURCES.avatarManifest), avatarRoot = path.resolve(ROOT, 'resource/knightavatars');
const avatarFiles = [...avatarManifest.characters.flatMap(item => [item.file, item.displayFile]),
  avatarManifest.shieldFrame?.file, avatarManifest.shieldFrame?.maskFile].filter(Boolean).map(file => {
  const resolved = fs.realpathSync(path.resolve(avatarRoot, file));
  if (!resolved.startsWith(avatarRoot + path.sep)) throw new Error('Avatar source outside asset directory');
  return relative(resolved);
});
const phoneFiles = ['knight-avatars.mjs', 'terminal-app.html', 'terminal-app.js', 'terminal-controls.js',
  'terminal-app.css', 'terminal-theme.css', 'terminal-status.css', 'styles.css', 'main.js', 'state-reader.js',
  'calendar-worldbook.js', 'layout.js', 'wheel.js', 'state-panel.js', 'correction.js', 'player-portrait.js'].map(file => `${PHONE_ROOT}/${file}`);
const sourceFiles = [...new Set([...Object.values(SOURCES), ...phoneFiles, ...avatarFiles,
  `${OUT}/变量列表.txt`, `${OUT}/变量更新规则.txt`, `${OUT}/变量输出格式.txt`, 'scripts/正文气泡/bubble.css', 'scripts/build-native-mvu-components.mjs'])];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(read(file))]));
const source = file => stripModuleSyntax(read(file).toString('utf8').replace(/\r\n/g, '\n'));
function target(file) {
  const directory = path.resolve(ROOT, OUT), resolved = path.resolve(ROOT, file);
  if (resolved === directory || !resolved.startsWith(directory + path.sep)) throw new Error('Output outside declared directory: ' + file);
  return resolved;
}
function writeJson(file, value) {
  const resolved = target(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, canonicalJson(value), 'utf8');
}
function portable(report) {
  if (typeof report === 'string') return report.startsWith(ROOT) ? relative(report) : report;
  if (Array.isArray(report)) return report.map(portable);
  if (report && typeof report === 'object') return Object.fromEntries(Object.entries(report).map(([key, value]) => [key, portable(value)]));
  return report;
}
const card = json(SOURCES.cardMetadata);
const regexes = card.data?.extensions?.regex_scripts ?? card.extensions?.regex_scripts;
const matches = regexes?.filter(rule => rule.id === OPENING_ID) ?? [];
if (matches.length !== 1 || matches[0].scriptName !== '[开局]') throw new Error('Expected exactly one stable [开局] regex');
const openingOriginal = structuredClone(matches[0]);
const opening = { ...structuredClone(openingOriginal), replaceString: read(SOURCES.opening).toString('utf8') };
const { artifact: phone, version: phoneVersion } = buildTerminal(), guard = json(SOURCES.guard);
if (phone.type !== 'script' || phoneVersion !== '1.3.23' || !phone.name.includes('v1.3.23') || guard.type !== 'script') {
  throw new Error('Unexpected source component version or dialect');
}
const wrap = (body, run) => '// GENERATED: node scripts/build-native-mvu-components.mjs --write\n(function () {\n"use strict";\n' + body + '\n' + run + '\n})();\n';
const nativeContent = wrap([source(SOURCES.structure), source(SOURCES.patch), source(SOURCES.native)].join('\n'),
  'window.RakudaiMvuNative = { version: "N04", runtime: rakudaiMvuRuntime, prepare: prepareRakudaiNativeMvu, install: installRakudaiNativeMvu };\nvoid installRakudaiNativeMvu(window);');
const noApiOrRemoteImport = content => !/\b(?:fetch|XMLHttpRequest|ChatCompletionService|generateRaw)\b|\bimport\s*\(/.test(content);
for (const [name, content] of [['native-mvu-n04', nativeContent]]) {
  new vm.Script(content, { filename: `${name}.js` });
  if (!noApiOrRemoteImport(content)) throw new Error(`${name} must not request APIs or remote modules`);
}
const native = {
  type: 'script', enabled: true, name: '落第骑士·原生 MVU 写入兼容 [N04]', id: NATIVE_ID, content: nativeContent,
  info: 'N04：沿用 N01/N02/N03 的脚本 ID。真实 MVU 更新开始时补本卡 v4 缺失的玩家.成长、成长.经验与历史申请父容器，经验缺轴补0；已有经验、六维、旧申请、收据、未知字段和坏类型保留。安全整合已解析的对象型 add/replace 批次，将缺失父对象的子字段合并为完整新增记录；已有容器、数组及其他操作保持原命令语义。主API直接写经验与六维终值，原生模式由模型计算门槛与余量；需要准确门槛校正可另开当前v4字段约束。约束关闭时才重建原生schema，加载或失败不视为关闭。不兑现旧申请、不结算奖励、不注册Zod、不调用API、不重放旧失败补丁、不批量改历史楼层。升级后关闭旧独立成长G04，只启用一份兼容脚本。',
  button: { enabled: true, buttons: [] }, data: {}, export_with: { data: false, button: false },
};
const selected = [
  { name: 'phone-v1-3-23', kind: 'helper-script', value: phone, file: `${OUT}/落第骑士-小手机-v1.3.23.json` },
];
const reused = [
  { file: SOURCES.guard, id: guard.id, sha256: sourceHashes[SOURCES.guard], enabled: guard.enabled },
  ...[SOURCES.existingNative, SOURCES.existingOpening].map(file => {
    const value = json(file);
    return { file, id: value.id, sha256: sourceHashes[file], enabled: value.type === 'script' ? value.enabled : !value.disabled };
  }),
];
if (opening.replaceString !== '```\n' + read(SOURCES.openingPage).toString('utf8') + '```') {
  throw new Error('Opening replacement differs from its maintained page');
}
const worldbookEntryFiles = ['变量列表.txt', '变量更新规则.txt', '变量输出格式.txt', '[initvar]变量初始化.yaml'].map(file => `${OUT}/${file}`);
if (new Set([...selected.map(item => item.value.id), ...reused.map(item => item.id)]).size !== selected.length + reused.length) throw new Error('Duplicate component IDs');
const batches = [...new Set(selected.map(item => item.kind))].map(kind => ({
  kind, specFile: `${RECORDS}/specs/${kind === 'regex' ? 'opening-regex' : 'helper-scripts'}.json`,
  stage: `${RECORDS}/skill-staging/${kind}`,
  spec: { schemaVersion: 1, deliveryMode: 'component', kind,
    items: selected.filter(item => item.kind === kind).map(item => ({ artifactName: item.name, value: item.value })) },
}));
const plans = batches.map(batch => ({ spec: batch.specFile, ...planSpec(batch.spec, target(batch.stage)) }));
if (plans.some(report => report.errors.length)) throw new Error(JSON.stringify(portable(plans)));
const scopeLock = {
  schemaVersion: 1, deliveryMode: 'component', outputRoot: OUT, recordsRoot: RECORDS, builder: 'scripts/build-native-mvu-components.mjs',
  versions: { state: 4, native: 'N04', opening: 'N06', growthProtocol: 'final-values-v1', phone: phoneVersion, guard: guard.name }, sourceHashes,
  phoneBuild: { method: 'buildTerminal in memory', artifactSha256: hash(canonicalJson(phone)) },
  library: { skill: 'sillytavern-component-update', routeIds: ['sillytavern-component-update'], snapshotVersion: '2026-08-18',
    loadedGuideIds: ['ST-A0', 'ST-A2', 'ST-A6', 'ST-C1', 'ST-C10'], adoptedCandidates: [],
    a0: { goal: 'Emit only phone 1.3.23 with atomic relationship repair, full candidate validation and accurate state-panel diagnostics; reuse native N04, opening N06 and MVU02 guard without writes',
      redLines: 'Only selected component artifacts and records inside outputRoot; no writes to output/, full card, PNG, worldbook package, live import, model request or source-state write',
      acceptance: 'Skill plan/build/validation, stable IDs and metadata, no independent growth output, bounded paths and unchanged source hashes' } },
  selected: selected.map(item => ({ id: item.value.id, kind: item.kind, output: item.file,
    runtimeOwner: 'current Rakudai character; message-floor MVU data', enabled: item.kind === 'regex' ? !item.value.disabled : item.value.enabled })),
  reused,
  worldbookEntryFiles,
  upgrade: { disableLegacyIndependentGrowth: '43a80755-9084-5356-ac85-cc60f8e93886', preserveLegacyArtifacts: true },
  untouched: ['all source files', 'historical N02/N03/N04/N05/N06/G04 artifacts and records', 'other regexes and scripts', 'complete card and worldbook', 'all real chats and historical floors'],
  pendingRuntime: ['target SillyTavern, Tavern Helper and MVU versions', 'component import, execution, current-reply saving and reload persistence in user runtime'],
};
if (preparing || writing) {
  for (const batch of batches) writeJson(batch.specFile, batch.spec);
  writeJson(`${RECORDS}/scope-lock.json`, scopeLock);
  writeJson(`${RECORDS}/write-plan.json`, portable({ schemaVersion: 1, deliveryMode: 'component', skillPlans: plans,
    finalFiles: selected.map(item => item.file), reusedFiles: reused.map(item => item.file), worldbookEntryFiles }));
}
if (!writing) {
  console.log(canonicalJson(portable({ deliveryMode: 'component', prepared: preparing, plans,
    finalFiles: selected.map(item => item.file), reusedFiles: reused.map(item => item.file), worldbookEntryFiles })));
} else {
  const stageResults = batches.map(batch => build(batch.spec, target(batch.stage), true));
  for (const result of stageResults) {
    if (result.errors.length) throw new Error(JSON.stringify(result.errors));
    for (const written of result.written) target(relative(written));
  }
  const stagingValidation = batches.map(batch => validateTarget(target(batch.stage)));
  if (stagingValidation.some(report => report.errors.length)) throw new Error(JSON.stringify(portable(stagingValidation)));
  const artifacts = selected.map(item => {
    const batch = batches.find(entry => entry.kind === item.kind), suffix = item.kind === 'regex' ? 'regex' : 'script';
    const content = fs.readFileSync(target(`${batch.stage}/${item.name}.${suffix}.json`));
    fs.writeFileSync(target(item.file), content);
    return { artifactName: item.name, id: item.value.id, kind: item.kind,
      relativePath: path.basename(item.file), file: item.file, sha256: hash(content) };
  });
  writeJson(`${RECORDS}/component-update-manifest.json`, { schemaVersion: 1, deliveryMode: 'component', artifactRoot: OUT,
    artifacts, reused: scopeLock.reused, worldbookEntryFiles });
  const finalValidation = [...selected.map(item => validateTarget(target(item.file))), ...reused.map(item => validateTarget(target(item.file)))];
  if (finalValidation.some(report => report.errors.length)) throw new Error(JSON.stringify(portable(finalValidation)));
  const sameSourceHashes = Object.entries(sourceHashes).every(([file, expected]) => hash(read(file)) === expected);
  const { replaceString: beforeReplace, ...beforeMetadata } = openingOriginal;
  const { replaceString: afterReplace, ...afterMetadata } = json(SOURCES.existingOpening);
  const preservation = {
    sourceHashesUnchanged: sameSourceHashes,
    phoneAllFieldsPreserved: canonicalJson(json(selected[0].file)) === canonicalJson(phone),
    guardFileReusedWithoutWrite: hash(read(SOURCES.guard)) === sourceHashes[SOURCES.guard],
    reusedComponentsUnchanged: reused.every(item => hash(read(item.file)) === item.sha256),
    openingMetadataPreserved: canonicalJson(beforeMetadata) === canonicalJson(afterMetadata),
    openingReplacementReused: hash(read(SOURCES.existingOpening)) === sourceHashes[SOURCES.existingOpening],
    nativeStableIdAndEnabled: native.id === NATIVE_ID && native.enabled && native.button.enabled,
    noIndependentGrowthOutput: selected.every(item => item.name !== 'growth-g04'),
    nativeNoApiOrRemoteImport: noApiOrRemoteImport(nativeContent),
    outputPathsInsideDeclaredRoot: artifacts.every(item => target(item.file).startsWith(path.resolve(ROOT, OUT) + path.sep)),
  };
  if (Object.values(preservation).some(passed => !passed)) throw new Error('Component preservation failed: ' + JSON.stringify(preservation));
  const report = { schemaVersion: 1, deliveryMode: 'component', passed: true, versions: scopeLock.versions, sourceHashes,
    artifactCount: artifacts.length, reusedCount: reused.length, artifacts, reused: scopeLock.reused, worldbookEntryFiles, preservation,
    skill: { stagingValidation, finalValidation }, runtime: 'Static artifact validation; no live import, model request or full-card packaging',
    pendingRuntime: scopeLock.pendingRuntime };
  writeJson(`${RECORDS}/component-validation.json`, portable(report));
  console.log(canonicalJson({ deliveryMode: 'component', passed: true,
    artifacts: artifacts.map(item => ({ file: item.file, id: item.id, sha256: item.sha256 })),
    reused: scopeLock.reused, preservation, validationReport: `${RECORDS}/component-validation.json` }));
}
