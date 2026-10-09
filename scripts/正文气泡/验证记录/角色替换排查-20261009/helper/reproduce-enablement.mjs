/**
 * Neutral, offline source-level reproduction; never imports SillyTavern, accesses
 * a browser/profile, edits a card, or writes settings. Requires Node >= 22.13.
 * Executes the pinned upstream createScriptsStore implementation unchanged after
 * TypeScript erasure and import/export binding removal. Vue/Pinia/Lodash are small
 * synchronous test doubles: this verifies enablement predicates, not scheduling.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const base = path.dirname(fileURLToPath(import.meta.url));
const versions = [
  { version: '4.8.19', sha: '36d8889a99f1cf09d3d1f8aabd0eba33975dc64d', key: 'name' },
  { version: '4.10.0', sha: 'cd689ceae578282f35003c12be9752ff5386edd7', key: 'name' },
  { version: '4.11.0', sha: '360db45dff7e1c221ccc5e9d07d9445b179a1272', key: 'avatar' },
  { version: '4.11.3', sha: 'ed8b2360b32d9cfb96770d44e5c4ae45c2071a86', key: 'avatar' },
];
function lodash(items) {
  let result = items;
  const chain = {
    filter(predicate) { result = result.filter(predicate); return chain; },
    flatMap(predicate) { result = result.flatMap(predicate); return chain; },
    value() { return result; },
  };
  return chain;
}
lodash.pull = (items, value) => {
  for (let i = items.length - 1; i >= 0; i--) if (items[i] === value) items.splice(i, 1);
  return items;
};
function loadStore({ version, sha, key }) {
  const dir = path.join(base, `upstream-${sha}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version, version);
  const source = fs.readFileSync(path.join(dir, 'src/store/scripts.ts'), 'utf8');
  const runnable = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''));
  const character = {
    name: 'Neutral Card v0.07', avatar: 'neutral-fixed-avatar.png',
    settings: { scripts: [{ type: 'script', id: 'neutral-phone', enabled: true, content: '// neutral' }] },
  };
  const global = { settings: { script: { enabled: { characters: [character[key]], global: true, presets: [] }, scripts: [] } } };
  const context = {
    defineStore: (_id, setup) => setup,
    computed: spec => Object.defineProperty({}, 'value', {
      get: typeof spec === 'function' ? spec : spec.get,
      set: typeof spec === 'function' ? undefined : spec.set,
    }),
    ref: value => ({ value }),
    useCharacterSettingsStore: () => character,
    useGlobalSettingsStore: () => global,
    usePresetSettingsStore: () => ({ name: undefined, settings: { scripts: [] } }),
    isScript: item => item.type === 'script',
    _: lodash,
  };
  vm.createContext(context);
  const store = vm.runInContext(`${runnable}\nuseCharacterScriptsStore();`, context);
  return { character, global, store };
}

const cases = [];
for (const item of versions) {
  const { character, global, store } = loadStore(item);
  assert.equal(store.enabled.value, true);
  assert.equal(store.enabled_scripts.value.length, 1);
  const before = { containerEnabled: store.enabled.value, itemEnabled: character.settings.scripts[0].enabled, runningCandidates: store.enabled_scripts.value.length };
  // Core replacement keeps avatar, but new card payload changes data.name.
  // Model the already-refreshed character store; no host events are simulated.
  character.name = 'Neutral Card v0.08';
  const after = { containerEnabled: store.enabled.value, itemEnabled: character.settings.scripts[0].enabled, runningCandidates: store.enabled_scripts.value.length };
  assert.equal(after.containerEnabled, item.key === 'avatar');
  assert.equal(after.itemEnabled, true, 'The individual item switch did not change');
  assert.equal(after.runningCandidates, item.key === 'avatar' ? 1 : 0);
  cases.push({ test: 'rename-only replacement, same avatar', ...item, before, after, allowlist: [...global.settings.script.enabled.characters], pass: true });

  // A card payload can independently turn off the item, even with container on.
  store.enabled.value = true;
  character.settings.scripts = [{ type: 'script', id: 'neutral-phone', enabled: false, content: '// neutral' }];
  assert.equal(store.enabled.value, true);
  assert.equal(store.enabled_scripts.value.length, 0);
  cases.push({ test: 'incoming item disabled, container enabled', version: item.version, containerEnabled: store.enabled.value, itemEnabled: false, runningCandidates: 0, pass: true });
}
console.log(JSON.stringify({
  method: 'Pinned official scripts.ts executed in isolated Node VM; synchronous host stubs; no browser/card/user-settings access or writes.',
  limitation: 'Conditional source-level test only. Reporting player helper version and before/after switches are unknown; this does not establish their actual cause, prompt outcome, or native regex behavior.',
  cases,
}, null, 2));
