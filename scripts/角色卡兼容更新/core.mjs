import { Buffer } from 'node:buffer';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_SOURCE = Symbol('validated PNG source');
const CARD_KEYWORDS = new Set(['chara', 'ccv3']);
const SWITCH_POLICY = 'preserve-disabled; newer disabled defaults win';
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function fail(message) { throw new Error(message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function readJson(bytes, label) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail(`${label}: invalid UTF-8`); }
  let card;
  try { card = JSON.parse(text); }
  catch { fail(`${label}: invalid JSON`); }
  validateCard(card, label);
  return card;
}
function validateCard(card, label) {
  if (!object(card) || !object(card.data)) fail(`${label}: expected a card object with object data`);
}
function withoutEnvelope(card) {
  const { spec, spec_version, ...body } = card;
  return body;
}
function compatiblePayloads(chara, ccv3) {
  if (canonical(chara) === canonical(ccv3)) return true;
  // SillyTavern emits this official V2 compatibility / V3 effective pair.
  return chara.spec === 'chara_card_v2' && chara.spec_version === '2.0'
    && ccv3.spec === 'chara_card_v3' && ccv3.spec_version === '3.0'
    && canonical(withoutEnvelope(chara)) === canonical(withoutEnvelope(ccv3));
}
function decodeBase64(text, label) {
  if (!text || !/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 === 1
    || (text.includes('=') && text.length % 4 !== 0)) fail(`${label}: invalid base64`);
  const bytes = Buffer.from(text, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== text.replace(/=+$/, '')) fail(`${label}: invalid base64`);
  return bytes;
}

/** Decode data only. No card HTML, JavaScript, regex or prompt is evaluated. */
export function decodeCard(input, filename = '') {
  if (!(input instanceof Uint8Array)) fail('decodeCard: expected Uint8Array bytes');
  const bytes = Buffer.from(input);
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE);
  if (!isPng) {
    if (/\.png$/i.test(filename)) fail('PNG: invalid signature');
    return { card: readJson(bytes, 'JSON'), format: 'json', filename };
  }
  const chunks = [];
  const payloads = new Map();
  let position = 8;
  let dimensions;
  let sawIdat = false;
  let ended = false;
  while (position < bytes.length) {
    if (bytes.length - position < 12) fail('PNG: truncated chunk header');
    const length = bytes.readUInt32BE(position);
    if (length > 0x7fffffff || length > bytes.length - position - 12) fail('PNG: chunk length out of bounds');
    const type = bytes.toString('latin1', position + 4, position + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) fail('PNG: invalid chunk type');
    const end = position + length + 12;
    const data = bytes.subarray(position + 8, end - 4);
    if (crc32(bytes.subarray(position + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) fail(`PNG: invalid CRC in ${type}`);
    if (!chunks.length && type !== 'IHDR') fail('PNG: IHDR must be first');
    if (type === 'IHDR') {
      if (dimensions || length !== 13) fail('PNG: invalid or duplicate IHDR');
      const width = data.readUInt32BE(0), height = data.readUInt32BE(4);
      const bitDepth = data[8], colorType = data[9];
      if (!width || !height || width > 0x7fffffff || height > 0x7fffffff) fail('PNG: dimensions out of bounds');
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!depths[colorType]?.includes(bitDepth) || data[10] !== 0 || data[11] !== 0 || data[12] > 1) fail('PNG: unsupported IHDR fields');
      dimensions = { width, height, bitDepth, colorType };
    }
    if (type === 'IDAT') sawIdat = true;
    const chunk = { type, raw: bytes.subarray(position, end) };
    if (['tEXt', 'zTXt', 'iTXt'].includes(type)) {
      const zero = data.indexOf(0);
      if (zero < 1 || zero > 79) fail(`PNG: malformed ${type} keyword`);
      const keyword = data.toString('latin1', 0, zero);
      const normalizedKeyword = keyword.toLowerCase();
      if (CARD_KEYWORDS.has(normalizedKeyword)) {
        if (type !== 'tEXt') fail(`PNG: unsupported ${type} card payload ${keyword}`);
        if (payloads.has(normalizedKeyword)) fail(`PNG: duplicate ${normalizedKeyword} payload`);
        const card = readJson(decodeBase64(data.toString('latin1', zero + 1), `PNG ${keyword}`), `PNG ${keyword}`);
        payloads.set(normalizedKeyword, card);
        chunk.keyword = keyword;
        chunk.envelope = {};
        for (const key of ['spec', 'spec_version']) if (Object.hasOwn(card, key)) chunk.envelope[key] = card[key];
      }
    }
    chunks.push(chunk);
    position = end;
    if (type === 'IEND') {
      if (length !== 0 || position !== bytes.length) fail('PNG: invalid IEND or trailing bytes');
      ended = true;
      break;
    }
  }
  if (!ended || !sawIdat) fail('PNG: missing IEND or IDAT');
  if (!payloads.size) fail('PNG: missing chara/ccv3 card payload');
  if (payloads.has('chara') && payloads.has('ccv3') && !compatiblePayloads(payloads.get('chara'), payloads.get('ccv3'))) fail('PNG: conflicting chara/ccv3 payloads');
  const result = {
    card: payloads.get('ccv3') ?? payloads.get('chara'), format: 'png', filename,
    png: { ...dimensions, chunkCount: chunks.length, payloadKeywords: [...payloads.keys()] },
  };
  Object.defineProperty(result, PNG_SOURCE, { value: chunks });
  return result;
}

