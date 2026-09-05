// Offline standalone worldbook assembly. Does not access SillyTavern or Downloads.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const sourceRoot = path.resolve(__dirname, '../世界书规则/v0.3');
const config = JSON.parse(fs.readFileSync(path.join(sourceRoot, '条目配置.json'), 'utf8'));
const mode = process.argv[2] || '--build';
assert(['--build', '--check', '--dry-run'].includes(mode), 'Use --build, --check or --dry-run');
assert.equal(process.argv.length <= 3, true, 'Unexpected extra arguments');

function localPath(relative) {
  const resolved = path.resolve(sourceRoot, relative);
  const rel = path.relative(sourceRoot, resolved);
  assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Path outside v0.3');
  return resolved;
}

// Field baseline: SillyTavern commit 8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8,
// public/scripts/world-info.js, newWorldInfoEntryDefinition.
const defaults = {
  key: [], keysecondary: [], comment: '', content: '',
  constant: false, vectorized: false, selective: true, selectiveLogic: 0,
  addMemo: true, order: 100, position: config.position, disable: false,
  ignoreBudget: false, excludeRecursion: true, preventRecursion: true,
  matchPersonaDescription: false, matchCharacterDescription: false,
  matchCharacterPersonality: false, matchCharacterDepthPrompt: false,
  matchScenario: false, matchCreatorNotes: false, delayUntilRecursion: 0,
  probability: 100, useProbability: true, depth: config.depth,
  outletName: '', group: '', groupOverride: false, groupWeight: 100,
  scanDepth: config.scanDepth, caseSensitive: false, matchWholeWords: false,
  useGroupScoring: null, automationId: '', role: config.role,
  sticky: null, cooldown: null, delay: null, triggers: [],
};

const entryCount = config.entries.length;
assert(entryCount > 0, 'No rules selected');
assert.equal(new Set(config.entries.map(e => e.uid)).size, entryCount, 'Duplicate UID');
assert.equal(new Set(config.entries.map(e => e.id)).size, entryCount, 'Duplicate source ID');
assert.equal(new Set(config.entries.map(e => e.name)).size, entryCount, 'Duplicate display name');
const worldbook = { entries: {} };
const sourceEvidence = [];
for (const [displayIndex, entry] of config.entries.entries()) {
  assert(Number.isInteger(entry.uid) && entry.uid >= 0, 'Invalid UID');
  assert(typeof entry.constant === 'boolean' && typeof entry.disable === 'boolean');
  assert(Array.isArray(entry.keys) && entry.keys.every(k => typeof k === 'string' && k.trim()));
  assert(entry.constant || entry.keys.length, 'Keyword entry has no keys');
  const raw = fs.readFileSync(localPath(entry.source), 'utf8');
  const text = raw.replace(/\r\n?/g, '\n');
  const start = '<!-- 正文开始 -->';
  const end = '<!-- 正文结束 -->';
  assert.equal(text.split(start).length, 2, `${entry.source}: expected one start marker`);
  assert.equal(text.split(end).length, 2, `${entry.source}: expected one end marker`);
  assert(text.indexOf(end) > text.indexOf(start));
  const content = text.slice(text.indexOf(start) + start.length, text.indexOf(end)).trim();
  const sourceTitle = text.match(/^#\s+(.+)$/m)?.[1];
  assert(sourceTitle && sourceTitle.startsWith(`${entry.id} · `), 'Source title/ID mismatch');
  const name = entry.name;
  assert(typeof name === 'string' && name.trim() === name && name.length, 'Invalid display name');
  assert(content && !/<!--|\[initvar\]|\[mvu_(?:plot|update)\]/i.test(content + name), 'Unexpected marker');
  worldbook.entries[entry.uid] = {
    uid: entry.uid, ...structuredClone(defaults), key: entry.keys,
    comment: name, content, constant: entry.constant, disable: entry.disable,
    order: entry.order, displayIndex,
  };
  sourceEvidence.push({
    id: entry.id, name, source: entry.source,
    sourceSha256: createHash('sha256').update(raw).digest('hex'),
    contentCharacters: content.length,
  });
}

const serialized = `${JSON.stringify(worldbook, null, 2)}\n`;
assert.deepEqual(JSON.parse(serialized), worldbook);
const outputPath = localPath(config.output);
if (mode === '--check') {
  assert.equal(fs.readFileSync(outputPath, 'utf8'), serialized, 'Artifact differs from source/config; rebuild');
} else if (mode === '--build') {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, 'utf8');
  assert.equal(fs.readFileSync(outputPath, 'utf8'), serialized);
}
console.log(JSON.stringify({
  mode, output: outputPath, entryCount,
  enabled: Object.values(worldbook.entries).filter(e => !e.disable).map(e => e.comment),
  disabled: Object.values(worldbook.entries).filter(e => e.disable).map(e => e.comment),
  bytes: Buffer.byteLength(serialized),
  sha256: createHash('sha256').update(serialized).digest('hex'),
  sourceEvidence,
  runtimeImportVerified: false,
}, null, 2));
