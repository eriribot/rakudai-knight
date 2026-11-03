// 学战 DLC 预览：只扩展开局草稿，不把学战数据写入落第 MVU。
var activeOpeningWorld = "rakudai";
var activeAcademyId = "seidoukan";
var openingWorldDrafts = {};
var AST_CATEGORIES = ["星脉世代（无魔术师异能）", "魔术师", "自定义（见能力说明）"];
var AST_CHAPTERS = ["待选择", "入学报到", "学园日常", "决斗准备", "星武祭前夕", "自定义场景"];
var RAKUDAI_CHAPTERS = OPENING_CHAPTERS.slice();
var AST_SCHOOLS = {
  seidoukan: {name:"星导馆学园",en:"SEIDOUKAN ACADEMY",glyph:"星",number:"01",description:"自由的校风容纳不同的愿望。以你的武装与伙伴，在六花的舞台上寻找属于自己的答案。",tags:["自由校风","多样战术","星脉人才"],accent:"#087F96",soft:"#E4F5F7",dark:"#122C37",secondary:"#D2447D"},
  gallardworth: {name:"圣嘉莱多瓦思学园",en:"ST. GALAHADWORTH",glyph:"圣",number:"02",description:"秩序、忠诚与骑士风范。以纪律磨砺力量，在集体的荣耀与个人的信念之间写下自己的誓言。",tags:["秩序与忠诚","骑士风范","团队协作"],accent:"#8C6518",soft:"#FAF3DF",dark:"#172E45",secondary:"#3D78AA"},
  jielong: {name:"界龙第七学院",en:"JIE LONG SEVENTH",glyph:"龙",number:"03",description:"东方武学与星仙术在此交汇。门派、师承与修行各有道路，实力要在一次次练习与交手中证明。",tags:["东方武学","星仙术","修行与实战"],accent:"#A4432D",soft:"#FBEEE6",dark:"#3A251F",secondary:"#A57A26"},
  rewolf: {name:"雷渥夫黑学园",en:"LE WOLFE BLACK",glyph:"狼",number:"04",description:"崇尚强者，竞争从不缺席。在决斗与利益交织的学园里，决定你如何运用力量，也决定你为何而战。",tags:["强者竞争","决斗文化","个人意志"],accent:"#7951AC",soft:"#F0EAF8",dark:"#241D34",secondary:"#BF426D"},
  arlequint: {name:"阿勒坎特学园",en:"ALLEKANT ACADEMY",glyph:"研",number:"05",description:"研究班与实践班共同探索落星工学。把构想变成装置，再让实战检验每一个大胆的假说。",tags:["落星工学","研究与实践","武装研发"],accent:"#147B68",soft:"#E4F5EF",dark:"#143831",secondary:"#2789A4"},
  queenvail: {name:"葵恩薇儿女学园",en:"QUEENVALE ACADEMY",glyph:"葵",number:"06",description:"女子学园，兼重战斗资质与舞台魅力。本版本仅开放男性玩家入学。",tags:["女子学园","舞台魅力"],accent:"#A2578C",soft:"#F8EBF4",dark:"#3C2739",secondary:"#BA759E",disabled:true}
};
var AST_WEAPONS = {undecided:"尚未确定",conventional:"常规武器",lux:"煌式武装",orga:"纯星煌式武装",research:"研究装备",none:"不使用武装"};
function isAsteriskMode() { return activeOpeningWorld === "asterisk"; }
function selectedAcademy() { return AST_SCHOOLS[activeAcademyId]; }
function asteriskWeaponLabel(type) { return AST_WEAPONS[type] || "尚未确定"; }
function asteriskRankLabel(data) {
  if (data.rank_status === "unknown") return "尚未确定";
  if (data.rank_status !== "ranked") return "未上榜";
  return Number.isInteger(data.rank) && data.rank >= 1 && data.rank <= 72 ? "序列第 " + data.rank + " 位" + (data.rank <= 12 ? " · 始页十二人" : " · 在名祭祀书") : "名次待填写";
}
function readAsteriskFields() {
  var status = document.getElementById("aw-rank-status").value;
  var raw = document.getElementById("aw-rank-number").value;
  return {rank_status:status,rank:status === "ranked" && raw !== "" ? Number(raw) : null,prana:document.getElementById("aw-prana").value.trim(),weapon_type:document.getElementById("aw-weapon-type").value,weapon_notes:document.getElementById("aw-weapon-notes").value.trim()};
}
function applyAsteriskFields(data) {
  data = data || {rank_status:"unranked",rank:null,prana:"",weapon_type:"undecided",weapon_notes:""};
  document.getElementById("aw-rank-status").value = data.rank_status;
  document.getElementById("aw-rank-number").value = data.rank === null ? "" : data.rank;
  document.getElementById("aw-prana").value = data.prana;
  document.getElementById("aw-weapon-type").value = data.weapon_type;
  document.getElementById("aw-weapon-notes").value = data.weapon_notes;
  syncAsteriskFieldState();
}
function syncAsteriskFieldState() {
  var ranked = isAsteriskMode() && document.getElementById("aw-rank-status").value === "ranked";
  document.getElementById("aw-rank-number-field").hidden = !ranked;
  var input = document.getElementById("aw-rank-number"); input.required = ranked; input.disabled = !ranked;
  document.getElementById("aw-rank-description").textContent = asteriskRankLabel(readAsteriskFields());
}
function editAsteriskFields() { syncAsteriskFieldState(); handleProfileEdit(); }
function invalidateOpeningWorld() {
  aiDraftRevision++; greetingRevision++; openingUiRevision++; openingReferenceLoad++; avatarLoadRevision++;
  openingReceipt = null; openingPendingAttempt = null;
  openingReferenceChoices = {profile:null,greeting:null}; openingReferencePicker = null;
  var picker = document.getElementById("lk-reference-dialog"); if (picker.open) picker.close();
  document.getElementById("opening-scene-confirmed").checked = false;
  ["archive-feedback","ai-assistance-status","ai-assistance-result","greeting-feedback"].forEach(function(id){var e=document.getElementById(id); if(e.tagName === "TEXTAREA") e.value=""; else e.textContent="";});
  document.getElementById("opening-preview").hidden = true;
  ["ai-worldbook-status","greeting-worldbook-status"].forEach(function(id){document.getElementById(id).textContent="参考选择已按当前世界重置；可重新选择绑定世界书中的资料。";});
}
function worldText(selector, value) {
  document.querySelectorAll(selector).forEach(function(el){
    if (el.dataset.rakudaiText === undefined) el.dataset.rakudaiText=el.textContent;
    el.textContent=isAsteriskMode()?value:el.dataset.rakudaiText;
  });
}
function worldPlaceholder(id, value) {
  var el=document.getElementById(id); if(el.dataset.rakudaiPlaceholder===undefined)el.dataset.rakudaiPlaceholder=el.placeholder;
  el.placeholder=isAsteriskMode()?value:el.dataset.rakudaiPlaceholder;
}
function applyWorldFieldLocks() {
  var ast=isAsteriskMode();
  RATING_AXES.forEach(function(k){var el=document.getElementById("stat-"+k);el.required=!ast;el.disabled=ast||activeStartProfile==="kurogane";el.closest(".form-grid-3").hidden=ast;});
  document.getElementById("input-school").readOnly=ast||activeStartProfile==="kurogane";
  document.getElementById("rating-panel").hidden=ast||activeStartProfile==="kurogane";
  syncAsteriskFieldState();
}
function applyWorldSkin() {
  var ast=isAsteriskMode(),school=selectedAcademy();
  document.body.dataset.world=activeOpeningWorld;document.body.dataset.school=activeAcademyId;
  ["accent","soft","dark","secondary"].forEach(function(k){document.body.style.setProperty("--ast-"+k,school[k]);});
  document.title=ast?"学战都市 · "+school.name+" · 开局档案":"落第骑士英雄谭 · 第一卷入学档案";
  document.querySelectorAll("[data-world-choice]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.worldChoice===activeOpeningWorld));});
  ["aw-academy-picker","asterisk-campus-stage","aw-enrollment-strip","aw-rank-panel","aw-live-record","aw-record-extended"].forEach(function(id){document.getElementById(id).hidden=!ast;});
  document.querySelector("#scene-narrative > .opening-layout").hidden=false;
  document.querySelectorAll('[data-profile-key="kurogane"]').forEach(function(el){el.hidden=ast;el.disabled=ast;});
  document.querySelectorAll('[onclick="RakudaiOpening.readConfirmedScene()"], #apply-player-avatar-button, .final-avatar-note').forEach(function(el){el.hidden=ast;});
  document.getElementById("bgm-widget-container").hidden=false;
  document.querySelectorAll(".card-parameter-section,.card-notes-section,.stamp-seal").forEach(function(el){el.hidden=ast;});
  worldText(".top-subtitle",school.name+" · 星脉世代入学登记 / ASTERISK ENTRY");
  worldText("#nav-step-1 span","① 序章启程");worldText("#nav-step-2 span","② 学生登记");worldText("#nav-step-3 span","③ 档案确认");
  worldText(".panel-register > .identity-help:first-of-type","登记你的身份、能力与武装；暂无的必填项目请写“无”。星辰力可用文字描述，照片可选。");
  worldText("#profile-fields > summary","人物资料与武装 · AI 辅助补全");
  worldText(".lk-ai-subtitle","档案 · 星脉能力 · 武装设定");
  worldText("#ai-assistance > p.lk-archive-note:not([id])","写下人物构思，按所选学园补全能力与武装。已有内容保留，新建议先填入草稿，由你检查后确认。");
  worldText('label[for="input-device"]',"武装名称");worldText('label[for="input-category"]',"能力身份");
  worldText('label[for="input-ability"]',"能力与武装机理");worldText('label[for="input-limits"]',"能力共通限制");
  worldText('label[for="input-noble-art"]',"能力／武装招式（可多项，选填）");
  worldPlaceholder("input-device","煌式武装或其他武器名称；未持有请写“无”");
  worldPlaceholder("input-ability","分别说明星辰力运用、个人异能与武装功能；普通星脉世代无需虚构魔术师异能");
  worldPlaceholder("input-school",school.name);
  worldPlaceholder("input-limits","作用距离、发动条件、负担与已知弱点；不确定的事项如实标明");
  worldText("#opening-greeting-panel .collapsible-body > p:first-child","选择所选学园的切入场景，再写登场动作。使用相对时间即可；具体赛事与原作进度由本局设定确认。");
  worldText('label[for="opening-chapter"]',"切入阶段");
  worldText("#opening-greeting-panel .preset-label","学园生活切入模板：");
  worldPlaceholder("opening-time","如：入学报到日·上午；未确定的公历年份不必编造");
  worldPlaceholder("opening-location",school.name+"·具体场所");
  worldText('[onclick="RakudaiOpening.applySceneTemplate(\'training\')"]',"训练场·初次练习");
  worldText('[onclick="RakudaiOpening.applySceneTemplate(\'dorm\')"]',"宿舍·入学报到");
  worldText('[onclick="RakudaiOpening.applySceneTemplate(\'director\')"]',"接待处·入学面谈");
  worldText('[onclick="RakudaiOpening.applySceneTemplate(\'ceremony\')"]',"学园日常·初识六花");
  worldText("#opening-scene-feedback","场景仅属于本次学战草稿。请核对时间、地点与开场白的一致性。");
  worldText(".stage-header-title",school.name+" · 学生入学档案");
  worldText(".final-record-trigger-wrap button","查看序列与学生档案");worldText("#final-record-title","序列与学生档案");
  worldText("#opening-commit-button","确认草稿并预览开局");
  worldText(".btn-to-confirm","下一步：确认学生档案 →");
  worldText("#archive-room-panel .lk-archive-slots ~ .lk-archive-note","本机槽位只保存人物草稿。学战预览版可保存、导出与复制，不会把资料写进落第的聊天状态。");
  worldText("#start-archive-dialog > p","新建或读取人物草稿。读取会恢复世界、学园和人物设定，不会自动开始剧情。");
  worldText("#aw-enrollment-school",school.name);
  var category=document.getElementById("input-category"),current=category.value;
  if(!category.dataset.rakudaiOptions)category.dataset.rakudaiOptions=JSON.stringify(Array.from(category.options).map(function(o){return [o.text,o.value];}));
  var opts=ast?[["待定 / 留给 AI 建议",""]].concat(AST_CATEGORIES.map(function(v){return [v,v];})):JSON.parse(category.dataset.rakudaiOptions);
  category.replaceChildren();opts.forEach(function(o){category.add(new Option(o[0],o[1]));});category.value=current;
  var chapter=document.getElementById("opening-chapter"),chapterValue=chapter.value;
  OPENING_CHAPTERS=ast?AST_CHAPTERS.slice():RAKUDAI_CHAPTERS.slice();chapter.replaceChildren();OPENING_CHAPTERS.forEach(function(v){chapter.add(new Option(v,v));});chapter.value=OPENING_CHAPTERS.includes(chapterValue)?chapterValue:"待选择";
  document.querySelectorAll("[data-school-id]").forEach(function(button){button.setAttribute("aria-pressed",String(button.dataset.schoolId===activeAcademyId));});
  document.getElementById("aw-selected-school").textContent=school.name;document.getElementById("aw-selected-school-en").textContent=school.en;
  document.getElementById("aw-school-description").textContent=school.description;document.getElementById("aw-detail-code").textContent="ACADEMY "+school.number;
  document.getElementById("aw-detail-badge").src=openingMediaUrl(OPENING_ASTERISK_MEDIA.emblems[activeAcademyId]);
  document.getElementById("aw-detail-badge").alt=school.name+"校徽";
  var tags=document.getElementById("aw-school-tags");tags.replaceChildren();school.tags.forEach(function(t){var s=document.createElement("span");s.textContent=t;tags.append(s);});
  applyWorldFieldLocks();
  applyNovelWorld();
}
function loadAsteriskPreset() {
  invalidateOpeningWorld();activeStartProfile="user";customGreetingDraft="";
  Object.keys(OPENING_FIELDS).forEach(function(k){document.getElementById(OPENING_FIELDS[k]).value=k==="school"?selectedAcademy().name:"";});
  RATING_AXES.forEach(function(k){document.getElementById("stat-"+k).value="";});
  Object.keys(CONTEXT_FIELDS).forEach(function(k){document.getElementById(CONTEXT_FIELDS[k]).value="";});
  setSceneInputs({"当前章":"待选择","时间":"","地点":"","切入说明":""});
  document.getElementById("opening-greeting").value="";document.getElementById("opening-greeting").readOnly=false;
  document.getElementById("generate-greeting").hidden=false;document.getElementById("ai-assistance").hidden=false;
  applyAsteriskFields();setProfileAvatar("user");setActiveProfileChip("user");setFormLockedState(false);applyWorldSkin();setProfileHelp("玩家主角");syncCard();
}
function chooseOpeningWorld(world) {
  if(!["rakudai","asterisk"].includes(world)||world===activeOpeningWorld)return;
  if(openingCommitBusy){archiveFeedback("人物提交尚未完成，请完成后再切换世界。",true);return;}
  openingWorldDrafts[activeOpeningWorld]=readOpeningDraft();invalidateOpeningWorld();
  activeOpeningWorld=world;applyWorldSkin();
  if(openingWorldDrafts[world])applyOpeningDraft(openingWorldDrafts[world],true);
  else {customGreetingDraft="";document.getElementById("opening-greeting").value="";loadPreset("user");}
  switchScene(1);
}
function selectAcademy(id) {
  var school=AST_SCHOOLS[id];if(!Object.prototype.hasOwnProperty.call(AST_SCHOOLS,id)||school.disabled||!isAsteriskMode()||openingCommitBusy)return;
  if(id===activeAcademyId)return;
  invalidateOpeningWorld();activeAcademyId=id;document.getElementById("input-school").value=school.name;
  applyWorldSkin();setProfileHelp("玩家主角");syncCard();
  document.getElementById("opening-scene-feedback").textContent="所属学园已更换；人物构思保留，请重新核对地点、武装资格与背景中的学园名称。";
}
function enterAcademy() { if(!isAsteriskMode())return;document.getElementById("aw-academy-picker").open=false;switchScene(2); }
function initializeWorldUI() {
  openingWorldInitializing=true;
  initializeNovelWorld();
  var grid=document.getElementById("aw-school-grid");
  Object.keys(AST_SCHOOLS).filter(function(id){return !AST_SCHOOLS[id].disabled;}).forEach(function(id){var s=AST_SCHOOLS[id],b=document.createElement("button");b.type="button";b.className="aw-school";b.dataset.schoolId=id;b.setAttribute("aria-pressed",String(id===activeAcademyId));b.style.setProperty("--school-color",s.accent);b.style.setProperty("--school-soft",s.soft);
    var crest=document.createElement("img");crest.className="aw-crest";crest.src=openingMediaUrl(OPENING_ASTERISK_MEDIA.emblems[id]);crest.alt=s.name+"校徽";crest.width=112;crest.height=130;b.append(crest);
    [["aw-school-number",s.number],["aw-school-name",s.name],["aw-school-en",s.en],["aw-school-trait",s.tags.join(" / ")],["aw-school-status","选择此学园 ↗"]].forEach(function(pair){var span=document.createElement("span");span.className=pair[0];span.textContent=pair[1];b.append(span);});
    b.onclick=function(){selectAcademy(id);};grid.append(b);
  });
  var params=new URLSearchParams(location.search);
  if(params.get("world")==="asterisk") {var school=params.get("school");if(Object.prototype.hasOwnProperty.call(AST_SCHOOLS,school)&&!AST_SCHOOLS[school].disabled)activeAcademyId=school;chooseOpeningWorld("asterisk");}
  else applyWorldSkin();
  document.getElementById("aw-prompt-preview").addEventListener("toggle",updatePromptPreview);
  updatePromptPreview();
  openingWorldInitializing=false;
}
function updatePromptPreview() {
  var panel=document.getElementById("aw-prompt-preview");if(!panel||!panel.open)return;
  var draft=readOpeningDraft();document.getElementById("aw-profile-prompt").value=buildAiAssistancePrompt(draft);
  document.getElementById("aw-greeting-prompt").value=buildGreetingPrompts(draft).map(function(p){return "【"+p.role+"】\n"+p.content;}).join("\n\n");
}
function readAsteriskDraft() {
  var profile={},scene={},context={};
  Object.keys(OPENING_FIELDS).forEach(function(k){profile[k]=document.getElementById(OPENING_FIELDS[k]).value.trim();});
  profile.school=selectedAcademy().name;
  Object.keys(SCENE_FIELDS).forEach(function(k){scene[k]=document.getElementById(SCENE_FIELDS[k]).value.trim();});
  Object.keys(CONTEXT_FIELDS).forEach(function(k){context[k]=document.getElementById(CONTEXT_FIELDS[k]).value.trim();});
  return {format:ARCHIVE_FORMAT,schema_version:ARCHIVE_VERSION,world_id:"asterisk",school_id:activeAcademyId,profile_key:"user",profile:profile,asterisk:readAsteriskFields(),scene:scene,context:context,greeting:document.getElementById("opening-greeting").value.trim(),avatar:avatarState==="uploaded"?document.getElementById("card-avatar-img").getAttribute("src"):null};
}
function validateAsteriskArchive(data) {
  if(data.format!==ARCHIVE_FORMAT||data.schema_version!==ARCHIVE_VERSION||data.profile_key!=="user")throw new Error("学战档案格式不受支持；本版本仅支持男性自定义学生。");
  var school=AST_SCHOOLS[data.school_id];
  if(!Object.prototype.hasOwnProperty.call(AST_SCHOOLS,data.school_id)||school.disabled)throw new Error("所属学园不可用：男性版本不能在葵恩薇儿女学园入学。");
  if(!data.profile||typeof data.profile!=="object"||Array.isArray(data.profile))throw new Error("人物资料不完整。");
  var p={};Object.keys(OPENING_FIELDS).forEach(function(k){var v=data.profile[k];if(typeof v!=="string"||v.length>FIELD_LIMITS[k])throw new Error("人物字段格式不正确："+k);p[k]=v;});
  if(p.school!==school.name)throw new Error("档案中的所属名称与所选学园不一致。");
  if(p.category!==""&&!AST_CATEGORIES.includes(p.category))throw new Error("学战能力身份不受支持。");
  parseAbilityLines(p.nobleArt,"能力／武装招式");parseAbilityLines(p.otherAbilities,"其他技艺");
  var a=data.asterisk;if(!a||typeof a!=="object"||Array.isArray(a))throw new Error("缺少学战星脉档案。");
  if(!["unranked","ranked","unknown"].includes(a.rank_status))throw new Error("校内序列状态不正确。");
  if(a.rank_status==="ranked"&&(!Number.isInteger(a.rank)||a.rank<1||a.rank>72))throw new Error("校内序列必须是 1–72 的整数。");
  if(!Object.prototype.hasOwnProperty.call(AST_WEAPONS,a.weapon_type))throw new Error("武装类别不受支持。");
  ["prana","weapon_notes"].forEach(function(k){if(typeof a[k]!=="string"||a[k].length>1200)throw new Error("星脉或武装说明格式不正确。");});
  if(data.avatar!==null&&(typeof data.avatar!=="string"||data.avatar.length>ARCHIVE_LIMIT/2||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.avatar)))throw new Error("档案照片格式不正确。");
  if(typeof data.greeting!=="string"||data.greeting.length>6000)throw new Error("开场白格式不正确。");
  var context={};if(!data.context||typeof data.context!=="object"||Array.isArray(data.context))throw new Error("状态补充格式不正确。");
  Object.keys(CONTEXT_FIELDS).forEach(function(k){var v=data.context[k]===undefined?"":data.context[k];if(typeof v!=="string"||v.length>1200)throw new Error("状态补充字段不正确："+k);context[k]=v;});
  return {format:ARCHIVE_FORMAT,schema_version:ARCHIVE_VERSION,world_id:"asterisk",school_id:data.school_id,profile_key:"user",profile:p,asterisk:{rank_status:a.rank_status,rank:a.rank_status==="ranked"?a.rank:null,prana:a.prana,weapon_type:a.weapon_type,weapon_notes:a.weapon_notes},avatar:data.avatar,greeting:data.greeting,scene:validateScene(data.scene,false,"asterisk"),context:context};
}
function prepareIncomingWorld(world,school) {
  if(activeOpeningWorld!==world)openingWorldDrafts[activeOpeningWorld]=readOpeningDraft();
  invalidateOpeningWorld();activeOpeningWorld=world;
  if(world==="asterisk")activeAcademyId=school;
  applyWorldSkin();
}
function applyAsteriskDraft(draft,restoreMemory) {
  // The in-memory cache is produced by this form and must preserve incomplete edits.
  // File/slot imports still pass strict validateArchive before applying.
  if(!restoreMemory)draft=validateAsteriskArchive(draft);
  prepareIncomingWorld("asterisk",draft.school_id);loadAsteriskPreset();
  Object.keys(OPENING_FIELDS).forEach(function(k){document.getElementById(OPENING_FIELDS[k]).value=draft.profile[k];});
  Object.keys(CONTEXT_FIELDS).forEach(function(k){document.getElementById(CONTEXT_FIELDS[k]).value=draft.context[k];});
  applyAsteriskFields(draft.asterisk);setSceneInputs(draft.scene);document.getElementById("opening-greeting").value=draft.greeting;
  applyArchiveAvatar(draft.avatar);syncCard();
}
function syncAsteriskCard() {
  var draft=readAsteriskDraft(),p=draft.profile,school=selectedAcademy();validateAbilityInputs();
  var text={"card-name":p.name||"未命名","card-personality":p.personality||"性格待补充","card-conduct-val":p.conduct||"待补充","card-route-val":"男性 · 自定义学生","card-school-val":school.name,"card-rank-label":"校内序列：","card-rank-val":asteriskRankLabel(draft.asterisk),"card-device-val":p.device||"尚未登记","card-category-val":p.category||"尚未确定","card-noble-val":p.nobleArt||"未登记命名招式","card-other-abilities-val":p.otherAbilities||"未登记","card-profile-text":p.desc||"等待补充个人简介。","card-ability-text":"能力与武装机理："+(p.ability||"待补充"),"card-limits-text":"共通限制："+(p.limits||"待补充"),"card-style-text":"战斗风格："+(p.style||"待补充"),"aw-record-school":school.name,"aw-record-name":p.name||"等待你的名字","aw-record-personality":p.personality||"性格与处事风格由你定义。","aw-record-type":p.category||"尚未确定","aw-record-rank":asteriskRankLabel(draft.asterisk),"aw-record-weapon":p.device||"尚未登记","ability-draft-help":"以文字记录星辰力与实际能力。校内序列单独设定，不计算综合战力等级。","register-feedback":school.name+" · "+(p.name||"未命名")+" · 学生档案草稿"};
  Object.keys(text).forEach(function(id){document.getElementById(id).textContent=text[id];});
  document.getElementById("card-rank-item").hidden=false;
  var nobleLabel=document.getElementById("card-noble-val").previousElementSibling;
  if(!nobleLabel.dataset.rakudaiText)nobleLabel.dataset.rakudaiText=nobleLabel.textContent;nobleLabel.textContent="能力招式：";
  var live=document.getElementById("aw-record-extended");
  if(live)live.textContent="星辰力："+(draft.asterisk.prana||"尚未填写")+"\n武装类别："+asteriskWeaponLabel(draft.asterisk.weapon_type)+"\n使用条件："+(draft.asterisk.weapon_notes||"尚未填写");
  updateOpeningPreview(draft);updatePromptPreview();
}
function buildAsteriskOpeningMessage(draft) {
  var p=draft.profile,a=draft.asterisk;
  var lines=["【学战都市 Asterisk · 开局档案草稿】","本内容是待确认的人物与场景设定，尚未写入聊天或开始剧情。","玩家："+(p.name||"未命名"),"性别：男性","所属学园："+AST_SCHOOLS[draft.school_id].name,"校内序列（本局开局设定）："+asteriskRankLabel(a),"性格："+p.personality,"处事风格："+p.conduct,"能力身份："+p.category,"角色简介："+p.desc,"星辰力与运用："+(a.prana||"尚未确定"),"武装类别："+asteriskWeaponLabel(a.weapon_type),"武装名称："+p.device,"武装适合与使用条件："+(a.weapon_notes||"尚未确定"),"能力与武装机理："+p.ability,"共通限制："+p.limits,"战斗风格："+p.style,"能力／武装招式（名称｜说明｜条件与代价）：\n"+(p.nobleArt||"未登记"),"其他技艺：\n"+(p.otherAbilities||"未登记")];
  Object.keys(CONTEXT_FIELDS).forEach(function(k){if(draft.context[k])lines.push(k+"："+draft.context[k]);});
  lines.push("","【待确认的切入场景】");Object.keys(SCENE_FIELDS).forEach(function(k){lines.push((k==="当前章"?"切入阶段":k)+"："+(draft.scene[k]||"待填写"));});
  if(draft.greeting)lines.push("","【玩家开场白】",draft.greeting);
  lines.push("","【规则边界】","每所学园各有 72 个在名序列名额，第 1–12 名列于第一页，称始页十二人；第 13–72 名同样在榜。序列仅表示所选学园的排名，不等同于通用战力，不能自动赋予获胜记录。","个人异能、星辰力运用、武装功能和独立技艺分别理解；原有 NPC 的武装、经历与关系不自动转移给玩家。","跨世界机制只采用玩家明确写出的本局映射。上述资料是草稿，不是已写入的游戏状态；这份预览不执行变量初始化或剧情推进。");
  return lines.join("\n");
}
function previewAsteriskOpening() {
  if(!requireCompleteProfile())return;
  try {var draft=validateAsteriskArchive(readAsteriskDraft());validateScene(draft.scene,true,"asterisk");
    if(draft.greeting&&!document.getElementById("opening-scene-confirmed").checked)throw new Error("请核对开场白的时间、地点，并勾选场景一致确认。");
    var input=showOpeningPreview(draft);input.scrollIntoView({behavior:"smooth",block:"center"});archiveFeedback("学战开局草稿已整理，可复制或保存；当前仅预览，尚未写入聊天。");
  }catch(error){archiveFeedback(error.message,true);}
}
function applyAsteriskSceneTemplate(type) {
  var school=selectedAcademy().name;
  var choices={training:["决斗准备","入学报到后·上午","训练场","熟悉训练设施与安全规则","我来到"+school+"的训练场，在边缘停下脚步。确认场地使用规则后，我准备先做一轮基础练习，熟悉自己的状态与这里的训练节奏。"],dorm:["入学报到","入学报到日·上午","学生宿舍接待处","办理住宿登记","我带着行李来到"+school+"的学生宿舍接待处，取出入学资料，准备核对房间与接下来的安排。窗外是六花的水面，新生活还没有开始，我想先把眼前的报到手续办好。"],director:["入学报到","入学报到日·上午","入学接待处","提交资料并了解入学安排","我在"+school+"的入学接待处站定，整理好手中的材料。关于自己的经历、能力和来到六花的目的，我已经准备了简短的说明，现在等待负责接待的人与我核对。"],ceremony:["学园日常","入学后的第一个休息日·午后","校园入口","熟悉学园与六花的生活","午后的光线落在"+school+"的校园入口。我确认了一遍终端上的地图，打算先熟悉附近的道路和生活设施。比起立刻决定下一场战斗，我想先知道这里的人们怎样度过普通的一天。"]};
  var v=choices[type]||choices.dorm;setSceneInputs({"当前章":v[0],"时间":v[1],"地点":school+"·"+v[2],"切入说明":v[3]});document.getElementById("opening-greeting").value=v[4];editScene();editGreeting();document.getElementById("opening-scene-confirmed").checked=true;document.getElementById("greeting-feedback").textContent="已填入所选学园的原创开场草稿，可继续修改。";
}
function applyAsteriskAssistanceData(data,draft) {
  var pending=[],notes=[],changed=0;
  function stage(id,value){var el=document.getElementById(id);if(el.value.trim()!==value)pending.push({el:el,value:value});}
  var labels=Object.assign({},AI_FIELD_LABELS,{device:"武装",nobleArt:"能力／武装招式",category:"能力身份",ability:"能力与武装机理"});
  Object.keys(OPENING_FIELDS).forEach(function(k){
    if(k==="school"){if(data.school!==draft.profile.school)notes.push("所属学园由界面选择，已保留当前学园。");return;}
    var v=data[k];if(typeof v!=="string"||v.length>FIELD_LIMITS[k]){notes.push(labels[k]+"格式或长度无效，保留原值。");return;}v=v.trim();
    if(k==="category"&&v!==""&&!AST_CATEGORIES.includes(v)){notes.push("能力身份不受支持，保留原值。");return;}
    if(k==="nobleArt"||k==="otherAbilities") {try{if(/^(无|暂无|没有|none)$/i.test(v))v="";v=mergeAiAbilityLines(draft.profile[k],v,labels[k]);if(v.length>FIELD_LIMITS[k])throw new Error(labels[k]+"合并后超长，保留原值。");stage(OPENING_FIELDS[k],v);}catch(error){notes.push(error.message);}}
    else {v=draft.profile[k]||v;stage(OPENING_FIELDS[k],v);if(!v)notes.push(labels[k]+"仍待填写。");}
  });
  [["prana","aw-prana"],["weapon_notes","aw-weapon-notes"]].forEach(function(pair){var v=data.asterisk&&data.asterisk[pair[0]];if(typeof v!=="string"||v.length>1200){notes.push("星辰力或武装使用条件未返回有效文字。");return;}stage(pair[1],draft.asterisk[pair[0]]||v.trim());});
  Object.keys(CONTEXT_FIELDS).forEach(function(k){var v=data.context&&data.context[k];if(typeof v!=="string"||v.length>1200){notes.push(k+"未返回有效文字。");return;}stage(CONTEXT_FIELDS[k],draft.context[k]||v.trim());});
  if(data.stats||data.rating||data.rank)notes.push("已忽略模型额外返回的通用评级字段。");
  if(typeof data.reasons!=="string"||!data.reasons.trim())notes.push("AI 未说明新增建议，请自行核对。");
  pending.forEach(function(item){item.el.value=item.value;changed++;});if(changed)handleProfileEdit();
  var counts={};["nobleArt","otherAbilities"].forEach(function(k){counts[k]=Object.keys(parseAbilityLines(document.getElementById(OPENING_FIELDS[k]).value,labels[k])).length;});
  return {changed:changed,notes:notes,counts:counts};
}
