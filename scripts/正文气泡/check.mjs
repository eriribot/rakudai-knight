import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildRules, applyRules, reports } from './build.mjs';

// This checks declared card-regex fields and JavaScript string replacement only.
// Markdown, installed host versions, extension ordering and actual prompt assembly
// still require acceptance in the user's SillyTavern instance.
const manifest = JSON.parse(fs.readFileSync(new URL('../../resource/knightavatars/manifest.json', import.meta.url), 'utf8'));
const rules = buildRules();
const results = [];
const measurements = [];
const owners = new Map();
for (const character of manifest.characters) {
  for (const name of new Set([character.name, ...(character.aliases ?? [])])) {
    if (!owners.has(name)) owners.set(name, new Set());
    owners.get(name).add(character.id);
  }
}
const names = [...owners].filter(([name, ids]) => ids.size === 1 && name !== '艾莉丝').map(([name]) => name);
const ambiguousNames = [...owners].filter(([, ids]) => ids.size > 1).map(([name]) => name);
const bubbleOpenings = value => [...value.matchAll(/<div\b[^>]*\bdata-rkd="bubble"[^>]*>/g)].map(match => match[0]);
const bubbleCount = value => bubbleOpenings(value).length;
const candidateCount = value => [...value.matchAll(/<span data-rkd="candidate" /g)].length;
const styleCount = value => [...value.matchAll(/<style>\/\* rkd-dialogue-style:/gi)].length;
function inertText(value) {
  return value.replace(/^<style>\/\* rkd-dialogue-style:[\s\S]*?<\/style>\n\n/, '')
    .replace(/<span data-rkd="candidate" data-rkd-name="[^"]+"><span data-rkd-source>([^<>&]*)<\/span><\/span>/g, '$1');
}
function check(name, run) {
  try {
    run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}
function unchanged(input, context, allowCandidate = false) {
  const output = applyRules(input, rules, context);
  assert.equal(bubbleCount(output), 0, '未确认身份不得生成气泡');
  if (allowCandidate) assert.equal(inertText(output), input, '候选可逐字还原原行，不能猜身份');
  else assert.equal(output, input, '保护区和非目标输入必须逐字保留，也不能单独注入样式');
}
function rendered(input, expectedBubbles = 1, context) {
  const output = applyRules(input, rules, context);
  assert.equal(bubbleCount(output), expectedBubbles, '气泡数量');
  assert.equal(styleCount(output), expectedBubbles ? 1 : 0, '每消息样式至多一份');
  return output;
}

check('规则结构：恰好三条，既有 ID 保持、候选在样式前、AI 显示侧', () => {
  assert.ok(Array.isArray(rules));
  assert.equal(rules.length, 3);
  assert.equal(new Set(rules.map(rule => rule.id)).size, 3);
  assert.equal(rules[0].id, 'cf3083f8-42e4-4e2e-8e70-a65817a2c881');
  assert.equal(rules[1].id, 'bea21af8-9a41-4b0c-9009-1811e54bb8e4');
  assert.equal(rules[2].id, 'cf3083f8-42e4-4e2e-8e70-a65817a2c882');
  assert.equal(rules[0].substituteRegex, 2, '对白规则仅对查找模式做转义宏替换');
  assert.equal(rules[1].substituteRegex, 0, '候选规则不执行查找宏替换');
  assert.equal(rules[2].substituteRegex, 0, '样式规则不执行查找宏替换');
  for (const rule of rules) {
    assert.equal(typeof rule.id, 'string');
    assert.ok(rule.id.length > 0);
    assert.equal(typeof rule.scriptName, 'string');
    assert.ok(rule.scriptName.length > 0);
    assert.equal(typeof rule.findRegex, 'string');
    assert.equal(typeof rule.replaceString, 'string');
    assert.deepEqual(rule.placement, [2]);
    assert.equal(rule.markdownOnly, true);
    assert.equal(rule.promptOnly, false);
    assert.equal(rule.runOnEdit, true);
    assert.equal(rule.disabled, false);
    assert.deepEqual(rule.trimStrings, []);
    assert.ok(rule.minDepth == null);
    assert.ok(rule.maxDepth == null);
    const literal = rule.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);
    assert.ok(literal, '输出必须为带 flags 的 JS 正则字面量');
    assert.doesNotThrow(() => new RegExp(literal[1], literal[2]));
  }
});

