import fs from 'node:fs';
import { createRequire } from 'node:module';
import { buildDualMvuWorldbookUpdate, createDualWorldbookPlan } from '../../scripts/build-dual-mvu-worldbook-update.mjs';

const require = createRequire(import.meta.url);
const ejs = require('../worldbook-calibration/dev/node_modules/ejs');
// 用户本轮粘贴的 ORIGINAL 标记内原文。这里只生成单条正文与离线预览，不生成世界书或整卡。
const original = `<世界设定>
## 世界观总览: 灵魂武装与魔导骑士的世界
      -时代背景:现代社会,存在着千人中仅一人的特异能力者，古时他们被称为“魔法师”或“魔女”，而今被称为——〈伐刀者（Blazer）〉。现今国家的安全防卫与国际话语权，皆建立在伐刀者的战力之上。
      -世界观核心规则:1.【灵魂具现】:伐刀者能将自身灵魂具象化显现为武器-〈固有灵装（Device）〉,运用魔力施展伐刀能力，并将其发展为各具条件的伐刀技。2.【常规魔力锁死导致的社会意识形态】:普通人的魔力量自幼年测定后终生固定不可变。社会极度奉行“才能即一切、等级定终生”的偏见体制。3.【魔法骑士制度】:伐刀者必须在国际机关认可的专门学校(比如日本国内共有“国际魔法骑士联盟”正式承认的七所骑士学校[1.破军学园、2.贪狼学园、3.巨门学园、4.禄存学园、5.文曲学园、6.廉贞学园、7.武曲学园])毕业，获得执照成为正规“魔导骑士”，方可合法在社会中使用能力。
      - 骑士等级:1.A级骑士:百年难遇的天才，国家王牌。B级骑士:十年难遇的天才。C级骑士:大致上伐刀者菁英皆为此级，一届新生中有5名就算是倍受期待的一届了。D级骑士:一个年级的顶尖大多为此级。E级骑士:大部分的伐刀者皆是此级。F级骑士:百年难遇的劣才，甚至不被当作伐刀者。
</世界设定>`;
const { artifact, payload, sourceHashes } = buildDualMvuWorldbookUpdate();
const names = ['[MVU]变量列表', '[MVU]变量更新规则', '[MVU]变量输出格式', '[initvar]变量初始化', '世界设定'];
const book = { entries: Object.fromEntries(names.map((comment, uid) => [String(uid), { uid, comment, content: comment === '世界设定' ? original : '' }])) };
const content = createDualWorldbookPlan(book, payload).changes.find(row => row.comment === '世界设定').content;
const write = (name, value) => fs.writeFileSync(new URL(name, import.meta.url), value, 'utf8');
write('世界设定-可直接替换.txt', content);
const previews = [];
for (const world of ['rakudai', 'asterisk', null]) {
  const state = { 系统: { 结构版本: 4, 作品: world, 开局状态: world ? '已建档' : '待建档' }, 场景: {}, 玩家: {}, 人际: {} };
  const text = ejs.render(content, { getvar: path => path.split('.').reduce((value, key) => value?.[key], { stat_data: state }) }).trim() + '\n';
  const name = `预览-${world || '未建档'}.txt`;
  write(name, text);
  previews.push({ world, file: name, characters: text.length });
}
write('component-spec.json', JSON.stringify({ schemaVersion: 1, deliveryMode: 'component', kind: 'helper-script', items: [{ artifactName: 'dual-worldbook-updater', value: artifact }] }, null, 2) + '\n');
write('preview-validation.json', JSON.stringify({ source: '本轮用户提供的世界设定原文', sourceHashes, ejsVersion: ejs.VERSION, previews, liveImported: false, liveVerified: false }, null, 2) + '\n');
console.log(JSON.stringify({ previews, ejsVersion: ejs.VERSION, liveImported: false }, null, 2));
