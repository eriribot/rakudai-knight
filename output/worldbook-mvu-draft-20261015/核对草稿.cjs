// 仅生成本目录示例并做离线核对；不写入酒馆、项目源文件或聊天。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const st = 'D:/someimportant/SillyTavern-release';
const read = p => fs.readFileSync(p, 'utf8');
const write = (name, value) => fs.writeFileSync(path.join(__dirname, name), value, 'utf8');
const book = JSON.parse(read(st + '/data/default-user/worlds/落第骑士英雄谭v0.15.json'));
const catalogue = ['volumes-01-09.json', 'volumes-10-19.json'].flatMap(name => JSON.parse(read(path.join(root, 'scripts/story', name))));
// 精确目录键及其显式别名，仅供该示例验证输入；不暴露为新的模板全局。
const keys = Object.fromEntries(catalogue.map(v => [v.volume, v.chapters.flatMap(c => [c.key, ...(c.aliases || [])])]));
const titleDraft = `<% {
// 审阅用称号片段；不是完整人物条目。目录按项目现有文件生成。
const s = getvar('stat_data')?.场景;
const keys = ${JSON.stringify(keys)};
const valid = s && Number.isInteger(s.当前卷) && keys[s.当前卷]?.includes(s.当前章) && ['未开始','进行中','已结束'].includes(s.阶段);
const afterTitle = valid && (s.当前卷 > 3 || (s.当前卷 === 3 && s.当前章 === '终章' && s.阶段 === '已结束'));
%>
【称号与本局经历】
“落第骑士”是对一辉低魔力评级的贬称，不能据此否定其剑术与实战能力。本局已确认称号优先于原作时间表；卷章只决定背景资料的展示范围，不自动补写战果。
<% if (afterTitle) { %>
原作后期称号参考：“无冕剑王”。其来源是第三卷终章一辉战胜东堂刀华后，观众对其评价的转变。本局确已取得对应称号时，才以此称呼或回忆；若本局战果不同或未确认，保留实际经历。
<% } else { %>
本阶段不默认使用后期称号或回忆尚未确认的后续战果；若本局提前取得称号，按已确认记录表现。
<% } %>
<% } %>
`;
write('05a-一辉称号分期-示例.ejs', titleDraft);
const box = { module: { exports: {} }, exports: {} };
vm.runInNewContext(read(st + '/public/scripts/extensions/third-party/ST-Prompt-Template/src/3rdparty/ejs.js'), box);
const ejs = box.module.exports;
const render = (text, state) => ejs.render(text, {getvar: p => p.split('.').slice(1).reduce((v, k) => v?.[k], state)});
const cases = [
  [3,'第一章','进行中',false], [3,'终章','未开始',false], [3,'终章','进行中',false],
  [3,'终章','已结束',true], [4,'序章','未开始',true], [3,'错误章节','已结束',false],
  [4,'错误章节','已结束',false], [4,'序章','错误阶段',false], [20,'序章','已结束',false]
];
for (const [v,c,p,expected] of cases) {
  const state = {场景:{当前卷:v,当前章:c,阶段:p}};
  const before = JSON.stringify(state);
  assert.equal(render(titleDraft, state).includes('“无冕剑王”'), expected);
  assert.equal(JSON.stringify(state), before);
}
assert(!render(titleDraft, undefined).includes('“无冕剑王”'));
assert(!render(titleDraft + titleDraft, {场景:{当前卷:3,当前章:'第一章',阶段:'进行中'}}).includes('<%'));
const init = read(path.join(__dirname, '03-变量初始化-草稿.yaml'));
assert.equal(init, book.entries['3'].content);
const chatDir = st + '/data/default-user/chats/落第骑士英雄谭v0.12';
const chat = read(chatDir + '/落第骑士英雄谭v0.12 - 2026-10-11@23h22m38s593ms.jsonl').trim().split(/\r?\n/).map(JSON.parse);
const state = [...chat].reverse().find(x => x.variables?.[0]?.stat_data)?.variables[0].stat_data;
assert(state);
const beforeState = JSON.stringify(state);
const oldList = render(book.entries['8'].content, state);
const newList = render(read(path.join(__dirname, '04-变量列表-草稿.ejs')), state);
const stateBlock = s => s.match(/<status_current_variable>([\s\S]*?)<\/status_current_variable>/)[1];
assert.equal(stateBlock(oldList), stateBlock(newList));
assert.equal(JSON.stringify(state), beforeState);
const h = value => crypto.createHash('sha256').update(value).digest('hex');
(async () => {
  const {SentencePieceProcessor} = require(st + '/node_modules/@agnai/sentencepiece-js');
  const sp = new SentencePieceProcessor();
  await sp.load(st + '/src/tokenizers/gemma.model');
  const count = text => sp.encodeIds('system\n\n' + text).length - 1;
  const results = [];
  for (const [uid,name] of [[10,'01-MVU变量更新规则-草稿.txt'],[41,'02-MVU变量更新格式-草稿.txt']]) {
    const original = book.entries[String(uid)].content;
    const draft = read(path.join(__dirname,name));
    results.push({uid,name,sourceCharsBefore:original.length,sourceCharsAfter:draft.length,sourceTokensBefore:count(original),sourceTokensAfter:count(draft),renderedTokensBefore:count(render(original,state)),renderedTokensAfter:count(render(draft,state)),sha256:h(draft)});
  }
  results.push({uid:8,name:'04-变量列表-草稿.ejs',renderedTokensBefore:count(oldList),renderedTokensAfter:count(newList),projectionIdentical:true});
  const totalBefore = results.reduce((n,x)=>n+x.renderedTokensBefore,0);
  const totalAfter = results.reduce((n,x)=>n+x.renderedTokensAfter,0);
  const report={scope:'离线草稿核对，不是实机最终请求或服务商计费',tokenizer:'安装目录 gemma.model，system wrapper 与前轮对齐',scene:{当前卷:state.场景?.当前卷,当前章:state.场景?.当前章,阶段:state.场景?.阶段},titleBoundaryCases:cases.length+2,initByteIdentical:true,initDisabled:book.entries['3'].disable,initSha256:h(init),stateUnchanged:true,results,totalBefore,totalAfter,saved:totalBefore-totalAfter,reductionPercent:Math.round(1000*(totalBefore-totalAfter)/totalBefore)/10};
  write('离线核对.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
