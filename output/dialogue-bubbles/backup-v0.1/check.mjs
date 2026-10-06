import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildRules, applyRules } from './build.mjs';

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
const styleCount = value => [...value.matchAll(/<style\b[^>]*\bdata-rkd-style(?:=|\s|>)/gi)].length;
function check(name, run) {
  try {
    run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}
function unchanged(input) {
  assert.equal(applyRules(input, rules), input, '非目标输入必须逐字保留，也不能单独注入样式');
}
function rendered(input, expectedBubbles = 1) {
  const output = applyRules(input, rules);
  assert.equal(bubbleCount(output), expectedBubbles, '气泡数量');
  assert.equal(styleCount(output), expectedBubbles ? 1 : 0, '每消息样式至多一份');
  return output;
}

check('规则结构：恰好两条，唯一 ID，AI 显示侧，编辑时重绘', () => {
  assert.ok(Array.isArray(rules));
  assert.equal(rules.length, 2);
  assert.equal(new Set(rules.map(rule => rule.id)).size, 2);
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

for (const name of names) {
  check(`头像清单唯一姓名/别名：${name}`, () => {
    const output = rendered(`${name}:测试对白。`);
    assert.ok(bubbleOpenings(output)[0].includes(`data-rkd-name="${name}"`), '应保留输入姓名作为头像查询键');
    assert.ok(output.includes('测试对白。'));
  });
}
for (const name of new Set([...ambiguousNames, '艾莉丝'])) {
  check(`歧义别名保留原文：${name}`, () => unchanged(`${name}:这行不猜测身份。`));
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
  assert.equal(output.split('\r\n').length, input.split('\r\n').length, '原始 CRLF 数量应保留');
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
  check(`非目标行与空台词 ${index + 1}`, () => unchanged(input));
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
  '<thinking>', '<reasoning>', '<script>', '<style>', '<pre>', '<code>', '<!--',
];
for (const marker of protectedMarkers) {
  for (const variant of new Set([marker, marker.toLowerCase(), marker.toUpperCase()])) {
    check(`保护块从标记起不处理：${variant}`, () => {
      const tail = `${variant}\n一辉:这里是保护块正文。\n史黛菈:即使像对白也不要处理。`;
      unchanged(tail);
      const output = rendered(`珠雫:标记前对白。\n${tail}`);
      assert.ok(output.endsWith(tail), '首个保护标记到消息末尾必须逐字相同');
    });
  }
}
for (const input of [
  '<div title="\n一辉:hello\n">x</div>',
  '<textarea>\n一辉:这里是表单值。\n</textarea>',
  '<textarea title="\n一辉:这里是属性。\n">value</textarea>',
  '<content>\n史黛菈:封套里的正文整条回退。\n一辉:不向标签内部插入 HTML。\n</content>',
  '<div>\n一辉:普通容器内部也不转换。\n</div>',
  '2 < 3\n一辉:原始小于号之后保留。',
]) {
  check(`首个原始小于号后的 HTML/属性/封套回退：${input.slice(0, 28)}`, () => {
    unchanged(input);
    assert.ok(rendered(`珠雫:前置安全对白。\n${input}`).endsWith(input));
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
check('完整 MVU JSONPatch 与后续内容逐字保留', () => {
  const tail = '<UpdateVariable>\n<Analysis>保持变量</Analysis>\n<JSONPatch>\n[{"op":"replace","path":"/对白","value":"一辉:不要匹配"}]\n</JSONPatch>\n</UpdateVariable>\n一辉:保护块之后也不转换。';
  assert.ok(rendered(`史黛菈:正常正文。\n${tail}`).endsWith(tail));
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
check('未知人物 HTML 之后的余文整体保留', () => {
  const unsafe = '未知人物:<img src=x onerror=alert(1)>';
  unchanged(`${unsafe}\n一辉:我在下一行。`);
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
    ['scripts/正文气泡/bubble.css', new URL('./bubble.css', import.meta.url)],
    ['resource/knightavatars/manifest.json', new URL('../../resource/knightavatars/manifest.json', import.meta.url)],
  ].map(([name, sourceUrl]) => [name, createHash('sha256').update(fs.readFileSync(sourceUrl)).digest('hex')])),
  dialect: 'SillyTavern card RegexScriptData',
  evidenceType: 'offline-javascript-string-replacement',
  disclaimer: '仅验证规则字段、JavaScript 替换与固定输入输出；不等于 SillyTavern 实机、Markdown 渲染或真实模型格式遵守率验收。',
  unverifiedHostStages: ['installed-version numeric placement mapping', 'Markdown/HTML rendering', 'macro substitution (not run; actual behavior depends on the installed host)', 'actual prompt assembly', 'global/preset/character regex ordering', 'edit/swipe/reload/streaming lifecycle', 'remote avatar availability'],
  declaredScope: { placement: [2], destination: 'display', markdownOnly: true, promptOnly: false, runOnEdit: true },
  safetyBoundary: '仅对已知唯一姓名的安全纯文本行生成 HTML；从首个原始 < 起余文保留；含 HTML/实体或 {{ 宏标记的行保持宿主原文，本组件不是原始消息 HTML 消毒器。',
  manifestCharacters: manifest.characters.length,
  uniqueNamesChecked: names.length,
  ambiguousNames,
  total: results.length,
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  measurements,
  results,
};
const reportUrl = new URL('../../output/dialogue-bubbles/check-results.json', import.meta.url);
fs.mkdirSync(new URL('.', reportUrl), { recursive: true });
fs.writeFileSync(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, measurements }, null, 2));
for (const result of results.filter(result => !result.passed)) console.error(`${result.name}: ${result.error}`);
process.exitCode = report.failed ? 1 : 0;
