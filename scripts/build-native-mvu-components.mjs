import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { stripModuleSyntax } from './story-build.mjs';
import { canonicalJson, planSpec } from '../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';
import { build } from '../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { validateTarget } from '../.agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs';

// Only standalone components are emitted; the source card is a read-only metadata fixture.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = 'output/native-mvu-repair';
const NATIVE_ID = '0ad18dbe-5a59-4cad-acfd-50c2bce0d9ec';
const OPENING_ID = '4f9bda79-82bd-4d2f-9a66-2497349df26e';
const SOURCES = {
  phone: 'scripts/酒馆助手脚本-小手机-黑白ADV轮盘版-v1.3.14.json',
  guard: '世界书规则/MVU/落第骑士-MVU-v4字段约束.json',
  native: 'scripts/rakudai-mvu-native.mjs',
  cardMetadata: 'output/chapter-v4/runtime-original-card.json',
  opening: '第一卷-世界书整理/开局页面/正则替换文本.txt',
};
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !['--prepare', '--write'].includes(flag)) || flags.size > 1) {
  throw new Error('Usage: node scripts/build-native-mvu-components.mjs [--prepare|--write]');
}
const preparing = flags.has('--prepare'), writing = flags.has('--write');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const relative = absolute => path.relative(ROOT, absolute).replaceAll('\\', '/');
const sourceHashes = Object.fromEntries(Object.values(SOURCES).map(file => [file, hash(read(file))]));
const json = file => JSON.parse(read(file).toString('utf8'));
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
const phone = json(SOURCES.phone), guard = json(SOURCES.guard);
if (phone.type !== 'script' || !phone.name.includes('v1.3.14') || guard.type !== 'script') throw new Error('Unexpected source component version or dialect');
const nativeBody = stripModuleSyntax(read(SOURCES.native).toString('utf8').replace(/\r\n/g, '\n'));
const nativeContent = '// GENERATED: node scripts/build-native-mvu-components.mjs --write\n(function () {\n"use strict";\n' +
  nativeBody + '\nwindow.RakudaiMvuNative = { version: "N01", runtime: rakudaiMvuRuntime, prepare: prepareRakudaiNativeMvu, install: installRakudaiNativeMvu };\n' +
  'void installRakudaiNativeMvu(window);\n})();\n';