function textChunk(keyword, card) {
  const content = Buffer.from(JSON.stringify(card), 'utf8').toString('base64');
  const data = Buffer.from(`${keyword}\0${content}`, 'latin1');
  if (data.length > 0x7fffffff) fail('PNG: encoded card payload too large');
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  output.write('tEXt', 4, 'ascii');
  data.copy(output, 8);
  output.writeUInt32BE(crc32(output.subarray(4, -4)), output.length - 4);
  return output;
}

/** Use the new card's image container; all non-card chunks retain exact bytes. */
export function encodeCard(decodedNew, card) {
  validateCard(card, 'encodeCard');
  if (decodedNew?.format === 'json') return Buffer.from(`${JSON.stringify(card, null, 2)}\n`, 'utf8');
  if (decodedNew?.format !== 'png' || !decodedNew[PNG_SOURCE]) fail('encodeCard: expected a decodeCard result');
  const chunks = decodedNew[PNG_SOURCE].map(chunk => {
    if (!chunk.keyword) return chunk.raw;
    const wrapped = { ...card };
    for (const key of ['spec', 'spec_version']) {
      if (Object.hasOwn(chunk.envelope, key)) wrapped[key] = chunk.envelope[key];
      else delete wrapped[key];
    }
    return textChunk(chunk.keyword, wrapped);
  });
  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

function extensions(card, label) {
  const ex = card.data.extensions;
  if (ex === undefined) return {};
  if (!object(ex)) fail(`${label}: extensions must be an object`);
  return ex;
}
function regexEntries(card, label) {
  const value = extensions(card, label).regex_scripts;
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${label}: regex_scripts must be an array`);
  return value.map((entry, index) => {
    if (!object(entry) || typeof entry.disabled !== 'boolean') fail(`${label}: regex ${index} requires boolean disabled`);
    return { entry, id: entry.id, type: 'regex', path: `/data/extensions/regex_scripts/${index}` };
  });
}
function helperScripts(card, label) {
  const helper = extensions(card, label).tavern_helper;
  if (helper === undefined) return [];
  let scripts;
  if (Array.isArray(helper)) {
    const keys = new Set();
    for (const pair of helper) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') fail(`${label}: invalid tavern_helper key/value pair`);
      if (keys.has(pair[0])) fail(`${label}: duplicate tavern_helper key`);
      keys.add(pair[0]);
      if (pair[0] === 'folders') fail(`${label}: separate helper folders format is unsupported`);
      if (pair[0] === 'scripts') scripts = pair[1];
    }
  } else if (object(helper)) {
    if (Object.hasOwn(helper, 'folders')) fail(`${label}: separate helper folders format is unsupported`);
    scripts = helper.scripts;
  }
  else fail(`${label}: unsupported tavern_helper format`);
  // The old variables namespace is deliberately never read or copied.
  if (scripts === undefined) return [];
  if (!Array.isArray(scripts)) fail(`${label}: helper scripts must be an array`);
  const entries = [];
  function visit(list, parentEnabled, path) {
    for (const [index, entry] of list.entries()) {
      if (!object(entry) || !['script', 'folder'].includes(entry.type) || typeof entry.enabled !== 'boolean') fail(`${label}: helper requires script/folder type and boolean enabled`);
      if (Object.hasOwn(entry, 'children')) fail(`${label}: helper children format is unsupported`);
      const currentPath = `${path}/${index}`;
      const effectiveEnabled = parentEnabled && entry.enabled;
      entries.push({ entry, id: entry.id, type: entry.type, path: currentPath, effectiveEnabled });
      if (entry.type === 'folder') {
        if (!Array.isArray(entry.scripts)) fail(`${label}: folder scripts must be an array`);
        visit(entry.scripts, effectiveEnabled, `${currentPath}/scripts`);
      } else if (Object.hasOwn(entry, 'scripts')) fail(`${label}: script cannot contain nested scripts`);
    }
  }
  visit(scripts, true, '/data/extensions/tavern_helper/scripts');
  return entries;
}
function aliases(groups, label) {
  if (!Array.isArray(groups)) fail(`${label}: alias groups must be an array`);
  const byId = new Map();
  groups.forEach((group, index) => {
    if (!Array.isArray(group) || group.length < 2) fail(`${label}: alias group requires at least two IDs`);
    for (const id of group) {
      if (typeof id !== 'string' || !id.trim()) fail(`${label}: alias IDs must be nonempty strings`);
      if (byId.has(id)) fail(`${label}: duplicate or overlapping alias ID`);
      byId.set(id, index);
    }
  });
  return byId;
}
function indexEntries(entries, aliasMap, label) {
  const byId = new Map(), byAlias = new Map();
  for (const item of entries) {
    if (typeof item.id !== 'string' || !item.id.trim()) fail(`${label}: component requires nonempty stable ID`);
    if (byId.has(item.id)) fail(`${label}: duplicate component ID ${item.id}`);
    byId.set(item.id, item);
    if (aliasMap.has(item.id)) {
      const group = aliasMap.get(item.id);
      if (byAlias.has(group)) fail(`${label}: alias group matches more than one component`);
      byAlias.set(group, item);
    }
  }
  return { byId, byAlias };
}
function migrate(oldEntries, newEntries, aliasMap, kind, report) {
  const oldIndex = indexEntries(oldEntries, aliasMap, `old ${kind}`);
  indexEntries(newEntries, aliasMap, `new ${kind}`);
  const matchedOld = new Set();
  const summary = { matchedById: 0, matchedByAlias: 0, newUnmatched: [], oldUnmatched: [] };
  for (const target of newEntries) {
    let source = oldIndex.byId.get(target.id);
    let match = 'id';
    if (!source && aliasMap.has(target.id)) {
      source = oldIndex.byAlias.get(aliasMap.get(target.id));
      match = 'alias';
    }
    if (!source) {
      summary.newUnmatched.push({ id: target.id, type: target.type });
      continue;
    }
    if (source.type !== target.type) fail(`${kind}: matching ID changes type from ${source.type} to ${target.type}`);
    matchedOld.add(source.id);
    summary[match === 'id' ? 'matchedById' : 'matchedByAlias']++;
    const field = kind === 'regex' ? 'disabled' : 'enabled';
    const newDefault = target.entry[field];
    const oldEffective = kind === 'regex' ? source.entry.disabled : source.effectiveEnabled;
    const result = kind === 'regex' ? newDefault || oldEffective : newDefault && oldEffective;
    if (newDefault !== result) {
      target.entry[field] = result;
      report.switchChanges.push({ kind, type: target.type, id: target.id, oldId: source.id, match, field, newDefault, oldEffective, result });
    }
    if ((kind === 'regex' && newDefault && !oldEffective) || (kind === 'helper' && !newDefault && oldEffective)) {
      report.newerDisabledKept.push({ kind, type: target.type, id: target.id, oldId: source.id });
    }
  }
  for (const entry of oldEntries) if (!matchedOld.has(entry.id)) summary.oldUnmatched.push({ id: entry.id, type: entry.type });
  summary.newUnmatchedCount = summary.newUnmatched.length;
  summary.oldUnmatchedCount = summary.oldUnmatched.length;
  return summary;
}

/** New content wins; only identity, explicit version, and disabled states migrate. */
export function makeCompatibleCard(oldCard, newCard, { version, regexAliasGroups = [], helperAliasGroups = [] } = {}) {
  validateCard(oldCard, 'old card');
  validateCard(newCard, 'new card');
  if (typeof oldCard.data.name !== 'string' || !oldCard.data.name.trim()) fail('old card: data.name must be a nonempty string');
  if (typeof version !== 'string' || !version.trim()) fail('version must be an explicitly supplied nonempty string');
  const card = structuredClone(newCard);
  const report = {
    schemaVersion: 1, switchPolicy: SWITCH_POLICY,
    identity: { oldName: oldCard.data.name, newName: newCard.data.name ?? null, resultName: oldCard.data.name },
    version: { old: oldCard.data.character_version ?? null, new: newCard.data.character_version ?? null, result: version },
    switchChanges: [], newerDisabledKept: [],
  };
  const regexAliasMap = aliases(regexAliasGroups, 'regex');
  const helperAliasMap = aliases(helperAliasGroups, 'helper');
  report.regex = migrate(regexEntries(oldCard, 'old card'), regexEntries(card, 'new card'), regexAliasMap, 'regex', report);
  report.helper = migrate(helperScripts(oldCard, 'old card'), helperScripts(card, 'new card'), helperAliasMap, 'helper', report);
  card.data.name = oldCard.data.name;
  card.name = oldCard.data.name;
  card.data.character_version = version;
  return { card, report };
}
