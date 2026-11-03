from pathlib import Path
import hashlib, json, re, shutil

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
source = root / '第一卷-世界书整理/开局页面/index.html'
target = root / '第一卷-世界书整理/开局网页正则替换'
original_bytes = source.read_bytes()
s = original_bytes.decode('utf-8').replace('\r\n', '\n')
def replace(old, new, count=1):
    global s
    found = s.count(old)
    if found != count:
        raise RuntimeError(f'Expected {count} matches, got {found}: {old[:150]}')
    s = s.replace(old, new)
def branch(signature, body):
    replace(signature, signature + '\n        ' + body)

parts = (work/'asterisk-markup.html').read_text(encoding='utf-8').split('<!-- AW_SPLIT -->')
replace('<div class="container" id="lkGuideContainer">', '<div class="container" id="lkGuideContainer">\n'+parts[0])
replace('<p class="top-subtitle">', parts[1]+'\n<p class="top-subtitle">')
picker='<details id="aw-academy-picker" hidden><summary>所属学园 · <strong id="aw-academy-current">星导馆学园</strong><span>选择 / 变更 ↗</span></summary>'+parts[2]+'</details>'
replace('<section class="panel-register">', '<section class="panel-register">\n'+picker+parts[3])
replace('onclick="RakudaiOpening.switchScene(1)">变更学园', 'onclick="RakudaiOpening.openAcademyPicker()">变更学园')
replace('<section id="rating-panel"', parts[4]+'\n<section id="rating-panel"')
replace('<aside class="character-card-wrapper" hidden aria-hidden="true">', parts[5]+'\n<aside class="character-card-wrapper" hidden aria-hidden="true">')
replace('            <!-- 引导流下一步 -->', parts[6]+'\n            <!-- 引导流下一步 -->')
replace('                <!-- PARAMETER 雷达图 -->', '<p id="aw-record-extended" class="card-profile-text" style="white-space:pre-wrap" hidden></p>\n                <!-- PARAMETER 雷达图 -->')
style=(work/'asterisk-theme.css').read_text(encoding='utf-8')
style+='\n'+(work/'asterisk-novel-theme.css').read_text(encoding='utf-8')
style+='\n'+(work/'asterisk-brand-polish.css').read_text(encoding='utf-8')
style+='\n'+(work/'shared-title.css').read_text(encoding='utf-8')
style+='\n.aw-world-options button span{display:block;font-size:11px;font-weight:400;opacity:.8}\n.aw-prompts{margin:18px 0}.aw-prompts>summary{cursor:pointer;min-height:44px;padding:10px 0}.aw-prompts details{margin-top:12px}.aw-prompts textarea{min-height:260px;font-size:12px;line-height:1.7}\n[hidden]{display:none!important}\n'
replace('</head>', '<style id="asterisk-preview-theme">\n'+style+'\n</style>\n</head>')

# Keep the original OP -> title -> novel layout. Only skipIntro=1 bypasses it.
replace('<div class="lk-prelude-stage lk-title-stage">', '<div class="lk-prelude-stage lk-title-stage"><div class="opening-art-frame opening-art-frame--asterisk"><img class="aw-title-original-art" alt="学战都市 · 尤莉丝、克劳蒂雅、纱夜与绮凛官方原图" hidden /></div><img class="aw-title-logo" alt="学战都市 Asterisk" hidden /><span class="aw-title-divider" aria-hidden="true" hidden></span><span class="aw-title-cross" aria-hidden="true" hidden>×</span>')
replace('''          <img
            class="lk-title-art"''', '''          <div class="opening-art-frame opening-art-frame--rakudai"><img
            class="lk-title-art"''')
replace('''            alt=""
          />
          <img
            class="lk-title-logo"''', '''            alt=""
          /></div>
          <img
            class="lk-title-logo"''')
replace('        window.__lkPreludeComplete = false;', '        window.__lkPreludeComplete = false;\n        window.__openingOpActive = true;\n        var preludeRevision = 0;\n        var playAttempt = 0;\n        var opRemoteFallback = false;\n        var hidePreludeTimer = null;')
start=s.index('        function playOpeningWithSound() {')
end=s.index('\n        function revealTitle()',start)
s=s[:start]+(work/'prelude-autoplay.js').read_text(encoding='utf-8')+'\n'+s[end:]
replace('          soundGate.classList.remove("is-visible");\n          playOpeningBackdrop();', '''          soundGate.classList.toggle("is-visible",video.muted);
          soundGate.classList.toggle("is-sound-toggle",video.muted);
          if(video.muted)soundGate.innerHTML="开启声音<small>OP 正在静音自动播放</small>";
          playOpeningBackdrop();''')