check('显式传入规则与默认规则行为一致', () => {
  assert.equal(applyRules('史黛菈:一起走吧。'), applyRules('史黛菈:一起走吧。', rules));
});
check('固定玩家标记不依赖 persona 全名，NPC 不携带非空玩家标记', () => {
  for (const name of ['玩家', 'player', 'PLAYER', 'user', 'OC', 'oc']) {
    const output = rendered(`${name}:这句话使用稳定玩家标记。`);
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-player="${name}"`));
    assert.equal(candidateCount(output), 0);
  }
  const npc = rendered('一辉:我是已知角色。');
  assert.ok(bubbleOpenings(npc)[0].includes('data-rkd-player=""'));
});
check('OC 全名、缺字和明确简称先保留为候选，不提前猜成玩家', () => {
  for (const name of ['清泉朝阳', '朝阳', '清泉', '清泉朝', '未登记同伴']) {
    const input = `  ${name} \t：\t 原文字句 $1、$$、引号“你好”。  `;
    const output = applyRules(input, rules, {user:'另一个 persona'});
    assert.equal(candidateCount(output), 1);
    assert.equal(bubbleCount(output), 0);
    assert.equal(styleCount(output), 1, '候选消息预置一次样式供稍后提升');
    assert.ok(output.includes(`data-rkd-name="${name}"`), '候选属性姓名剔除分隔符前空白');
    assert.ok(output.includes(`<span data-rkd-source>${input}</span>`));
    assert.equal(inertText(output), input);
    assert.equal(applyRules(output, rules, {user:'另一个 persona'}), output, '候选显示重绘幂等');
  }
});
check('OC 候选不含脚本、不注入头像地址，保留原文 CRLF 和 Unicode 行边界', () => {
  const input = '前文\r\n  朝阳:第一句。  \r\n清泉：第二句。\u2028陌生人:第三句。\u2029后文';
  const output = applyRules(input, rules);
  assert.equal(candidateCount(output), 3);
  assert.equal(inertText(output), input);
  assert.equal(styleCount(output), 1);
  assert.ok(!/<script\b|\bon\w+\s*=|javascript:/i.test(output));
  assert.ok(!rules[1].replaceString.includes('$&'), '宿主只展开编号及命名捕获，不使用 JS $&');
  assert.ok(!rules[1].replaceString.includes('src='));
});
check('OC 候选沿用思考、变量、属性及围栏边界，结束后可恢复', () => {
  for (const [open, close] of [['<acg_think>','</acg_think>'],['<UpdateVariable>','</UpdateVariable>'],
    ['<details><summary>剧情驱动</summary>','</details>'],['<!--','-->']]) {
    const block = `${open}\n朝阳:保护区中的文字。\n${close}`;
    unchanged(block);
    const output = applyRules(`${block}\n朝阳:正文的候选。`, rules);
    assert.equal(candidateCount(output), 1);
    assert.equal(inertText(output), `${block}\n朝阳:正文的候选。`);
  }
  for (const input of ['```text\n朝阳:代码。\n```', '~~~\n朝阳:代码。\n~~~',
    '<div title="quoted >\n朝阳:属性。\n">正文</div>', '朝阳:前文{{getvar::x}}后文',
    '朝阳:普通文字 <img src=x>', '朝阳:A & B', '朝阳:&lt;script&gt;']) unchanged(input);
});
check('用户原样双语复现：日文行保留，两个中文对白显示气泡', () => {
  const input = fs.readFileSync(new URL('../../output/dialogue-bubbles/user-reproduction.txt', import.meta.url), 'utf8');
  const output = rendered(input, 2);
  for (const line of input.split(/\r?\n/).filter(line => line.startsWith('☆‹'))) {
    assert.ok(output.includes(line), '日文原文不可删除或改写');
  }
  assert.deepEqual(bubbleOpenings(output).map(opening => opening.match(/data-rkd-name="([^"]+)"/)[1]),
    ['黑铁一辉', '史黛菈·法米利昂']);
});
check('当前玩家动态匹配，换名后旧名与其他未知人物不放行', () => {
  for (const user of ['清泉朝阳', '另一个玩家']) {
    const input = `${user}:这是当前玩家的对白。`;
    const output = rendered(input, 1, { user });
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-name="${user}"`));
    assert.ok(output.includes('这是当前玩家的对白。'));
    unchanged(input, { user: user === '清泉朝阳' ? '另一个玩家' : '清泉朝阳' }, true);
    unchanged('其他未知人物:不能借玩家分支显示。', { user }, true);
  }
});
check('玩家英文正则元字符与单引号按字面匹配，大小写沿用 i', () => {
  for (const user of ['A.[B](C)+D?^E$|F\\G/H', "O'Brien"]) {
    const output = rendered(`${user}:Literal player name.`, 1, { user });
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-name="${user}"`), '姓名不能被正则元字符或引号改写');
  }
  unchanged('AxB:点号不可当成通配符。', { user: 'A.B' }, true);
  unchanged('AB:括号不可变成捕获语法。', { user: 'A(B)' }, true);
  for (const spelling of ['ari player', 'ARI PLAYER', 'aRi pLaYeR']) {
    const output = rendered(`${spelling}:Case stays as written.`, 1, { user: 'Ari Player' });
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-name="${spelling}"`));
  }
});
check('空名、HTML、宏、冒号及换行玩家名不制造气泡或跨行捕获', () => {
  const invalidNames = ['', '清泉"朝阳', '清泉<朝阳', '清泉>朝阳', '清泉&朝阳',
    '清泉{朝阳}', '清泉{{user}}', '清泉:朝阳', '清泉：朝阳',
    '清泉\n朝阳', '清泉\r\n朝阳', '清泉\u2028朝阳', '清泉\u2029朝阳'];
  for (const user of invalidNames) {
    const input = `${user}:不安全姓名保持原文。`;
    const output = applyRules(input, rules, { user });
    assert.equal(inertText(output), input, `非法玩家名不能被截取：${JSON.stringify(user)}`);
    assert.equal(bubbleCount(output), 0, `非法玩家名不得产生破损气泡：${JSON.stringify(user)}`);
    unchanged('其他未知人物:不得由空名或坏名放行。', { user }, true);
  }
});
check('玩家与 NPC 混排共用一次样式，玩家分支保留台词安全边界', () => {
  const user = '清泉朝阳';
  const input = `${user}:我先说一句。\n史黛菈:我接着回答。\n未知同行:这句维持原文。\n${user}:再说一句。`;
  const output = rendered(input, 3, { user });
  assert.deepEqual(bubbleOpenings(output).map(opening => opening.match(/data-rkd-name="([^"]+)"/)[1]),
    [user, '史黛菈', user]);
  assert.ok(output.includes('未知同行:这句维持原文。'));
  for (const speech of ['<img src=x>', 'A & B', '{{user}}', '前文{{getvar::x}}后文']) {
    unchanged(`${user}:${speech}`, { user });
  }
});
check('动态玩家在保护区与 HTML 属性内不转换，闭合后正文恢复', () => {
  const user = '清泉朝阳';
  for (const block of [
    `<acg_think>\n${user}:思考分析。\n</acg_think>`,
    `<parallel_line_drive>\n${user}:驱动分析。\n</parallel_line_drive>`,
    `<UpdateVariable>\n${user}:变量内容。\n</UpdateVariable>`,
    `<details><summary>剧情驱动</summary>\n${user}:折叠分析。\n</details>`,
    `<div title="quoted >\n${user}:这是属性。\n">正文</div>`,
  ]) {
    unchanged(block, { user });
    const output = rendered(`${block}\n${user}:这是正文。\n一辉:这是 NPC。`, 2, { user });
    assert.ok(output.includes(block), '玩家分支不得改写保护块或属性');
  }
});

