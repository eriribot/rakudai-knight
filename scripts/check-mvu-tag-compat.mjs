// Standalone component delivery and deterministic display regression fixtures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalJson, planSpec } from '../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';
import { build } from '../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { validateTarget } from '../.agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs';
import { parseRegex } from '../.agents/skills/sillytavern-render-regex-pipeline/scripts/validate-tavern-regex.mjs';
import { runCases } from '../.agents/skills/sillytavern-render-regex-pipeline/scripts/run-regex-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'output/mvu-tag-compat');
const args = process.argv.slice(2);
assert.ok(args.length === 1 && ['--prepare', '--write'].includes(args[0]), 'Use --prepare or --write');
const writing = args[0] === '--write';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const portable = value => JSON.parse(JSON.stringify(value).replaceAll(root.replaceAll('\\', '\\\\'), '').replaceAll(root, ''));
const save = (file, value) => {
  const target = path.resolve(out, file);
  assert.ok(target.startsWith(out + path.sep), 'Output outside declared component folder');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, canonicalJson(value));
};
const sourceFiles = [
  '世界书规则/MVU/落第骑士-专属变量美化正则.json',
  'scripts/酒馆助手脚本-小手机-黑白ADV轮盘版-v1.3.15.json',
  '世界书规则/MVU/落第骑士-MVU-v4字段约束.json',
];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(read(file))]));
const rules = json(sourceFiles[0]), before = json('output/mvu-tag-compat/before-display-rules.json');
const id = 'e0b51684-257a-422a-a9f8-rakudai00001';
const selected = rules.filter(rule => rule.id === id), original = before.filter(rule => rule.id === id);
assert.equal(selected.length, 1); assert.equal(original.length, 1);
const rule = selected[0];
const withoutPattern = value => { const { findRegex, ...metadata } = value; return metadata; };
assert.deepEqual(withoutPattern(rule), withoutPattern(original[0]));
assert.deepEqual(rules.filter(item => item.id !== id), before.filter(item => item.id !== id));
assert.ok(rule.replaceString.includes('本轮变量输出') && !rule.replaceString.includes('变量已同步'));
const analysis = 'Scene: classroom greeting. Profile: Kurogane Ikki; confirmed this turn.';
const patch = JSON.stringify([{ op: 'add', path: '/人际/黑铁一辉', value: { 关系: '同级生', 好感: 20, 支援度: 10 } }]);
const rendered = (a = '', p = '') => rule.replaceString.replace(/\$([12])/g, (_match, index) => index === '1' ? a : p);
const block = (a = analysis, p = patch, analysisTag = 'Analysis', patchTag = 'JSONPatch', outer = 'UpdateVariable') =>
  '<' + outer + '><' + analysisTag + '>' + a + '</' + analysisTag + '><' + patchTag + '>' + p + '</' + patchTag + '></' + outer + '>';
const onlyPatch = '<UpdateVariable><JSONPatch>' + patch + '</JSONPatch></UpdateVariable>';
const second = block('SECOND', '[{"op":"replace","path":"/场景/地点","value":"SECOND"}]', 'update_analysis', 'json_patch');
const secondOutput = rendered('SECOND', '[{"op":"replace","path":"/场景/地点","value":"SECOND"}]');
const canonicalSecond = block('SECOND', '[{"op":"replace","path":"/场景/地点","value":"SECOND"}]');
const unknown = '<UpdateVariable><other>Original payload remains available.</other></UpdateVariable>';
const unclosed = '<UpdateVariable><JSONPatch>' + patch + '</JSONPatch>';
const malformed = '<UpdateVariable><Analysis>Incomplete analysis</UpdateVariable>';
const longPatch = JSON.stringify([{ op: 'add', path: '/人际/黑铁一辉', value: { 态度印象: '长文本内容'.repeat(3000) } }]);
const fixtures = { schemaVersion: 1, cases: [] };
function fixture(id, input, expected, options = {}) {
  fixtures.cases.push({ id, input, source: 'ai_output', placement: 2, destination: 'display', depth: 0, expected, ...options });
}
fixture('canonical', block(), rendered(analysis, patch));
fixture('snake-user-reply', block(analysis, patch, 'update_analysis', 'json_patch'), rendered(analysis, patch));
fixture('mixed-tag-styles', block(analysis, patch, 'Analysis', 'json_patch'), rendered(analysis, patch));
fixture('mixed-case', block(analysis, patch, 'UPDATE_ANALYSIS', 'JsOn_PaTcH', 'uPdAtEvArIaBlE'), rendered(analysis, patch));
fixture('legacy-wrapper', block(analysis, patch, 'analysis', 'jsonpatch', 'update'), rendered(analysis, patch));
fixture('patch-only', onlyPatch, rendered('', patch));
fixture('analysis-only', '<UpdateVariable><update_analysis>' + analysis + '</update_analysis></UpdateVariable>', rendered(analysis, ''));
fixture('actual-empty-array', block(analysis, '[]', 'update_analysis', 'json_patch'), rendered(analysis, '[]'));
fixture('long-patch-retained', block(analysis, longPatch, 'update_analysis', 'json_patch'), rendered(analysis, longPatch));
fixture('adjacent-blocks', onlyPatch + '\n' + second, rendered('', patch) + '\n' + secondOutput);
fixture('adjacent-canonical-blocks', onlyPatch + '\n' + canonicalSecond, rendered('', patch) + '\n' + secondOutput);
fixture('unclosed-first-block', unclosed + '\n' + second, unclosed + '\n' + secondOutput);
fixture('malformed-first-block', malformed + '\n' + second, malformed + '\n' + secondOutput);
fixture('unknown-tags-retained', unknown, unknown);
fixture('streaming-unclosed-retained', unclosed, unclosed);
fixture('prompt-stage-skipped', block(), block(), { destination: 'prompt' });
fixture('user-placement-skipped', block(), block(), { placement: 1, source: 'user_input' });
fixture('outside-depth-skipped', block(), block(), { depth: 10000 });
const report = runCases(rule, fixtures);
assert.deepEqual(report.errors, []); assert.equal(report.failed, 0);
const rawSnake = block(analysis, patch, 'update_analysis', 'json_patch');
const oldSnake = parseRegex(original[0].findRegex).exec(rawSnake);
assert.equal(oldSnake?.[1], undefined); assert.equal(oldSnake?.[2], undefined);
assert.equal([... (onlyPatch + '\n' + canonicalSecond).matchAll(parseRegex(original[0].findRegex))].length, 1);
assert.equal([... (onlyPatch + '\n' + canonicalSecond).matchAll(parseRegex(rule.findRegex))].length, 2);