replace('          needsGesture = true;\n          videoBackdrop.pause();', '          needsGesture = true;\n          soundGate.classList.remove("is-sound-toggle");\n          soundGate.innerHTML="重试播放<small>片头未能开始，点击重试或跳过</small>";\n          videoBackdrop.pause();')
replace('          titleVisible = true;', '          titleVisible = true;\n          playAttempt++;\n          window.__openingOpActive = false;')
replace('          finished = true;', '          finished = true;\n          playAttempt++;\n          window.__openingOpActive = false;')
replace('          document.dispatchEvent(new CustomEvent("lk:prelude-complete"));', '          document.dispatchEvent(new CustomEvent("lk:prelude-complete"));\n          window.scrollTo({top:0,behavior:"instant"});')
replace('          window.setTimeout(function () {\n            root.hidden = true;', '          var finishRevision = preludeRevision;\n          hidePreludeTimer = window.setTimeout(function () {\n            if(finishRevision!==preludeRevision || !finished)return;\n            root.hidden = true;')
replace('video.addEventListener("ended", revealTitle, { once: true });', 'video.addEventListener("ended", revealTitle);')
replace('video.addEventListener("error", revealTitle, { once: true });', '''video.addEventListener("error", function(){
          if(titleVisible || finished)return;
          if(!opRemoteFallback && video.getAttribute("src")!==originalPreludeMedia.video){
            opRemoteFallback=true;window.__openingOpRemoteFallback=true;playAttempt++;
            [video,videoBackdrop].forEach(function(el){el.pause();el.src=originalPreludeMedia.video;el.load();});
            playOpeningWithSound();
          }else revealTitle();
        });''')
replace('        function activatePreludeScope() {', '''        window.OpeningPrelude = {replay: function() {
          preludeRevision++; playAttempt++; clearTimeout(hidePreludeTimer);
          video.pause(); videoBackdrop.pause();
          var bgm=document.getElementById("bgm-audio");if(bgm)bgm.pause();
          finished=false;titleVisible=false;needsGesture=false;
          window.__lkPreludeComplete=false;window.__openingOpActive=true;
          document.dispatchEvent(new CustomEvent("lk:prelude-start"));
          root.hidden=false;root.classList.remove("is-finished");videoBackdrop.hidden=false;
          openingScreen.classList.add("is-active");openingScreen.setAttribute("aria-hidden","false");
          titleScreen.classList.remove("is-active");titleScreen.setAttribute("aria-hidden","true");
          if(messageHost)messageHost.classList.add("lk-prelude-host-active");else document.body.classList.add("prelude-active");
          document.addEventListener("keydown",handlePreludeKey,true);setGuideInert(true);
          try{video.currentTime=0;videoBackdrop.currentTime=0;}catch(error){}
          playOpeningWithSound();
        }};
        if(new URLSearchParams(location.search).get("skipIntro")==="1") {
          titleVisible=true;finishPrelude();return;
        }
        window.addEventListener("pagehide",function(){preludeRevision++;clearTimeout(hidePreludeTimer);video.pause();videoBackdrop.pause();});
        function activatePreludeScope() {''')
replace('''        if (document.readyState === "complete") {
          playOpeningWithSound();
        } else {
          window.addEventListener("load", playOpeningWithSound, { once: true });
        }''', '        playOpeningWithSound();')
replace('<span class="aw-version">MALE EDITION / 男性版</span>', '<button type="button" class="aw-replay-op" onclick="RakudaiOpening.replayOpening()">重播 OP ▷</button><span class="aw-version">MALE EDITION / 男性版</span>')
replace('            🌸 散落插画: 显现\n          </button>', '            🌸 散落插画: 显现\n          </button><button type="button" class="scene-ambient-toggle" onclick="RakudaiOpening.openCinemaMode(0)">打开插画册 ▣</button>')
branch('      function quickLoadCanon() {','if(isAsteriskMode()) return openAcademyPicker();')
replace('        if (currentScene !== 1 || document.hidden) return;', '        if (currentScene !== 1 || document.hidden || !window.__lkPreludeComplete) return;')
replace('          setTimeout(function () {\n            img.src = data.img;', '          clearTimeout(cinemaSwitchTimer);\n          cinemaSwitchTimer = setTimeout(function () {\n            img.src = data.img;')
branch('      function closeCinemaMode(e) {','clearTimeout(cinemaSwitchTimer);')
replace('          card.addEventListener("click", function (e) {', '''          var galleryImage=card.querySelector("img");
          galleryImage.alt=item.alt || "落第骑士英雄谭插画";
          if(isAsteriskMode())galleryImage.onerror=function(){this.onerror=null;this.src=openingMediaUrl(OPENING_ASTERISK_MEDIA.volumes[0].file);};
          card.addEventListener("click", function (e) {''')
