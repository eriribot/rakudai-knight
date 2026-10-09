import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodeCard, encodeCard, makeCompatibleCard } from './core.mjs';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Independent, bitwise fixture CRC; no implementation helper is imported.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data = Buffer.alloc(0)) {
  const value = Buffer.from(data);
  const output = Buffer.alloc(value.length + 12);
  output.writeUInt32BE(value.length);
  output.write(type, 4, 'latin1');
  value.copy(output, 8);
  output.writeUInt32BE(crc32(output.subarray(4, -4)), output.length - 4);
  return output;
}
function ihdr(width = 1, height = 1) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0); data.writeUInt32BE(height, 4);
  data[8] = 8; data[9] = 6;
  return chunk('IHDR', data);
}
function payload(keyword, card) {
  return chunk('tEXt', Buffer.from(`${keyword}\0${Buffer.from(JSON.stringify(card), 'utf8').toString('base64')}`, 'latin1'));
}
function png(textChunks, { width = 1, height = 1 } = {}) {
  return Buffer.concat([
    signature, ihdr(width, height),
    chunk('tEXt', Buffer.from('Comment\0non-card metadata', 'latin1')),
    chunk('zTXt', Buffer.concat([Buffer.from('Notes\0\0', 'latin1'), deflateSync('preserve me')])),
    chunk('raNd', Buffer.from([1, 2, 3, 0, 255])),
    ...textChunks,
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND'),
  ]);
}
function chunks(bytes) {
  const result = [];
  for (let p = 8; p < bytes.length;) {
    const size = bytes.readUInt32BE(p);
    const raw = bytes.subarray(p, p + size + 12);
    const type = raw.toString('latin1', 4, 8);
    const data = raw.subarray(8, -4);
    const keyword = type === 'tEXt' ? data.toString('latin1', 0, data.indexOf(0)) : null;
    result.push({ raw, type, keyword, data });
    p += size + 12;
  }
  return result;
}
const regex = (id, disabled = false, extra = {}) => ({ id, scriptName: 'same display name', disabled, findRegex: '/new/g', replaceString: 'new replacement', ...extra });
const script = (id, enabled = true, extra = {}) => ({ id, type: 'script', name: 'same display name', enabled, content: 'NEW CODE', data: { revision: 'new' }, ...extra });
const folder = (id, enabled, scripts) => ({ id, type: 'folder', name: 'folder', enabled, scripts });
function card({ name = 'new name', regexes = [], scripts = [], variables = { revision: 'new' }, extra = {} } = {}) {
  return {
    spec: 'chara_card_v3', spec_version: '3.0', name,
    data: { name, character_version: '', description: 'NEW PRIVATE DESCRIPTION',
      extensions: { regex_scripts: regexes, tavern_helper: { scripts, variables }, unknown: { preserve: true } },
      character_book: { entries: [{ content: 'NEW WORLDBOOK', enabled: true }] }, ...extra },
    unknown: ['preserve', { value: 7 }],
  };
}
const update = (oldCard, newCard, options = {}) => makeCompatibleCard(oldCard, newCard, { version: '0.09', ...options });

test('JSON uses UTF-8 and only parses data; invalid inputs are rejected', () => {
  const input = card({ name: '旧名称・🌸' });
  input.data.description = 'throw new Error("must never run")';
  const bytes = Buffer.from(JSON.stringify(input), 'utf8');
  const decoded = decodeCard(bytes, 'card.json');
  assert.equal(decoded.format, 'json');
  assert.deepEqual(decoded.card, input);
  assert.deepEqual(decodeCard(encodeCard(decoded, input)).card, input);
  assert.throws(() => decodeCard(Buffer.from([0xc3, 0x28])), /UTF-8/);
  assert.throws(() => decodeCard(Buffer.from('{')), /JSON/);
  assert.throws(() => decodeCard(Buffer.from('[]')), /card object/);
  assert.throws(() => decodeCard(bytes, 'wrong.png'), /signature/);
  assert.throws(() => decodeCard('not bytes'), /Uint8Array/);
});