new vm.Script(nativeContent, { filename: 'native-mvu-n01.js' });
if (/\b(?:fetch|XMLHttpRequest|ChatCompletionService|generateRaw)\b|\bimport\s*\(/.test(nativeContent)) throw new Error('Standalone N01 must not request APIs or remote modules');
if (read(SOURCES.cardMetadata).toString('utf8').includes(NATIVE_ID) || [phone.id, guard.id, opening.id].includes(NATIVE_ID)) throw new Error('New N01 ID collides with an existing component');
const native = {
  type: 'script', enabled: true, name: '落第骑士·原生 MVU 写入兼容 [N01]', id: NATIVE_ID,
  content: nativeContent,
  info: 'N01：仅在本卡关闭 Zod 字段约束时兼容原生 MVU 写入结构，不改 stat_data、不调用 API。独立保持开启，可在小手机和字段约束同时关闭时支持普通 JSONPatch add。约束开启时沿用原 G04/T02 路径；加载或失败不视为关闭。不自动结算成长或关系，不重放旧失败补丁，不批量改写历史楼层。只启用一份。',
  button: { enabled: true, buttons: [] }, data: {}, export_with: { data: false, button: false },
};
const selected = [
  { name: 'phone-v1-3-14', kind: 'helper-script', value: phone },
  { name: 'native-mvu-n01', kind: 'helper-script', value: native },
  { name: 'opening-state', kind: 'regex', value: opening },
  { name: 'guard-v4-r01', kind: 'helper-script', value: guard },
];
if (new Set(selected.map(item => item.value.id)).size !== selected.length) throw new Error('Duplicate component IDs');
const batches = ['helper-script', 'regex'].map(kind => ({
  kind, specFile: `${OUT}/specs/${kind === 'regex' ? 'opening-regex' : 'helper-scripts'}.json`,
  stage: `${OUT}/skill-staging/${kind}`,
  spec: { schemaVersion: 1, deliveryMode: 'component', kind,
    items: selected.filter(item => item.kind === kind).map(item => ({ artifactName: item.name, value: item.value })) },
}));
const plans = batches.map(batch => ({ spec: batch.specFile, ...planSpec(batch.spec, target(batch.stage)) }));
if (plans.some(report => report.errors.length)) throw new Error(JSON.stringify(portable(plans)));
const scopeLock = {
  schemaVersion: 1, deliveryMode: 'component', outputRoot: OUT, builder: 'scripts/build-native-mvu-components.mjs',
  sourceHashes,
  library: { skill: 'sillytavern-component-update', routeIds: ['sillytavern-component-update'], snapshotVersion: '2026-08-18',
    loadedGuideIds: ['ST-A0', 'ST-A2', 'ST-A6', 'ST-B2'], adoptedCandidates: [],
    a0: { goal: 'Emit four standalone MVU compatibility components', redLines: 'No full card, PNG, worldbook, live import, model request or source-state write',
      acceptance: 'Skill plan/build/validation, stable IDs and metadata, declared output paths and unchanged source hashes' } },
  selected: selected.map(item => ({ id: item.value.id, kind: item.kind, output: `components/${item.name}.json`,
    runtimeOwner: 'current Rakudai character; message-floor MVU data', enabled: item.kind === 'regex' ? !item.value.disabled : item.value.enabled })),
  untouched: ['all source files', 'other regexes and scripts', 'complete card and worldbook', 'all real chats and historical floors'],
  pendingRuntime: ['target SillyTavern and Tavern Helper versions', 'component import and current-reply execution in user runtime'],
};
if (preparing || writing) {
  for (const batch of batches) writeJson(batch.specFile, batch.spec);
  writeJson(`${OUT}/scope-lock.json`, scopeLock);
  writeJson(`${OUT}/write-plan.json`, portable({ schemaVersion: 1, deliveryMode: 'component', skillPlans: plans,
    finalFiles: selected.map(item => `${OUT}/components/${item.name}.json`) }));
}
if (!writing) {
  console.log(canonicalJson(portable({ deliveryMode: 'component', prepared: preparing, plans,
    finalFiles: selected.map(item => `${OUT}/components/${item.name}.json`) })));
} else {
  const stageResults = batches.map(batch => build(batch.spec, target(batch.stage), true));
  for (const result of stageResults) {
    if (result.errors.length) throw new Error(JSON.stringify(result.errors));
    for (const written of result.written) target(relative(written));
  }
  const stagingValidation = batches.map(batch => validateTarget(target(batch.stage)));
  if (stagingValidation.some(report => report.errors.length)) throw new Error(JSON.stringify(portable(stagingValidation)));
  const components = target(`${OUT}/components`);
  fs.mkdirSync(components, { recursive: true });
  const artifacts = selected.map(item => {
    const batch = batches.find(entry => entry.kind === item.kind), suffix = item.kind === 'regex' ? 'regex' : 'script';
    const stageFile = target(`${batch.stage}/${item.name}.${suffix}.json`);
    const content = fs.readFileSync(stageFile), relativePath = `${item.name}.json`;
    fs.writeFileSync(target(`${OUT}/components/${relativePath}`), content);
    return { artifactName: item.name, id: item.value.id, kind: item.kind, relativePath, sha256: hash(content) };
  });
  writeJson(`${OUT}/components/component-update-manifest.json`, { schemaVersion: 1, deliveryMode: 'component', artifacts });
  const finalValidation = validateTarget(components);
  if (finalValidation.errors.length) throw new Error(JSON.stringify(portable(finalValidation)));
  const sameSourceHashes = Object.entries(sourceHashes).every(([file, expected]) => hash(read(file)) === expected);
  const { replaceString: beforeReplace, ...beforeMetadata } = openingOriginal;
  const { replaceString: afterReplace, ...afterMetadata } = json(`${OUT}/components/opening-state.json`);
  const preservation = {
    sourceHashesUnchanged: sameSourceHashes,
    phoneAllFieldsPreserved: canonicalJson(json(`${OUT}/components/phone-v1-3-14.json`)) === canonicalJson(phone),
    guardAllFieldsPreserved: canonicalJson(json(`${OUT}/components/guard-v4-r01.json`)) === canonicalJson(guard),
    openingMetadataPreserved: canonicalJson(beforeMetadata) === canonicalJson(afterMetadata),
    openingReplacementMatchesSource: afterReplace === read(SOURCES.opening).toString('utf8'),
    nativeEnabled: native.enabled && native.button.enabled,
    nativeNoApiOrRemoteImport: true,
    outputPathsInsideDeclaredRoot: artifacts.every(item => target(`${OUT}/components/${item.relativePath}`).startsWith(components + path.sep)),
  };
  if (Object.values(preservation).some(passed => !passed)) throw new Error('Component preservation failed: ' + JSON.stringify(preservation));
  const report = { schemaVersion: 1, deliveryMode: 'component', passed: true, sourceHashes,
    artifactCount: artifacts.length, artifacts, preservation, skill: { stagingValidation, finalValidation },
    runtime: 'Static importable artifact validation; no live import, model request or full-card packaging',
    pendingRuntime: scopeLock.pendingRuntime };
  writeJson(`${OUT}/component-validation.json`, portable(report));
  console.log(canonicalJson({ deliveryMode: 'component', passed: true, artifacts: artifacts.map(item => ({ file: `${OUT}/components/${item.relativePath}`, id: item.id, sha256: item.sha256 })),
    preservation, validationReport: `${OUT}/component-validation.json` }));
}