branch('      function setProfileHelp(route) {','if (isAsteriskMode()) { document.getElementById("identity-help").textContent = "男性自定义学生 · " + selectedAcademy().name + "。原作人物仍独立存在，其身份与人际关系不会转移给玩家。"; return; }')
replace('        if (avatarInput) avatarInput.disabled = isLocked;\n        updateAvatarUploadUi();','        if (avatarInput) avatarInput.disabled = isLocked;\n        applyWorldFieldLocks();\n        updateAvatarUploadUi();')
branch('      function loadPreset(key) {','if (isAsteriskMode()) { if (key !== "user") return; return loadAsteriskPreset(); }')
branch('      async function readConfirmedScene() {','if (isAsteriskMode()) { document.getElementById("opening-scene-feedback").textContent = "学战模式使用独立场景草稿，不读取落第聊天场景。"; return; }')
branch('      function applySceneTemplate(type) {','if (isAsteriskMode()) return applyAsteriskSceneTemplate(type);')
branch('      function insertBlankTemplate() {','if (isAsteriskMode()) return applyAsteriskSceneTemplate("dorm");')
branch('      function buildGreetingPrompts(draft) {','if (draft.world_id === "asterisk") return buildAsteriskGreetingPrompts(draft);')
replace('        var data = { profile: draft.profile, context: draft.context };','        var data = { world: draft.world_id === "asterisk" ? "学战都市 Asterisk" : "落第骑士英雄谭", school: draft.school_id, profile: draft.profile, context: draft.context };')
replace('return JSON.stringify({ profile_key: draft.profile_key, profile: draft.profile, context: draft.context });','return JSON.stringify({ world_id: draft.world_id, school_id: draft.school_id, asterisk: draft.asterisk, profile_key: draft.profile_key, profile: draft.profile, context: draft.context });')
branch('      function buildAiAssistancePrompt(draft) {','if ((draft || readOpeningDraft()).world_id === "asterisk") return buildAsteriskAssistancePrompt(draft || readOpeningDraft());')
branch('      function applyAiAssistanceData(data, draft) {','if (draft.world_id === "asterisk") return applyAsteriskAssistanceData(data, draft);')
replace('button.disabled = true; status.textContent = "正在结合第一卷开场模板构思场景与开场白…";', 'button.disabled = true; status.textContent = isAsteriskMode() ? "正在按所选学园构思场景与开场白…" : "正在结合第一卷开场模板构思场景与开场白…";')
replace('status.textContent = "正在生成完整档案建议，包括伐刀招式与其他能力；已有内容将保留。";', 'status.textContent = isAsteriskMode() ? "正在生成星脉能力与武装建议；学园和已有内容将保留。" : "正在生成完整档案建议，包括伐刀招式与其他能力；已有内容将保留。";')
replace('var summary = "已补填 " + result.changed + " 项；当前伐刀招式：" + result.counts.nobleArt', 'var summary = "已补填 " + result.changed + (isAsteriskMode() ? " 项；当前能力／武装招式：" : " 项；当前伐刀招式：") + result.counts.nobleArt')
replace('" 已填文字与评级保留；要重写某项可先清空该项。"','" 已填设定保留；要重写某项可先清空该项。"')
branch('      function syncCard() {','if (isAsteriskMode()) return syncAsteriskCard();\n        var nobleLabel = document.getElementById("card-noble-val").previousElementSibling;\n        if (nobleLabel.dataset.rakudaiText) nobleLabel.textContent = nobleLabel.dataset.rakudaiText;')
replace('        updateOpeningPreview(draft);\n      }\n\n      function resetRegisterForm()', '        updateOpeningPreview(draft);\n        updatePromptPreview();\n      }\n\n      function resetRegisterForm()')
replace('var ARCHIVE_FORMAT = "rakudai-opening-profile";', 'var ARCHIVE_FORMAT = "tavern-opening-profile";')
replace('var ARCHIVE_VERSION = 5;', 'var ARCHIVE_VERSION = 6;')
replace('var ARCHIVE_KEY = "rakudai-opening-profiles-v2-slot-";', 'var ARCHIVE_KEY = "tavern-opening-dlc-preview-v1-slot-";')
replace('parseAbilityLines(input.value, key === "nobleArt" ? "伐刀招式" : "其他能力");','parseAbilityLines(input.value, key === "nobleArt" ? (isAsteriskMode() ? "能力／武装招式" : "伐刀招式") : "其他能力");')
branch('      function readOpeningDraft() {','if (isAsteriskMode()) return readAsteriskDraft();')
replace('format: ARCHIVE_FORMAT, schema_version: ARCHIVE_VERSION, profile_key: activeStartProfile,','format: ARCHIVE_FORMAT, schema_version: ARCHIVE_VERSION, world_id: "rakudai", school_id: null, profile_key: activeStartProfile,')
branch('      function buildOpeningMessage(draft, committedState) {','if (draft.world_id === "asterisk") return buildAsteriskOpeningMessage(draft);')
branch('      function buildOpeningVariables(draft) {','if (draft.world_id === "asterisk") throw new Error("学战预览档案不能提交到落第变量结构。");')
branch('      function validateArchive(data) {','''if (data && data.world_id === "asterisk") return validateAsteriskArchive(data);
        if (data && data.world_id && data.world_id !== "rakudai") throw new Error("不支持此开局世界。");
        if (data && data.format === "rakudai-opening-profile" && [2,3,4,5].includes(data.schema_version)) data = Object.assign({}, data, {format: ARCHIVE_FORMAT});''')
