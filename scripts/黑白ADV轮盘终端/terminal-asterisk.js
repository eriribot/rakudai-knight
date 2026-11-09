(function () {
  'use strict';
  // This is a read-only application surface for the existing RK host.
  // Data is read-only; appearance.get/set manages the host's visual preference.
  // Visual state stays in this iframe and is never written to game variables.
  var ASSETS = {
    seidoukan: '__AW_ASSET_EMBLEM_SEIDOUKAN__',
    gallardworth: '__AW_ASSET_EMBLEM_GALLARDWORTH__',
    jielong: '__AW_ASSET_EMBLEM_JIELONG__',
    rewolf: '__AW_ASSET_EMBLEM_REWOLF__',
    arlequint: '__AW_ASSET_EMBLEM_ARLEQUINT__',
    heroines: '__AW_ASSET_HEROINES__'
  };
  var localAssets = '../../第一卷-世界书整理/开局网页正则替换/assets/asterisk/';
  var schools = [
    { id: 'seidoukan', name: '星导馆学园', match: '星导馆', english: 'SEIDOUKAN ACADEMY', accent: '#f3a9bc', rgb: '243,169,188' },
    { id: 'gallardworth', name: '圣嘉莱多瓦思学园', match: '圣嘉莱多瓦思', english: 'GALLARDWORTH ACADEMY', accent: '#f1db9c', rgb: '241,219,156' },
    { id: 'jielong', name: '界龙第七学院', match: '界龙', english: 'JIE LONG SEVENTH INSTITUTE', accent: '#e6c383', rgb: '230,195,131' },
    { id: 'rewolf', name: '雷渥夫黑学园', match: '雷渥夫', english: 'REWOLF BLACK INSTITUTE', accent: '#c7aded', rgb: '199,173,237' },
    { id: 'arlequint', name: '阿勒坎特学园', match: '阿勒坎特', english: 'ARLEQUINT ACADEMY', accent: '#b5de94', rgb: '181,222,148' }
  ];
  var apps = {
    home: { name: '终端总览', english: 'PERSONAL INTERFACE' },
    blazer: { name: '学生档案', english: 'STUDENT PROFILE' },
    lime: { name: '通讯', english: 'COMMUNICATION' },
    moments: { name: '学园动态', english: 'CAMPUS FEED' },
    bbs: { name: '论坛', english: 'CAMPUS FORUM' },
    schedule: { name: '赛事', english: 'FESTA RECORD' },
    gallery: { name: '原图画廊', english: 'VISUAL ARCHIVE' },
    calendar: { name: '剧情与校历', english: 'STORY / CALENDAR' },
    settings: { name: '设置', english: 'TERMINAL SETTINGS' }
  };
  var appOrder = ['blazer', 'lime', 'moments', 'bbs', 'schedule', 'gallery', 'calendar', 'settings'];
  var people = [
    { name: '尤莉丝', full: '尤莉丝·爱雷克西亚·冯·里斯妃特', english: 'JULIS-ALEXIA', shortLine: '既然站上了舞台，就认真面对自己的选择吧。', longLine: '目标还没有决定，也没关系。先想清楚自己为什么站上舞台，再选择该走的路。至于接下来的事，就用你自己的行动回答吧。' },
    { name: '克劳蒂雅', full: '克劳蒂雅·恩菲尔德', english: 'CLAUDIA ENFIELD', shortLine: '这里的每一页，都可以由你慢慢了解。', longLine: '在做出决定之前，先看清楚眼前的信息吧。学园、武装，以及你希望前往的方向，都值得认真考虑。这只是视窗的长台词展示。' },
    { name: '纱夜', full: '沙沙宫纱夜', english: 'SASAMIYA SAYA', shortLine: '武装的事，先从最基本的部分看起。', longLine: '先确认武装的形态，再了解它的使用条件。还没有决定的部分，就留着慢慢考虑。现在这段文字只用来展示长台词的自动换行。' },
    { name: '绮凛', full: '刀藤绮凛', english: 'TOUDOU KIRIN', shortLine: '那么，就从第一步开始吧。', longLine: '即使暂时没有记录，也不用着急。先确认自己的目标，再把每一步认真做好就可以了。这段台词是界面演示，不对应已经发生的相遇。' }
  ];
  var bridge = null, unsubscribe = null, requestRevision = 0, bridgeRevision = 0;
  var state = {}, snapshot = null, snapshotSignature = '', dataStatus = 'unbound', dataMessage = '', currentApp = 'home';
  var content = document.getElementById('ax-content');
  var viewport = document.getElementById('ax-viewport');
  var dialog = document.getElementById('ax-dialog');
  var dialogBody = document.getElementById('ax-dialog-body');
  var lastDialogOpener = null, activePortrait = null, dialogueMode = 'short';
  var pageScroll = Object.create(null), toastTimer = null;
  var correctionEditor = null, correctionPreview = null, correctionMessage = '', correctionAction = 0;
  var plotStatus = null, plotPreview = null, plotError = '', plotBusy = false, plotRequest = 0;
  var storyCapture = null, storyDraft = null, storyMessage = '', storyBusy = false, storyRequest = 0;
  var contactPortraits = /*__AW_CONTACT_PORTRAITS__*/ null;

  function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function valueText(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback === undefined ? '待记录' : fallback;
  }
  function escape(value) { return String(value).replace(/[&<>"']/g, function (character) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]; }); }
  function icon(name) { return '<svg class="ax-icon" aria-hidden="true"><use href="#ax-' + name + '"/></svg>'; }
  function asset(key) {
    var source = ASSETS[key] || '';
    if (source.indexOf('__AW_ASSET_') === 0) return localAssets + (key === 'heroines' ? 'entry-cover-asterisk-original.jpg' : 'emblem-' + key + '.png');
    return source;
  }
  function model() {
    var player = object(state.玩家), academy = object(player.学战), prana = object(academy.星辰力), weapon = object(academy.武装);
    var school = schools.find(function (entry) { return entry.id === academy.学园ID; }) || null;
    var schoolName = school ? school.name : valueText(player.所属, '所属学园待登记');
    var rank = object(academy.校内序列);
    var rankName = valueText(rank.状态, '待记录');
    if (rank.状态 === '已上榜' && Number.isInteger(rank.名次) && rank.名次 >= 1 && rank.名次 <= 72) rankName += ' · 第 ' + rank.名次 + ' 名' + (rank.名次 <= 12 ? ' · 始页十二人' : '');
    return { player: player, academy: academy, prana: prana, weapon: weapon, school: school, schoolName: schoolName, rank: rankName, name: valueText(player.姓名, '待登记') };
  }
  function rosterEntries(contactsOnly) {
    var playerName = valueText(object(state.玩家).姓名, '');
    var deleted = object(state.系统).已删除人物;
    deleted = Array.isArray(deleted) ? deleted : [];
    return Object.entries(object(state.人际)).filter(function (entry) {
      var relation = object(entry[1]);
      return entry[0] !== playerName && deleted.indexOf(entry[0]) === -1 && relation.名册隐藏 !== true && (!contactsOnly || relation.已加联系方式 === true);
    });
  }
  function contactEntries() { return rosterEntries(true); }
  function contactAvatar(name) {
    var key = name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '').toLowerCase();
    var portrait = contactPortraits?.entries[contactPortraits.byName[key]];
    return '<span class="ax-contact-avatar' + (portrait?.world === 'rakudai' ? ' ax-contact-avatar-knight' : '') + '" aria-hidden="true"><span>' + escape(Array.from(name)[0] || '人') + '</span>' +
      (portrait ? '<img src="' + escape(portrait.src) + '" style="' + escape(portrait.style) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>';
  }
  function names(value) { return Array.isArray(value) ? value.filter(function (name) { return typeof name === 'string'; }).join('、') : ''; }
  function skillsView(record) {
    var entries = Object.entries(object(record));
    return entries.length ? entries.map(function (entry) {
      var skill = object(entry[1]);
      return '<div class="ax-profile-field"><h3>' + escape(entry[0]) + '</h3><dl class="ax-detail-list">' + line('说明', typeof entry[1] === 'string' ? entry[1] : skill.说明) + line('条件与代价', skill.条件与代价) + line('掌握状态', skill.掌握状态) + '</dl></div>';
    }).join('') : '<p class="ax-note">尚无已记录的能力。</p>';
  }
  function knownProfileView(known) {
    return ['身份', '所属', '登记等级', '灵装', '武装', '校内序列', '已知能力'].filter(function (key) { return valueText(known[key], ''); }).map(function (key) { return line(key, known[key]); }).join('');
  }
  function line(label, value, fallback, prose) {
    var display = valueText(value, fallback);
    var empty = ['待记录', '待登记', '待描述', '未测定', '未选', '尚未确定'].indexOf(display) !== -1;
    return '<div' + (prose ? ' class="ax-detail-prose"' : '') + '><dt>' + escape(label) + '</dt><dd' + (empty ? ' class="is-empty"' : '') + '>' + escape(display) + '</dd></div>';
  }
  function panel(code, title, body) { return '<section class="ax-panel"><span class="ax-overline">' + code + '</span><h2>' + title + '</h2>' + body + '</section>'; }
  function emptyState(app, title, description, extra) {
    return '<section class="ax-panel"><div class="ax-empty">' + icon(app) + '<h2>' + title + '</h2><p>' + description + '</p>' + (extra || '') + '</div></section>';
  }
  function button(label, action, primary) { return '<button class="ax-button' + (primary ? ' ax-button-primary' : '') + '" data-action="' + action + '">' + label + icon('arrow') + '</button>'; }

  function homeView() {
    var m = model(), scene = object(state.场景);
    var storyEntry = usesHostStoryControls() ? 'data-action="host-story-controls"' : 'data-app="calendar"';
    var emblem = m.school ? '<img class="ax-holo-emblem" src="' + escape(asset(m.school.id)) + '" alt="' + escape(m.school.name) + '校徽">' : '<svg class="ax-icon ax-holo-placeholder" aria-label="学园尚未登记"><use href="#ax-home"/></svg>';
    return '<section class="ax-panel ax-home-hero"><div class="ax-hero-top"><div class="ax-hero-copy"><span class="ax-overline">ASTERISK / PERSONAL</span><h2>你的六花，<br><span>随身记录。</span></h2><p>学园、武装与交汇的轨迹。</p></div><div class="ax-hologram"><svg class="ax-holo-lines" viewBox="0 0 180 200" fill="none" aria-hidden="true"><path d="m90 12 70 40v80l-70 40-70-40V52Z" stroke="currentColor" opacity=".25"/><path d="m90 25 58 33v66l-58 33-58-33V58Z" stroke="currentColor" stroke-width="1.5" stroke-dasharray="28 10 42 9"/><path d="M39 74V62l51-29 51 29v13m0 32v12l-51 29-51-29v-12" stroke="#d7faff" stroke-width="2.5" opacity=".7"/><circle cx="90" cy="91" r="76" stroke="currentColor" stroke-dasharray="1 5" opacity=".2"/><path d="M4 91h22m128 0h22M90 0v19m0 144v21" stroke="currentColor" opacity=".4"/></svg>' + emblem + '<div class="ax-holo-base"></div><div class="ax-holo-scan"></div></div></div><div class="ax-hero-school">' + escape(m.schoolName) + '</div><div class="ax-home-stats"><div class="ax-home-stat"><small>学生姓名</small><strong>' + escape(m.name) + '</strong></div><div class="ax-home-stat"><small>校内序列</small><strong>' + escape(m.rank) + '</strong></div><div class="ax-home-stat"><small>当前武装</small><strong>' + escape(valueText(m.weapon.名称, '未选')) + '</strong></div></div></section>' +
      panel('CURRENT STORY', '当前剧情', '<dl class="ax-detail-list">' + line('章节', scene.当前章) + line('阶段', scene.阶段) + '</dl><p class="ax-note">查看主线注入、选择章节与调整阶段。</p><button class="ax-button ax-button-primary" ' + storyEntry + '>打开剧情控制' + icon('arrow') + '</button>') +
      '<div class="ax-section-heading"><h2>终端应用</h2><span>APPLICATIONS / 08</span></div><nav class="ax-app-grid" aria-label="学战终端应用">' + appOrder.map(function (id) { return '<button class="ax-app" data-app="' + id + '"><span class="ax-app-hex">' + icon(id) + '</span><strong>' + apps[id].name + '</strong><small>' + apps[id].english.split(' ')[0] + '</small></button>'; }).join('') + '</nav><div class="ax-home-foot"><span>ASTERISK NETWORK</span><strong>本局档案 · 已同步</strong></div>';
  }

  function profileView() {
    var m = model();
    var portrait = bridge?.playerPortrait?.resolve('玩家');
    var photo = portrait?.src ? '<img src="' + escape(portrait.src) + '" alt="" decoding="async">' : '';
    var identity = '<div class="ax-profile-identity"><div class="ax-profile-hex" aria-hidden="true">' + icon('blazer') + photo + '</div><div><span class="ax-overline">STUDENT IDENTITY</span><h2>' + escape(m.name) + '</h2><p>' + escape(m.schoolName) + '</p></div></div><dl class="ax-detail-list">' + ['性别', '性格关键词', '处事风格', '所属', '角色简介', '战斗风格'].map(function (key) { return line(key, m.player[key]); }).join('') + line('所属学园', m.schoolName) + line('校内序列', m.rank) + '</dl>';
    var mapping = ['当前身体', '当前能力边界', '本局映射'].filter(function (key) { return valueText(m.player[key], ''); }).map(function (key) { return line(key, m.player[key]); }).join('');
    var roster = rosterEntries(false).map(function (entry) {
      var relation = object(entry[1]);
      return '<details class="ax-contact" data-contact="' + escape(entry[0]) + '"><summary>' + contactAvatar(entry[0]) + '<div class="ax-contact-title"><strong>' + escape(entry[0]) + '</strong></div>' + icon('arrow') + '</summary><div class="ax-contact-body"><dl class="ax-detail-list">' + line('关系', relation.关系) + line('态度印象', relation.态度印象, undefined, true) + line('好感', relation.好感, '未知') + line('支援度', relation.支援度, '未知') + line('羁绊阶段', relation.羁绊阶段) + knownProfileView(object(relation.已知资料)) + '</dl></div></details>';
    }).join('');
    return '<section class="ax-panel">' + identity + '</section>' + (mapping ? panel('CURRENT IDENTITY', '本局身体与映射', '<dl class="ax-detail-list">' + mapping + '</dl>') : '') +
      panel('PRANA RECORD', '星辰力', '<p class="ax-small">' + escape(valueText(m.prana.说明)) + '</p><p class="ax-note">以实际记录描述表现；未记录的总量与百分比不作推算。</p>') +
      panel('ABILITY MECHANISM', '能力机制', '<dl class="ax-detail-list">' + line('能力身份', m.academy.能力身份) + line('能力机制', m.academy.能力机制) + line('共通限制', m.academy.共通限制) + '</dl>') +
      panel('TECHNIQUES', '招式', skillsView(m.academy.招式)) + panel('OTHER ABILITIES', '其他能力', skillsView(m.player.其他能力)) +
      panel('LUX ARMAMENT', '武装', '<dl class="ax-detail-list">' + line('类别', m.weapon.类别, '尚未确定') + line('名称', m.weapon.名称, '未选') + line('使用条件', m.weapon.使用条件) + '</dl>') +
      blazerProfileView(m.player) +
      panel('KNOWN PEOPLE', '本局人物', roster || '<p class="ax-note">尚无已记录的人物。</p>');
  }

  function blazerProfileView(player) {
    if (!['伐刀能力', '固有灵装', '登记等级', '魔人觉醒', '六维', '成长'].some(function (key) { return Object.prototype.hasOwnProperty.call(player, key); })) return '';
    var ability = object(player.伐刀能力), axes = object(player.六维), experience = object(object(player.成长).经验);
    var fields = line('固有灵装', player.固有灵装) + line('登记等级', player.登记等级, '未登记') +
      line('能力系别', ability.能力系别) + line('能力本质', ability.能力本质) + line('共通限制', ability.共通限制);
    if (typeof player.魔人觉醒 === 'boolean') fields += line('魔人觉醒', player.魔人觉醒 ? '已觉醒' : '未觉醒');
    var attributes = Object.keys(axes).map(function (key) { return line(key, axes[key], '未确认'); }).join('');
    var growth = Object.keys(experience).map(function (key) { return line(key + '档内经验', experience[key]); }).join('');
    return panel('BLAZER RECORD', '伐刀能力与固有灵装', '<dl class="ax-detail-list">' + fields + '</dl>' + skillsView(ability.招式)) +
      (attributes || growth ? panel('BLAZER GROWTH', '六维与成长', '<dl class="ax-detail-list">' + attributes + growth + '</dl>') : '');
  }

  function communicationView() {
    var contacts = contactEntries();
    var summary = '<div class="ax-split"><div><span class="ax-overline">CONTACT CHANNEL</span><h2 style="margin-bottom:0">已建立联系方式</h2></div><span class="ax-count">' + contacts.length + '</span></div>';
    if (!contacts.length) return panel('COMMUNICATION', '通讯录', '<div class="ax-empty">' + icon('lime') + '<h2>尚无联系人</h2><p>人物资料的存在不代表已交换联系方式。<br>建立联系后，人物才会出现在这里。</p></div>');
    return '<section class="ax-panel">' + summary + '</section><div class="ax-roster">' + contacts.map(function (entry) {
      var name = entry[0], relation = object(entry[1]), known = object(relation.已知资料);
      return '<details class="ax-contact" data-contact="' + escape(name) + '"><summary>' + contactAvatar(name) + '<div class="ax-contact-title"><strong>' + escape(name) + '</strong><small>' + escape(valueText(relation.联系状态, '已建立联系方式')) + '</small></div>' + icon('arrow') + '</summary><div class="ax-contact-body"><dl class="ax-detail-list">' + line('关系记录', relation.关系, '待确认') + knownProfileView(known) + '</dl>' + (valueText(relation.态度印象, '') ? '<p>' + escape(relation.态度印象) + '</p>' : '') + '<p class="ax-note">通讯录展示已建立的联系；此页不发送消息。</p></div></details>';
    }).join('') + '</div>';
  }

  function momentsView() { return emptyState('moments', '尚无学园动态', '学园通知与已发生的日常动态将在这里呈现。<br>目前没有可读取的动态记录。') + panel('CAMPUS CHANNEL', '学园视窗', '<p class="ax-small">' + escape(model().schoolName) + '</p><p class="ax-note">此处不自动编写同学发言、点赞或评论。</p>'); }
  function forumView() { return emptyState('bbs', '论坛尚待记录', '话题、发帖与回复尚未接入学战档案。<br>当前不会生成帖子或模拟他人发言。') + panel('FORUM ARCHIVE', '等待真实话题', '<p class="ax-note">在相应内容确定后，按实际记录展示主题、来源与讨论进度。</p>'); }
  function competitionView() {
    return emptyState('schedule', '尚无赛事记录', '当前没有报名、搭档、对手或胜负记录。') + panel('FESTA INDEX', '星武祭', ['凤凰星武祭', '狮鹫星武祭', '王龙星武祭'].map(function (name) { return '<div class="ax-readonly-row">' + icon('schedule') + '<div><strong>' + name + '</strong><p>赛事索引 · 参赛记录待确认</p></div><span class="ax-tag">待记录</span></div>'; }).join('') + '<p class="ax-note">以上为赛事名称索引，不表示已报名或获得参赛资格。</p>');
  }

  function galleryView() {
    return '<div class="ax-preview-banner">官方人物原图展示。画廊不代表本局已相遇、已认识或已建立联系。</div><div class="ax-gallery-grid">' + people.map(function (person, index) {
      return '<article class="ax-gallery-card"><div class="ax-portrait" style="--ax-person:' + index + '"><img src="' + escape(asset('heroines')) + '" alt="' + person.name + '官方原图" loading="lazy"></div><div class="ax-gallery-body"><span class="ax-overline">' + person.english + '</span><h2>' + person.name + '</h2><p>星导馆学园 · 画廊资料</p><button class="ax-button" data-person="' + index + '">原图与气泡' + icon('arrow') + '</button></div></article>';
    }).join('') + '</div><p class="ax-note">人物保持原图，只作等比例裁切。气泡里的文字会明确标作演示台词。</p>';
  }

  function plotView() {
    var available = !!bridge?.plot, previous = plotStatus?.lastInjection;
    var disabled = plotBusy || !available ? ' disabled' : '';
    var source = plotPreview ? plotPreview.worldbook + ' / ' + plotPreview.entryName + '（order ' + plotPreview.entryOrder + '）' : '';
    return panel('STORY INJECTION', '当前主线注入', '<div class="ax-correction">' +
      '<p class="ax-note">按本局作品与当前章节读取世界书。预览不推进剧情，切换外观不改变主线。</p>' +
      '<p role="status">' + escape(plotBusy ? '正在读取…' : plotStatus ? (plotStatus.enabled ? '已开启。' : '已关闭。') + plotStatus.reason : available ? '尚未读取注入状态。' : '尚未连接剧情注入服务。') + '</p>' +
      (previous ? '<p class="ax-small">最近注入：' + escape(previous.chapter + ' · ' + previous.phase + ' · ' + (previous.entryName || '')) + '</p>' : '') +
      '<div class="ax-button-row"><button class="ax-button" data-plot-action="toggle"' + (disabled || !plotStatus ? ' disabled' : '') + '>' + (plotStatus?.enabled ? '关闭注入' : '开启注入') + '</button><button class="ax-button" data-plot-action="preview"' + disabled + '>预览当前章原文</button><button class="ax-button" data-plot-action="refresh"' + disabled + '>刷新状态</button></div>' +
      (plotError ? '<p role="alert">' + escape(plotError) + '</p>' : '') +
      (plotPreview ? '<p class="ax-small">' + escape(source) + '</p><pre tabindex="0" aria-label="当前章节注入预览">' + escape(plotPreview.text) + '</pre>' : '') + '</div>');
  }

  async function runPlotAction(action) {
    var request = ++plotRequest, currentBridge = bridge, ownBridge = bridgeRevision;
    plotBusy = true; plotError = ''; if (action === 'preview') plotPreview = null;
    render();
    try {
      if (!currentBridge?.plot) throw new Error('尚未连接剧情注入服务。');
      var api = currentBridge.plot;
      plotStatus = null;
      plotStatus = api.getStatus();
      if (action === 'toggle') {
        await api.setEnabled(!plotStatus.enabled);
        if (request !== plotRequest || ownBridge !== bridgeRevision) return;
        plotStatus = api.getStatus();
      }
      if (action === 'preview') {
        var preview = await api.preview();
        if (request !== plotRequest || ownBridge !== bridgeRevision) return;
        plotPreview = preview;
      }
    } catch (error) {
      if (request !== plotRequest || ownBridge !== bridgeRevision) return;
      plotError = valueText(error?.message, String(error));
    } finally {
      if (request === plotRequest && ownBridge === bridgeRevision) { plotBusy = false; if (currentApp === 'calendar') render(); }
    }
  }

  function invalidateStory(clearDraft) {
    storyRequest++; storyCapture = null; storyBusy = false; storyMessage = '';
    if (clearDraft) storyDraft = null;
  }

  function usesHostStoryControls() {
    var system = object(state.系统);
    return !bridge?.story && typeof bridge?.ui?.openStoryControls === 'function' &&
      (system.作品 === 'rakudai' || !Object.prototype.hasOwnProperty.call(system, '作品') && system.开局状态 === '已建档');
  }

  function openHostStoryControls() {
    if (!usesHostStoryControls()) return;
    try { bridge.ui.openStoryControls(); }
    catch (error) { notify(valueText(error?.message, '剧情控制暂时不可用。')); }
  }

  function storyActions() {
    var scene = object(storyCapture?.state?.场景), chapters = storyCapture?.chapters || [];
    var index = chapters.findIndex(function (chapter) { return chapter.key === scene.当前章; });
    var current = chapters[index], next = chapters[index + 1];
    var target = chapters.find(function (chapter) { return chapter.key === storyDraft?.chapter; });
    var ready = dataStatus === 'ready' && !storyBusy && !!storyCapture?.token;
    return {
      ready: ready,
      start: ready && !!current?.available && scene.阶段 === '未开始',
      end: ready && !!current?.available && scene.阶段 === '进行中',
      next: ready && index >= 0 && scene.阶段 === '已结束' && !!next?.available,
      jump: ready && !!target?.available && (index < 0 || chapters.indexOf(target) > index) &&
        ['time', 'location', 'entryNote'].every(function (key) { return typeof storyDraft?.[key] === 'string' && storyDraft[key].trim(); })
    };
  }

  function storyControlsView() {
    if (usesHostStoryControls()) return panel('STORY CONTROL', '章节与阶段', '<p class="ax-note">本局为落第主线，卷章操作沿用本局剧情控制。切换终端外观不会改变作品。</p><button class="ax-button" data-action="host-story-controls">打开卷章控制</button>');
    var api = bridge?.story, actions = storyActions(), chapters = storyCapture?.chapters || [];
    var scene = object(storyCapture?.state?.场景), index = chapters.findIndex(function (chapter) { return chapter.key === scene.当前章; });
    var draft = storyDraft || {}, next = index >= 0 ? chapters[index + 1] : null;
    var unavailable = chapters.filter(function (chapter) { return !chapter.available; });
    var message = storyBusy ? '正在核对剧情状态…' : storyMessage || (dataStatus === 'pending' ? '等待当前回复更新，剧情操作暂不可用。' : !api ? '请更新终端组件以使用章节控制。' : !storyCapture ? '请读取本局章节后操作。' : '已读取当前剧情。选择和填写不会立即改变本局。');
    var actionButtons = [['start', '开始本章'], ['end', '标记本章结束'], ['next', '进入下一章']].map(function (item) {
      return '<button class="ax-button" data-story-action="' + item[0] + '"' + (actions[item[0]] ? '' : ' disabled') + '>' + item[1] + '</button>';
    }).join('');
    var options = '<option value="">请选择目标章</option>' + chapters.map(function (chapter, chapterIndex) {
      var past = index >= 0 && chapterIndex <= index;
      return '<option value="' + escape(chapter.key) + '"' + (draft.chapter === chapter.key ? ' selected' : '') + (!chapter.available || past ? ' disabled' : '') + '>' + escape(chapter.title || chapter.key) + (!chapter.available ? ' · 暂不可用' : past ? ' · 当前或已过' : '') + '</option>';
    }).join('');
    return panel('STORY CONTROL', '章节与阶段', '<div class="ax-correction"><p role="status" aria-live="polite">' + escape(message) + '</p>' +
      '<div class="ax-button-row"><button class="ax-button" data-story-action="refresh"' + (!api || storyBusy || dataStatus !== 'ready' ? ' disabled' : '') + '>重新读取章节</button>' + actionButtons + '</div>' +
      (next && !next.available ? '<p class="ax-note">下一章暂不可用：' + escape(next.reason || '世界书没有可读取的正文。') + '</p>' : '') +
      (storyCapture ? '<p class="ax-small">章节来源：' + escape(storyCapture.worldbook || '本角色主世界书') + '</p><label>向前切入章节<select data-story-field="chapter"' + (!actions.ready ? ' disabled' : '') + ' style="width:100%;max-width:100%;min-height:44px;padding:10px;font:inherit;background:var(--ax-panel,#122e40);color:inherit;border:1px solid var(--ax-line,#51758b)">' + options + '</select></label>' +
        [['time', '切入时间'], ['location', '切入地点']].map(function (field) { return '<label>' + field[1] + '<input data-story-field="' + field[0] + '" value="' + escape(draft[field[0]] || '') + '"' + (!actions.ready ? ' disabled' : '') + '></label>'; }).join('') +
        '<label>切入说明<textarea data-story-field="entryNote" rows="3"' + (!actions.ready ? ' disabled' : '') + '>' + escape(draft.entryNote || '') + '</textarea></label><p class="ax-note">仅向前切入；保留已有经历。时间和地点按上方填写保存，不自动推算。</p>' +
        '<button class="ax-button ax-button-primary" data-story-action="jump"' + (actions.jump ? '' : ' disabled') + '>确认切入并开始目标章</button>' : '') +
      (unavailable.length ? '<p class="ax-note">' + unavailable.map(function (chapter) { return escape((chapter.title || chapter.key) + '：' + (chapter.reason || '暂无可读取正文')); }).join('<br>') + '</p>' : '') + '</div>');
  }

  function editStoryField(field, value) {
    if (!storyDraft || !['chapter', 'time', 'location', 'entryNote'].includes(field) || storyBusy) return;
    storyDraft[field] = value;
    var button = content.querySelector('[data-story-action="jump"]');
    if (button) button.disabled = !storyActions().jump;
  }

  async function runStoryAction(action) {
    if (storyBusy) return;
    var api = bridge?.story, currentBridge = bridge, ownBridge = bridgeRevision, request = ++storyRequest;
    if (!api || dataStatus !== 'ready') { storyMessage = '当前资料尚不可操作，请等待更新后重新读取。'; render(); return; }
    var capture = storyCapture, payload;
    if (action !== 'refresh') {
      if (!['start', 'end', 'next', 'jump'].includes(action) || !storyActions()[action]) { storyMessage = '此操作当前不可用，请检查章节与阶段后重新读取。'; render(); return; }
      payload = action === 'jump' ? { action: action, chapter: storyDraft.chapter, time: storyDraft.time.trim(), location: storyDraft.location.trim(), entryNote: storyDraft.entryNote.trim(), start: true } : { action: action };
    }
    storyBusy = true; storyMessage = ''; render();
    try {
      if (action !== 'refresh') {
        await api.transition(capture.token, payload);
        if (request !== storyRequest || ownBridge !== bridgeRevision || currentBridge !== bridge) return;
        storyCapture = null; storyDraft = null;
        await refreshTerminalState();
        if (request !== storyRequest || ownBridge !== bridgeRevision || currentBridge !== bridge) return;
      }
      var next = await api.read();
      if (request !== storyRequest || ownBridge !== bridgeRevision || currentBridge !== bridge) return;
      if (!next?.state?.场景 || !next.token || !Array.isArray(next.chapters)) throw new Error('章节控制返回的数据不完整，请更新终端后重试。');
      storyCapture = next;
      if (!storyDraft || action !== 'refresh') storyDraft = { chapter: '', time: next.state.场景.时间 || '', location: next.state.场景.地点 || '', entryNote: next.state.场景.切入说明 || '' };
      storyMessage = action === 'refresh' ? '已读取当前章节，可按需操作。' : '剧情操作已保存并回读确认。';
    } catch (error) {
      if (request !== storyRequest || ownBridge !== bridgeRevision) return;
      storyCapture = null; storyMessage = valueText(error?.message, String(error));
    } finally {
      if (request === storyRequest && ownBridge === bridgeRevision) { storyBusy = false; if (currentApp === 'calendar') render(); }
    }
  }

  function calendarView() {
    var scene = object(state.场景);
    var schedule = Object.entries(object(scene.日程)).map(function (entry) {
      var item = object(entry[1]);
      return '<div class="ax-profile-field"><h3>' + escape(entry[0]) + '</h3><dl class="ax-detail-list">' + ['类型', '日期', '时间', '地点', '状态', '说明'].map(function (key) { return line(key, item[key]); }).join('') + line('参与者', names(item.参与者)) + '</dl></div>';
    }).join('');
    var events = Object.entries(object(scene.已发生事件)).map(function (entry) {
      var item = object(entry[1]);
      return '<div class="ax-profile-field"><h3>' + escape(entry[0]) + '</h3><dl class="ax-detail-list">' + line('章段', item.章段) + line('结果', item.结果) + line('参与者', names(item.参与者)) + line('知情者', names(item.知情者)) + '</dl></div>';
    }).join('');
    return panel('CURRENT SCENE', '当前阶段', '<dl class="ax-detail-list">' + ['当前章', '阶段', '时间', '地点', '切入说明'].map(function (key) { return line(key, scene[key]); }).join('') + '</dl>') + storyControlsView() + plotView() + panel('SCHEDULE', '本局日程', schedule || '<p class="ax-note">尚无登记日程。</p>') + panel('EVENT RECORD', '已发生事件', events || '<p class="ax-note">尚无事件记录。</p>');
  }

  function settingsView() {
    var source = object(snapshot && snapshot.source);
    var sourceLabel = typeof source.messageId === 'number' ? '第 ' + source.messageId + ' 楼' + (typeof source.swipeId === 'number' ? ' · 回复 ' + (source.swipeId + 1) : '') : '来源待确认';
    var mode = document.documentElement.getAttribute('data-ax-motion') === 'reduced';
    var appearance = bridge && bridge.appearance;
    var appearanceValue = appearance && typeof appearance.get === 'function' ? appearance.get() : 'auto';
    var appearanceSelect = '<label class="ax-setting-control" style="flex-wrap:wrap"><span>终端外观<small>跟随作品或指定外观</small></span><select data-terminal-appearance' + (appearance && typeof appearance.set === 'function' ? '' : ' disabled') + ' style="min-height:44px;max-width:100%;padding:8px;font:inherit;background:#16364c;color:#c5e9f4;border:1px solid #51758b;">' +
      [['auto', '跟随作品'], ['rakudai', '落第 · 黑白'], ['asterisk', '学战 · 六花']].map(function (option) { return '<option value="' + option[0] + '"' + (appearanceValue === option[0] ? ' selected' : '') + '>' + option[1] + '</option>'; }).join('') + '</select></label>';
    return panel('TERMINAL CONNECTION', '学战终端', '<p class="ax-small">档案、人物与日程来自当前回复的 MVU。作品决定主线，能力与装备按人物档案展示，外观可以自由选择。</p>') +
      panel('DISPLAY & SOURCE', '显示与来源', '<dl class="ax-detail-list">' + line('数据状态', dataStatus === 'ready' ? '已读取' : dataStatus === 'pending' ? '等待更新' : dataStatus === 'error' ? '读取失败' : '尚未连接') + line('当前来源', sourceLabel) + line('学园', model().schoolName) + '</dl>' + appearanceSelect + '<button class="ax-setting-control" data-action="motion" aria-pressed="' + mode + '"><span>减少动态<small>只影响当前终端的视觉效果</small></span><em>' + (mode ? '已开启' : '跟随系统') + '</em></button><div class="ax-button-row">' + button('重新读取', 'refresh', false) + button('返回轮盘', 'close', false) + '</div>') + correctionSettingsView();
  }

  function correctionSettingsView() {
    var api = bridge && bridge.correction;
    if (!api) return '';
    if (!correctionEditor) correctionEditor = Object.assign({ apiKey: '' }, api.getConfig());
    var editor = correctionEditor;
    var fields = [['endpoint', 'API 地址', 'url'], ['apiKey', 'API 密钥（留空保留）', 'password'], ['model', '模型名称', 'text'], ['maxTokens', '输出上限', 'number']];
    return panel('MVU CORRECTION / ASTERISK', '副 API · 本轮校正', '<div class="ax-correction"><p class="ax-note">连接配置两作共用；此处提示词只用于学战。配置保存在本机，校正依据本轮正文并经 MVU 校验后保存。</p><label><input type="checkbox" data-correction-field="autoApply"' + (editor.autoApply ? ' checked' : '') + '> 每轮自动校正并保存</label>' + fields.map(function (field) {
      return '<label>' + field[1] + '<input data-correction-field="' + field[0] + '" type="' + field[2] + '" autocomplete="off" value="' + escape(editor[field[0]] || '') + '"></label>';
    }).join('') + [['excludedParams', '排除参数（选填）'], ['deviation', '本轮补充说明'], ['prompt', '学战校正提示词']].map(function (field) {
      var value = editor[field[0]];
      return '<label>' + field[1] + '<textarea data-correction-field="' + field[0] + '" rows="' + (field[0] === 'prompt' ? 7 : 2) + '">' + escape(Array.isArray(value) ? value.join(', ') : value || '') + '</textarea></label>';
    }).join('') + '<div class="ax-button-row">' + ['save', 'reset', 'request', 'apply', 'cancel'].map(function (action, index) {
      return '<button class="ax-button" data-correction-action="' + action + '"' + (action === 'apply' && !correctionPreview?.count ? ' disabled' : '') + '>' + ['保存配置', '恢复内置提示词', '校正并预览', '应用预览', '取消'][index] + '</button>';
    }).join('') + '</div><p id="ax-correction-status" role="status" aria-live="polite">' + escape(correctionMessage || api.getStatus().message) + '</p><pre id="ax-correction-preview" tabindex="0"' + (correctionPreview ? '' : ' hidden') + '>' + escape(correctionPreview?.patch || '') + '</pre></div>');
  }
  async function runCorrectionAction(action) {
    var api = bridge && bridge.correction;
    if (!api) return;
    var token = ++correctionAction;
    try {
      if (action === 'reset') { api.cancel(); correctionEditor.prompt = api.getConfig().defaultPrompt; correctionPreview = null; correctionMessage = '已恢复学战内置提示词，保存后生效。'; }
      else if (action === 'cancel') { api.cancel(); correctionPreview = null; correctionMessage = '已取消请求与预览。'; }
      else if (action === 'apply') { correctionPreview = null; correctionMessage = await api.apply(); }
      else {
        correctionPreview = null;
        correctionEditor = Object.assign({ apiKey: '' }, api.saveConfig(correctionEditor));
        correctionMessage = '配置已保存。';
        if (action === 'request') {
          correctionMessage = '正在校正本轮内容…'; render();
          var result = await api.request();
          if (token !== correctionAction) return;
          correctionPreview = result; correctionMessage = result.count ? result.count + ' 项待检查，尚未写入。' : '没有需要更正的变量。';
        }
      }
    } catch (error) { if (token === correctionAction) correctionMessage = valueText(error.message); }
    if (token === correctionAction && currentApp === 'settings') render();
  }

  function render() {
    var oldScroll = viewport.scrollTop;
    var expanded = Array.from(content.querySelectorAll('details[open][data-contact]')).map(function (node) { return node.dataset.contact; });
    var views = { home: homeView, blazer: profileView, lime: communicationView, moments: momentsView, bbs: forumView, schedule: competitionView, gallery: galleryView, calendar: calendarView, settings: settingsView };
    var m = model();
    document.documentElement.style.setProperty('--ax-accent', m.school ? m.school.accent : '#a9dcea');
    document.documentElement.style.setProperty('--ax-school', m.school ? m.school.rgb : '169,220,234');
    content.innerHTML = views[currentApp](); // External values enter only through escape().
    content.querySelectorAll('details[data-contact]').forEach(function (node) { node.open = expanded.indexOf(node.dataset.contact) !== -1; });
    document.getElementById('ax-page-title').textContent = apps[currentApp].name;
    document.getElementById('ax-page-code').textContent = apps[currentApp].english;
    document.getElementById('ax-back-button').disabled = currentApp === 'home';
    document.querySelectorAll('.ax-dock [data-app]').forEach(function (button) { if (button.dataset.app === currentApp) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    var status = document.getElementById('ax-source-status');
    status.textContent = dataStatus === 'ready' ? '档案已同步' : dataStatus === 'pending' ? '等待更新' : dataStatus === 'error' ? '读取失败' : dataStatus === 'loading' ? '读取中' : '未连接';
    var messageNode = document.getElementById('ax-data-message');
    messageNode.hidden = !dataMessage;
    messageNode.textContent = dataMessage;
    viewport.scrollTop = oldScroll;
  }

  function openApp(id) {
    if (id === 'worldbook') id = 'calendar';
    if (!Object.prototype.hasOwnProperty.call(apps, id)) return false;
    if (dialog.open) dialog.close();
    pageScroll[currentApp] = viewport.scrollTop;
    currentApp = id;
    render();
    viewport.scrollTop = pageScroll[id] || 0;
    viewport.focus({ preventScroll: true });
    if (id === 'calendar') { runPlotAction('refresh'); runStoryAction('refresh'); }
    return true;
  }

  function notify(message) {
    var toast = document.getElementById('ax-toast');
    clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('is-visible');
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2600);
  }

  async function refreshTerminalState() {
    if (!bridge || typeof bridge.getSnapshot !== 'function') {
      invalidateStory(true); state = {}; snapshot = null; snapshotSignature = ''; dataStatus = 'unbound'; dataMessage = '尚未连接终端宿主。请从现有轮盘终端打开学战应用。'; render(); return;
    }
    var ownRequest = ++requestRevision, ownBridge = bridgeRevision, currentBridge = bridge;
    try {
      var next = await currentBridge.getSnapshot();
      if (ownRequest !== requestRevision || ownBridge !== bridgeRevision) return;
      if (!next || !next.state || typeof next.state !== 'object' || Array.isArray(next.state)) throw new Error('宿主快照缺少可读取的 state。');
      var nextSignature = JSON.stringify(next);
      if (nextSignature === snapshotSignature && dataStatus === (next.pending ? 'pending' : 'ready')) {
        if (currentApp === 'calendar' && !next.pending && !storyCapture && !storyBusy) runStoryAction('refresh');
        return;
      }
      invalidateStory(snapshot?.source?.chatId !== next.source?.chatId);
      snapshotSignature = nextSignature;
      state = next.state; snapshot = next; dataStatus = next.pending ? 'pending' : 'ready';
      plotRequest++; plotPreview = null; plotStatus = null; plotError = ''; plotBusy = false;
      dataMessage = next.pending ? valueText(next.message, '当前回复尚待更新，暂时展示已保存的只读资料。') : '';
      render();
      if (currentApp === 'calendar') { runPlotAction('refresh'); if (!next.pending) runStoryAction('refresh'); }
    } catch (error) {
      if (ownRequest !== requestRevision || ownBridge !== bridgeRevision) return;
      invalidateStory(false); state = {}; snapshot = null; snapshotSignature = ''; dataStatus = 'error'; dataMessage = '无法读取当前资料：' + valueText(error && error.message, '宿主暂未提供快照。'); render();
    }
  }

  function renderPortraitDialog() {
    var index = activePortrait, person = people[index];
    if (!person) return;
    document.getElementById('ax-dialog-title').textContent = person.name + ' · 原图预览';
    dialogBody.innerHTML = '<span class="ax-overline">OFFICIAL VISUAL ARCHIVE</span><p>' + person.full + '</p><img class="ax-gallery-original" src="' + escape(asset('heroines')) + '" alt="尤莉丝、克劳蒂雅、纱夜与绮凛的官方合图"><p class="ax-note">原图查看，不会将人物加入通讯录或建立关系。</p><div class="ax-section-heading"><h2>六边头像与台词视窗</h2><span class="ax-tag">演示台词</span></div><div class="ax-dialogue-row"><div class="ax-dialogue-avatar" style="--ax-person:' + index + '"><img src="' + escape(asset('heroines')) + '" alt="' + person.name + '原图头像"></div><div class="ax-dialogue-bubble"><strong>' + person.name + '：</strong>' + (dialogueMode === 'long' ? person.longLine : person.shortLine) + '</div></div><div class="ax-gallery-tabs" role="group" aria-label="气泡长度预览"><button data-dialogue="short" aria-pressed="' + (dialogueMode === 'short') + '">标准台词</button><button data-dialogue="long" aria-pressed="' + (dialogueMode === 'long') + '">长文本</button></div><p class="ax-note">以上台词为界面排版示例，不是原作引文，也不表示本局已发生对话。</p>';
  }

  function closeToWheel() {
    if (dialog.open) dialog.close();
    try {
      if (bridge && bridge.ui && typeof bridge.ui.openWheel === 'function') { bridge.ui.openWheel(); return; }
      if (bridge && bridge.ui && typeof bridge.ui.close === 'function') { bridge.ui.close(); return; }
      notify('当前没有连接轮盘宿主。');
    } catch (error) { notify(valueText(error && error.message, '终端暂时无法收起。')); }
  }

  document.addEventListener('change', function (event) {
    if (event.target.dataset.storyField) { editStoryField(event.target.dataset.storyField, event.target.value); return; }
    if (event.target.matches('select[data-terminal-appearance]') && bridge && bridge.appearance) bridge.appearance.set(event.target.value);
  });
  document.addEventListener('input', function (event) {
    if (event.target.dataset.storyField) { editStoryField(event.target.dataset.storyField, event.target.value); return; }
    var field = event.target.dataset.correctionField;
    if (!field || !correctionEditor) return;
    correctionEditor[field] = field === 'autoApply' ? event.target.checked : event.target.value;
    correctionAction++; correctionPreview = null; bridge.correction.cancel();
    var apply = content.querySelector('[data-correction-action="apply"]'); if (apply) apply.disabled = true;
    var preview = document.getElementById('ax-correction-preview'); if (preview) preview.hidden = true;
  });
  document.addEventListener('click', function (event) {
    var button = event.target.closest('button'); if (!button) return;
    if (button.dataset.storyAction) { runStoryAction(button.dataset.storyAction); return; }
    if (button.dataset.action === 'host-story-controls') { openHostStoryControls(); return; }
    if (button.dataset.plotAction) { runPlotAction(button.dataset.plotAction); return; }
    if (button.dataset.correctionAction) { runCorrectionAction(button.dataset.correctionAction); return; }
    if (button.dataset.app) { openApp(button.dataset.app); return; }
    if (button.dataset.action === 'home') { openApp('home'); return; }
    if (button.dataset.action === 'close') { closeToWheel(); return; }
    if (button.dataset.action === 'dismiss') { dialog.close(); return; }
    if (button.dataset.action === 'refresh') { refreshTerminalState().then(function () { notify(dataStatus === 'ready' ? '已重新读取宿主快照。' : '已完成读取检查，请查看数据状态。'); }); return; }
    if (button.dataset.action === 'motion') {
      var mode = document.documentElement.getAttribute('data-ax-motion') === 'reduced';
      document.documentElement.setAttribute('data-ax-motion', mode ? 'system' : 'reduced'); render();
      content.querySelector('[data-action="motion"]')?.focus(); return;
    }
    if (button.dataset.person !== undefined) {
      var index = Number(button.dataset.person); if (!people[index]) return;
      lastDialogOpener = button; activePortrait = index; dialogueMode = 'short'; renderPortraitDialog(); dialog.showModal(); return;
    }
    if (button.dataset.dialogue) { dialogueMode = button.dataset.dialogue === 'long' ? 'long' : 'short'; renderPortraitDialog(); dialogBody.querySelector('[data-dialogue="' + dialogueMode + '"]')?.focus(); }
  });
  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    var rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', function () { if (lastDialogOpener && lastDialogOpener.isConnected) lastDialogOpener.focus({ preventScroll: true }); });
  document.addEventListener('error', function (event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.classList.contains('ax-holo-emblem')) { img.hidden = true; return; }
    var holder = img.parentElement;
    if (holder?.classList.contains('ax-contact-avatar') || holder?.classList.contains('ax-profile-hex')) { img.hidden = true; return; }
    if (holder && (holder.classList.contains('ax-portrait') || holder.classList.contains('ax-dialogue-avatar'))) { holder.classList.add('ax-missing-media'); holder.setAttribute('aria-label', '原图暂不可用'); }
  }, true);

  window.RKBoot = function (nextBridge) {
    if (typeof unsubscribe === 'function') unsubscribe();
    unsubscribe = null; bridgeRevision++; requestRevision++;
    bridge = nextBridge || null;
    invalidateStory(true);
    correctionAction++; correctionEditor = null; correctionPreview = null; correctionMessage = '';
    plotRequest++; plotStatus = null; plotPreview = null; plotError = ''; plotBusy = false;
    state = {}; snapshot = null; snapshotSignature = ''; dataStatus = 'loading'; dataMessage = '';
    render();
    if (bridge && typeof bridge.onUpdate === 'function') unsubscribe = bridge.onUpdate(function (event) {
      if (event?.type === 'player-portrait') { if (currentApp === 'blazer') render(); return; }
      if (event?.reset && event.type !== 'show') invalidateStory(['CHAT_CHANGED', 'CHARACTER_FIRST_MESSAGE_SELECTED'].includes(event.type));
      if (event?.reset && !['show', 'correction-applied'].includes(event.type)) {
        correctionAction++; correctionPreview = null; correctionMessage = '';
        if (['CHAT_CHANGED', 'CHARACTER_FIRST_MESSAGE_SELECTED'].includes(event.type)) correctionEditor = null;
      }
      if (event?.type === 'correction-preview') { correctionPreview = event.result; correctionMessage = event.result.count + ' 项待检查，尚未写入。'; if (currentApp === 'settings') render(); }
      else if (event?.type === 'correction-status') {
        var status = bridge.correction?.getStatus();
        if (status && status.state !== 'preview') { correctionPreview = null; var apply = content.querySelector('[data-correction-action="apply"]'); if (apply) apply.disabled = true; }
        var node = document.getElementById('ax-correction-status'); if (node && status) node.textContent = status.message;
      }
      refreshTerminalState();
    });
    return refreshTerminalState();
  };
  window.openApp = openApp;
  window.goHome = function () { return openApp('home'); };
  window.refreshTerminalState = refreshTerminalState;
  window.addEventListener('pagehide', function () { bridgeRevision++; requestRevision++; correctionAction++; invalidateStory(true); clearTimeout(toastTimer); if (typeof unsubscribe === 'function') unsubscribe(); unsubscribe = null; });
  render();
})();