const phone = json(sourceFiles[1]), guard = json(sourceFiles[2]);
assert.ok(phone.name.includes('v1.3.15')); assert.equal(phone.type, 'script'); assert.equal(guard.type, 'script');
const batches = [
  { name: 'regex', spec: { schemaVersion: 1, deliveryMode: 'component', kind: 'regex',
    items: [{ artifactName: 'variable-display', value: rule }] } },
  { name: 'helper', spec: { schemaVersion: 1, deliveryMode: 'component', kind: 'helper-script',
    items: [{ artifactName: 'phone-v1-3-15', value: phone }, { artifactName: 'guard-v4-tags', value: guard }] } },
];
const plans = batches.map(batch => ({ name: batch.name, ...planSpec(batch.spec, path.join(out, 'components', batch.name)) }));
assert.ok(plans.every(plan => plan.errors.length === 0));
const scope = {
  schemaVersion: 1, deliveryMode: 'component', sourceHashes,
  selected: batches.flatMap(batch => batch.spec.items.map(item => ({ id: item.value.id, kind: batch.spec.kind,
    output: 'components/' + batch.name + '/' + item.artifactName + (batch.name === 'regex' ? '.regex.json' : '.script.json') }))),
  library: { snapshotVersion: '2026-08-18', routeIds: ['sillytavern-render-regex-pipeline', 'sillytavern-component-update'],
    loadedDocumentIds: ['ST-A0', 'ST-A5', 'ST-A6', 'ST-A2', 'ST-B2'], adoptedCandidates: [],
    a0: { goal: 'Display nonempty snake-tag MVU output and recognize the same source tags in the phone/optional guard',
      redLines: 'No real chat writes, replay, model API, full card package, history-cleanup edit or save-lock weakening',
      acceptance: 'Reproduce empty captures, preserve non-target metadata, fixtures, upstream/core and existing readiness tests; target host pending' } },
  untouched: ['prior releases', 'history prompt-cleanup regex', 'canonical output format', 'real chats and swipes', 'N01 component'],
  pendingRuntime: ['player installed SillyTavern/Tavern Helper/MVU versions', 'player component import and current-swipe render/readback'],
};
save('scope-lock.json', scope);
save('write-plan.json', portable(plans));
if (writing) {
  const built = batches.map(batch => build(batch.spec, path.join(out, 'components', batch.name), true));
  assert.ok(built.every(value => value.errors.length === 0));
  const validations = batches.map(batch => validateTarget(path.join(out, 'components', batch.name)));
  assert.ok(validations.every(value => value.errors.length === 0));
  assert.ok(sourceFiles.every(file => sourceHashes[file] === hash(read(file))));
  save('fixtures.json', fixtures);
  save('display-fixture-report.json', report);
  save('component-validation.json', portable({ passed: true, validations,
    preservation: { sourceHashesUnchanged: true, displayMetadataPreserved: true, historyCleanupUnchanged: true,
      phoneAllFieldsPreserved: true, guardAllFieldsPreserved: true }, sourceHashes,
    evidence: 'Deterministic Node regex and component validation; no player host execution.' }));
}
console.log(JSON.stringify({ mode: 'component', written: writing, displayFixtures: report.passed,
  reproduced: ['nonempty snake tags yield empty old captures', 'old regex consumes adjacent blocks'],
  artifacts: scope.selected, pendingRuntime: scope.pendingRuntime }, null, 2));
