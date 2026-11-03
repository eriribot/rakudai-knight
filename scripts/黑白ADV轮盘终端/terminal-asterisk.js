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
    calendar: { name: '校历', english: 'ACADEMY CALENDAR' },
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
    var schoolName = valueText(academy.所属学园, valueText(player.所属学校, '所属学园待登记'));
    var school = schools.find(function (entry) { return schoolName.indexOf(entry.match) !== -1; }) || null;
    var rank = object(academy.校内序列);
    var rankName = valueText(rank.状态, '待记录');
    if (typeof rank.名次 === 'number' && Number.isInteger(rank.名次) && rank.名次 > 0 && rankName !== '未上榜') rankName += ' · 第 ' + rank.名次 + ' 名';
    return { player: player, academy: academy, prana: prana, weapon: weapon, school: school, schoolName: schoolName, rank: rankName, name: valueText(player.姓名, '待登记') };
  }
  function contactEntries() {
    var playerName = valueText(object(state.玩家).姓名, '');
    var deleted = object(state.系统).已删除人物;
    deleted = Array.isArray(deleted) ? deleted : [];
    return Object.entries(object(state.人际)).filter(function (entry) {
      var relation = object(entry[1]);
      return entry[0] !== playerName && deleted.indexOf(entry[0]) === -1 && relation.名册隐藏 !== true && relation.已加联系方式 === true;
    });
  }
  function line(label, value, fallback) {
    var display = valueText(value, fallback);
    var empty = ['待记录', '待登记', '待描述', '未测定', '未选', '尚未确定'].indexOf(display) !== -1;
    return '<div><dt>' + escape(label) + '</dt><dd' + (empty ? ' class="is-empty"' : '') + '>' + escape(display) + '</dd></div>';
  }
  function panel(code, title, body) { return '<section class="ax-panel"><span class="ax-overline">' + code + '</span><h2>' + title + '</h2>' + body + '</section>'; }
  function emptyState(app, title, description, extra) {
    return '<section class="ax-panel"><div class="ax-empty">' + icon(app) + '<h2>' + title + '</h2><p>' + description + '</p>' + (extra || '') + '</div></section>';
  }
  function button(label, action, primary) { return '<button class="ax-button' + (primary ? ' ax-button-primary' : '') + '" data-action="' + action + '">' + label + icon('arrow') + '</button>'; }

  function homeView() {
    var m = model();
    var emblem = m.school ? '<img class="ax-holo-emblem" src="' + escape(asset(m.school.id)) + '" alt="' + escape(m.school.name) + '校徽">' : '<svg class="ax-icon ax-holo-placeholder" aria-label="学园尚未登记"><use href="#ax-home"/></svg>';
    return '<section class="ax-panel ax-home-hero"><div class="ax-hero-top"><div class="ax-hero-copy"><span class="ax-overline">ASTERISK / PERSONAL</span><h2>你的六花，<br><span>随身记录。</span></h2><p>学园、武装与交汇的轨迹。</p></div><div class="ax-hologram"><svg class="ax-holo-lines" viewBox="0 0 180 200" fill="none" aria-hidden="true"><path d="m90 12 70 40v80l-70 40-70-40V52Z" stroke="currentColor" opacity=".25"/><path d="m90 25 58 33v66l-58 33-58-33V58Z" stroke="currentColor" stroke-width="1.5" stroke-dasharray="28 10 42 9"/><path d="M39 74V62l51-29 51 29v13m0 32v12l-51 29-51-29v-12" stroke="#d7faff" stroke-width="2.5" opacity=".7"/><circle cx="90" cy="91" r="76" stroke="currentColor" stroke-dasharray="1 5" opacity=".2"/><path d="M4 91h22m128 0h22M90 0v19m0 144v21" stroke="currentColor" opacity=".4"/></svg>' + emblem + '<div class="ax-holo-base"></div><div class="ax-holo-scan"></div></div></div><div class="ax-hero-school">' + escape(m.schoolName) + '</div><div class="ax-home-stats"><div class="ax-home-stat"><small>学生姓名</small><strong>' + escape(m.name) + '</strong></div><div class="ax-home-stat"><small>校内序列</small><strong>' + escape(m.rank) + '</strong></div><div class="ax-home-stat"><small>当前武装</small><strong>' + escape(valueText(m.weapon.名称, '未选')) + '</strong></div></div></section>' +
      '<div class="ax-section-heading"><h2>终端应用</h2><span>APPLICATIONS / 08</span></div><nav class="ax-app-grid" aria-label="学战终端应用">' + appOrder.map(function (id) { return '<button class="ax-app" data-app="' + id + '"><span class="ax-app-hex">' + icon(id) + '</span><strong>' + apps[id].name + '</strong><small>' + apps[id].english.split(' ')[0] + '</small></button>'; }).join('') + '</nav><div class="ax-home-foot"><span>ASTERISK NETWORK</span><strong>原型预览 · 只读</strong></div>';
  }

  function profileView() {
    var m = model();
    var identity = '<div class="ax-profile-identity"><div class="ax-profile-hex">' + icon('blazer') + '</div><div><span class="ax-overline">STUDENT IDENTITY</span><h2>' + escape(m.name) + '</h2><p>' + escape(m.schoolName) + '</p></div></div><dl class="ax-detail-list">' + line('所属学园', m.schoolName) + line('校内序列', m.rank) + line('能力身份', m.academy.能力身份) + '</dl>';
    var prana = ['控制', '运用', '负担'].map(function (label, index) {
      var descriptions = ['稳定性、精度与星辰力调动。', '身体强化、能力发动或武装驱动。', '持续使用后的消耗、恢复与身体负担。'];
      var text = valueText(m.prana[label], '待记录');
      return '<div class="ax-profile-field"><div><h3>' + label + '</h3><span>' + (text === '待记录' ? '待记录' : '已有描述') + '</span></div><p' + (text === '待记录' ? ' class="is-empty"' : '') + '>' + escape(text === '待记录' ? descriptions[index] + '尚待记录。' : text) + '</p></div>';
    }).join('');
    return '<section class="ax-panel">' + identity + '</section>' + panel('PRANA RECORD', '星辰力', prana + '<p class="ax-note">以实际记录描述表现；未记录的总量与百分比不作推算。</p>') +
      panel('ABILITY MECHANISM', '能力机制', '<dl class="ax-detail-list">' + line('能力身份', m.academy.能力身份) + '</dl><div class="ax-profile-field"><h3>发动方式与限制</h3><p>' + escape(valueText(m.academy.能力机制, '能力如何生效、限制与代价，尚待记录。')) + '</p></div>') +
      panel('LUX ARMAMENT', '煌式武装', '<dl class="ax-detail-list">' + line('类别', m.weapon.类别, '尚未确定') + line('名称', m.weapon.名称, '未选') + line('使用条件', m.weapon.使用条件) + '</dl><p class="ax-note">此页仅展示档案；没有装备、修改或保存操作。</p>');
  }

  function communicationView() {
    var contacts = contactEntries();
    var summary = '<div class="ax-split"><div><span class="ax-overline">CONTACT CHANNEL</span><h2 style="margin-bottom:0">已建立联系方式</h2></div><span class="ax-count">' + contacts.length + '</span></div>';
    if (!contacts.length) return panel('COMMUNICATION', '通讯录', '<div class="ax-empty">' + icon('lime') + '<h2>尚无联系人</h2><p>人物资料的存在不代表已交换联系方式。<br>建立联系后，人物才会出现在这里。</p></div>');
    return '<section class="ax-panel">' + summary + '</section><div class="ax-roster">' + contacts.map(function (entry) {
      var name = entry[0], relation = object(entry[1]), known = object(relation.已知资料);
      return '<details class="ax-contact" data-contact="' + escape(name) + '"><summary><div class="ax-profile-hex">' + icon('blazer') + '</div><div><strong>' + escape(name) + '</strong><small>' + escape(valueText(relation.联系状态, '已建立联系方式')) + '</small></div>' + icon('arrow') + '</summary><div class="ax-contact-body"><dl class="ax-detail-list">' + line('关系记录', relation.关系, '待确认') + line('已知身份', known.身份) + '</dl>' + (valueText(relation.态度印象, '') ? '<p>' + escape(relation.态度印象) + '</p>' : '') + '<p class="ax-note">当前学战原型只展示已有联系，不生成消息或回信。</p></div></details>';
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

  function calendarView() {
    var scene = object(state.场景);
    return panel('CURRENT SCENE', '当前坐标', '<dl class="ax-detail-list">' + line('时间', scene.时间, '时间待记录') + line('地点', scene.地点, '地点待记录') + '</dl>') + emptyState('calendar', '校历尚待记录', '课程、学园活动与比赛日期尚未登记。<br>这里不会根据当前日期自动安排事件。');
  }

  function settingsView() {
    var source = object(snapshot && snapshot.source);
    var sourceLabel = typeof source.messageId === 'number' ? '第 ' + source.messageId + ' 楼' + (typeof source.swipeId === 'number' ? ' · 回复 ' + (source.swipeId + 1) : '') : '来源待确认';
    var mode = document.documentElement.getAttribute('data-ax-motion') === 'reduced';
    var appearance = bridge && bridge.appearance;
    var appearanceValue = appearance && typeof appearance.get === 'function' ? appearance.get() : 'auto';
    var appearanceSelect = '<label class="ax-setting-control" style="flex-wrap:wrap"><span>终端外观<small>跟随作品或指定外观</small></span><select data-terminal-appearance' + (appearance && typeof appearance.set === 'function' ? '' : ' disabled') + ' style="min-height:44px;max-width:100%;padding:8px;font:inherit;background:#16364c;color:#c5e9f4;border:1px solid #51758b;">' +
      [['auto', '跟随作品'], ['rakudai', '落第 · 黑白'], ['asterisk', '学战 · 六花']].map(function (option) { return '<option value="' + option[0] + '"' + (appearanceValue === option[0] ? ' selected' : '') + '>' + option[1] + '</option>'; }).join('') + '</select></label>';
    return panel('PREVIEW NOTICE', '学战应用原型', '<p class="ax-small">这是黑白轮盘终端内的学战应用视图。姓名、学园与已存在的联系来自同一份宿主快照。</p><p class="ax-note">学战档案仅供视觉与字段讨论，不修改正式角色资料或发送消息；外观偏好由终端设置管理。</p>') +
      panel('DISPLAY & SOURCE', '显示与来源', '<dl class="ax-detail-list">' + line('数据状态', dataStatus === 'ready' ? '已读取 · 只读' : dataStatus === 'pending' ? '等待更新 · 只读' : dataStatus === 'error' ? '读取失败' : '尚未连接') + line('当前来源', sourceLabel) + line('学园', model().schoolName) + '</dl>' + appearanceSelect + '<button class="ax-setting-control" data-action="motion" aria-pressed="' + mode + '"><span>减少动态<small>只影响当前终端的视觉效果</small></span><em>' + (mode ? '已开启' : '跟随系统') + '</em></button><div class="ax-button-row">' + button('重新读取', 'refresh', false) + button('返回轮盘', 'close', false) + '</div>');
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
    status.textContent = dataStatus === 'ready' ? '原型 · 只读' : dataStatus === 'pending' ? '等待更新' : dataStatus === 'error' ? '读取失败' : dataStatus === 'loading' ? '读取中' : '未连接';
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
    return true;
  }

  function notify(message) {
    var toast = document.getElementById('ax-toast');
    clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('is-visible');
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2600);
  }

  async function refreshTerminalState() {
    if (!bridge || typeof bridge.getSnapshot !== 'function') {
      state = {}; snapshot = null; snapshotSignature = ''; dataStatus = 'unbound'; dataMessage = '尚未连接终端宿主。请从现有轮盘终端打开学战应用。'; render(); return;
    }
    var ownRequest = ++requestRevision, ownBridge = bridgeRevision, currentBridge = bridge;
    try {
      var next = await currentBridge.getSnapshot();
      if (ownRequest !== requestRevision || ownBridge !== bridgeRevision) return;
      if (!next || !next.state || typeof next.state !== 'object' || Array.isArray(next.state)) throw new Error('宿主快照缺少可读取的 state。');
      var nextSignature = JSON.stringify(next);
      if (nextSignature === snapshotSignature && dataStatus === (next.pending ? 'pending' : 'ready')) return;
      snapshotSignature = nextSignature;
      state = next.state; snapshot = next; dataStatus = next.pending ? 'pending' : 'ready';
      dataMessage = next.pending ? valueText(next.message, '当前回复尚待更新，暂时展示已保存的只读资料。') : '';
      render();
    } catch (error) {
      if (ownRequest !== requestRevision || ownBridge !== bridgeRevision) return;
      state = {}; snapshot = null; snapshotSignature = ''; dataStatus = 'error'; dataMessage = '无法读取当前资料：' + valueText(error && error.message, '宿主暂未提供快照。'); render();
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
    if (event.target.matches('select[data-terminal-appearance]') && bridge && bridge.appearance) bridge.appearance.set(event.target.value);
  });
  document.addEventListener('click', function (event) {
    var button = event.target.closest('button'); if (!button) return;
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
    if (holder && (holder.classList.contains('ax-portrait') || holder.classList.contains('ax-dialogue-avatar'))) { holder.classList.add('ax-missing-media'); holder.setAttribute('aria-label', '原图暂不可用'); }
  }, true);

  window.RKBoot = function (nextBridge) {
    if (typeof unsubscribe === 'function') unsubscribe();
    unsubscribe = null; bridgeRevision++; requestRevision++;
    bridge = nextBridge || null;
    state = {}; snapshot = null; snapshotSignature = ''; dataStatus = 'loading'; dataMessage = '';
    render();
    if (bridge && typeof bridge.onUpdate === 'function') unsubscribe = bridge.onUpdate(function () { refreshTerminalState(); });
    return refreshTerminalState();
  };
  window.openApp = openApp;
  window.goHome = function () { return openApp('home'); };
  window.refreshTerminalState = refreshTerminalState;
  window.addEventListener('pagehide', function () { bridgeRevision++; requestRevision++; clearTimeout(toastTimer); if (typeof unsubscribe === 'function') unsubscribe(); unsubscribe = null; });
  render();
})();
