import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {buildRules, applyRules, reports} from './build.mjs';

// Deterministic neutral text; no model, external script, preset or saved chat runs.
function story(size, count, unknown = false) {
  return Array.from({length:count}, (_, index) =>
    '环境安静，训练记录保持原样。'.repeat(Math.floor(size / count / 14)) + '\n' +
    (unknown ? '新人物' + index : index % 2 ? '史黛菈' : '一辉') + ':「第' + index + '句对白。」').join('\n');
}
const fixtures = [
  {name:'冷启动一行正文', input:'史黛菈:中性正文。', bubbles:1, candidates:0, budgetMs:200, coldBudgetMs:200},
  {name:'20k普通正文100句', input:story(20000,100), bubbles:100, candidates:0, budgetMs:200},
  {name:'50k普通正文200句', input:story(50000,200), bubbles:200, candidates:0, budgetMs:200},
  {name:'50k未知姓名200行', input:story(50000,200,true), bubbles:0, candidates:200, budgetMs:200},
  {name:'50k无匹配', input:'环境安静，无人说话。'.repeat(5000), bubbles:0, candidates:0, budgetMs:200},
  {name:'50k闭合围栏夹200句', input:story(40000,150) + '\n```html\n' + story(10000,50) + '\n```\n史黛菈:正文。', bubbles:151, candidates:0},
  {name:'50k未闭合反引号100句', input:'```\n' + story(50000,100), bubbles:0, candidates:0},
  {name:'50k未闭合波浪号100句', input:'~~~html\n' + story(50000,100), bubbles:0, candidates:0},
  {name:'50k十六个混合围栏192句', input:Array.from({length:16},(_,i) => {
    const fence = i % 2 ? '~~~~' : '````';
    return story(1000,4) + '\n' + fence + 'html\n' + story(2100,8) + '\n' + fence + '\n';
  }).join(''), bubbles:64, candidates:0},
  {name:'50k关闭run较长100句', input:'````html\n' + story(25000,50) + '\n' + '`'.repeat(96) + '\n' + story(25000,50), bubbles:50, candidates:0},
  {name:'50k长关闭前缀不是关闭100句', input:'````html\n' + story(25000,50) + '\n' + '`'.repeat(96) + '继续代码\n' + story(25000,50), bubbles:0, candidates:0},
  {name:'50k选项保护块夹200句', input:story(40000,150) + '\n<options>\n' + story(10000,50) + '\n</options>', bubbles:150, candidates:0},
  {name:'50k闭合选项代码假tag后200句', input:'```html\n<options>\n<!-- literal opener\n<div title="\n```\n'+story(50000,200), bubbles:200, candidates:0},
  {name:'50k真实未闭选项跨代码假close200句', input:'<options>\n```html\n</options>\n```\n'+story(50000,200), bubbles:0, candidates:0},
];
const count = text => ({bubbles:(text.match(/<div data-rkd="bubble"/g) || []).length,
  candidates:(text.match(/<span data-rkd="candidate"/g) || []).length});

if (!isMainThread) {
  const fixture = fixtures[workerData.index];
  const coldStarted = performance.now();
  const rules = buildRules();
  const coldOutput = applyRules(fixture.input,rules);
  const cold = {elapsedMs:Number((performance.now()-coldStarted).toFixed(2)),...count(coldOutput)};
  const measurements = [];
  // Warm the JS engine once, then measure complete replacements, including
  // RegExp construction. Each fixture runs alone to avoid CPU contention.
  for (let sample = 0; sample < 3; sample++) {
    let text = fixture.input;
    const started = performance.now();
    const stages = [];
    for (const rule of rules) {
      const stageStarted = performance.now();
      text = applyRules(text, [rule]);
      stages.push({id:rule.id, elapsedMs:Number((performance.now()-stageStarted).toFixed(2))});
    }
    measurements.push({elapsedMs:Number((performance.now()-started).toFixed(2)), stages, ...count(text)});
  }
  parentPort.postMessage({cold,samples:measurements});
} else {
  const results = [];
  for (const [index, fixture] of fixtures.entries()) {
    if (process.env.RK_BUBBLE_TRACE_PROGRESS === '1') console.log('Measuring: ' + fixture.name);
    let worker;
    try {
      const {cold,samples} = await new Promise((resolve, reject) => {
        worker = new Worker(new URL(import.meta.url), {workerData:{index}});
        const timeout = setTimeout(() => {worker.terminate();reject(new Error('worker exceeded 10s timeout'));},10000);
        worker.once('message', value => {clearTimeout(timeout);resolve(value);});
        worker.once('error', error => {clearTimeout(timeout);reject(error);});
        worker.once('exit', code => {if(code) {clearTimeout(timeout);reject(new Error('worker exit '+code));}});
      });
      const budgetMs = fixture.budgetMs ?? 1000;
      const coldBudgetMs = fixture.coldBudgetMs ?? 1000;
      assert.equal(cold.bubbles,fixture.bubbles,'cold visible bubbles');
      assert.equal(cold.candidates,fixture.candidates,'cold inert candidates');
      assert.ok(cold.elapsedMs<coldBudgetMs,`cold build/compile/replace ${cold.elapsedMs}ms exceeds ${coldBudgetMs}ms`);
      for (const sample of samples) {
        assert.equal(sample.bubbles,fixture.bubbles,'expected visible bubbles');
        assert.equal(sample.candidates,fixture.candidates,'expected inert candidates');
        assert.ok(sample.elapsedMs < budgetMs, `replacement ${sample.elapsedMs}ms exceeds ${budgetMs}ms budget`);
      }
      results.push({name:fixture.name,characters:fixture.input.length,
        inputHash:createHash('sha256').update(fixture.input).digest('hex'),
        budgetMs,coldBudgetMs,cold,samples,passed:true});
    } catch(error) {
      results.push({name:fixture.name,characters:fixture.input.length,passed:false,error:error.message});
    } finally {if(worker) await worker.terminate();}
  }
  const report = {schemaVersion:1,version:'0.6',generatedAt:new Date().toISOString(),nodeVersion:process.version,
    evidenceType:'isolated-offline-JavaScript-regex-performance',
    boundary:'单worker顺序运行；首次build+RegExp编译+完整转换单独计时，之后三次完整转换。一行冷启动200ms，其他冷启动硬门槛1s；普通正文热预算200ms，围栏/保护块硬门槛1s。结果随硬件变化，不等于实际酒馆流式帧时间。',
    sourceHashes:Object.fromEntries(['build.mjs','context-guard.mjs','check-performance.mjs'].map(name =>
      [name,createHash('sha256').update(fs.readFileSync(new URL('./'+name,import.meta.url))).digest('hex')])),
    total:results.length,passed:results.filter(result=>result.passed).length,
    failed:results.filter(result=>!result.passed).length,results};
  fs.mkdirSync(reports,{recursive:true});
  fs.writeFileSync(path.join(reports,'performance-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,
    measurements:results.map(({name,characters,budgetMs,cold,samples,error}) => ({name,characters,budgetMs,coldMs:cold?.elapsedMs,
      elapsedMs:samples?.map(sample=>sample.elapsedMs),error}))},null,2));
  process.exitCode = report.failed ? 1 : 0;
}