replace('![2, 3, 4, 5].includes(data.schema_version)', '![2, 3, 4, 5, 6].includes(data.schema_version)')
replace('这不是受支持的落第开局档案（支持版本 2、3、4、5）。','这不是受支持的开局档案（新档 v6，兼容落第旧档 v2–v5）。')
replace('return { format: ARCHIVE_FORMAT, schema_version: ARCHIVE_VERSION, profile_key: data.profile_key, profile: p, avatar: avatar, greeting: greeting, scene: validateScene(data.scene), context: context };','return { format: ARCHIVE_FORMAT, schema_version: ARCHIVE_VERSION, world_id: "rakudai", school_id: null, profile_key: data.profile_key, profile: p, avatar: avatar, greeting: greeting, scene: validateScene(data.scene, false, "rakudai"), context: context };')
replace('function validateScene(input, requireComplete) {','function validateScene(input, requireComplete, world) {')
replace('if (!OPENING_CHAPTERS.includes(clean["当前章"])) throw new Error("请在第一卷范围内选择章段。");','var chapters = (world || activeOpeningWorld) === "asterisk" ? AST_CHAPTERS : RAKUDAI_CHAPTERS;\n        if (!chapters.includes(clean["当前章"])) throw new Error("请选择当前世界允许的切入阶段。");')
branch('      function openingController() {','if (isAsteriskMode()) throw new Error("学战预览不连接落第建档控制器。");')
branch('      function applyAvatarToCurrentChat() {','if (isAsteriskMode()) { archiveFeedback("学战预览的头像仅随草稿保存，不应用到落第聊天。"); return; }')
branch('      function currentOpeningReceipt(draft) {','if (draft.world_id === "asterisk") return null;')
replace('return stableOpeningJson({ profile_key: draft.profile_key, profile: draft.profile, avatar: draft.avatar, greeting: draft.greeting, scene: draft.scene, context: draft.context });','return stableOpeningJson({ world_id: draft.world_id, school_id: draft.school_id, asterisk: draft.asterisk, profile_key: draft.profile_key, profile: draft.profile, avatar: draft.avatar, greeting: draft.greeting, scene: draft.scene, context: draft.context });')
branch('      function updateOpeningPreview(draft) {','''if (draft.world_id === "asterisk") {
          document.getElementById("opening-message").value = buildAsteriskOpeningMessage(draft);
          document.getElementById("opening-preview-title").textContent = "学战 · 开局草稿预览";
          document.getElementById("opening-preview-help").textContent = "可以复制、保存并继续调整；此版本尚未连接学战游戏状态，预览不会开始剧情。";
          return;
        }''')
