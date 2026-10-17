import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { extractScripts } from './bundle.mjs';
import { readMappedScript } from './build-lime-story-component.mjs';
import { defaultBaseline, readAvatarData, inspectAvatarSlots, updateAvatarComponent } from './update-avatar-component.mjs';

const baseline = JSON.parse(fs.readFileSync(defaultBaseline, 'utf8'));
const originalBytes = JSON.stringify(baseline), data = readAvatarData();
const results = [];
function check(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const built = updateAvatarComponent(baseline, data);
const slots = inspectAvatarSlots(readMappedScript(built.artifact.content).body);

check('B1 current manifest refresh is deterministic and idempotent', () => {
  assert.equal(updateAvatarComponent(baseline, data).artifact.content, built.artifact.content);
  assert.equal(updateAvatarComponent(built.artifact, data).artifact.content, built.artifact.content);
  assert.equal(JSON.stringify(baseline), originalBytes);
});

check('Preserve disabled state, buttons, custom data, names, info and unknown metadata', () => {
  const custom = structuredClone(baseline);
  custom.enabled = false;
  custom.button = { enabled: false, buttons: [{ name: '保留按钮', visible: true }] };
  custom.data = { value: ['旧数据', 23] };
  custom.futureMetadata = { untouched: true };
  const actual = updateAvatarComponent(custom, data).artifact;
  for (const key of Object.keys(custom)) if (key !== 'content') assert.deepEqual(actual[key], custom[key]);
});

check('Reject wrong stable ID, non-avatar code changes and embedded source-map changes', () => {
  assert.throws(() => updateAvatarComponent({ ...baseline, id: 'wrong' }, data), /stable ID/);
  const codeChanged = { ...baseline, content: baseline.content.replace('const BUILD_VERSION = "1.3.29"', 'const BUILD_VERSION = "1.3.30"') };
  assert.notEqual(codeChanged.content, baseline.content);
  assert.throws(() => updateAvatarComponent(codeChanged, data), /non-avatar/);
  const mapped = readMappedScript(baseline.content);
  mapped.map.sourcesContent[0] += '\n// not an avatar update\n';
  const marker = '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,';
  const changedMap = mapped.body + marker + Buffer.from(JSON.stringify(mapped.map)).toString('base64') + mapped.trailer;
  assert.throws(() => updateAvatarComponent({ ...baseline, content: changedMap }, data), /non-avatar/);
});

check('All manifest names render the matching portrait in the actual embedded B1 page', () => {
  const realm = vm.createContext({ document: { getElementById: () => null, addEventListener() {} },
    addEventListener() {}, setTimeout, clearTimeout, console });
  realm.window = realm;
  vm.runInContext(extractScripts(slots.app.value)[0].content, realm);
  assert.deepEqual(JSON.parse(JSON.stringify(realm.RK_KNIGHT_AVATARS)), JSON.parse(JSON.stringify(data.catalog)));
  let tested = 0;
  for (const person of data.aliases) {
    for (const name of [person.name, ...person.aliases]) {
      const normalized = name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '');
      const id = data.catalog.byName[normalized];
      const avatar = realm.resolveKnightAvatar(name);
      assert.equal(avatar.src, data.catalog.entries[id].src, name);
      const images = [];
      function visit(node) {
        if (node.tagName === 'img') images.push(Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])));
        for (const child of node.childNodes || []) visit(child);
      }
      visit(parseFragment(realm.renderCompanionAvatar(name)));
      assert.equal(images[0]?.src, data.catalog.entries[id].src, name);
      tested++;
    }
  }
  assert.ok(tested >= 200);
  for (const id of ['lunaseyes', 'astraea', 'sirius']) {
    assert.equal(data.catalog.entries[id].prepared, true);
    assert.equal(data.catalog.entries[id].src, `https://eriribot.github.io/rakudai-knight/resource/knightavatars/prepared/${id}.png`);
  }
});

check('LIME names and player reserved names contain every manifest alias, including the family', () => {
  assert.deepEqual(slots.aliases.value, data.aliases);
  assert.deepEqual(slots.reserved.value, data.reservedNames);
  for (const person of data.aliases) for (const name of [person.name, ...person.aliases]) {
    assert.ok(slots.reserved.value.includes(name), name);
  }
});

check('Quoted HTML, newlines and Unicode separators stay data across nested HTML and JS', () => {
  const special = structuredClone(data);
  const name = '测试"</script><script>alert(1)</script>\n\u2028\u2029&';
  special.aliases.push({ name, aliases: [name] });
  special.reservedNames.push(name);
  special.catalog.byName[name] = 'ikki';
  const actual = updateAvatarComponent(baseline, special);
  const output = inspectAvatarSlots(readMappedScript(actual.artifact.content).body);
  assert.equal(output.aliases.value.at(-1).name, name);
  assert.equal(output.reserved.value.at(-1), name);
  assert.equal(output.catalog.value.byName[name], 'ikki');
  assert.equal(extractScripts(output.app.value).length, extractScripts(slots.app.value).length);
});

console.log(JSON.stringify({ passed: results.filter(result => result.passed).length,
  total: results.length, results, runtimeAcceptance: 'offline embedded-page VM only; real host import not run' }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
