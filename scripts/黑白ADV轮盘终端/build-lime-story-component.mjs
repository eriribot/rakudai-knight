import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sourceMap from 'source-map-js';
import { extractScripts } from './bundle.mjs';
import { build } from '../../.agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs';
import { canonicalJson, planSpec, sha256 } from '../../.agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
export const baselineId = '3d8c6c23-f78e-46e5-8e89-4a90bab6fb85';
export const baselineHash = '0eeadc635e76b49e71004c3c91b48da39c5fd86d149cce94a12399f9fe4e0d07';
const mapMarker = '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,';
const sourceName = 'lime-story.js';
const { SourceMapConsumer, SourceMapGenerator } = sourceMap;

// Only read a known baseline. Never write the installed card, its settings, or chat.
export function readBaseline(filename) {
  const bytes = fs.readFileSync(filename);
  let value;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    const texts = new Map();
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
      assert.ok(end <= bytes.length, 'Invalid PNG chunk length');
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'tEXt') {
        const data = bytes.subarray(offset + 8, offset + 8 + size), split = data.indexOf(0);
        if (split >= 0) texts.set(data.toString('latin1', 0, split), data.toString('latin1', split + 1));
      }
      offset = end;
    }
    assert.ok(texts.has('ccv3') || texts.has('chara'), 'PNG has no character payload');
    value = JSON.parse(Buffer.from(texts.get('ccv3') || texts.get('chara'), 'base64').toString('utf8'));
  } else value = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (value.type === 'script') return value;
  const matches = [];
  function visit(items) {
    for (const item of items || []) {
      if (item.type === 'folder') visit(item.scripts);
      else if (item.id === baselineId) matches.push(item);
    }
  }
  visit(value.data?.extensions?.tavern_helper?.scripts);
  assert.equal(matches.length, 1, 'Expected exactly one baseline terminal');
  return matches[0];
}

export function readMappedScript(content) {
  const index = content.lastIndexOf(mapMarker);
  assert.ok(index >= 0, 'Baseline needs an inline source map');
  const end = content.indexOf('\n', index + mapMarker.length);
  assert.ok(end > index, 'Missing source map trailer');
  return { body: content.slice(0, index), trailer: content.slice(end),
    map: JSON.parse(Buffer.from(content.slice(index + mapMarker.length, end), 'base64').toString('utf8')) };
}

