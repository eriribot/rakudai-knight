import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildRules, reports} from './build.mjs';
import {buildIzumiPlanningRepair, izumiPlanningRepair, wrapIzumiPlanningStyle} from './preset-compatibility.mjs';

// Presets and their embedded prompts are untrusted test data. This runner only
// applies eligible display regex replacements; it never executes their scripts.
const defaults = ['Izumi 1002.json', '咩咩预设 - ver 5.8.1.json',
  '咩咩预设-专用正则-ver7.1-大字体版(PC端推荐).json'];
const inputPaths = defaults.map((name, index) => process.argv[index + 2] || path.join(os.homedir(), 'Downloads', name));
const hash = value => createHash('sha256').update(value).digest('hex');
const attachments = inputPaths.map(file => {
  const bytes = fs.readFileSync(file);
  return {file: path.basename(file), sha256: hash(bytes), bytes: bytes.length,
    data: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))};
});
const izumi = attachments[0].data.extensions.regex_scripts;
const planningRepair = buildIzumiPlanningRepair(attachments[0].data);
const repairedIzumi = izumi.map(rule => rule.id === planningRepair.id ? planningRepair : rule);
const mee = attachments[2].data;
assert.ok(Array.isArray(izumi) && Array.isArray(mee));
const bubble = buildRules();
const checks = [];
const cases = [];
function check(name, run) {
  if (process.env.RK_BUBBLE_TRACE_PROGRESS === '1') console.log('Checking: ' + name);
  try {run(); checks.push({name, passed:true});}
  catch(error) {checks.push({name, passed:false, error:error.message});}
}
function eligible(rule, depth) {
  // ST 1.18.0 display gate: markdownOnly is sufficient, even when promptOnly
  // is also true. This does not emulate installed preset/group admission.
  return !rule.disabled && rule.markdownOnly && rule.placement?.includes(2) &&
    !(typeof rule.minDepth === 'number' && depth < rule.minDepth) &&
    !(typeof rule.maxDepth === 'number' && depth > rule.maxDepth);
}
function runRule(rule, text) {
  const find = rule.findRegex.split('{{user}}').join('清泉朝阳');
  const end = find.lastIndexOf('/');
  const regex = find.startsWith('/') && end > 0
    ? new RegExp(find.slice(1, end), find.slice(end + 1)) : new RegExp(find);
  // Pinned host expands numbered/named captures in a replacement callback.
  // Other host macros remain literal and are explicitly outside this runner.
  return text.replace(regex, function() {
    const args = [...arguments];
    return rule.replaceString.replace(/{{match}}/gi, '$0')
      .replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_, number, name) => {
        const groups = args.at(-1);
        const value = number ? args[Number(number)] : groups && typeof groups === 'object' && groups[name];
        return value || '';
      });
  });
}
function counts(text) {
  return {characters:text.length, bubbles:(text.match(/<div data-rkd="bubble"/g) || []).length,
    candidates:(text.match(/<span data-rkd="candidate"/g) || []).length,
    styles:(text.match(/\/\* rkd-dialogue-style:/g) || []).length,
    fenceBlocks:fencedBlocks(text).length};
}
function fencedBlocks(text) {
  const lines = text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) || [];
  const result = [];let open = null;let raw = '';
  for (const line of lines) {
    const content = line.replace(/[\r\n]+$/, '');
    if (!open) {
      const match = content.match(/^[ ]{0,3}(`{3,}|~{3,})([^\r\n]*)$/);
      if (!match || match[1][0] === '`' && match[2].includes('`')) continue;
      open = {character:match[1][0], length:match[1].length};raw = line;
    } else {
      raw += line;
      const close = content.match(/^[ ]{0,3}(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === open.character && close[1].length >= open.length) {
        result.push(raw);open = null;raw = '';
      }
    }
  }
  return result;
}
function run(input, sets, depth = 0) {
  let text = input;const trace = [{stage:'input', ...counts(text)}];
  for (const [stage, rules] of sets) {
    for (const [index, rule] of rules.entries()) {
      if (!eligible(rule, depth)) continue;
      if (process.env.RK_BUBBLE_TRACE_PROGRESS === '2') console.log(stage + ' / ' + rule.scriptName);
      const next = runRule(rule, text);
      if (next !== text) trace.push({stage, index, id:rule.id, name:rule.scriptName,
        before:counts(text), after:counts(next)});
      text = next;
    }
  }
  return {text, trace};
}
const orders = [
  {name:'Izumi → bubble', sets:[['Izumi',repairedIzumi],['bubble',bubble]],
    assumption:'Izumi 启用显示规则先于角色组件'},
  {name:'bubble → Izumi', sets:[['bubble',bubble],['Izumi',repairedIzumi]],
    assumption:'Izumi 逆序压力测试'},
  {name:'Mee → bubble', sets:[['Mee',mee],['bubble',bubble]],
    assumption:'咩咩启用显示规则先于角色组件'},
  {name:'bubble → Mee', sets:[['bubble',bubble],['Mee',mee]],
    assumption:'咩咩逆序压力测试'},
  {name:'global-Mee → preset-Izumi → scoped-bubble', sets:[['Mee',mee],['Izumi',repairedIzumi],['bubble',bubble]],
    assumption:'SillyTavern 1.18.0 官方类型合并顺序；实际导入分组尚未确认'},
  {name:'bubble → Mee → Izumi', sets:[['bubble',bubble],['Mee',mee],['Izumi',repairedIzumi]],
    assumption:'相反顺序压力测试；不声称当前宿主如此分组'},
];
const body = '史黛菈:「我们走吧。」\n玩家:『我准备好了。』';
const fixtures = [
  {name:'日轻引号、无扩展块', input:body},
  {name:'Izumi思考清理', input:'<think>中立思考。</think>\n' + body},
  {name:'Izumi选项iframe', input:body + '\n<options>\n>选项一：一起走\n</options>'},
  {name:'咩咩选项iframe', input:body + '\n<selection>\nA.一起走\n</selection>'},
  {name:'两套选项与多种思考封套', input:'<think>中立思考。</think>\n<konatan_planning~>\n史黛菈:「思考区示例。」\n</konatan_planning~>\n<story_scene>\n' + body +
    '\n</story_scene>\n<options>\n>选项一：一起走\n</options>\n<selection>\nA.一起走\n</selection>'},
  {name:'选项内同形对白不能变气泡', input:body + '\n<options>\n史黛菈:「选项文字。」\n</options>\n<selection>\n玩家:「选项文字。」\n</selection>'},
];
check('附件Izumi两处导出regex副本一致，但仅复放一份', () => {
  assert.deepEqual(attachments[0].data.extensions.SPreset.RegexBinding.regexes, izumi);
});
check('Izumi修复只改稳定ID的findRegex与首段style保护，模板/CSS/metadata精确保留', () => {
  const source = izumi.find(rule => rule.id === planningRepair.id);
  const leading = planningRepair.replaceString.match(/^<pre hidden>(<style>[\s\S]*?<\/style>)<\/pre>/);
  assert.ok(leading);
  const unwrapped = leading[1] + planningRepair.replaceString.slice(leading[0].length);
  assert.equal(unwrapped,source.replaceString,'包装之外的全部模板含script逐字保持');
  assert.deepEqual({...planningRepair,findRegex:source.findRegex,replaceString:source.replaceString},source);
  assert.equal(izumi.find(rule => rule.id === planningRepair.id).findRegex,izumiPlanningRepair.originalFindRegex);
  assert.equal(buildIzumiPlanningRepair({extensions:{regex_scripts:[planningRepair]}}).findRegex, planningRepair.findRegex);
  assert.deepEqual(buildIzumiPlanningRepair({extensions:{regex_scripts:[planningRepair]}}),planningRepair,'已修复结构幂等');
  assert.throws(()=>wrapIzumiPlanningStyle('<style class="unknown">x</style>'),/结构未知/);
  assert.throws(()=>wrapIzumiPlanningStyle('<div>unknown</div><style>x</style>'),/结构未知/);
});
for (const fixture of fixtures) {
  for (const order of orders) {
    check(`${fixture.name} / ${order.name}`, () => {
      const {text, trace} = run(fixture.input, order.sets);
      const external = run(fixture.input, order.sets.filter(([stage]) => stage !== 'bubble')).text;
      const actual = counts(text);
      assert.equal(actual.bubbles, 2, '正文两句均保留气泡');
      assert.equal(actual.styles, 1, '只有一份气泡样式，清理后仍保留');
      assert.ok(text.includes('「我们走吧。」') && text.includes('『我准备好了。』'));
      assert.deepEqual(fencedBlocks(text), fencedBlocks(external), '预设选项iframe逐字一致，不塞入气泡或候选');
      assert.ok(!fencedBlocks(text).some(block => /data-rkd=|rkd-dialogue-style:/.test(block)));
      cases.push({name:fixture.name, order:order.name, assumption:order.assumption, depth:0,
        fixture:fixture.input, trace, final:actual,
        optionBlocks:fencedBlocks(text).map(block => ({sha256:hash(block), characters:block.length})),
        optionIntegrity:'exact parity with enabled external display regex sequence'});
    });
  }
}
check('咩咩深度5起显示裁剪按原设计移除正文，气泡不绕过', () => {
  const input = body + '\n<memory_log>中立记录。</memory_log>';
  for (const order of orders.filter(order => order.sets.some(([stage]) => stage === 'Mee'))) {
    const {text,trace} = run(input, order.sets, 5);
    assert.equal(counts(text).bubbles, 0);
    assert.equal(counts(text).styles, 0);
    cases.push({name:'既有旧楼层显示裁剪', order:order.name, depth:5, fixture:input,trace,final:counts(text)});
  }
});
const report = {schemaVersion:1,version:'0.5',generatedAt:new Date().toISOString(),nodeVersion:process.version,
  evidenceType:'offline-enabled-display-regex-composition',
  externalFiles:attachments.map(({file,sha256,bytes}) => ({file,sha256,bytes})),
  sourceHashes:Object.fromEntries(['build.mjs','context-guard.mjs','check-preset-compatibility.mjs','preset-compatibility.mjs'].map(name =>
    [name,hash(fs.readFileSync(new URL('./' + name, import.meta.url)))])),
  authority:'https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/extensions/regex/engine.js',
  mergeOrder:'Object.values(SCRIPT_TYPES): global → preset → scoped',
  admission:{depth:0,isEdit:false,placement:2,destination:'display',disabled:false,
    ruleGate:'markdownOnly sufficient, including promptOnly + markdownOnly; depth bounds respected'},
  appliedSourceRepair:{...izumiPlanningRepair,replacementHash:hash(planningRepair.replaceString),
    scope:'仅复放中替换该 existing rule 的查找模式与首段样式包装；附件文件未改，正式同 ID 组件另由组件构建阶段生成'},
  boundary:'附件提示词与脚本只当数据；不执行HTML脚本、不复制整份附件。仅回放启用display规则、depth gate与编号/命名捕获；其他宏、实际分组准入、Markdown、净化、iframe、CSS布局及宿主生命周期未模拟。',
  realSillyTavern:'not run',total:checks.length,passed:checks.filter(c=>c.passed).length,
  failed:checks.filter(c=>!c.passed).length,checks,cases};
fs.mkdirSync(reports,{recursive:true});
fs.writeFileSync(path.join(reports,'preset-compatibility-trace.json'), JSON.stringify(report,null,2) + '\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,cases:cases.length}));
for (const result of checks.filter(c => !c.passed)) console.error(result.name + ': ' + result.error);
process.exitCode = report.failed ? 1 : 0;
