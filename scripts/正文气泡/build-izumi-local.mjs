// Current-character display compatibility only. The supplied preset is read as
// data; neither its regex registry nor any real chat is written by this builder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildLocalIzumiRules, localArtifactNames } from './local-izumi-compat.mjs';
import { canonicalJson, planSpec } from '../../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';
import { build } from '../../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { validateTarget } from '../../.agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '发布/Izumi本卡兼容'), components = path.join(out, 'components');
const args = process.argv.slice(2), flags = args.filter(arg => arg.startsWith('--'));
if (flags.some(flag => !['--prepare', '--write'].includes(flag)) || flags.length > 1 || args.length - flags.length > 1) {
  throw new Error('Usage: node build-izumi-local.mjs [preset.json] [--prepare|--write]');
}
const input = args.find(arg => !arg.startsWith('--')) || path.join(os.homedir(), 'Downloads/Izumi 1002.json');
const bytes = fs.readFileSync(input), preset = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const originalRules = preset.extensions?.regex_scripts;
if (!Array.isArray(originalRules)) throw new Error('Expected the supplied Izumi regex data');
const sourceBefore = canonicalJson(preset), rules = buildLocalIzumiRules(preset);
if (rules.length !== localArtifactNames.length || new Set(rules.map(rule => rule.id)).size !== rules.length) {
  throw new Error('Local component count or identity mismatch');
}
if (rules.some(rule => originalRules.some(original => original.id === rule.id) ||
    !rule.markdownOnly || rule.promptOnly || rule.substituteRegex !== 0 || canonicalJson(rule.placement) !== canonicalJson([2]))) {
  throw new Error('Local compatibility must use independent display-only component IDs');
}
const spec = { schemaVersion: 1, deliveryMode: 'component', kind: 'regex',
  items: rules.map((value, index) => ({ artifactName: localArtifactNames[index], value })) };
const plan = planSpec(spec, components);
if (plan.errors.length) throw new Error(JSON.stringify(plan.errors));
const hash = value => createHash('sha256').update(value).digest('hex');
const portable = value => {
  if (typeof value === 'string') {
    const normalized = value.replaceAll('\\', '/'), normalizedOut = out.replaceAll('\\', '/');
    return normalized === normalizedOut || normalized.startsWith(normalizedOut + '/')
      ? 'scripts/正文气泡/发布/Izumi本卡兼容' + normalized.slice(normalizedOut.length) : value;
  }
  return Array.isArray(value) ? value.map(portable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, portable(item)])) : value;
};
const receipt = { schemaVersion: 1, deliveryMode: 'component',
  runtimeOwner: '当前落第角色卡，仅 SCOPED 显示正则',
  source: { file: path.basename(input), sha256: hash(bytes), treatedAs: 'untrusted regex data; no scripts executed' },
  sourceHashes: Object.fromEntries(['build-izumi-local.mjs', 'local-izumi-compat.mjs', 'context-guard.mjs'].map(file =>
    [file, hash(fs.readFileSync(path.join(here, file)))])),
  scopeLock: { intendedGroup: 'SCOPED', order: [...rules.map(rule => rule.scriptName),
    '01 盾形对白 · 姓名与台词 v0.5', '02 盾形对白 · OC 姓名候选 v0.5', '03 盾形对白 · 共享样式 v0.5'],
    publicIzumiRuleChanges: 0, sourcePresetChanges: 0,
    import: 'Native ST import creates a new ID and appends. Remove or disable older copies manually; ID equality is not an override.',
    redLines: ['No global/preset rule changes', 'No output writes', 'No complete card or preset export', 'No live chat or MVU writes'] },
  library: { snapshotVersion: '2026-08-18', routeIds: ['sillytavern-component-update'],
    loadedGuideIds: ['ST-A0', 'ST-A2', 'ST-A5', 'ST-A6', 'ST-B2'], adoptedCandidates: [] },
  pendingRuntime: ['Import into the current character local regex group only',
    'Live user theme, complete stream lifecycle and option iframe interaction'] };
if (canonicalJson(preset) !== sourceBefore) throw new Error('Builder changed preset data');
if (flags.length) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'scope-lock.json'), canonicalJson(receipt));
  fs.writeFileSync(path.join(out, 'update-spec.json'), canonicalJson(spec));
  fs.writeFileSync(path.join(out, 'write-plan.json'), canonicalJson(portable(plan)));
}
if (flags.includes('--write')) {
  const result = build(spec, components, true);
  if (result.errors.length || result.written.some(file => !path.resolve(file).startsWith(components + path.sep))) {
    throw new Error('Component build failed or escaped the declared directory');
  }
  const validation = validateTarget(components);
  if (validation.errors.length) throw new Error(JSON.stringify(validation.errors));
  const artifacts = rules.map((rule, index) => {
    const file = path.join(components, localArtifactNames[index] + '.regex.json');
    if (canonicalJson(JSON.parse(fs.readFileSync(file, 'utf8'))) !== canonicalJson(rule)) throw new Error('Artifact differs from source');
    return { file, id: rule.id, sha256: hash(fs.readFileSync(file)) };
  });
  if (hash(fs.readFileSync(input)) !== receipt.source.sha256 || canonicalJson(preset) !== sourceBefore) throw new Error('Preset preservation failed');
  fs.writeFileSync(path.join(out, 'component-validation.json'), canonicalJson(portable({ ...receipt, passed: true, artifacts, validation,
    preservation: { presetFileNotWritten: true, presetDataUnchanged: true, independentLocalIds: true } })));
  console.log(JSON.stringify(portable({ passed: true, artifacts, presetUnchanged: true, intendedGroup: 'SCOPED' })));
} else console.log(JSON.stringify(portable({ prepared: flags.includes('--prepare'), ...plan }), null, 2));