for (const name of names) {
  check(`头像清单唯一姓名/别名：${name}`, () => {
    const output = rendered(`${name}:测试对白。`);
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-name="${name}"`), '应保留输入姓名作为头像查询键');
    assert.ok(output.includes('测试对白。'));
  });
}
for (const name of new Set([...ambiguousNames, '艾莉丝'])) {
  check(`歧义别名保留原文：${name}`, () => unchanged(`${name}:这行不猜测身份。`, undefined, true));
}

check('中英文冒号兼容，台词内部冒号及引号原样', () => {
  const speech = '她说：“集合时间是 12:30。” 我回答:好。';
  for (const separator of [':', '：']) {
    const output = rendered(`史黛菈${separator}${speech}`);
    assert.ok(output.includes(speech));
  }
});
check('英文别名大小写保持输入文字，并能命中对白', () => {
  for (const name of ['ikki kurogane', 'IKKI KUROGANE', 'iKkI kUrOgAnE']) {
    const output = rendered(`${name}:Case stays as written.`);
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-name="${name}"`));
    assert.ok(output.includes('Case stays as written.'));
  }
});
check('JavaScript replacement 符号 $1、$$、$`、$\' 不二次求值', () => {
  const speech = '原样保留 $1、$2、$$、$`、$\'，不要插入别的内容。';
  assert.ok(rendered(`一辉:${speech}`).includes(speech));
});
check('连续对白逐行转换，首尾旁白保持原样', () => {
  const prefix = '窗外的风吹动了窗帘。\n\n';
  const suffix = '\n\n她把书轻轻合上。';
  const output = rendered(`${prefix}史黛菈:走吧。\n一辉:嗯。\n珠雫:等等我。${suffix}`, 3);
  assert.ok(output.includes(prefix));
  assert.ok(output.endsWith(suffix));
  for (const speech of ['走吧。', '嗯。', '等等我。']) assert.ok(output.includes(speech));
});
check('CRLF 不吞相邻行和末尾换行', () => {
  const input = '前置旁白\r\n史黛菈:第一句。\r\n一辉:第二句。\r\n后置旁白\r\n';
  const output = rendered(input, 2);
  assert.ok(output.includes('前置旁白\r\n'));
  assert.ok(output.endsWith('\r\n后置旁白\r\n'));
  const body = output.replace(/^<style>\/\* rkd-dialogue-style:[\s\S]*?<\/style>\n\n/, '');
  assert.equal(body.split('\r\n').length, input.split('\r\n').length, '排除独立样式后，正文原始 CRLF 数量应保留');
});
for (const indent of ['', ' ', '  ', '   ']) {
  check(`允许 ${indent.length} 个行首空格`, () => rendered(`${indent}一辉:这是对白。`));
}
for (const indent of ['    ', '     ', '\t', ' \t', '\t ']) {
  check(`代码缩进保留：${JSON.stringify(indent)}`, () => unchanged(`${indent}一辉:这是代码块内容。`));
}
check('缩进行与普通对白混排互不干扰', () => {
  const codeLine = '    一辉:不要转换这行。';
  const output = rendered(`一辉:前一句。\n${codeLine}\n史黛菈:后一句。`, 2);
  assert.ok(output.includes(`\n${codeLine}\n`));
});