test('PNG round trip changes all card chunks, preserves every other byte and original input', () => {
  const initial = card();
  const original = png([payload('chara', initial), payload('ccv3', initial)]);
  const snapshot = Buffer.from(original);
  const decoded = decodeCard(original, 'card.png');
  const replacement = card({ name: '完整新内容' });
  replacement.data.description = 'updated';
  const encoded = encodeCard(decoded, replacement);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(decoded.card, initial);
  assert.deepEqual(decodeCard(encoded).card, replacement);
  const before = chunks(original), after = chunks(encoded);
  assert.equal(before.length, after.length);
  for (let index = 0; index < before.length; index++) {
    if (['chara', 'ccv3'].includes(before[index].keyword)) {
      const item = after[index];
      const decodedJson = JSON.parse(Buffer.from(item.data.subarray(item.data.indexOf(0) + 1).toString('ascii'), 'base64'));
      assert.deepEqual(decodedJson, replacement);
    } else assert.deepEqual(after[index].raw, before[index].raw);
  }
  assert.equal(decoded.png.width, 1);
  assert.equal(decoded.png.height, 1);
  assert.deepEqual(decoded.png.payloadKeywords, ['chara', 'ccv3']);
});

test('PNG accepts canonical key ordering and both single-payload formats', () => {
  const first = card(), second = { data: first.data, name: first.name, unknown: first.unknown, spec_version: '3.0', spec: 'chara_card_v3' };
  assert.deepEqual(decodeCard(png([payload('chara', first), payload('ccv3', second)])).card, second);
  for (const keyword of ['chara', 'ccv3']) {
    const parsed = decodeCard(png([payload(keyword, first)]));
    assert.deepEqual(decodeCard(encodeCard(parsed, second)).card, second);
  }
});

test('official V2/V3 dual envelope is accepted and retained on output', () => {
  const v3 = card(), v2 = { ...v3, spec: 'chara_card_v2', spec_version: '2.0' };
  const decoded = decodeCard(png([payload('ccv3', v3), payload('chara', v2)]));
  assert.equal(decoded.card.spec, 'chara_card_v3');
  const changed = structuredClone(v3); changed.data.name = 'changed'; changed.name = 'changed';
  const output = encodeCard(decoded, changed);
  for (const item of chunks(output).filter(c => ['chara', 'ccv3'].includes(c.keyword))) {
    const outputCard = JSON.parse(Buffer.from(item.data.subarray(item.data.indexOf(0) + 1).toString('ascii'), 'base64'));
    assert.equal(outputCard.spec, item.keyword === 'chara' ? 'chara_card_v2' : 'chara_card_v3');
    assert.equal(outputCard.spec_version, item.keyword === 'chara' ? '2.0' : '3.0');
    assert.deepEqual(outputCard.data, changed.data);
  }
  assert.deepEqual(decodeCard(output).card, changed);
});

test('card keywords are case insensitive for selection/duplicates and retain their spelling', () => {
  const v3 = card(), v2 = { ...v3, spec: 'chara_card_v2', spec_version: '2.0' };
  const decoded = decodeCard(png([payload('ChArA', v2), payload('CCV3', v3)]));
  assert.equal(decoded.card.spec, 'chara_card_v3');
  const updated = structuredClone(v3); updated.data.name = 'updated';
  const encoded = encodeCard(decoded, updated);
  assert.deepEqual(chunks(encoded).filter(x => ['ChArA', 'CCV3'].includes(x.keyword)).map(x => x.keyword), ['ChArA', 'CCV3']);
  assert.deepEqual(decodeCard(encoded).card, updated);
  for (const [lower, upper] of [['chara', 'ChArA'], ['ccv3', 'CCV3']]) {
    assert.throws(() => decodeCard(png([payload(lower, v3), payload(upper, v3)])), /duplicate/);
    assert.throws(() => decodeCard(png([chunk('zTXt', Buffer.from(`${upper}\0\0stuff`, 'latin1'))])), /unsupported/);
  }
});

test('conflicting content, illegal envelope differences and duplicate payloads fail closed', () => {
  const one = card(), two = card({ name: 'conflict' });
  assert.throws(() => decodeCard(png([payload('chara', one), payload('ccv3', two)])), /conflicting/);
  const v2 = { ...one, spec: 'chara_card_v2', spec_version: '2.0' };
  assert.throws(() => decodeCard(png([payload('chara', v2), payload('ccv3', two)])), /conflicting/);
  assert.throws(() => decodeCard(png([payload('chara', one), payload('ccv3', v2)])), /conflicting/);
  assert.throws(() => decodeCard(png([payload('chara', one), payload('chara', one)])), /duplicate/);
  assert.throws(() => decodeCard(png([])), /missing chara/);
});

