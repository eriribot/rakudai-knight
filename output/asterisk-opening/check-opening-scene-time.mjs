import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const build = spawnSync('python', ['output/asterisk-opening/build-preview.py', '--stdout'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
assert.equal(build.status, 0, build.stderr);
const html = build.stdout;
const start = html.indexOf('      function openingReferenceCandidates(');
const end = html.indexOf('      function packOpeningReferences(', start);
const mode = fs.readFileSync('output/asterisk-opening/asterisk-mode.js', 'utf8');
const prompts = fs.readFileSync('output/asterisk-opening/asterisk-prompts.js', 'utf8');
const book = JSON.parse(fs.readFileSync('output/asterisk-chapter-alignment-20261106/世界书-实机原始备份.json', 'utf8'));
const entries = Object.values(book.entries).map(e => ({ uid:e.uid, name:e.comment, enabled:!e.disable, probability:e.probability, position:{order:e.order}, content:e.content, strategy:{keys:e.key} }));
const canonicalTime = '西历 2013 年 6 月 12 日（星期三）清晨（早于与学生会长克劳蒂雅约定的会面时间）';
const state = { world_id:'asterisk',school_id:'seidoukan',profile:{name:'测试'},context:{},asterisk:{},scene:{当前章:'待选择',时间:'',地点:'',切入说明:''},greeting:'' };
const nodes = new Map();
const node = id => { if(!nodes.has(id)) nodes.set(id,{value:'',textContent:'',checked:false}); return nodes.get(id); };
let books = [{name:'主世界书',entries}], duringLoad;
const realm = vm.createContext({ console, OPENING_CHAPTERS:['待选择','序章'], OPENING_FIELDS:{name:'姓名'}, CONTEXT_FIELDS:{}, CHARACTER_SCOPE_PROMPT:'',
  document:{getElementById:node}, readOpeningDraft:()=>state,
  openingHelper:()=>async()=>({primary:'主世界书',additional:[]}),
  loadOpeningWorldbooks:async()=>{if(duringLoad)duringLoad();return {names:books.map(b=>b.name),books};},
  openingBoundWorldbooks:()=>['主世界书'], openingReferenceChoices:{profile:null,greeting:null},
  openingReferenceKey:e=>JSON.stringify([e.worldbook||e.book,e.uid]), showOpeningReferenceStatus(){},
  setSceneInputs(scene){state.scene=JSON.parse(JSON.stringify(scene));}, editScene(){}, editGreeting(){}
});
vm.runInContext(mode+'\n'+prompts+'\n'+html.slice(start,end),realm);
realm.activeOpeningWorld='asterisk';
let checks=0;
const check=(label,run)=>{run();checks++;};
check('same-name Rakudai scene remains excluded',()=>assert.equal(realm.asteriskScenePosition(entries.find(e=>e.uid===15)),-1));
check('non-plot character order 201 excluded',()=>assert.equal(realm.asteriskScenePosition(entries.find(e=>e.uid===11)),-1));
check('disabled Asterisk chapter mapped by order',()=>assert.equal(realm.asteriskScenePosition(entries.find(e=>e.uid===46)),1));
check('export order and helper position.order agree',()=>assert.equal(realm.asteriskScenePosition({name:'[剧情]任意标题',order:201}),1));
check('chapter content detector preserves EJS/script/update rejection',()=>{
  for (const [content,accepted] of [
    ['时间：清晨\n普通剧情',true], ['时间：清晨\n<% const x = 1; %>',false],
    ['时间：清晨\n<script>内容</script>',false], ['时间：清晨\n<SCRIPT type="module">',false],
    ['时间：清晨\n<UpdateVariable>内容',false], ['时间：清晨\n&LT;% 文字',true],
  ]) assert.equal(!!realm.asteriskOpeningScene({name:'[剧情]第一章',order:201,content}),accepted);
});
check('manual picker includes disabled Asterisk scene',()=>assert.ok(realm.openingReferenceCandidates(books,'',true).some(e=>e.uid===46)));
check('automatic recommendations do not inject disabled chapters',()=>assert.ok(!realm.openingReferenceCandidates(books,'华焰魔女',false).some(e=>e.uid===46)));
check('manual picker does not include disabled Rakudai scene',()=>assert.ok(!realm.openingReferenceCandidates(books,'',true).some(e=>e.uid===15)));
const before=JSON.stringify(entries);
await realm.applyAsteriskSceneTemplate('ceremony');
check('first chapter reads actual primary-book date',()=>assert.equal(state.scene.时间,canonicalTime));
check('first chapter retains routing key and first place',()=>{assert.equal(state.scene.当前章,'第一章');assert.equal(state.scene.地点,'星导馆学园·散步道');});
check('worldbook was not enabled or rewritten',()=>assert.equal(JSON.stringify(entries),before));
check('chosen reference preserves full original content',()=>assert.equal(realm.openingReferenceChoices.greeting.references[0].content,entries.find(e=>e.uid===46).content));
check('scene still awaits user confirmation',()=>assert.equal(node('opening-scene-confirmed').checked,false));
state.scene.时间='玩家指定次日';state.scene.地点='玩家指定地点';
await realm.applyAsteriskSceneTemplate('ceremony');
check('explicit time/place survive worldbook template',()=>{assert.equal(state.scene.时间,'玩家指定次日');assert.equal(state.scene.地点,'玩家指定地点');});
books=[{name:'主世界书',entries:entries.concat({...entries.find(e=>e.uid===46),uid:999})}];
await realm.applyAsteriskSceneTemplate('ceremony');
check('duplicate error shown and draft untouched',()=>{assert.match(node('greeting-feedback').textContent,/唯一/);assert.equal(state.scene.时间,'玩家指定次日');});
books=[{name:'主世界书',entries}];
duringLoad=()=>{state.scene.时间='读取期间手改';};
await realm.applyAsteriskSceneTemplate('ceremony');
check('late read cannot overwrite newer draft',()=>{assert.match(node('greeting-feedback').textContent,/读取期间/);assert.equal(state.scene.时间,'读取期间手改');});
duringLoad=null;realm.activeAcademyId='jielong';state.school_id='jielong';
await realm.applyAsteriskSceneTemplate('ceremony');
check('other academies keep original scene and school',()=>{assert.equal(state.scene.当前章,'原创开场');assert.equal(state.scene.地点,'界龙第七学院·校园入口');assert.equal(state.scene.时间,'读取期间手改');});
const prompt=realm.buildAsteriskGreetingPrompts(state)[0].content;
check('AI has explicit date precedence without 2013 prohibition',()=>{assert.match(prompt,/玩家已填时间 > 所选世界书/);assert.ok(!prompt.includes('不套用落第2013年日期'));assert.match(prompt,/原创开场/);});
console.log(JSON.stringify({passed:true,checks,actualWorldbookDate:canonicalTime,worldbookUnchanged:true,existingDraftPreserved:true}));
