// Component-only repair: read an exported preset as data, repair one regex.
// Never execute its replacement scripts or overwrite the supplied preset.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildIzumiPlanningRepair, izumiPlanningRepair } from './preset-compatibility.mjs';
import { canonicalJson, planSpec } from '../../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';
import { build } from '../../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { validateTarget } from '../../.agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '发布/Izumi兼容'), components = path.join(out, 'components');
const args = process.argv.slice(2), flags = args.filter(value => value.startsWith('--'));
if (flags.some(flag => !['--prepare', '--write'].includes(flag)) || flags.length > 1 || args.length - flags.length > 1) {
  throw new Error('Usage: node build-izumi-compat.mjs [preset.json] [--prepare|--write]');
}
const input = args.find(value => !value.startsWith('--')) || path.join(os.homedir(), 'Downloads/Izumi 1002.json');
const bytes = fs.readFileSync(input), preset = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const source = preset.extensions?.regex_scripts?.filter(rule => rule.id === izumiPlanningRepair.id);
if (source?.length !== 1) throw new Error('Expected exactly one verified Izumi planning regex');
const repaired = buildIzumiPlanningRepair(preset), artifactName = 'izumi-planning-compat';
const unwrapped = text => text.replace(/^<pre hidden>(<style>[\s\S]*?<\/style>)<\/pre>/, '$1');
const spec = { schemaVersion: 1, deliveryMode: 'component', kind: 'regex', items: [{ artifactName, value: repaired }] };
const plan = planSpec(spec, components);
if (plan.errors.length) throw new Error(JSON.stringify(plan.errors));
const hash = value => createHash('sha256').update(value).digest('hex');
const portable = value => {
  if (typeof value === 'string') {
    const normalized = value.replaceAll('\\', '/'), normalizedOut = out.replaceAll('\\', '/');
    return normalized === normalizedOut || normalized.startsWith(normalizedOut + '/')
      ? 'scripts/正文气泡/发布/Izumi兼容' + normalized.slice(normalizedOut.length) : value;
  }
  return Array.isArray(value) ? value.map(portable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, portable(item)])) : value;
};
const receipt = { schemaVersion: 1, deliveryMode: 'component', scope: 'Replace only the existing Izumi planning display regex in its original group',
  source: { file: path.basename(input), sha256: hash(bytes), id: repaired.id },
  sourceHashes: Object.fromEntries(['build-izumi-compat.mjs', 'preset-compatibility.mjs'].map(file =>
    [file, hash(fs.readFileSync(path.join(here, file)))])),
  changedFields: ['findRegex', 'replaceString'].filter(field => repaired[field] !== source[0][field]),
  before: source[0].findRegex, after: repaired.findRegex,
  styleProtection: 'Wrap only the leading bare style block in pre[hidden]; CSS and visible template stay exact',
  preservation: { presetFileNotWritten: true,
    metadataUnchanged: canonicalJson({ ...repaired, findRegex: source[0].findRegex, replaceString: source[0].replaceString }) === canonicalJson(source[0]),
    cssAndVisibleTemplateUnchanged: unwrapped(repaired.replaceString) === unwrapped(source[0].replaceString) },
  library: { snapshotVersion: '2026-08-18', routeIds: ['sillytavern-component-update'], loadedGuideIds: ['ST-A0', 'ST-A2', 'ST-A5', 'ST-A6', 'ST-B2'], adoptedCandidates: [] },
  pendingRuntime: ['Import into the same original regex group and keep only one enabled rule with this ID', 'Real preset rendering, iframe interaction and stream/reload acceptance'] };
if (Object.values(receipt.preservation).some(value => !value)) throw new Error('Unexpected metadata/template change');
if (flags.length) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'update-spec.json'), canonicalJson(spec));
  fs.writeFileSync(path.join(out, 'source-receipt.json'), canonicalJson(receipt));
  fs.writeFileSync(path.join(out, 'write-plan.json'), canonicalJson(portable(plan)));
}
if (flags.includes('--write')) {
  const result = build(spec, components, true);
  if (result.errors.length || result.written.some(file => !path.resolve(file).startsWith(components + path.sep))) throw new Error('Component build failed or escaped declared directory');
  const validation = validateTarget(components);
  if (validation.errors.length) throw new Error(JSON.stringify(validation.errors));
  const file = path.join(components, artifactName + '.regex.json');
  const actual = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (canonicalJson(actual) !== canonicalJson(repaired) || hash(fs.readFileSync(input)) !== receipt.source.sha256) throw new Error('Artifact/source preservation failed');
  fs.writeFileSync(path.join(out, 'component-validation.json'), canonicalJson(portable({ ...receipt, passed: true,
    artifact: { file, id: actual.id, sha256: hash(fs.readFileSync(file)) }, validation })));
  console.log(JSON.stringify(portable({ passed: true, file, id: actual.id, changedFields: receipt.changedFields, sourcePreserved: true })));
} else console.log(JSON.stringify(portable({ prepared: flags.includes('--prepare'), ...plan }), null, 2));
