import fs from 'node:fs';
import assert from 'node:assert/strict';

const dir = 'output/asterisk-avatar-audit-20261116';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const groups = ['group-a/group-a.json', 'group-b/group-b.json', 'group-c.json', 'root-guan.json', 'root-extra.json'];
const additions = groups.flatMap(file => {
  const data = read(`${dir}/${file}`);
  return Array.isArray(data) ? data : data.characters;
});
assert.equal(additions.length, 20);
assert.equal(new Set(additions.map(item => item.id)).size, 20);
const manifestFile = 'scripts/正文气泡/asterisk-portraits.json';
const manifest = read(manifestFile);
const before = read(`${dir}/before/asterisk-portraits.json`);
assert.deepEqual(manifest.characters.slice(0, 23), before.characters);
const ids = new Set(additions.map(item => item.id));
assert.ok(manifest.characters.slice(23).every(item => ids.has(item.id)));
const fields = ['id', 'name', 'aliases', 'portraitCrop', 'file', 'imageUrl', 'width', 'height', 'sourcePage', 'sourceUrl', 'sha256'];
const extraAliases = {song: ['宋'], luo: ['罗', '羅']};
const clean = item => ({...item, aliases: [...new Set([...item.aliases, ...(extraAliases[item.id] || [])])].filter(name => name !== item.name)});
manifest.characters = [...before.characters, ...additions.map(clean).map(item => Object.fromEntries(fields.map(key => [key, item[key]])))];
write(manifestFile, manifest);

const sourcesFile = 'resource/asteriskavatars/sources.json';
const sources = read(sourcesFile);
sources.updatedOn = '2026-11-16';
sources.characters = [...sources.characters.filter(item => !ids.has(item.id)), ...additions.map(clean).map(item => ({
  ...item,
  kind: ['anime-frame', 'anime-screenshot'].includes(item.kind) ? '动画正片截图（分集评论转载）' : item.kind.startsWith('official-anime-expression') ? '动画官网角色表情设定图' : item.kind,
  checkedOn: '2026-11-16',
  visualVerified: true,
}))];
write(sourcesFile, sources);
write(`${dir}/added.json`, additions.map(clean));
console.log(`已接入 ${additions.length} 人；学战头像共 ${manifest.characters.length} 人。`);
