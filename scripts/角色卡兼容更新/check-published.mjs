import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeCard, encodeCard, makeCompatibleCard } from './core.mjs';

const directory = process.argv[2];
assert.ok(directory, '传入旧版和新版发布PNG所在目录；只读检查，不生成发布卡。');
const sha = value => createHash('sha256').update(value).digest('hex');
const aliases = JSON.parse(fs.readFileSync(new URL('./known-components.json', import.meta.url), 'utf8'));
const options = { version: '0.08', regexAliasGroups: aliases.regexAliasGroups, helperAliasGroups: aliases.helperAliasGroups };
const versions = ['0.06', '0.07', '0.08'];
const inputs = versions.map(version => {
  const file = path.resolve(directory, '落第骑士英雄谭v' + version + '.png');
  const bytes = fs.readFileSync(file);
  return { version, file, hash: sha(bytes), decoded: decodeCard(bytes, file) };
});
const fresh = inputs[2].decoded;
const helper = card => {
  const value = card.data.extensions.tavern_helper;
  return Array.isArray(value) ? Object.fromEntries(value) : value;
};
function withoutMigratedFields(card) {
  const value = structuredClone(card);
  delete value.name;
  delete value.data.name;
  delete value.data.character_version;
  value.data.extensions.regex_scripts.forEach(rule => { delete rule.disabled; });
  const walk = nodes => nodes.forEach(node => { delete node.enabled; if (node.type === 'folder') walk(node.scripts); });
  walk(helper(value).scripts);
  return value;
}
// Independent PNG chunk walk, compare every non-card byte block (including CRC).
function nonCardChunks(bytes) {
  const data = Buffer.from(bytes), chunks = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset), type = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    const keyword = type === 'tEXt' ? body.subarray(0, body.indexOf(0)).toString('latin1').toLowerCase() : '';
    if (!['chara', 'ccv3'].includes(keyword)) chunks.push(sha(data.subarray(offset, offset + length + 12)));
    offset += length + 12;
  }
  return chunks;
}
const cases = [];
for (const input of inputs) {
  for (const closed of [false, true]) {
    const base = structuredClone(input.decoded.card);
    if (closed) {
      const phone = helper(base).scripts.find(item => /黑白ADV轮盘终端/.test(item.name));
      phone.enabled = false;
      base.data.extensions.regex_scripts.find(item => /^01 盾形对白/.test(item.scriptName)).disabled = true;
    }
    const result = makeCompatibleCard(base, fresh.card, options);
    assert.equal(result.card.data.name, base.data.name);
    assert.equal(result.card.name, base.data.name);
    assert.equal(result.card.data.character_version, '0.08');
    assert.deepEqual(withoutMigratedFields(result.card), withoutMigratedFields(fresh.card));
    assert.equal(helper(result.card).scripts.find(item => item.id === '7c1db4ff-9404-4504-94ad-e8df9aa5d70b').enabled, false);
    if (closed) {
      assert.equal(helper(result.card).scripts.find(item => item.id === '207dc896-ebda-4fca-ab4b-6c683f859536').enabled, false);
      assert.equal(result.card.data.extensions.regex_scripts.find(item => item.id === '339601a8-28af-42a2-9359-107ebe50bc73').disabled, true);
    }
    const encoded = encodeCard(fresh, result.card);
    assert.deepEqual(decodeCard(encoded, 'compatible.png').card, result.card);
    assert.deepEqual(nonCardChunks(encoded), nonCardChunks(fs.readFileSync(inputs[2].file)));
    cases.push({ baseVersion: input.version, userDisabledPhoneAndBubble: closed, namePreserved: true,
      implementationAndWorldbookUnchanged: true, authorDisabledGuardStillDisabled: true, pngRoundtrip: true,
      imageChunksUnchanged: true, outputSha256: sha(encoded) });
  }
}
for (const input of inputs) assert.equal(sha(fs.readFileSync(input.file)), input.hash);
const report = { status: 'passed', cases, inputFilesUnchanged: true,
  boundary: '真实发布PNG只读；兼容输出仅在内存中检查。未生成或导入整卡，未修改用户许可/聊天。',
  hostAcceptance: 'pending' };
const out = new URL('./verification/published-cards.json', import.meta.url);
fs.mkdirSync(new URL('./verification/', import.meta.url), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