test('PNG rejects CRC corruption, invalid chunk sizes, truncated/missing IEND and trailing bytes', () => {
  const valid = png([payload('chara', card())]);
  const badCrc = Buffer.from(valid); badCrc[29] ^= 1;
  assert.throws(() => decodeCard(badCrc), /CRC/);
  const badSize = Buffer.from(valid); badSize.writeUInt32BE(0xffffffff, 8);
  assert.throws(() => decodeCard(badSize), /bounds/);
  assert.throws(() => decodeCard(valid.subarray(0, -1)), /truncated|bounds/);
  assert.throws(() => decodeCard(valid.subarray(0, -12)), /missing IEND/);
  assert.throws(() => decodeCard(Buffer.concat([valid, Buffer.from([0])])), /trailing/);
  const invalidIend = Buffer.concat([valid.subarray(0, -12), chunk('IEND', Buffer.from([0]))]);
  assert.throws(() => decodeCard(invalidIend), /IEND/);
  assert.throws(() => decodeCard(png([payload('chara', card()), chunk('\u00c9HDR')])), /chunk type/);
});

test('PNG rejects invalid dimensions, IHDR order/duplication and absent IDAT', () => {
  for (const [width, height] of [[0, 1], [1, 0], [0x80000000, 1], [1, 0xffffffff]]) {
    assert.throws(() => decodeCard(png([payload('chara', card())], { width, height })), /dimensions/);
  }
  const valid = png([payload('chara', card())]);
  assert.throws(() => decodeCard(Buffer.concat([signature, chunk('tEXt', Buffer.from('a\0b')), valid.subarray(8)])), /IHDR/);
  assert.throws(() => decodeCard(Buffer.concat([signature, ihdr(), valid.subarray(8)])), /IHDR/);
  assert.throws(() => decodeCard(Buffer.concat([signature, ...chunks(valid).filter(x => x.type !== 'IDAT').map(x => x.raw)])), /IDAT/);
});

test('compressed or alternate card text carriers and malformed payload encoding are rejected', () => {
  for (const type of ['zTXt', 'iTXt']) {
    for (const keyword of ['chara', 'ccv3']) {
      assert.throws(() => decodeCard(png([chunk(type, Buffer.from(`${keyword}\0\0stuff`, 'latin1'))])), /unsupported/);
    }
  }
  for (const value of ['%%%', 'A', 'AB==', 'e30===']) {
    assert.throws(() => decodeCard(png([chunk('tEXt', Buffer.from(`chara\0${value}`))])), /base64/);
  }
  assert.throws(() => decodeCard(png([chunk('tEXt', Buffer.from('chara\0wy g='))])), /base64/);
  assert.throws(() => decodeCard(png([chunk('tEXt', Buffer.from(`chara\0${Buffer.from([0xff]).toString('base64')}`))])), /UTF-8/);
  assert.throws(() => encodeCard({ format: 'png' }, card()), /decodeCard/);
});

test('new content is authoritative; only old data.name, explicit version and disabled state carry', () => {
  const old = card({ name: 'identity', regexes: [regex('r', true, { findRegex: '/OLD/', replaceString: 'OLD PRIVATE REPLACE' })], scripts: [script('s', false, { content: 'OLD PRIVATE CODE', data: { old: true } })], variables: { old: true }, extra: { description: 'OLD PRIVATE DESCRIPTION', character_book: { entries: ['OLD PRIVATE WORLD'] } } });
  old.name = 'stale top mirror';
  const next = card({ regexes: [regex('r')], scripts: [script('s')] });
  const oldSnapshot = structuredClone(old), nextSnapshot = structuredClone(next);
  const { card: result, report } = update(old, next);
  const expected = structuredClone(next);
  expected.name = expected.data.name = 'identity'; expected.data.character_version = '0.09';
  expected.data.extensions.regex_scripts[0].disabled = true;
  expected.data.extensions.tavern_helper.scripts[0].enabled = false;
  assert.deepEqual(result, expected);
  assert.deepEqual(old, oldSnapshot); assert.deepEqual(next, nextSnapshot);
  assert.equal(report.switchPolicy, 'preserve-disabled; newer disabled defaults win');
  assert.equal(report.switchChanges.length, 2);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE|CODE|WORLDBOOK|revision|findRegex|replaceString/);
});

test('disabled state is monotonic for every old/new flag combination', () => {
  for (const oldEnabled of [false, true]) for (const newEnabled of [false, true]) {
    const { card: result } = update(card({ scripts: [script('s', oldEnabled)], regexes: [regex('r', !oldEnabled)] }), card({ scripts: [script('s', newEnabled)], regexes: [regex('r', !newEnabled)] }));
    assert.equal(result.data.extensions.tavern_helper.scripts[0].enabled, oldEnabled && newEnabled);
    assert.equal(result.data.extensions.regex_scripts[0].disabled, !oldEnabled || !newEnabled);
  }
});