branch('      async function enterGame() {','if (isAsteriskMode()) return previewAsteriskOpening();')
replace('      function applyOpeningDraft(draft) {','      function applyOpeningDraft(draft, restoreMemory) {')
branch('      function applyOpeningDraft(draft, restoreMemory) {','if (draft.world_id === "asterisk") return applyAsteriskDraft(draft, restoreMemory);\n        prepareIncomingWorld("rakudai");')
replace('return "落第骑士_" + (draft.profile.name', 'return (draft.world_id === "asterisk" ? "学战都市_" : "落第骑士_") + (draft.profile.name')
replace('档案已导入表单，照片和性格字段已恢复；点击“确认人物”后同步到终端，当前未写入聊天。','档案已导入表单，世界、人物与照片已恢复；当前未写入聊天。')
replace('，人物设定已填入表单；点击“确认人物”后同步到终端，当前未写入聊天。','，世界与人物设定已填入表单；当前未写入聊天。')
replace('name = draft.profile.name || "未命名";\n              var date', 'name = (draft.world_id === "asterisk" ? AST_SCHOOLS[draft.school_id].name : "落第骑士") + " · " + (draft.profile.name || "未命名");\n              var date')
replace('button.textContent = "读取卷 " + slot + " · " + (draft.profile.name || "未命名");', 'button.textContent = "读取卷 " + slot + " · " + (draft.world_id === "asterisk" ? AST_SCHOOLS[draft.school_id].name : "落第骑士") + " · " + (draft.profile.name || "未命名");')
branch('      async function exportArchiveImage() {','if (isAsteriskMode()) return exportAsteriskArchiveImage();')
branch('      function startBgmAfterPrelude() {','if (window.__openingOpActive) return;')
replace('          if (bgmUnlocked || !bgmAudio) return;', '          if (bgmUnlocked || !bgmAudio || window.__openingOpActive) return;')
replace('            startBgmAfterPrelude,\n            { once: true },', '            startBgmAfterPrelude,')
replace('          document.addEventListener(\n            "lk:title-visible",\n            startBgmAfterPrelude,\n          );', '')
replace('        // OP 停止进入标题页后启动 BGM；继续按钮手势也会重试。', '        document.addEventListener("lk:title-visible",startBgmAfterPrelude);\n        // OP 停止进入标题页后启动 BGM；继续按钮手势也会重试。')

# Keep remote covers remote when embedded in a Tavern Helper iframe.
# The author's original page is unchanged; its relative fallback is not portable.
s, local_cover_fallbacks = re.subn(r"^[ \t]*this\.src = '\.\./resource/no\d+\.jpg';\n", '', s, flags=re.M)
if local_cover_fallbacks != 19:
    raise RuntimeError(f'Expected 19 original cover fallbacks, got {local_cover_fallbacks}')

extension='\n'.join((work/name).read_text(encoding='utf-8') for name in ['asterisk-mode.js','asterisk-prompts.js','asterisk-image-export.js','asterisk-novel.js'])
replace('      // 内联事件使用显式接口；宿主以模块执行脚本时也不依赖隐式全局函数。','\n// ASTERISK_MODE_BEGIN\n'+extension+'\n// ASTERISK_MODE_END\n      // 内联事件使用显式接口；宿主以模块执行脚本时也不依赖隐式全局函数。')
replace('      window.RakudaiOpening = {','      window.RakudaiOpening = {\n        openCinemaMode: openCinemaMode,\n        replayOpening: replayOpening,\n        openAcademyPicker: openAcademyPicker,\n        chooseWorld: chooseOpeningWorld,\n        selectAcademy: selectAcademy,\n        enterAcademy: enterAcademy,\n        editAsteriskFields: editAsteriskFields,')
replace('        prepareFinalCard();\n        var params = new URLSearchParams(window.location.search);','        prepareFinalCard();\n        initializeWorldUI();\n        var params = new URLSearchParams(window.location.search);')

media=json.loads((work/'asterisk-media-manifest.json').read_text(encoding='utf-8'))
asset_dir=target/'assets'/'asterisk'
asset_dir.mkdir(parents=True,exist_ok=True)
assets=[]
def copy_asset(source_path, filename, asset_id, kind='image', preload='lazy'):
    src=root/source_path
    dst=asset_dir/filename
    if not dst.exists() or dst.stat().st_size != src.stat().st_size: shutil.copy2(src,dst)
    assets.append({'id':asset_id,'kind':kind,'source':{'type':'local','path':filename},'bytes':dst.stat().st_size,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'preload':preload,'lifetime':'message','fallbackAssetId':None,'originalSource':source_path})
    return filename
bundle={'volumes':[],'gallery':[],'missingVolumes':media['missingVolumes']}
for v in media['volumes']:
    file=copy_asset(v['coverPath'],f"cover-{v['number']:02}.jpg",f"cover-{v['number']:02}",preload='eager' if v['number']==1 else 'lazy')
    bundle['volumes'].append({'number':v['number'],'title':v['title'],'file':file})
