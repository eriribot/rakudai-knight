// Uses the UI-exported card as a packaging template; no host state is read or written.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE, createSchema } from '../世界书规则/MVU/schema.mjs';
const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const YAML = require('yaml'), { z } = require('zod');
const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const json = file => JSON.parse(read(file));
const card = json('output/chapter-v4/runtime-original-card.json');
const worldbook = json('世界书规则/v0.3/导出/落第骑士英雄谭.json');
const releaseWorldbook = json('output/chapter-v4/runtime-original-worldbook.json');
const scripts = card.data.extensions.tavern_helper.scripts;
const replacements = [
  ['落第骑士·动态EJS与1~19卷剧情注入综合器 v2.0.0', 'scripts/tavern_helper_ejs_injector.json'],
  ['落第骑士·黑白ADV轮盘终端 v1.3.5', 'scripts/酒馆助手脚本-小手机-黑白ADV轮盘版-v1.3.6.json'],
  ['落第骑士·MVU v3 字段与第一卷约束', '世界书规则/MVU/落第骑士-MVU-v4字段约束.json'],
];
for (const [name, file] of replacements) {
  const matches = scripts.filter(script => script.name === name);
  assert.equal(matches.length, 1, '导出的运行时脚本不唯一：' + name);
  Object.assign(matches[0], json(file), { id: matches[0].id });
}
const opening = card.data.extensions.regex_scripts.filter(script => script.scriptName === '[开局]');
assert.equal(opening.length, 1);
opening[0].replaceString = '```\n' + read('第一卷-世界书整理/开局页面/index.html').trim() + '\n```';
for (const id of [3, 8, 10]) {
  const entry = card.data.character_book.entries.find(entry => entry.id === id), source = worldbook.entries[id];
  assert.ok(entry && source);
  entry.content = source.content; entry.enabled = !source.disable;
  entry.keys = source.key; entry.secondary_keys = source.keysecondary;
}
// 格式与业务更新规则分别携带，保留已有配置；UID 冲突时停止组装。
const outputFormatName = '[MVU]变量输出格式';
const outputFormatSources = Object.values(worldbook.entries).filter(entry => entry.comment === outputFormatName);
assert.equal(outputFormatSources.length, 1, '源世界书必须有唯一 MVU 变量输出格式条目');
const outputFormatSource = outputFormatSources[0];
assert.ok(Number.isInteger(outputFormatSource.uid) && outputFormatSource.uid >= 0, '输出格式 UID 无效');
const formatCardMatches = card.data.character_book.entries.filter(entry => entry.comment === outputFormatName);
const formatBookMatches = Object.values(releaseWorldbook.entries).filter(entry => entry.comment === outputFormatName);
assert.ok(formatCardMatches.length <= 1 && formatBookMatches.length <= 1, '实机导出中 MVU 输出格式条目重复');
if (formatCardMatches.length) assert.equal(formatCardMatches[0].id, outputFormatSource.uid, '卡片输出格式 UID 与源世界书不一致，请先确认映射');
if (formatBookMatches.length) assert.equal(formatBookMatches[0].uid, outputFormatSource.uid, '实机世界书输出格式 UID 与源世界书不一致，请先确认映射');
assert.ok(!card.data.character_book.entries.some(entry => entry.id === outputFormatSource.uid && entry.comment !== outputFormatName), '输出格式 UID 已被卡片其他条目占用');
assert.ok(!Object.values(releaseWorldbook.entries).some(entry => entry.uid === outputFormatSource.uid && entry.comment !== outputFormatName), '输出格式 UID 已被实机世界书其他条目占用');
const rawFormatTarget = releaseWorldbook.entries[outputFormatSource.uid];
assert.ok(!rawFormatTarget || rawFormatTarget.comment === outputFormatName, '输出格式索引已被实机世界书其他条目占用');
releaseWorldbook.entries[outputFormatSource.uid] = {
  ...structuredClone(rawFormatTarget ?? {}), ...structuredClone(outputFormatSource),
};
const formatCardEntry = formatCardMatches[0] ?? structuredClone(card.data.character_book.entries.find(entry => entry.id === 10));
assert.ok(formatCardEntry, '卡片缺少 MVU 更新规则配置模板');
formatCardEntry.extensions = { ...formatCardEntry.extensions };
const cardFields = { uid: 'id', key: 'keys', keysecondary: 'secondary_keys', comment: 'comment', content: 'content', constant: 'constant', selective: 'selective', order: 'insertion_order' };
const extensionFields = {
  displayIndex: 'display_index', excludeRecursion: 'exclude_recursion', preventRecursion: 'prevent_recursion',
  delayUntilRecursion: 'delay_until_recursion', selectiveLogic: 'selectiveLogic', outletName: 'outlet_name',
  groupOverride: 'group_override', groupWeight: 'group_weight', scanDepth: 'scan_depth',
  matchWholeWords: 'match_whole_words', useGroupScoring: 'use_group_scoring', caseSensitive: 'case_sensitive',
  automationId: 'automation_id', ignoreBudget: 'ignore_budget',
  matchPersonaDescription: 'match_persona_description', matchCharacterDescription: 'match_character_description',
  matchCharacterPersonality: 'match_character_personality', matchCharacterDepthPrompt: 'match_character_depth_prompt',
  matchScenario: 'match_scenario', matchCreatorNotes: 'match_creator_notes',
};
for (const [key, value] of Object.entries(outputFormatSource)) {
  if (Object.hasOwn(cardFields, key)) formatCardEntry[cardFields[key]] = structuredClone(value);
  else if (key === 'disable') formatCardEntry.enabled = !value;
  else if (key === 'position') {
    formatCardEntry.position = value === 0 ? 'before_char' : 'after_char';
    formatCardEntry.extensions.position = value;
  } else if (key === 'extensions') {
    Object.assign(formatCardEntry.extensions, structuredClone(value));
  } else {
    // 未知来源配置也保留在扩展字段中，避免格式条目在组装时丢失设置。
    formatCardEntry.extensions[extensionFields[key] ?? key] = structuredClone(value);
  }
}
if (!formatCardMatches.length) card.data.character_book.entries.push(formatCardEntry);
// 只启用一份输出格式，避免旧G02条目与新规则一起注入。
for (const entry of card.data.character_book.entries) if (entry.comment === '[MVU]变量更新格式') entry.enabled = false;
// 剧情正文与完成标识以实机原卡为准，不用本地 MD / 候选摘要覆盖。
// 仅停用旧条目的自动触发，保留关键词与其他元数据。
// 后续由剧情注入器按卷章读取对应条目。
for (const id of [13, 15]) {
  const entry = card.data.character_book.entries.find(entry => entry.id === id);
  assert.ok(entry, '实机原卡缺少剧情条目 ' + id);
  entry.enabled = false;
}
// Author sources already differ from the user's imported character prose.
// Preserve that live prose and its keyword metadata; only correct its EJS API.
const ikki = card.data.character_book.entries.find(entry => entry.id === 9);
const oldCondition = "<% if ((typeof stat_data !== 'undefined' && stat_data?.系统?.主角模式 === '黑铁一辉') || (typeof locals !== 'undefined' && locals?.stat_data?.系统?.主角模式 === '黑铁一辉')) { %>";
assert.equal(ikki.content.split(oldCondition).length, 2, '原卡一辉模式条件必须唯一');
ikki.content = ikki.content.replace(oldCondition, "<% if (getvar('stat_data.系统.主角模式') === '黑铁一辉') { %>");
// 本局觉醒可偏离原著卷数，只替换已确认冲突句，不重铺人物正文。
for (const [id, oldText, newText] of [
  [
    9,
    "- 战斗限制：原生魔力总量严格锁死为常人十分之一（10 MP 级），严禁外放魔力法术，完全依赖纯粹剑术与一分钟爆发绝技“一刀修罗”克敌。第一卷尚未掌握“一刀罗刹”或跨入“魔人”境界。",
    "<% if (getvar('stat_data.玩家.魔人觉醒') === true) { %>\n- 当前成长：本局已确认魔人觉醒，原著初始的先天魔力量限制不再阻止后续成长；只按当前能力记录与实际成果演绎，不自动赠送招式或等级。\n<% } else { %>\n- 初始限制：未觉醒时原生魔力约为常人十分之一，不能换算为固定10 MP；主要依赖剑术与“一刀修罗”。本局明确觉醒后以魔人觉醒:true切换，不用原著卷数否认本局变化。\n<% } %>\n- 能力事实：原著第一卷尚未掌握“一刀罗刹”；本局是否掌握以已确认的学习成果与能力记录为准，不凭后卷知识提前解锁。"
  ],
  [
    11,
    "- 第一卷中不得将其龙化干涉与魔人状态提前解锁。",
    "- 原著第一卷初始尚未解锁龙化干涉与魔人状态；不能凭后卷知识提前赋予，也不能用卷数否认本局实际确认的能力变化。"
  ],
  [
    12,
    "- 第一卷中黑乃主要作为学园高层与制度裁判出现，双枪、禁技与时间干涉能力仅为背景底牌；魔人觉醒与绝技〈三千世界〉发生在第十八卷第二章的大战绝境中，早期日常不可随意提前常驻使用。",
    "- 原著第一卷中黑乃主要作为学园高层与制度裁判出现，双枪、禁技与时间干涉能力为背景底牌；原著魔人觉醒与〈三千世界〉发生在第十八卷第二章。该时间仅作原著参照，不作为本局硬门槛；未在本局确认的能力不提前常驻，已确认的变化不按原著强行还原。"
  ]
]) {
  const entry = card.data.character_book.entries.find(item => item.id === id);
  assert.ok(entry, '缺少觉醒规则目标人物 ' + id);
  if (entry.content.includes(oldText)) entry.content = entry.content.replace(oldText, newText);
  else assert.ok(entry.content.includes(newText), '人物觉醒约束已变化，请核对 ' + id);
}
for (const entry of card.data.character_book.entries) {
  const target = releaseWorldbook.entries[entry.id];
  assert.ok(target, '实机世界书缺少条目 ' + entry.id);
  Object.assign(target, { content: entry.content, disable: !entry.enabled, key: entry.keys, keysecondary: entry.secondary_keys });
}
function nameCard(target, name) {
  target.name = target.data.name = name;
  target.data.character_version = '1.3.6';
  target.data.character_book.name = name;
  target.data.extensions.world = name;
  target.fav = target.data.extensions.fav = false;
}
nameCard(card, '落第骑士英雄谭 v1.3.6');
const fixture = structuredClone(card);
nameCard(fixture, '落第骑士·v1.3.6 验收副本');
fixture.first_mes = fixture.data.first_mes = '这是独立的卷章集成验收副本。合成测试档位于第一卷终章末，测试事件只用于检查保留行为。请通过终端进入下一卷。';
const state = structuredClone(INITIAL_STATE);
state.系统 = { 结构版本: 4, 主角模式: '自定义角色', 开局状态: '已建档' };
state.玩家.姓名 = '验收员';
state.场景 = { ...state.场景, 当前章: '终章', 阶段: '已结束', 时间: '测试日·上午', 地点: '测试训练场', 切入说明: '合成边界测试', 已发生事件: { 测试记录: { 卷号: 1, 章段: '序章', 结果: '这是一条合成验收记录，不代表原作或用户聊天事实。', 参与者: ['验收员'], 知情者: ['验收员'] } } };
createSchema(z).parse(state);
fixture.data.character_book.entries.find(entry => entry.id === 3).content = YAML.stringify(state, { lineWidth: 0 });
const marker = structuredClone(fixture.data.character_book.entries[0]);
Object.assign(marker, { id: 900, comment: '仅验收副本：真实EJS分支探针', constant: true, enabled: true, keys: [], content: '<% if (true) { %>RK_EJS_TRUE<% if (false) { %>RK_EJS_NESTED_BAD<% } else { %>RK_EJS_NESTED_OK<% } %><% } else { %>RK_EJS_FALSE_BAD<% } %>\n<% if (getvar("stat_data.系统.主角模式") === "黑铁一辉") { %>RK_EJS_IKKI<% } else { %>RK_EJS_CUSTOM<% } %>' });
fixture.data.character_book.entries.push(marker);
// Diagnostic observer is exclusive to the synthetic fixture, never the release card.
fixture.data.extensions.tavern_helper.scripts.push({
  ...json('scripts/tavern_helper_ejs_injector.json'),
  id: 'd03e83b4-5c8a-46a1-9e0c-1a2d46076336',
  name: '仅验收副本·发送请求只读探针',
  info: '只观察独立合成副本的实际本地发送参数与助手活动回复页；不触发生成，不改写变量。正式卡不包含本脚本。',
  content: read('scripts/chapter-runtime-probe.js'),
});
for (const [file, value] of [['output/chapter-v4/落第骑士英雄谭-v1.3.6.json', card], ['output/chapter-v4/验收副本-v1.3.6.json', fixture], ['output/chapter-v4/落第骑士英雄谭-v1.3.6-世界书.json', releaseWorldbook]]) fs.writeFileSync(new URL(file, root), JSON.stringify(value, null, 2) + '\n');
console.log('已从实机导出备份组装正式卡与独立合成验收副本；未修改酒馆。');