test('newly disabled defaults remain disabled and are reported', () => {
  const { card: result, report } = update(card({ scripts: [script('s')], regexes: [regex('r')] }), card({ scripts: [script('s', false)], regexes: [regex('r', true)] }));
  assert.equal(result.data.extensions.tavern_helper.scripts[0].enabled, false);
  assert.equal(result.data.extensions.regex_scripts[0].disabled, true);
  assert.equal(report.switchChanges.length, 0);
  assert.equal(report.newerDisabledKept.length, 2);
});

test('same names are not identities; unknown components retain the new defaults', () => {
  const { card: result, report } = update(card({ regexes: [regex('old-r', true)], scripts: [script('old-s', false)] }), card({ regexes: [regex('new-r')], scripts: [script('new-s')] }));
  assert.equal(result.data.extensions.regex_scripts[0].disabled, false);
  assert.equal(result.data.extensions.tavern_helper.scripts[0].enabled, true);
  for (const kind of ['regex', 'helper']) {
    assert.equal(report[kind].newUnmatchedCount, 1);
    assert.equal(report[kind].oldUnmatchedCount, 1);
    assert.equal(report[kind].matchedById, 0);
  }
});

test('explicit aliases match changed IDs without migrating IDs or component bodies', () => {
  const { card: result, report } = update(card({ regexes: [regex('old-r', true)], scripts: [script('old-s', false)] }), card({ regexes: [regex('new-r')], scripts: [script('new-s')] }), { regexAliasGroups: [['old-r', 'new-r']], helperAliasGroups: [['old-s', 'new-s']] });
  assert.equal(result.data.extensions.regex_scripts[0].id, 'new-r');
  assert.equal(result.data.extensions.regex_scripts[0].disabled, true);
  assert.equal(result.data.extensions.tavern_helper.scripts[0].id, 'new-s');
  assert.equal(result.data.extensions.tavern_helper.scripts[0].enabled, false);
  assert.equal(report.regex.matchedByAlias, 1); assert.equal(report.helper.matchedByAlias, 1);
});

test('disabled ancestors remain effective after scripts and folders move', () => {
  const old = card({ scripts: [folder('outer', false, [folder('inner', true, [script('s')])])] });
  const next = card({ scripts: [script('s'), folder('inner', true, []), folder('outer', true, [])] });
  const { card: result, report } = update(old, next);
  assert.deepEqual(result.data.extensions.tavern_helper.scripts.map(s => s.enabled), [false, false, false]);
  assert.equal(report.switchChanges.length, 3);
});

test('aliases retain ancestor disable when a child is renamed/moved outside the folder', () => {
  const old = card({ scripts: [folder('f', false, [script('old-s')])] });
  const next = card({ scripts: [script('new-s')] });
  const { card: result } = update(old, next, { helperAliasGroups: [['old-s', 'new-s']] });
  assert.equal(result.data.extensions.tavern_helper.scripts[0].enabled, false);
});

test('new folder closure is not reopened and unknown child flags stay untouched', () => {
  const old = card({ scripts: [folder('f', true, [script('s')])] });
  const next = card({ scripts: [folder('f', false, [script('s'), script('unknown')])] });
  const { card: result } = update(old, next);
  const [f] = result.data.extensions.tavern_helper.scripts;
  assert.equal(f.enabled, false);
  assert.equal(f.scripts[0].enabled, true); assert.equal(f.scripts[1].enabled, true);
});

test('helper object and key/value array formats interoperate while preserving the new format', () => {
  for (const oldPairs of [false, true]) for (const newPairs of [false, true]) {
    const old = card({ scripts: [script('s', false)] }), next = card({ scripts: [script('s')] });
    if (oldPairs) old.data.extensions.tavern_helper = Object.entries(old.data.extensions.tavern_helper);
    if (newPairs) next.data.extensions.tavern_helper = Object.entries(next.data.extensions.tavern_helper);
    const { card: result } = update(old, next);
    const h = result.data.extensions.tavern_helper;
    assert.equal(Array.isArray(h), newPairs);
    assert.equal((newPairs ? h.find(p => p[0] === 'scripts')[1] : h.scripts)[0].enabled, false);
    assert.deepEqual(newPairs ? h.find(p => p[0] === 'variables')[1] : h.variables, { revision: 'new' });
  }
});

