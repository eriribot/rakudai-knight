import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { TOURNAMENT_CANON } from '../scripts/rakudai-tournament-background.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../resource/knightavatars');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(directory, 'data.js'), 'utf8'), context);
const players = context.window.TOURNAMENT_DATA.players;
const normalize = name => name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '');
const names = new Set([...TOURNAMENT_CANON, ...Object.values(players).map(p => p.name)].map(normalize));
const byName = {}, byId = {};
for (const character of manifest.characters) {
  const aliases = [character.name, ...character.aliases];
  if (!aliases.some(name => names.has(normalize(name)))) continue;
  const source = path.join(root, character.displayFile || character.file);
  const target = 'assets/' + character.id + path.extname(source);
  fs.copyFileSync(source, path.join(directory, target));
  for (const name of aliases) byName[normalize(name)] = target;
}
for (const [id, player] of Object.entries(players)) {
  if (byName[normalize(player.name)]) byId[id] = byName[normalize(player.name)];
}
fs.writeFileSync(path.join(directory, 'portraits.js'), '// 来自终端共用 knightavatars 清单；本地素材与姓名别名同步。\n' +
  'window.TOURNAMENT_PORTRAITS = ' + JSON.stringify(byId, null, 2) + ';\n' +
  'window.TOURNAMENT_ROLE_PORTRAITS = ' + JSON.stringify(byName, null, 2) + ';\n');
console.log('已同步选拔与全国赛人物头像。');