const untouchedInputs = [
  '', '普通旁白，没有任何对白。', '未知人物:你好。', '史黛菈同学:你好。',
  '艾莉丝:你好。', '这是史黛菈:普通叙述。', '旁白提到 一辉:并非行首。',
  '> 一辉:引用内容。', '- 一辉:列表内容。', '1. 一辉:列表内容。',
  '一辉:', '一辉：', '一辉: ', '一辉:   ', '一辉:\t', '一辉: \t ',
  '一辉:\u3000', '一辉:\u00a0', '一辉:\v', '一辉:\f', '一辉: \u3000\u00a0\v\f ',
  '一辉:\n史黛菈:', '一辉\n:不跨行匹配。', '一辉:   \n普通旁白。',
];
for (const [index, input] of untouchedInputs.entries()) {
  check(`非目标行与空台词 ${index + 1}`, () => unchanged(input, undefined, true));
}

for (const fence of ['```', '~~~']) {
  for (const input of [
    `${fence}text\n一辉:代码内容。\n${fence}`,
    `史黛菈:围栏前的对白也保持原文。\n${fence}\n普通代码\n${fence}\n一辉:围栏后也保持原文。`,
    `一辉:正文中间有 ${fence} 标记。`,
  ]) {
    check(`消息含 ${fence} 时整条保留：${input.slice(0, 20)}`, () => unchanged(input));
  }
}