test('old helper variables are not even read', () => {
  const old = card({ scripts: [script('s', false)] });
  Object.defineProperty(old.data.extensions.tavern_helper, 'variables', { get() { throw new Error('old variables read'); }, enumerable: true });
  assert.equal(update(old, card({ scripts: [script('s')] })).card.data.extensions.tavern_helper.scripts[0].enabled, false);
  const pairs = [['scripts', [script('s', false)]], ['variables', null]];
  Object.defineProperty(pairs[1], 1, { get() { throw new Error('old variables read'); } });
  old.data.extensions.tavern_helper = pairs;
  assert.doesNotThrow(() => update(old, card()));
});

test('duplicate component IDs are rejected in either card, including nested helpers', () => {
  for (const side of ['old', 'new']) {
    const other = card();
    const badRegex = card({ regexes: [regex('r'), regex('r')] });
    const badHelper = card({ scripts: [script('s'), folder('f', true, [script('s')])] });
    for (const bad of [badRegex, badHelper]) assert.throws(() => update(side === 'old' ? bad : other, side === 'new' ? bad : other), /duplicate component ID/);
  }
});

test('helper matching identities cannot change script/folder type, directly or through aliases', () => {
  assert.throws(() => update(card({ scripts: [script('s')] }), card({ scripts: [folder('s', true, [])] })), /changes type/);
  assert.throws(() => update(card({ scripts: [folder('old', true, [])] }), card({ scripts: [script('new')] }), { helperAliasGroups: [['old', 'new']] }), /changes type/);
});

test('ambiguous and overlapping aliases are rejected before choosing a component', () => {
  for (const option of ['regexAliasGroups', 'helperAliasGroups']) {
    for (const groups of [[['a', 'a']], [['a', 'b'], ['b', 'c']], [['a']], [['', 'b']], 'invalid']) {
      assert.throws(() => update(card(), card(), { [option]: groups }), /alias/);
    }
  }
  for (const side of ['old', 'new']) {
    const bad = card({ regexes: [regex('a'), regex('b')], scripts: [script('x'), script('y')] });
    const other = card();
    const pair = side === 'old' ? [bad, other] : [other, bad];
    assert.throws(() => update(...pair, { regexAliasGroups: [['a', 'b']] }), /more than one/);
    assert.throws(() => update(...pair, { helperAliasGroups: [['x', 'y']] }), /more than one/);
  }
});

test('missing namespaces remain absent, but ambiguous schemas and switch types fail closed', () => {
  const old = { data: { name: 'old' } }, next = { data: { name: 'new', unknown: [1] } };
  const { card: result } = update(old, next);
  assert.deepEqual(result, { name: 'old', data: { name: 'old', unknown: [1], character_version: '0.09' } });
  const invalid = [
    card({ scripts: [script('s', 'false')] }), card({ regexes: [regex('r', 'false')] }),
    card({ scripts: [{ id: 'f', type: 'folder', enabled: false, children: [] }] }),
    card({ scripts: [{ id: 's', type: 'script', enabled: true, scripts: [] }] }),
    card({ scripts: [script('')] }), card({ regexes: [regex('')] }),
  ];
  for (const bad of invalid) assert.throws(() => update(card(), bad));
  const duplicateKeys = card(); duplicateKeys.data.extensions.tavern_helper = [['scripts', []], ['scripts', []]];
  assert.throws(() => update(duplicateKeys, card()), /duplicate tavern_helper key/);
  for (const separate of [{ scripts: [], folders: [] }, [['scripts', []], ['folders', []]]]) {
    const bad = card(); bad.data.extensions.tavern_helper = separate;
    assert.throws(() => update(bad, card()), /separate helper folders/);
  }
});

test('version must be explicit; filenames and old version fields do not provide defaults', () => {
  for (const version of [undefined, null, '', '  ', 0.09]) assert.throws(() => makeCompatibleCard(card(), card(), { version }), /version/);
  assert.throws(() => makeCompatibleCard(card(), card()), /version/);
  const old = card({ extra: { character_version: 'old' } });
  assert.equal(update(old, card(), { version: 'explicit-release' }).card.data.character_version, 'explicit-release');
});

test('old identity must be usable but valid surrounding whitespace is preserved verbatim', () => {
  for (const name of ['', '  ', '\n\t', null, 123]) assert.throws(() => update(card({ name }), card()), /name.*nonempty/);
  const name = '  保持真实旧名  ';
  const { card: result } = update(card({ name }), card());
  assert.equal(result.name, name); assert.equal(result.data.name, name);
});
