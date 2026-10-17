import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sourceMap from 'source-map-js';
import { buildKnightAvatarCatalog } from './knight-avatars.mjs';
import { extractScripts, jsString } from './bundle.mjs';
import { readMappedScript, baselineId } from './build-lime-story-component.mjs';
import { build } from '../../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { canonicalJson, planSpec, sha256 } from '../../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const defaultBaseline = path.join(root, '世界书规则/MVU/落第骑士-小手机-v1.3.29-B1.json');
export const defaultTarget = path.join(root, '世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json');
export const defaultOut = path.join(root, 'scripts/黑白ADV轮盘终端/avatar-release');
const marker = '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// All B1 code, embedded HTML, mapped sources and mappings outside the three data slots.
const expectedFingerprint = 'cb448ffa2cbd7e3c48d4056f16bb4b63f7460c8bdfa9887b8ea8a81570d6f823';

function literal(text, pattern, label) {
  const matches = [...text.matchAll(pattern)];
  assert.equal(matches.length, 1, label + ' must have exactly one literal');
  const match = matches[0], raw = match[1];
  assert.ok(!/[\r\n\u2028\u2029]/.test(raw), label + ' must stay on one generated line');
  const start = match.index + match[0].indexOf(raw);
  return { start, end: start + raw.length, raw, value: JSON.parse(raw), label };
}

function replace(text, edits) {
  let end = 0, result = '';
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    assert.ok(edit.start >= end && edit.end >= edit.start);
    assert.ok(!/[\r\n\u2028\u2029]/.test(edit.next));
    result += text.slice(end, edit.start) + edit.next;
    end = edit.end;
  }
  return result + text.slice(end);
}

export function inspectAvatarSlots(body) {
  const app = literal(body, /^  function embeddedPhoneHtml\(\) \{ return (.+); \}$/gm, 'APP_HTML');
  assert.equal(typeof app.value, 'string');
  const catalog = literal(app.value, /^var RK_KNIGHT_AVATARS = (.+);$/gm, 'RK_KNIGHT_AVATARS');
  const aliases = literal(body, /^  const limeCharacterAliases = (.+);$/gm, 'LIME_CHARACTER_ALIASES');
  const reserved = literal(body, /^    reservedNames: (.+),$/gm, 'PORTRAIT_RESERVED_NAMES');
  assert.ok(Array.isArray(aliases.value) && Array.isArray(reserved.value));
  return { app, catalog, aliases, reserved };
}

function firstVlq(segment) {
  let encoded = 0, shift = 0, length = 0, digit;
  do {
    digit = alphabet.indexOf(segment[length++]);
    assert.ok(digit >= 0 && shift < 30, 'Invalid source-map VLQ');
    encoded += (digit & 31) * 2 ** shift;
    shift += 5;
  } while (digit & 32);
  return { value: (encoded & 1 ? -1 : 1) * Math.floor(encoded / 2), length };
}

function encodeVlq(value) {
  let encoded = Math.abs(value) * 2 + (value < 0 ? 1 : 0), result = '';
  do {
    let digit = encoded % 32;
    encoded = Math.floor(encoded / 32);
    if (encoded) digit |= 32;
    result += alphabet[digit];
  } while (encoded);
  return result;
}

// Only generated columns change. Keep source/name indices, original positions,
// source content and every other map field exactly as in the installed B1.
function relocateMap(map, body, edits) {
  const positions = edits.map(edit => {
    const prefix = body.slice(0, edit.start).split('\n');
    return { line: prefix.length, start: prefix.at(-1).length,
      end: prefix.at(-1).length + edit.end - edit.start,
      delta: edit.next.length - (edit.end - edit.start) };
  });
  const shiftColumn = (line, column) => {
    let shifted = column;
    for (const edit of positions) {
      if (edit.line !== line) continue;
      assert.ok(column <= edit.start || column >= edit.end, 'Unexpected source mapping inside avatar literal');
      if (column >= edit.end) shifted += edit.delta;
    }
    return shifted;
  };
  const mappings = map.mappings.split(';').map((line, index) => {
    if (!line || !positions.some(edit => edit.line === index + 1)) return line;
    let oldColumn = 0, newColumn = 0;
    return line.split(',').map(segment => {
      const decoded = firstVlq(segment);
      oldColumn += decoded.value;
      const next = shiftColumn(index + 1, oldColumn);
      const result = encodeVlq(next - newColumn) + segment.slice(decoded.length);
      newColumn = next;
      return result;
    }).join(',');
  }).join(';');
  const updated = { ...map, mappings };
  const before = [], after = [];
  new sourceMap.SourceMapConsumer(map).eachMapping(mapping => before.push(mapping));
  new sourceMap.SourceMapConsumer(updated).eachMapping(mapping => after.push(mapping));
  assert.deepEqual(after, before.map(mapping => ({ ...mapping,
    generatedColumn: shiftColumn(mapping.generatedLine, mapping.generatedColumn) })));
  return { map: updated, mappingCount: before.length };
}