const protectedMarkers = [
  '<UpdateVariable>', '<update>', '<Analysis>', '<JSONPatch>', '<think>',
  '<thinking>', '<reasoning>', '<script>', '<style>', '<pre>', '<code>', '<textarea>',
  '<acg_think>', '<combat_driver>', '<story_driver>', '<parallel_line_drive>',
  '<memory_log>', '<wlog>', '<status>', '<affinity>', '<!--',
];
for (const marker of protectedMarkers) {
  for (const variant of new Set([marker, marker.toLowerCase(), marker.toUpperCase()])) {
    check(`尚未闭合的保护块不处理：${variant}`, () => {
      const tail = `${variant}\n一辉:这里是保护块正文。\n史黛菈:即使像对白也不要处理。`;
      unchanged(tail);
      const output = rendered(`珠雫:标记前对白。\n${tail}`);
      assert.ok(output.endsWith(tail), '首个保护标记到消息末尾必须逐字相同');
    });
  }
}
for (const marker of protectedMarkers) {
  check(`保护块闭合后恢复正文：${marker}`, () => {
    const closer = marker === '<!--' ? '-->' : marker.replace('<', '</');
    const block = `${marker}\n一辉:保护块里的文字。\n${closer}`;
    const output = rendered(`${block}\n史黛菈:已经回到正文。`);
    assert.ok(output.includes(`${block}\n`), '保护块须逐字保留');
    assert.ok(bubbleOpenings(output)[0].includes('data-rkd-name="史黛菈"'));
  });
}
for (const tag of ['content', 'story_scene', 'parallel_line', 'div']) {
  check(`正文封套 ${tag} 内部允许气泡`, () => {
    const output = rendered(`<${tag}>\n史黛菈:封套里的正文。\n一辉:第二句正文。\n</${tag}>`, 2);
    assert.ok(output.includes(`<${tag}>\n`));
    assert.ok(output.endsWith(`\n</${tag}>`));
  });
}
check('前置思考驱动、正文并行驱动及末尾状态块互不污染', () => {
  const prefix = '<acg_think>\n一辉:这里是人物分析。\n</acg_think>\n<combat_driver>\n史黛菈:这里是战斗推理。\n</combat_driver>\n<story_driver>\n珠雫:这里是剧情推理。\n</story_driver>';
  const driver = '<parallel_line_drive>\n一辉:这里是并行驱动。\n</parallel_line_drive>';
  const suffix = '<memory_log>\n一辉:记忆条目。\n</memory_log>\n<wlog name="record">\n史黛菈:日志条目。\n</wlog>\n<status>\n珠雫:状态条目。\n</status>\n<affinity>\n刀华:关系条目。\n</affinity>';
  const input = `${prefix}\n<story_scene>\n${driver}\n<parallel_line>\n黑铁一辉:这里才是正文。\n史黛菈·法米利昂:我在正文里回答。\n</parallel_line>\n</story_scene>\n${suffix}`;
  const output = rendered(input, 2);
  for (const block of [prefix, driver, suffix]) assert.ok(output.includes(block), '驱动和状态块须逐字保留');
});
for (const [label, input] of [
  ['普通多行属性', '<div title="\n一辉:hello\n">x</div>'],
  ['双引号属性包含大于号', '<div title="quoted >\n一辉:仍在属性中。\n">x</div>'],
  ['单引号属性包含大于号', "<div title='quoted >\n一辉:仍在属性中。\n'>x</div>"],
  ['属性里的伪关闭标签', '<div title="quoted </div> >\n一辉:仍在属性中。\n">x</div>'],
  ['未闭合双引号属性', '<div title="quoted >\n一辉:仍在属性中。'],
  ['未闭合单引号属性', "<div title='quoted >\n一辉:仍在属性中。"],
  ['完整 textarea', '<textarea>\n一辉:这里是表单值。\n</textarea>'],
  ['textarea 属性', '<textarea title="\n一辉:这里是属性。\n">value</textarea>'],
]) {
  check(`HTML 标签与属性保护：${label}`, () => {
    unchanged(input);
    assert.ok(rendered(`珠雫:前置安全对白。\n${input}`).endsWith(input));
  });
}
check('完整 HTML 属性关闭后，普通容器正文与后行可转换', () => {
  const opener = '<div title="quoted > </div> value">';
  const output = rendered(`${opener}\n一辉:普通容器正文。\n</div>\n史黛菈:容器外正文。`, 2);
  assert.ok(output.includes(`${opener}\n`));
});
check('普通 details 保护内部，结束后恢复', () => {
  const block = '<details open><summary>剧情驱动</summary>\n一辉:这是折叠分析。\n</details>';
  const output = rendered(`${block}\n史黛菈:这是正文。`);
  assert.ok(output.includes(block));
});
check('平行线事件 details 的正文可显示气泡', () => {
  const opener = '<details open><summary>支线 · 平行线事件</summary>';
  const output = rendered(`${opener}\n一辉:这里是平行线正文。\n史黛菈:我在这里回答。\n</details>`, 2);
  assert.ok(output.includes(opener));
});
check('平行线事件内嵌普通驱动 details 仍受保护', () => {
  const nested = '<details><summary>平行线驱动</summary>\n珠雫:只在驱动中出现。\n</details>';
  const output = rendered(`<details><summary>平行线事件</summary>\n一辉:外层前句。\n${nested}\n史黛菈:外层后句。\n</details>`, 2);
  assert.ok(output.includes(nested));
  assert.ok(!bubbleOpenings(output).some(opening => opening.includes('data-rkd-name="珠雫"')));
});
for (const [label, block] of [
  ['后置 summary 不改变首 summary 的驱动身份', '<details><summary>剧情驱动</summary><summary>平行线事件</summary>\n一辉:仍属于驱动。\n</details>'],
  ['属性里的伪 details 关闭不结束驱动区', '<details><summary>剧情驱动</summary><div title="</details> >\n一辉:这是属性。\n">\n史黛菈:仍属于驱动。\n</div></details>'],
  ['未关闭的 details 保持保护', '<details><summary>剧情驱动</summary>\n一辉:仍属于驱动。'],
]) {
  check(`details 边界：${label}`, () => unchanged(block));
}
for (const tag of ['acg_think', 'story_driver', 'status', 'UpdateVariable']) {
  check(`同名保护标签嵌套允许保守保留后文：${tag}`, () => {
    const outer = `<${tag}>\n一辉:外层保护文字。\n<${tag}>\n珠雫:内层保护文字。\n</${tag}>\n史黛菈:外层仍未关闭。\n</${tag}>`;
    const output = applyRules(`${outer}\n刀华:保护块结束后的普通正文。`, rules);
    assert.ok(output.includes(outer), '不得因为内层关闭而转换尚处在外层的对白');
    assert.ok(bubbleOpenings(output).every(opening => opening.includes('data-rkd-name="刀华"')), '仅允许恢复外层结束后的正文；也允许全部保守回退');
  });
}
for (const separator of ['\u2028', '\u2029']) {
  check(`Unicode 行分隔 U+${separator.codePointAt(0).toString(16)} 不合并两句对白`, () => {
    const output = rendered(`一辉:第一句。${separator}史黛菈:第二句。`, 2);
    const speeches = [...output.matchAll(/<div data-rkd-line>([\s\S]*?)<\/div>/g)].map(match => match[1]);
    assert.deepEqual(speeches, ['第一句。', '第二句。']);
    assert.equal(output.split(separator).length, 2, 'Unicode 分隔符保留');
  });
}
check('完整 MVU JSONPatch 逐字保留，闭合之后允许恢复正文', () => {
  const block = '<UpdateVariable>\n<Analysis>保持变量</Analysis>\n<JSONPatch>\n[{"op":"replace","path":"/对白","value":"一辉:不要匹配"}]\n</JSONPatch>\n</UpdateVariable>';
  const output = rendered(`史黛菈:正常正文。\n${block}\n一辉:已经退出变量区。`, 2);
  assert.ok(output.includes(block));
});
for (const input of [
  '一辉:{{user}}',
  '一辉:先说{{getvar::x}}后说',
]) {
  check(`含宿主宏标记的台词整行回退：${input}`, () => {
    unchanged(input);
    const output = rendered(`${input}\n史黛菈:下一行仍可转换。`);
    assert.ok(output.includes(`${input}\n`));
    assert.ok(!bubbleOpenings(output).some(opening => opening.includes('data-rkd-name="一辉"')), '宏前后都不能截取为气泡');
  });
}

