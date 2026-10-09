// Runs extracted upstream functions in a VM with in-memory I/O stubs.
// Never connects to SillyTavern, modifies cards, or writes chat files.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = file => fs.readFileSync(path.join(here, 'installed', file), 'utf8');
const server = source('src/endpoints/characters.js');
const client = source('public/script.js');
const engine = source('public/scripts/extensions/regex/engine.js');
function extract(text, name) {
  const match = new RegExp('^(?:export )?(?:async )?function ' + name + '\\(', 'm').exec(text);
  assert.ok(match, name);
  const end = text.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  return text.slice(match.index, end + 2).replace(/^export /, '');
}
const lodash = {
  get: (obj, key) => key.split('.').reduce((value, segment) => value?.[segment], obj),
  set(obj, key, value) {
    const keys = key.split('.');
    const last = keys.pop();
    let cursor = obj;
    for (const segment of keys) cursor = cursor[segment] ??= {};
    cursor[last] = value;
  },
  unset(obj, key) {
    const keys = key.split('.');
    const last = keys.pop();
    const cursor = keys.reduce((value, segment) => value?.[segment], obj);
    if (cursor) delete cursor[last];
  },
  isUndefined: value => value === undefined,
  forEach: (obj, callback) => Object.entries(obj).forEach(([key, value]) => callback(value, key)),
};
const results = [];
async function run(label, extensions, expectedCount, expectedDisabled) {
  const incoming = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Version Two', ...(extensions === undefined ? {} : { extensions }) } };
  const old = { avatar: 'Original.png', name: 'Version One', chat: 'existing-chat', data: { extensions: { regex_scripts: [{ id: 'local-only', disabled: false }], local_phone: { enabled: true } } } };
  let written;
  const io = [];
  const context = vm.createContext({
    path, _: lodash, console: { info() {}, warn() {} },
    fs: {
      readFileSync(file) { assert.equal(file, 'neutral-upload'); io.push('read-upload'); return JSON.stringify(incoming); },
      unlinkSync(file) { assert.equal(file, 'neutral-upload'); io.push('unlink-upload-stub-only'); },
    },
    sanitize: value => value,
    importRisuSprites() {},
    humanizedDateTime: () => 'neutral-date',
    DEFAULT_AVATAR_PATH: 'neutral-default',
    getPngName() { throw new Error('Replacement must use the preserved filename'); },
    async writeCharacterData(input, data, name) { written = { input, data: JSON.parse(data), name }; return true; },
    extension_settings: { character_allowed_regex: ['Original.png'] },
    characters: [old], this_chid: 0,
    SCRIPT_TYPE_UNKNOWN: 'unknown', SCRIPT_TYPES: { GLOBAL: 'global', SCOPED: 'scoped', PRESET: 'preset' },
    DEFAULT_GET_REGEX_SCRIPTS_OPTIONS: { allowedOnly: false },
  });
  vm.runInContext([
    ...['unsetPrivateFields', 'readFromV2', 'getPreservedName', 'importFromJson'].map(name => extract(server, name)),
    ...['isScopedScriptsAllowed', 'getScriptsByType'].map(name => extract(engine, name)),
  ].join('\n'), context);
  const request = { body: { preserved_name: old.avatar }, user: { directories: {} } };
  const preserved = context.getPreservedName(request);
  assert.equal(await context.importFromJson('neutral-upload', { request }, preserved), 'Original');
  context.characters[0] = { ...written.data, avatar: written.name + '.png' };
  const allowed = context.isScopedScriptsAllowed(context.characters[0]);
  const scripts = context.getScriptsByType('scoped', { allowedOnly: true });
  assert.equal(allowed, true);
  assert.equal(scripts.length, expectedCount);
  assert.equal(written.data.data.extensions.local_phone, undefined);
  if (expectedDisabled !== undefined) assert.equal(scripts[0].disabled, expectedDisabled);
  assert.ok(!scripts.some(item => item.id === 'local-only'));
  context.characters[0].avatar = 'Different.png';
  assert.equal(context.isScopedScriptsAllowed(context.characters[0]), false);
  results.push({ label, targetAvatar: written.name + '.png', incomingName: written.data.name, allowedWithPreservedAvatar: allowed, admittedRules: scripts.length, disabled: scripts[0]?.disabled ?? null, localOnlyExtensionsMerged: false, io });
}
await run('incoming card omits extension fields', undefined, 0);
await run('incoming card supplies an empty regex array', { regex_scripts: [] }, 0);
await run('incoming card supplies a disabled regex', { regex_scripts: [{ id: 'incoming', disabled: true }] }, 1, true);
await run('incoming card supplies an enabled regex', { regex_scripts: [{ id: 'incoming', disabled: false }] }, 1, false);
const postReplace = client.match(/async function postReplace\(\) \{\s*await openCharacterChat\(currentChatFile\);\s*\}/)?.[0];
assert.ok(postReplace);
let reopened;
const chatContext = vm.createContext({ currentChatFile: 'existing-chat', openCharacterChat: async file => { reopened = file; } });
vm.runInContext(postReplace, chatContext);
await chatContext.postReplace();
assert.equal(reopened, 'existing-chat');
console.log(JSON.stringify({ sourceCommit: '8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8', mode: 'extracted-source-with-in-memory-stubs', actualServerImportPerformed: false, cases: results, reopenedChat: reopened, passed: true }, null, 2));