export function baselineFingerprint(content) {
  const original = readMappedScript(content), slots = inspectAvatarSlots(original.body);
  const edits = [
    { ...slots.app, next: jsString(replace(slots.app.value, [{ ...slots.catalog, next: '{}' }])) },
    { ...slots.aliases, next: '[]' }, { ...slots.reserved, next: '[]' },
  ];
  const normalized = replace(original.body, edits);
  const relocated = relocateMap(original.map, original.body, edits);
  return sha256(normalized + marker + JSON.stringify(relocated.map) + original.trailer);
}

export function readAvatarData(directory = path.join(root, 'resource/knightavatars')) {
  const bytes = fs.readFileSync(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  return { catalog: buildKnightAvatarCatalog(directory),
    aliases: manifest.characters.map(person => ({ name: person.name, aliases: person.aliases })),
    reservedNames: [...manifest.characters, ...(manifest.missingPortraits || [])]
      .flatMap(person => [person.name, ...(person.aliases || [])])
      .concat((manifest.ambiguousAliases || []).flatMap(item => item.aliases)),
    manifestSha256: sha256(bytes) };
}

export function updateAvatarComponent(baseline, data = readAvatarData()) {
  assert.equal(baseline.type, 'script');
  assert.equal(baseline.id, baselineId, 'Expected current v1.3.29 B1 stable ID');
  assert.equal(baselineFingerprint(baseline.content), expectedFingerprint,
    'B1 non-avatar code or source maps changed; re-audit before refreshing');
  const original = readMappedScript(baseline.content), slots = inspectAvatarSlots(original.body);
  const html = replace(slots.app.value, [{ ...slots.catalog, next: jsString(data.catalog) }]);
  const edits = [{ ...slots.app, next: jsString(html) },
    { ...slots.aliases, next: jsString(data.aliases) },
    { ...slots.reserved, next: jsString(data.reservedNames) }];
  const body = replace(original.body, edits);
  const relocated = relocateMap(original.map, original.body, edits);
  const content = body + marker + Buffer.from(JSON.stringify(relocated.map)).toString('base64') + original.trailer;
  const artifact = { ...baseline, content };
  assert.equal(baselineFingerprint(content), expectedFingerprint);
  const updated = inspectAvatarSlots(body);
  assert.deepEqual(updated.catalog.value, JSON.parse(JSON.stringify(data.catalog)), 'Full avatar catalog mismatch');
  assert.deepEqual(updated.aliases.value, data.aliases, 'Full LIME aliases mismatch');
  assert.deepEqual(updated.reserved.value, data.reservedNames, 'Full reserved-name list mismatch');
  for (const key of Object.keys(baseline)) if (key !== 'content') assert.deepEqual(artifact[key], baseline[key]);
  const beforeScripts = extractScripts(slots.app.value), afterScripts = extractScripts(html);
  assert.equal(afterScripts.length, beforeScripts.length);
  beforeScripts.forEach((script, index) => {
    const before = readMappedScript(script.content), after = readMappedScript(afterScripts[index].content);
    assert.deepEqual(after.map, before.map, 'Embedded page source maps must stay unchanged');
    assert.equal(after.trailer, before.trailer);
    new vm.Script(afterScripts[index].content, { filename: 'avatar-page-' + index + '.js' });
  });
  new vm.Script(content, { filename: 'terminal-B1-avatars.js' });
  const host = extractScripts('<!doctype html><script type="module">\n' + content + '</script>');
  assert.equal(host.length, 1);
  assert.equal(host[0].content, '\n' + content, 'Unexpected Helper HTML parsing boundary');
  assert.deepEqual(JSON.parse(canonicalJson(artifact)), artifact);
  return { artifact, evidence: {
    deliveryMode: 'component', kind: 'helper-script', stableId: baselineId,
    runtimeVersion: '1.3.29', baselineContentSha256: sha256(baseline.content),
    contentSha256: sha256(content), manifestSha256: data.manifestSha256,
    nonAvatarFingerprint: expectedFingerprint, avatarCount: Object.keys(data.catalog.entries).length,
    aliasEntryCount: data.aliases.length, reservedNameCount: data.reservedNames.length,
    changedSlots: ['APP_HTML/RK_KNIGHT_AVATARS', 'LIME_CHARACTER_ALIASES', 'PORTRAIT_RESERVED_NAMES'],
    preservedMappedSources: original.map.sources.length, verifiedSourceMappings: relocated.mappingCount,
    preservedEmbeddedSourceMaps: beforeScripts.length,
    checks: ['B1 non-avatar fingerprint', 'complete catalog equality', 'complete aliases equality',
      'complete reserved names equality', 'all metadata unchanged', 'all source mappings',
      'embedded page map equality', 'V8 syntax', 'Helper HTML parse', 'JSON round trip'],
    runtimeAcceptance: 'not run: offline component validation does not replace live import and display acceptance',
    library: { routeId: 'sillytavern-component-update', snapshotVersion: '2026-08-18',
      loadedGuideIds: ['ST-A0', 'ST-A2', 'ST-A6', 'ST-B2'], adoptedCandidates: [],
      goal: 'Refresh B1 avatar data from current manifest', redLines: 'Preserve all non-avatar code, metadata and MVU behavior',
      acceptance: 'Full data equality, immutable runtime fingerprint, source mappings and component validation' },
  } };
}

function main() {
  const args = process.argv.slice(2), options = { baseline: defaultBaseline, out: defaultOut, target: defaultTarget };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--write') options.write = true;
    else if (['--baseline', '--out', '--target'].includes(args[index])) {
      assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), 'Missing path argument');
      options[args[index].slice(2)] = path.resolve(args[++index]);
    } else throw new Error('Usage: [--baseline script.json] [--out staging] [--target new-script.json] [--write]');
  }
  const resolvedTarget = fs.existsSync(options.target) ? fs.realpathSync(options.target) : path.resolve(options.target);
  for (const file of [options.baseline, defaultBaseline]) {
    assert.notEqual(resolvedTarget.toLowerCase(), fs.realpathSync(file).toLowerCase(), 'Never overwrite the B1 baseline');
  }
  const baseline = JSON.parse(fs.readFileSync(options.baseline, 'utf8').replace(/^\uFEFF/, ''));
  const { artifact, evidence } = updateAvatarComponent(baseline);
  if (fs.existsSync(options.target)) {
    const existing = JSON.parse(fs.readFileSync(options.target, 'utf8'));
    assert.equal(existing.id, baselineId, 'Existing target belongs to a different script');
    assert.equal(baselineFingerprint(existing.content), expectedFingerprint, 'Existing target is not an avatar-only B1');
  }
  const spec = { schemaVersion: 1, deliveryMode: 'component', kind: 'helper-script',
    items: [{ artifactName: 'terminal-v1-3-29-b1-avatars', value: artifact }] };
  const planned = planSpec(spec, options.out);
  assert.deepEqual(planned.errors, []);
  if (options.write) {
    fs.mkdirSync(options.out, { recursive: true });
    fs.writeFileSync(path.join(options.out, 'update-spec.json'), canonicalJson(spec));
    const result = build(spec, options.out, true);
    assert.deepEqual(result.errors, []);
    fs.mkdirSync(path.dirname(options.target), { recursive: true });
    fs.writeFileSync(options.target, canonicalJson(artifact));
    fs.writeFileSync(path.join(options.out, 'validation.json'), canonicalJson({ ...evidence,
      publicTarget: path.relative(root, options.target).replaceAll('\\', '/'), artifact: result.artifacts[0] }));
  }
  console.log(canonicalJson({ ...planned, write: !!options.write,
    publicTarget: path.relative(root, options.target).replaceAll('\\', '/'), evidence }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