const unsafeSpeeches = [
  '<img src=x onerror=alert(1)>', '普通开头 <img src=x onerror=alert(1)> 普通结尾',
  '</div><script>alert(1)</script>', '<svg/onload=alert(1)>', '普通文字 > 尾部',
  '普通文字 < 尾部', '&lt;img src=x onerror=alert(1)&gt;', '&#60;script&#62;',
  '&amp;', '&quot; onclick=&quot;alert(1)', 'A & B', '保留 $& 不二次替换。',
  '开头\u0026尾部', '开头\u003c尾部', '开头\u003e尾部',
];
for (const [index, speech] of unsafeSpeeches.entries()) {
  check(`HTML/实体反例整行不转换、不截取安全前缀 ${index + 1}`, () => {
    const input = `史黛菈:${speech}`;
    unchanged(input);
    const output = applyRules(`${input}\n一辉:安全后行。`, rules);
    assert.ok(output.includes(input), '有风险的一整行必须完整保留');
    assert.ok(!bubbleOpenings(output).some(opening => opening.includes('data-rkd-name="史黛菈"')), '不允许仅截取特殊字符前的部分台词');
  });
}
check('引号位于文本节点，不能变成气泡属性', () => {
  const speech = '" onmouseover="alert(1)\' onclick=\'alert(2)';
  const output = rendered(`一辉:${speech}`);
  assert.ok(output.includes(speech));
  const opening = output.match(/<[^>]*\bdata-rkd="bubble"[^>]*>/)?.[0];
  assert.ok(opening, '气泡元素存在');
  assert.ok(!/\bon(?:click|mouseover)\s*=/i.test(opening), '对白引号不能进入属性');
});
check('未知人物 HTML 原行保留，后续安全对白仍转换', () => {
  const unsafe = '未知人物:<img src=x onerror=alert(1)>';
  const output = rendered(`${unsafe}\n一辉:我在下一行。`);
  assert.ok(output.includes(`${unsafe}\n`));
});