for i,g in enumerate(media['gallery']):
    file=copy_asset(g['path'],f'gallery-{i+1:02}.jpg',f'gallery-{i+1:02}')
    bundle['gallery'].append({'volume':g['volume'],'file':file,'title':g['title']})
    if g['path']==media['titleArtPath']: bundle['titleArt']=file
bundle['op']=copy_asset('op.mp4','op.mp4','shared-opening-op','video','on-demand')
assets[-1]['fallbackAssetId']='gallery-08'
bundle['entryCover']=copy_asset('title-screen-8k.png','entry-cover-rakudai.png','shared-entry-cover','image','eager')
bundle['asteriskEntryCover']=copy_asset('output/asterisk-opening/source-assets/asterisk-four-heroines-official.jpg','entry-cover-asterisk-original.jpg','asterisk-original-entry-cover','image','eager')
assets[-1]['fallbackAssetId']='shared-entry-cover'
bundle['titleBackdrop']=copy_asset('output/asterisk-opening/source-assets/opening-game-backdrop-v1.png','opening-game-backdrop-v1.png','game-title-background','image','eager')
emblems={
    'seidoukan':'星导馆学园_赤莲校徽.png',
    'gallardworth':'圣嘉莱多瓦思学园_光轮校徽.png',
    'jielong':'界龙第七学院_黄龙校徽.png',
    'rewolf':'雷渥夫黑学园_双剑校徽.png',
    'arlequint':'阿勒坎特学园_昏枭校徽.png'
}
bundle['emblems']={key:copy_asset('DLC/插图/六大学园校徽/'+name,'emblem-'+key+'.png','emblem-'+key) for key,name in emblems.items()}
bundle['logos']={
    'rakudai':copy_asset('第一卷-世界书整理/开局页面/rakudai-logo.png','logo-rakudai.png','logo-rakudai','image','eager'),
    'asterisk':copy_asset('output/asterisk-opening/source-assets/asterisk-logo.png','logo-asterisk.png','logo-asterisk','image','eager')
}
(asset_dir/'media-manifest.json').write_text(json.dumps({'schemaVersion':1,'cardId':'rakudai-asterisk-opening-preview','assets':assets},ensure_ascii=False,indent=2),encoding='utf-8')
media_script='var OPENING_ASTERISK_MEDIA='+json.dumps(bundle,ensure_ascii=False)+';\n'+(work/'prelude-media.js').read_text(encoding='utf-8')
replace('<script>\n      (function () {\n        var root = document.getElementById("lkPrelude");','<script>\n'+media_script+'\n      (function () {\n        var root = document.getElementById("lkPrelude");')
replace('src="https://eriribot.github.io/rakudai-knight/op.mp4"','data-src="https://eriribot.github.io/rakudai-knight/op.mp4"',2)
replace('            autoplay\n','')
replace('          preload="auto"','          preload="metadata"',2)
s=re.sub(r'    <link\s+rel="preload"\s+as="video".*?/>\s*','',s,count=1,flags=re.S)
s, title_preloads_removed=re.subn(r'[ \t]*<link\s+rel="preload"\s+as="image"\s+href="https://eriribot.github.io/rakudai-knight/title-screen-8k.png".*?/>\s*','',s,count=1,flags=re.S)
if title_preloads_removed!=1: raise RuntimeError('Expected exactly one original title-art preload')
target.mkdir(parents=True, exist_ok=True)
(target/'index.html').write_text(s,encoding='utf-8',newline='\n')
for name in ['covers','default-avatar.png','rakudai-logo.png','knight-shield.png','knight-shield.svg']:
    item=source.parent/name
    if item.is_dir(): shutil.copytree(item,target/name,dirs_exist_ok=True)
    elif item.exists(): shutil.copy2(item,target/name)
receipt={'source':'../开局页面/index.html','source_sha256':hashlib.sha256(original_bytes).hexdigest(),'output_sha256':hashlib.sha256(s.encode()).hexdigest(),'delivery_mode':'component','worlds':['rakudai','asterisk'],'male_academies':[k for k in ['seidoukan','gallardworth','jielong','rewolf','arlequint']],'disabled_academy':'queenvail','live_sillytavern_verified':False}
(work/'source-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'bytes':len(s.encode()),'source_sha256':receipt['source_sha256'],'path':str(target/'index.html')},ensure_ascii=False))