export function buildLimeStoryComponent(baseline, replacement) {
  assert.equal(baseline.type, 'script');
  assert.equal(baseline.id, baselineId);
  assert.equal(sha256(baseline.content), baselineHash, 'Baseline changed; re-audit before updating');
  const original = readMappedScript(baseline.content);
  const sourceIndex = original.map.sources.indexOf(sourceName);
  assert.ok(sourceIndex >= 0, 'Missing maintained source');
  const previous = original.map.sourcesContent[sourceIndex];
  replacement = replacement.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  assert.ok(previous.endsWith('\n') && replacement.endsWith('\n'), 'Keep module boundary newlines');
  const start = original.body.indexOf(previous);
  assert.ok(start >= 0 && start === original.body.lastIndexOf(previous), 'Source must match one exact module');
  const prefix = original.body.slice(0, start), suffix = original.body.slice(start + previous.length);
  const body = prefix + replacement + suffix;
  const startLine = prefix.split('\n').length;
  const startColumn = prefix.split('\n').at(-1).length;
  assert.ok(/^\s*$/.test(prefix.split('\n').at(-1)), 'Only indentation may precede module');
  const endLine = startLine + previous.split('\n').length - 1;
  const delta = replacement.split('\n').length - previous.split('\n').length;
  const inModule = mapping => (mapping.generatedLine > startLine ||
    mapping.generatedLine === startLine && mapping.generatedColumn >= startColumn) && mapping.generatedLine < endLine;
  const consumer = new SourceMapConsumer(original.map);
  const generator = new SourceMapGenerator({ file: original.map.file, sourceRoot: original.map.sourceRoot });
  const sourceNames = new Map(consumer.sources.map((name, i) => [name, original.map.sources[i]]));
  original.map.sources.forEach((name, i) => generator.setSourceContent(name, name === sourceName ? replacement : original.map.sourcesContent[i]));
  consumer.eachMapping(mapping => {
    if (inModule(mapping)) {
      assert.equal(sourceNames.get(mapping.source), sourceName, 'Unexpected source inside replacement span');
      return;
    }
    const entry = { generated: { line: mapping.generatedLine + (mapping.generatedLine >= endLine ? delta : 0), column: mapping.generatedColumn } };
    if (mapping.source !== null) {
      entry.source = sourceNames.get(mapping.source);
      entry.original = { line: mapping.originalLine, column: mapping.originalColumn };
      if (mapping.name !== null) entry.name = mapping.name;
    }
    generator.addMapping(entry);
  });
  replacement.split('\n').forEach((line, i) => {
    if (line.length) generator.addMapping({ generated: { line: startLine + i, column: i === 0 ? startColumn : 0 },
      source: sourceName, original: { line: i + 1, column: 0 } });
  });
  const map = generator.toJSON();
  const content = body + mapMarker + Buffer.from(JSON.stringify(map)).toString('base64') + original.trailer;
  const artifact = { ...baseline,
    name: baseline.name + ' B1（LIME状态精简）', content,
    info: baseline.info + '\nB1：仅将主剧情LIME事实补充改为身份、当前场景和近期联系人关系的字段投影；完整MVU状态、人物原文、真实通讯与独立LIME发信保持原样。以现用v1.3.29构建为基线，保留其余模块、资源及运行时版本。' };

  // Validate exact delivery bytes through the Helper HTML/JavaScript boundary.
  new vm.Script(content, { filename: 'terminal-B1.js' });
  const scripts = extractScripts('<!doctype html><script type="module">\n' + content + '</script>');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].content, '\n' + content);
  new vm.Script(scripts[0].content, { filename: 'terminal-B1-host.js' });
  assert.equal(body.slice(0, start), prefix);
  assert.equal(body.slice(start + replacement.length), suffix);
  for (const key of Object.keys(baseline)) {
    if (!['name', 'content', 'info'].includes(key)) assert.deepEqual(artifact[key], baseline[key]);
  }
  const updated = new SourceMapConsumer(map);
  for (const [i, name] of original.map.sources.entries()) {
    assert.equal(updated.sourceContentFor(consumer.sources[i]), name === sourceName ? replacement : original.map.sourcesContent[i]);
  }
  replacement.split('\n').forEach((line, i) => {
    if (!line.length) return;
    const location = updated.originalPositionFor({ line: startLine + i, column: i === 0 ? startColumn : 0 });
    assert.equal(location.source, consumer.sources[sourceIndex]);
    assert.equal(location.line, i + 1);
  });
  consumer.eachMapping(mapping => {
    if (inModule(mapping)) return;
    const actual = updated.originalPositionFor({ line: mapping.generatedLine + (mapping.generatedLine >= endLine ? delta : 0), column: mapping.generatedColumn });
    assert.deepEqual(actual, { source: mapping.source, line: mapping.originalLine, column: mapping.originalColumn, name: mapping.name });
  });
  assert.deepEqual(JSON.parse(canonicalJson(artifact)), artifact);
  return { artifact, evidence: {
    deliveryMode: 'component', kind: 'helper-script', runtimeOwner: 'current character Tavern Helper',
    baselineId, baselineContentSha256: baselineHash, enabled: baseline.enabled,
    changedSource: sourceName, sourceBeforeSha256: sha256(previous), sourceAfterSha256: sha256(replacement),
    unchangedRuntimeBytesSha256: sha256(prefix + suffix), preservedMappedSources: original.map.sources.length - 1,
    moduleStartLine: startLine, moduleStartColumn: startColumn, lineDelta: delta, contentSha256: sha256(content),
    checks: ['exact baseline hash', 'unique source replacement', 'all other runtime bytes unchanged',
      'unknown metadata preserved', 'JSON round trip', 'V8 syntax', 'HTML host parse', 'all source mappings'],
    liveImport: 'pending; no live settings, card, worldbook, chat, or API request changed',
  } };
}

function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--write') options.write = true;
    else if (['--baseline', '--out'].includes(args[i])) options[args[i].slice(2)] = args[++i];
    else throw new Error('Unknown argument: ' + args[i]);
  }
  assert.ok(options.baseline && options.out, 'Usage: --baseline <PNG or script JSON> --out <staging> [--write]');
  const { artifact, evidence } = buildLimeStoryComponent(readBaseline(options.baseline), fs.readFileSync(path.join(directory, sourceName), 'utf8'));
  const spec = { schemaVersion: 1, deliveryMode: 'component', kind: 'helper-script',
    items: [{ artifactName: 'terminal-v1-3-29-b1', value: artifact }] };
  const planned = planSpec(spec, options.out);
  assert.deepEqual(planned.errors, []);
  if (options.write) {
    fs.mkdirSync(options.out, { recursive: true });
    fs.writeFileSync(path.join(options.out, 'update-spec.json'), canonicalJson(spec));
    const result = build(spec, options.out, true);
    assert.deepEqual(result.errors, []);
    fs.writeFileSync(path.join(options.out, 'validation.json'), canonicalJson({ ...evidence, artifact: result.artifacts[0] }));
  }
  console.log(canonicalJson({ ...planned, write: !!options.write, evidence }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
