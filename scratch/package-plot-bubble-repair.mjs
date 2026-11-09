import fs from 'node:fs';
import crypto from 'node:crypto';
const root='C:/Users/eriri/AppData/Local/Temp/rakudai-plot-bubble-repro-20261107/baseline/';
const out='output/plot-bubble-repair-20261107';
const read=f=>fs.readFileSync(f,'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const terminalId='51fe1880-ee64-432f-b800-4b2657310967', plotId='c6b247ce-164f-4f1e-9952-02731a212df2';
const priorTerminal=JSON.parse(read(root+terminalId+'.json')), priorPlot=JSON.parse(read(root+plotId+'.json'));
const builtTerminal=JSON.parse(read('世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json'));
const marker='function createRakudaiWorldbookReader(';
const boundary=priorPlot.content.indexOf(marker);
if(boundary<0) throw new Error('Missing plot boundary');
const prefix=priorPlot.content.slice(0,boundary);
const content=prefix+read('scripts/rakudai-worldbook-reader.js')+'\n'+read('scripts/rakudai-plot-runtime.js')+'\n'+read('scripts/rakudai-plot-bootstrap.js')+'\n})();\n';
const items=[{artifactName:'asterisk-story-terminal',value:{...priorTerminal,content:builtTerminal.content,
  name:'落第 × 学战·双作品终端（剧情控制 20261107.1）',info:priorTerminal.info+' 20261107.1：六花首页增加剧情控制入口；按绑定世界书核对可用章，显式切章复用MVU事务；卷号保持空。'}},
  {artifactName:'world-story-injector',value:{...priorPlot,content,name:'落第 × 学战·卷章剧情注入器 v3.0.0（20261107.1）',info:priorPlot.info+' 20261107.1：学战按order200起独立读取；下一章不可用时仅结束本章，不自动切章。下一章核验与当前条目共用读取并参与发送前复核。'}}];
fs.writeFileSync(out+'/update-spec.json',JSON.stringify({schemaVersion:1,deliveryMode:'component',kind:'helper-script',items},null,2));
fs.writeFileSync(out+'/preservation.json',JSON.stringify({mode:'component',components:items.map((item,i)=>{
  const before=i===0?priorTerminal:priorPlot;
  const untouched=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!['content','name','info'].includes(k)));
  if(JSON.stringify(untouched(before))!==JSON.stringify(untouched(item.value))) throw new Error('Unrelated fields changed');
  return {id:before.id,beforeContentSha256:hash(before.content),afterContentSha256:hash(item.value.content),preservedFields:Object.keys(untouched(before))};
}),plotUnchangedPrefixSha256:hash(prefix),plotPreservedPrefixCharacters:prefix.length,wholeCardOutput:false},null,2));
console.log('Prepared two helper components; existing IDs, settings, buttons and unknown fields preserved.');