check('无对白消息不注入样式；转换结果再次处理幂等', () => {
  unchanged('只有叙述。');
  const output = rendered('史黛菈:第一句。\n一辉:第二句。', 2);
  assert.equal(applyRules(output, rules), output);
  assert.equal(styleCount(output), 1);
});
check('原始消息字符串保留，离线替换返回新字符串', () => {
  const input = '一辉:模型上下文原文。';
  const saved = input;
  rendered(input);
  assert.equal(input, saved);
});

for (const [name, input, expectedBubbles] of [
  ['十万字旁白夹少量对白', `一辉:起始。\n${'这是很长的叙述段落，保持文字、标点与换行不变。\n'.repeat(4000)}史黛菈:结束。`, 2],
  ['数万字连续对白', Array.from({ length: 1200 }, (_, i) => `${i % 2 ? '一辉' : '史黛菈'}:第${i}句对白，包含一些额外文字用于检测大量相邻匹配。`).join('\n'), 1200],
  ['八万字单行对白', `一辉:${'长对白。'.repeat(20000)}`, 1],
]) {
  check(`性能粗测：${name}`, () => {
    const started = performance.now();
    const output = rendered(input, expectedBubbles);
    const elapsedMs = performance.now() - started;
    measurements.push({ name, inputCharacters: input.length, outputCharacters: output.length, elapsedMs: Number(elapsedMs.toFixed(2)) });
    assert.ok(elapsedMs < 10000, `单次离线替换超过宽松的 10 秒退化门槛：${elapsedMs.toFixed(1)} ms`);
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  sourceHashes: Object.fromEntries([
    ['scripts/正文气泡/build.mjs', new URL('./build.mjs', import.meta.url)],
    ['scripts/正文气泡/context-guard.mjs', new URL('./context-guard.mjs', import.meta.url)],
    ['scripts/正文气泡/bubble.css', new URL('./bubble.css', import.meta.url)],
    ['resource/knightavatars/manifest.json', new URL('../../resource/knightavatars/manifest.json', import.meta.url)],
  ].map(([name, sourceUrl]) => [name, createHash('sha256').update(fs.readFileSync(sourceUrl)).digest('hex')])),
  dialect: 'SillyTavern card RegexScriptData',
  evidenceType: 'offline-javascript-string-replacement',
  disclaimer: '仅验证规则字段、JavaScript 替换与固定输入输出；不等于 SillyTavern 实机、Markdown 渲染或真实模型格式遵守率验收。',
  unverifiedHostStages: ['installed-version numeric placement mapping', 'Markdown/HTML rendering', 'macro substitution (not run; actual behavior depends on the installed host)', 'actual prompt assembly', 'global/preset/character regex ordering', 'edit/swipe/reload/streaming lifecycle', 'remote avatar availability'],
  declaredScope: { placement: [2], destination: 'display', markdownOnly: true, promptOnly: false, runOnEdit: true },
  safetyBoundary: '已知唯一姓名、固定玩家标记或当前 persona 安全姓名的纯文本行生成气泡；未知安全姓名仅生成惰性候选，完整原行保留，只有终端身份解析唯一命中玩家后才可提升。玩家查找宏以转义值进行有限离线模拟，不代表宿主宏系统验收。正文封套及已闭合保护块之后可恢复；当前保护块、HTML 属性及普通 details 内不转换；同名保护标签嵌套允许保守回退；含 HTML/实体或 {{ 宏标记的行保持宿主原文。本组件不是原始消息 HTML 消毒器。',
  manifestCharacters: manifest.characters.length,
  uniqueNamesChecked: names.length,
  ambiguousNames,
  total: results.length,
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  measurements,
  results,
};
fs.mkdirSync(reports, { recursive: true });
fs.writeFileSync(reports + '/check-results.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, measurements }, null, 2));
for (const result of results.filter(result => !result.passed)) console.error(`${result.name}: ${result.error}`);
process.exitCode = report.failed ? 1 : 0;
