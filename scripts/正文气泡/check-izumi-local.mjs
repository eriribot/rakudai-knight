import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildRules} from './build.mjs';
import {buildLocalIzumiRules, localArtifactNames, localIzumiSource} from './local-izumi-compat.mjs';

// Read-only neutral fixtures. External prompts/HTML/scripts are data only;
// no browser script, whole preset write, original-group replacement or output/.
const file = process.argv[2] || path.join(os.homedir(),'Downloads','Izumi 1002.json');
const bytes = fs.readFileSync(file);
const preset = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const unchangedPreset = JSON.stringify(preset);
const original = preset.extensions.regex_scripts;
const local = buildLocalIzumiRules(preset);
const core = buildRules();
const source = original.find(rule=>rule.id===localIzumiSource.id);
const css = source.replaceString.match(/^<style>[\s\S]*?<\/style>/)[0];
const capture = source.replaceString.indexOf('$1');
const head = source.replaceString.slice(css.length,capture);
const tail = source.replaceString.slice(capture+2);
const checks = [], traces = [], measurements = [];
const hash = value => createHash('sha256').update(value).digest('hex');
// Exact algorithm from ST 1.18.0 public/scripts/utils.js, regexFromString.
// https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/utils.js
function regexFromString(input) {
  try {
    var m = input.match(/(\/?)(.+)\1([a-z]*)/i);
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) return RegExp(input);
    return new RegExp(m[2],m[3]);
  } catch {return;}
}
function check(name,run) {
  try {run();checks.push({name,passed:true});}
  catch(error) {checks.push({name,passed:false,error:error.message});}
}
function eligible(rule,depth=0) {
  return !rule.disabled && rule.markdownOnly && rule.placement?.includes(2) &&
    !(typeof rule.minDepth==='number' && depth<rule.minDepth) &&
    !(typeof rule.maxDepth==='number' && depth>rule.maxDepth);
}
function apply(text,rule) {
  const find = rule.findRegex.replaceAll('{{user}}','中性玩家');
  const compiled = regexFromString(find);
  assert.ok(compiled,'实际宿主 regexFromString 无法编译：'+rule.scriptName);
  return text.replace(compiled,function() {
    const args = [...arguments];
    return rule.replaceString.replace(/{{match}}/gi,'$0').replace(/\$(\d+)|\$<([^>]+)>/g,(_,number,name)=> {
      const groups = args.at(-1);
      return (number ? args[Number(number)] : groups && typeof groups==='object' && groups[name]) || '';
    });
  });
}
function run(text,rules,depth=0) {
  return rules.filter(rule=>eligible(rule,depth)).reduce((value,rule)=>apply(value,rule),text);
}
function counts(text) {
  return {bubbles:(text.match(/<div data-rkd="bubble"/g)||[]).length,
    bubbleCSS:(text.match(/\/\* rkd-dialogue-style:/g)||[]).length,
    rawPlanOpen:(text.match(/<konatan_planning~>/g)||[]).length,
    rawPlanClose:(text.match(/<\/konatan_planning~>/g)||[]).length,
    hiddenStyles:(text.match(/<pre hidden><style>/g)||[]).length};
}
check('原preset对象完全不变，本卡三条使用新ID/显示范围/原深度',()=> {
  assert.equal(JSON.stringify(preset),unchangedPreset);
  assert.equal(local.length,3);assert.equal(localArtifactNames.length,3);
  assert.equal(new Set(local.map(rule=>rule.id)).size,3);
  for(const rule of local) {
    assert.ok(!original.some(item=>item.id===rule.id));
    assert.deepEqual(rule.placement,[2]);assert.equal(rule.markdownOnly,true);
    assert.equal(rule.promptOnly,false);assert.equal(rule.substituteRegex,0);
    assert.equal(rule.maxDepth,2);assert.equal(rule.minDepth,null);
    assert.ok(!rule.replaceString.includes('$1')&&!rule.replaceString.includes('$<'));
  }
});
check('未知原模板/查找/ID在构建时拒绝',()=> {
  for(const change of [{replaceString:source.replaceString+' '},{findRegex:'/<unknown>/g'},{id:'unknown'}]) {
    const altered = {...preset,extensions:{...preset.extensions,regex_scripts:[{...source,...change}]}};
    assert.throws(()=>buildLocalIzumiRules(altered),/未知/);
  }
});
check('三条findRegex无原始行终止符，真实regexFromString与完整pattern编译一致',()=> {
  for(const rule of local) {
    assert.ok(!/[\r\n\u2028\u2029]/.test(rule.findRegex),'宿主非dotAll parser不能接受多行find字段');
    const end = rule.findRegex.lastIndexOf('/');
    const full = new RegExp(rule.findRegex.slice(1,end),rule.findRegex.slice(end+1));
    const actual = regexFromString(rule.findRegex);
    assert.ok(actual);assert.equal(actual.source,full.source);assert.equal(actual.flags,full.flags);
  }
  assert.ok(local[0].replaceString.includes('\n')&&local[1].replaceString.includes('\n'),
    'replacement必须保留原模板LF，不是把模板换行改成可见反斜杠');
});
const body = '史黛菈:「正文甲。」\n玩家:『正文乙。』';
const fixtures = [
  {name:'普通日轻正文',input:body},
  {name:'思考清理后正文',input:'<think>中性思考。</think>\n'+body},
  {name:'原规划美化残留foreign opener',input:'<konatan_planning~>\n中性计划。\n</konatan_planning~>\n'+body},
  {name:'思考清理删掉规划前缀',input:'<think>中性思考。</think>\n<konatan_planning~>\n中性计划。\n</konatan_planning~>\n'+body},
  {name:'规划与选项同时存在',input:'<think>中性思考。</think>\n<konatan_planning~>\n中性计划。\n</konatan_planning~>\n'+body+'\n<options>\n>中性选项\n</options>'},
  {name:'幸存字面宏前文不回填',input:'<think>中性思考。</think>\n<konatan_planning~>\n中性计划。\n</konatan_planning~>\n字面 {{user}} {{getvar::example}} $1。\n'+body},
];
for(const fixture of fixtures) {
  check(fixture.name,()=> {
    const external = run(fixture.input,original);
    const repaired = run(external,local);
    const final = run(repaired,core);
    assert.equal(counts(final).bubbles,2);assert.equal(counts(final).bubbleCSS,1);
    // Remove only the declared constant insertions. This is stronger than a
    // text-only comparison: every surviving user/template byte must be exact.
    let undone = repaired.replaceAll('<pre hidden>'+css+'</pre>',css);
    if(!external.includes(css+head)) undone = undone.replace(css+head,'');
    undone = undone.replace('</konatan_planning~>'+tail,tail);
    assert.equal(undone,external,'去掉固定新增片段后，全部幸存原字节和顺序一致');
    assert.equal(run(repaired,local),repaired,'local重复执行幂等');
    assert.equal(run(final,[...local,...core]),final,'完整显示结果重复执行幂等');
    if(fixture.name.includes('宏')) assert.ok(final.includes('字面 {{user}} {{getvar::example}} $1。'));
    const fences = text => text.match(/```html[\s\S]*?\n```/g)||[];
    assert.deepEqual(fences(repaired),fences(external),'选项iframe原字节保持');
    traces.push({name:fixture.name,fixture:fixture.input,
      stages:[{stage:'original-Izumi',...counts(external)},{stage:'local-addon',...counts(repaired)},
        {stage:'local-core',...counts(final)}]});
  });
}
const generated = css+head+'<konatan_planning~>\n中性计划。\n'+tail;
const protectedFixtures = [
  ['原始未闭合规划','<konatan_planning~>\n中性计划。\n'+body],
  ['规划尾部未知','<konatan_planning~>\n中性计划。\n'+tail.replace('bubbleInterval: 400','bubbleInterval: 401')],
  ['围栏内完整模板','```html\n'+generated+'\n```'],
  ['未闭合围栏内完整模板','~~~html\n'+generated],
  ['注释内完整模板','<!--'+generated+'-->'],
  ['属性中的固定CSS','<div title="'+css+'">属性文字。</div>'],
  ['options内完整模板','<options>\n'+generated+'\n</options>'],
  ['selection内完整模板','<selection>\n'+generated+'\n</selection>'],
];
for(const [name,input]of protectedFixtures) check(name+'保持',()=>assert.equal(run(input,local),input));
check('prefix/close匹配零长度，完全不捕获回填用户内容',()=> {
  const broken = '\n<konatan_planning~>\n中性计划。\n'+tail;
  for(const [index,input]of [[0,broken],[2,head+'<konatan_planning~>\n中性计划。\n'+tail]]) {
    const literal = local[index].findRegex;const end = literal.lastIndexOf('/');
    const match = new RegExp(literal.slice(1,end),literal.slice(end+1)).exec(input);
    assert.ok(match);assert.equal(match[0],'');
  }
});
check('其他卡未加载本卡scope时原display结果完全相同',()=> {
  for(const fixture of fixtures) assert.equal(run(fixture.input,original),run(fixture.input,preset.extensions.regex_scripts));
  assert.equal(JSON.stringify(preset),unchangedPreset);
});
check('原清理已经删除的前置文本不可恢复，不捏造文本',()=> {
  const input = '史黛菈:「被原清理删除。」\n<think>中性思考。</think>\n<konatan_planning~>\n中性计划。\n</konatan_planning~>\n'+body;
  const external = run(input,original);const final = run(external,[...local,...core]);
  assert.ok(!external.includes('被原清理删除'));assert.ok(!final.includes('被原清理删除'));
  assert.equal(counts(final).bubbles,2);
});
for(const [name,input,unchanged] of [
  ['50k无匹配','环境安静，无人说话。'.repeat(5000),true],
  ['50k真实未闭合规划','<konatan_planning~>\n'+'中性计划保持原样。'.repeat(5500),true],
  ['43k围栏内模板复刻','```html\n'+generated.repeat(4)+'\n```',true],
]) check('local性能预算：'+name,()=> {
  const started = performance.now();const result = run(input,local);
  const elapsedMs = performance.now()-started;
  if(unchanged) assert.equal(result,input);
  measurements.push({name,characters:input.length,elapsedMs:Number(elapsedMs.toFixed(2)),budgetMs:1000});
  assert.ok(elapsedMs<1000,'local适配超过1s预算：'+elapsedMs.toFixed(2)+'ms');
});
const report = {schemaVersion:1,version:'local-Izumi-0.1',generatedAt:new Date().toISOString(),nodeVersion:process.version,
  evidenceType:'read-only-neutral-enabled-regex-composition',
  external:{file:path.basename(file),bytes:bytes.length,sha256:hash(bytes),unchanged:true},
  sourceHashes:Object.fromEntries(['local-izumi-compat.mjs','check-izumi-local.mjs'].map(name=>[name,hash(fs.readFileSync(new URL('./'+name,import.meta.url)))])),
  order:'unchanged original PRESET → this card SCOPED addon → this card SCOPED core',
  gate:{depth:0,isEdit:false,AI_OUTPUT:2,destination:'display'},
  regexCompiler:{algorithm:'ST 1.18.0 utils.js regexFromString',
    source:'https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/utils.js',
    actualAlgorithmUsed:true,findFieldLiteralLineTerminators:0},
  boundary:'只做字符串regex复放；不执行附件脚本、不改原global/preset、不同ID不会覆盖。只恢复固定模板前缀、保护固定CSS、补已知模板foreign planning边界；原清理已删用户文本不可恢复。真实宿主scope admission/Markdown/净化/流式还需host replay。',
  total:checks.length,passed:checks.filter(result=>result.passed).length,failed:checks.filter(result=>!result.passed).length,
  checks,traces,measurements};
console.log(JSON.stringify(report,null,2));
process.exitCode = report.failed ? 1 : 0;
