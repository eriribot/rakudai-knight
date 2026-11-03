(() => {
  'use strict';
  // A standalone visual prototype. All state below is ephemeral UI/draft state.
  // No storage, host window, MVU, game variables, network APIs or message sending.
  const assetBase = '../../第一卷-世界书整理/开局网页正则替换/assets/asterisk/';
  const originalArt = `${assetBase}entry-cover-asterisk-original.jpg`;
  const schools = [
    { id: 'arlequint', name: '阿勒坎特学园', short: '阿勒坎特', english: 'ARLEQUINT ACADEMY', accent: '#b8e589', rgb: '184, 229, 137', note: '以研究与技术开发见长的学园。' },
    { id: 'seidoukan', name: '星导馆学园', short: '星导馆', english: 'SEIDOUKAN ACADEMY', accent: '#f2a4b3', rgb: '242, 164, 179', note: '汇聚多样才能的学园。' },
    { id: 'gallardworth', name: '圣嘉莱多瓦思学园', short: '圣嘉莱多瓦思', english: 'GALLARDWORTH ACADEMY', accent: '#f6dfa2', rgb: '246, 223, 162', note: '重视秩序与骑士精神的学园。' },
    { id: 'jielong', name: '界龙第七学院', short: '界龙第七', english: 'JIE LONG SEVENTH INSTITUTE', accent: '#edc57b', rgb: '237, 197, 123', note: '锤炼武艺与星仙术的学院。' },
    { id: 'rewolf', name: '雷渥夫黑学园', short: '雷渥夫黑', english: 'REWOLF BLACK INSTITUTE', accent: '#c6a7ef', rgb: '198, 167, 239', note: '实力至上的学园。' }
  ];
  const pages = { home: ['OVERVIEW', 1], profile: ['STUDENT PROFILE', 2], weapons: ['LUX ARMAMENT', 3], relations: ['RELATIONS', 4], events: ['EVENT ARCHIVE', 5] };
  const people = [
    { name: '尤莉丝', full: '尤莉丝·爱雷克西亚·冯·里斯妃特', english: 'JULIS-ALEXIA', note: '星导馆学园的学生。人物原图展示；与你的相遇与关系尚未建立。' },
    { name: '克劳蒂雅', full: '克劳蒂雅·恩菲尔德', english: 'CLAUDIA ENFIELD', note: '星导馆学园的学生会长。人物原图展示；与你的相遇与关系尚未建立。' },
    { name: '纱夜', full: '沙沙宫纱夜', english: 'SASAMIYA SAYA', note: '星导馆学园的学生。人物原图展示；与你的相遇与关系尚未建立。' },
    { name: '绮凛', full: '刀藤绮凛', english: 'TOUDOU KIRIN', note: '星导馆学园的学生。人物原图展示；与你的相遇与关系尚未建立。' }
  ];
  const weapons = [
    { id: 'blade', name: '剑型煌式武装', english: 'BLADE TYPE', description: '近距离 · 形态预览', detail: '以剑身轮廓展示煌式武装的界面样式。当前没有登记具体型号、适合率或持有者，也不会将其写入你的装备。', art: '<path d="m28 112 18-18m-10-9 20 20M43 91 97 19l13-5-1 15-56 69Z"/><path d="m49 89 53-67M34 107l8 8m17-9-28-28M27 114l-6 8 7 1 8-8"/><circle cx="79" cy="59" r="37" stroke-dasharray="3 9" opacity=".2"/>' },
    { id: 'spear', name: '枪型煌式武装', english: 'LANCE TYPE', description: '延伸距离 · 形态预览', detail: '以长柄与枪尖轮廓展示武装详情页。射程、星辰力消耗与招式均尚未设定；这里只预览视觉，不进行装备操作。', art: '<path d="m27 116 62-75m-6 7-4-16 26-21-8 33-14 4Zm6-7 12-22M28 111l6 5M35 102l5 4M43 93l5 4"/><circle cx="72" cy="65" r="44" stroke-dasharray="3 9" opacity=".2"/>' },
    { id: 'firearm', name: '射击型煌式武装', english: 'FIREARM TYPE', description: '远距离 · 形态预览', detail: '以枪身轮廓展示射击型武装条目。弹种、输出与装填方式均等待角色设定，不预填战斗数值。', art: '<path d="M22 43h81l10 8v17H66l-5 13H48l-8 25H25l12-38H22Zm9 7h68v11H31Zm17 18-5 13h11l6-13M39 78l-6 23m37-58v-8h17v8m15 8h15v10h-15"/><circle cx="72" cy="65" r="44" stroke-dasharray="3 9" opacity=".2"/>' }
  ];
  const eventItems = [
    { id: 'arrival', type: 'campus', code: '01', title: '抵达六花', subtitle: '新生记录 · 待开始', body: '这是一条事件详情的排版示例。报到日期、抵达地点以及同行者都尚未确定，正式剧情发生后才能形成事件记录。' },
    { id: 'enrolment', type: 'campus', code: '02', title: '学园登记', subtitle: '校园事项 · 待登记', body: '登记姓名、所属学园与基础身份。当前可在「学生档案」试填显示名，试填内容只在这次页面打开期间有效。' },
    { id: 'festa', type: 'festa', code: '03', title: '星武祭', subtitle: '赛事索引 · 尚未参赛', body: '此处预留星武祭相关事件的位置。当前没有报名、搭档、对手、胜负或成绩记录。预览不会触发参赛。' }
  ];
  const state = { page: 'home', school: schools[0], name: '', dialogue: 'normal', eventFilter: 'all' };
  const content = document.getElementById('at-page-content');
  const dialog = document.getElementById('at-dialog');
  const dialogContent = document.getElementById('at-dialog-content');
  const toast = document.getElementById('at-toast');
  let toastTimer;
  let dialogOpener;
  const icon = name => `<svg class="at-icon" aria-hidden="true"><use href="#at-i-${name}"/></svg>`;
  const emblem = school => `${assetBase}emblem-${school.id}.png`;
  const demoTag = '<span class="at-demo-tag">演示</span>';
  const title = (english, chinese, description) => `<div class="at-page-title"><div><span class="at-eyebrow">${english}</span><h1>${chinese}</h1><p>${description}</p></div>${demoTag}</div>`;
  const portrait = (index, extra = '') => `<div class="at-person-art ${extra}" style="--at-person-index:${index}"><img src="${originalArt}" alt="${people[index].name}官方原图" loading="lazy"></div>`;

  function homeView() {
    return `<section class="at-surface at-hero" aria-labelledby="at-home-title">
      <div class="at-hero-body"><div class="at-hero-copy"><span class="at-eyebrow">PERSONAL TERMINAL <span class="at-slash">/</span> 个人终端</span><h1 id="at-home-title">你的故事，<br>从<span>六花</span>开始。</h1><p class="at-hero-lead">学园、武装，以及即将相遇的人。<br>属于你的记录，将在这里逐一展开。</p><button class="at-button" data-page="profile">查看学生档案 ${icon('arrow')}</button></div>
      <div class="at-hologram" aria-label="学园全息校徽预览"><svg class="at-holo-lines" viewBox="0 0 300 275" fill="none" aria-hidden="true"><path class="at-faint-line" d="m150 7 111 64v128l-111 64-111-64V71Z" stroke="currentColor" stroke-width="1"/><path class="at-broken-line" d="m150 25 95 55v110l-95 55-95-55V80Z" stroke="currentColor" stroke-width="2"/><path d="m65 101 0-16 85-49 85 49v15m0 65v19l-85 49-85-49v-20" stroke="#d9fbff" stroke-width="3" opacity=".65"/><path class="at-faint-line" d="m150 49 73 42v85l-73 42-73-42V91Z" stroke="currentColor"/><path class="at-faint-line" d="M9 134h52m178 0h52M150 4v22m0 220v25M39 70l16 9m190 111 16 9M39 199l16-9m190-111 16-9" stroke="currentColor"/><circle cx="150" cy="134" r="113" stroke="currentColor" stroke-opacity=".13" stroke-dasharray="1 6"/><path d="M17 112v44m266-44v44" stroke="currentColor" stroke-opacity=".4"/></svg><img class="at-holo-emblem" data-school-emblem src="${emblem(state.school)}" alt="${state.school.name}校徽"><div class="at-holo-base"></div><div class="at-holo-scan"></div><span class="at-holo-code">ACADEMY ID / 06</span><div class="at-holo-school"><span data-school-name></span><small data-school-english></small></div></div></div>
      <div class="at-stat-row"><div class="at-stat"><small>学生姓名</small><strong data-player-name>待登记</strong></div><div class="at-stat"><small>序列</small><strong>未上榜<em>UNRANKED</em></strong></div><div class="at-stat"><small>当前武装</small><strong>未选<em>UNSELECTED</em></strong></div></div>
    </section>
    <div class="at-home-grid"><section class="at-surface at-panel"><div class="at-panel-heading"><div><span class="at-eyebrow">NEXT CHAPTER</span><h2>在开始之前</h2></div>${icon('spark')}</div><div class="at-task-list"><button class="at-task" data-action="school"><span class="at-task-number">01</span><span><strong>找到你的学园</strong><small>切换五所学园的终端配色与校徽</small></span>${icon('arrow')}</button><button class="at-task" data-page="weapons"><span class="at-task-number">02</span><span><strong>认识煌式武装</strong><small>浏览武装形态，预览详情面板</small></span>${icon('arrow')}</button><button class="at-task" data-page="relations"><span class="at-task-number">03</span><span><strong>可能相遇的人</strong><small>原作人物预览 · 关系尚未建立</small></span>${icon('arrow')}</button></div></section>
    <section class="at-surface at-panel"><div class="at-panel-heading"><div><span class="at-eyebrow">COMMUNICATION</span><h2>对话视窗</h2></div>${demoTag}</div><div id="at-dialogue-preview"></div><p class="at-dialogue-caption">演示台词 · 不代表已相遇或建立关系</p><div class="at-segmented" role="group" aria-label="对话气泡预览"><button data-dialogue="normal" aria-pressed="true">标准</button><button data-dialogue="long" aria-pressed="false">长文本</button><button data-dialogue="duo" aria-pressed="false">双人</button></div></section></div>`;
  }

  function profileView() {
    return `${title('STUDENT PROFILE', '学生档案', '从姓名开始，留出属于你的空白。')}
    <div class="at-two-column at-profile-layout">
      <section class="at-surface at-panel">
        <div class="at-profile-identity"><div class="at-profile-avatar">${icon('profile')}</div><div><span class="at-eyebrow">STUDENT / UNREGISTERED</span><h2 data-player-name>待登记</h2><p data-school-name></p></div></div>
        <dl class="at-data-list"><div><dt>登记状态</dt><dd>未正式登记</dd></div><div><dt>性别</dt><dd>男性 · 演示入口</dd></div><div><dt>所属学园</dt><dd data-school-name></dd></div><div><dt>序列</dt><dd>未上榜</dd></div><div><dt>煌式武装</dt><dd>未选</dd></div></dl>
        <section class="at-profile-fieldgroup" aria-labelledby="at-ability-title"><span class="at-eyebrow">ABILITY IDENTITY</span><h3 id="at-ability-title">能力身份与机制</h3><dl class="at-data-list"><div><dt>能力身份</dt><dd>待登记</dd></div><div><dt>能力机制</dt><dd>待描述</dd></div></dl><p class="at-note">记录能力如何生效，以及对应的限制与代价。当前没有预设能力身份。</p></section>
        <section class="at-profile-fieldgroup" aria-labelledby="at-lux-condition-title"><span class="at-eyebrow">LUX CONDITIONS</span><h3 id="at-lux-condition-title">武装使用条件</h3><dl class="at-data-list"><div><dt>使用条件</dt><dd>待记录</dd></div><div><dt>适合率</dt><dd>未测定</dd></div></dl><p class="at-note">具体型号、启动条件与使用限制，随武装设定一并确认。</p></section>
      </section>
      <div class="at-profile-aside">
        <section class="at-surface at-panel"><div class="at-panel-heading"><div><span class="at-eyebrow">PRANA RECORD</span><h2>星辰力</h2></div><span class="at-demo-tag">待记录</span></div><div class="at-field-record"><div><h3>控制</h3><span>待记录</span></div><p>稳定性、精度，以及能否按意图调动星辰力。</p></div><div class="at-field-record"><div><h3>运用</h3><span>待记录</span></div><p>身体强化、能力发动或武装驱动的实际表现。</p></div><div class="at-field-record"><div><h3>负担</h3><span>待记录</span></div><p>持续使用后的消耗、恢复与身体负担。</p></div><p class="at-note">这里只展示记录位置；尚未设置总量、百分比或战斗数值。</p></section>
        <section class="at-surface at-panel"><div class="at-panel-heading"><div><span class="at-eyebrow">IDENTITY PREVIEW</span><h2>试填显示名</h2></div>${demoTag}</div><form id="at-profile-form"><label class="at-field" for="at-name-input">显示姓名<input id="at-name-input" name="name" placeholder="输入你的姓名" maxlength="24" autocomplete="off" aria-describedby="at-name-help"></label><p class="at-form-error" id="at-name-error" hidden></p><button class="at-button" type="submit">更新本页预览 ${icon('arrow')}</button><p class="at-note" id="at-name-help">最多 24 个字符。试填会同步到本次预览的首页与档案；刷新页面后恢复为「待登记」。</p></form><button class="at-button at-secondary" style="margin-top:20px" data-action="school">切换学园 ${icon('switch')}</button></section>
      </div>
    </div>`;
  }

  function weaponsView() {
    return `${title('LUX ARMAMENT', '煌式武装', '万应素结晶，构成另一种可能。')}<section class="at-surface at-panel"><div class="at-empty-state">${icon('weapon')}<h3>尚未选择武装</h3><p>以下为武装类别的界面演示。<br>具体型号、能力与适合率等待你的设定。</p></div></section><div class="at-weapon-grid">${weapons.map(w => `<section class="at-surface at-weapon-card"><span class="at-eyebrow">${w.english}</span><div class="at-weapon-art" aria-hidden="true"><svg viewBox="0 0 140 130">${w.art}</svg></div><h2>${w.name}</h2><p>${w.description}</p><button class="at-button at-secondary" data-weapon="${w.id}">查看形态预览 ${icon('arrow')}</button></section>`).join('')}</div>`;
  }

  function relationsView() {
    return `${title('RELATIONS', '交汇的轨迹', '尚未相遇，也意味着故事才刚要开始。')}<div class="at-surface at-relation-banner">${icon('relations')}<span><strong>已建立关系：0</strong><br>下方为人物资料的展示样例，不代表已认识或已解锁。</span></div><div class="at-people-grid">${people.map((p, index) => `<section class="at-surface at-person-card">${portrait(index)}<div class="at-person-body"><span class="at-eyebrow">${p.english}</span><h2>${p.name}</h2><p>星导馆学园 · 未建立关系</p><button class="at-button at-secondary" data-person="${index}">人物预览 ${icon('arrow')}</button></div></section>`).join('')}</div>`;
  }

  function eventsView() {
    const filtered = eventItems.filter(item => state.eventFilter === 'all' || item.type === state.eventFilter);
    return `${title('EVENT ARCHIVE', '事件记录', '让已经发生的事，留下可以回望的坐标。')}<div class="at-segmented at-events-filter" role="group" aria-label="事件类型"><button data-filter="all" aria-pressed="${state.eventFilter === 'all'}">全部</button><button data-filter="campus" aria-pressed="${state.eventFilter === 'campus'}">校园</button><button data-filter="festa" aria-pressed="${state.eventFilter === 'festa'}">星武祭</button></div><div class="at-event-list">${filtered.map(item => `<article class="at-surface at-event-card"><div class="at-event-code">ENTRY<strong>${item.code}</strong></div><div><h2>${item.title}</h2><p>${item.subtitle}</p><span class="at-demo-tag">示例条目 · 未发生</span></div><button class="at-button at-secondary" data-event="${item.id}">预览详情 ${icon('arrow')}</button></article>`).join('')}</div><p class="at-note">这些条目用于检查记录的呈现方式。时间线尚未接入正式剧情。</p>`;
  }

  function syncIdentity() {
    document.documentElement.style.setProperty('--at-accent', state.school.accent);
    document.documentElement.style.setProperty('--at-school-rgb', state.school.rgb);
    document.querySelectorAll('[data-school-emblem]').forEach(img => { img.src = emblem(state.school); img.alt = `${state.school.name}校徽`; });
    document.querySelectorAll('[data-school-name]').forEach(node => { node.textContent = state.school.name; });
    document.querySelectorAll('[data-school-short]').forEach(node => { node.textContent = state.school.short; });
    document.querySelectorAll('[data-school-english]').forEach(node => { node.textContent = state.school.english; });
    document.querySelectorAll('[data-player-name]').forEach(node => { node.textContent = state.name || '待登记'; });
  }

  function renderPage(page, moveFocus = false) {
    state.page = Object.hasOwn(pages, page) ? page : 'home';
    const views = { home: homeView, profile: profileView, weapons: weaponsView, relations: relationsView, events: eventsView };
    content.innerHTML = views[state.page](); // Only local authored constants; draft text is applied with textContent/value below.
    document.getElementById('at-section-name').textContent = pages[state.page][0];
    document.getElementById('at-view-index').textContent = `0${pages[state.page][1]} — 05`;
    document.querySelectorAll('.at-nav-button').forEach(button => {
      const active = button.dataset.page === state.page;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    syncIdentity();
    if (state.page === 'home') renderDialogue();
    if (state.page === 'profile') document.getElementById('at-name-input').value = state.name;
    if (moveFocus) { document.getElementById('at-main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  }

  function renderDialogue() {
    const node = document.getElementById('at-dialogue-preview');
    if (!node) return;
    const lines = state.dialogue === 'long' ? [['尤莉丝', '目标还没有决定，也没关系。先想清楚自己为什么站上舞台，再选择该走的路。至于接下来的事，就用你自己的行动回答吧。']] : state.dialogue === 'duo' ? [['玩家', '先从哪里开始？'], ['尤莉丝', '先决定你的目标吧。']] : [['尤莉丝', '既然站上了舞台，就认真面对自己的选择吧。']];
    node.replaceChildren(...lines.map(([name, text]) => {
      const row = document.createElement('div'); row.className = 'at-dialogue-row';
      const avatar = document.createElement('div'); avatar.className = 'at-dialogue-avatar';
      if (name === '尤莉丝') {
        const img = document.createElement('img'); img.src = originalArt; img.alt = '尤莉丝原图头像'; avatar.append(img);
      } else {
        avatar.classList.add('at-dialogue-avatar-player'); avatar.setAttribute('aria-label', '玩家头像'); avatar.innerHTML = icon('profile');
      }
      const bubble = document.createElement('div'); bubble.className = 'at-dialogue';
      const p = document.createElement('p'); const strong = document.createElement('strong');
      strong.textContent = `${name}：`; p.append(strong, document.createTextNode(text)); bubble.append(p); row.append(avatar, bubble); return row;
    }));
    document.querySelectorAll('[data-dialogue]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dialogue === state.dialogue)));
  }

  function openDialog(titleText, kicker, html) {
    dialogOpener = document.activeElement;
    document.getElementById('at-dialog-title').textContent = titleText;
    document.getElementById('at-dialog-kicker').textContent = kicker;
    dialogContent.innerHTML = html; // Static local preview templates only.
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }

  function closeDialog() { dialog.close(); }

  function showSchoolPicker() {
    openDialog('选择学园', 'ACADEMY INTERFACE / 配色预览', `<p>选择一所学园，查看它的校徽与终端配色。</p><div class="at-school-list">${schools.map(school => `<button class="at-school-option" data-school="${school.id}" aria-pressed="${school.id === state.school.id}"><img src="${emblem(school)}" alt=""><span><strong>${school.name}</strong><small>${school.english}</small></span><span class="at-selected">${school.id === state.school.id ? '当前预览' : '切换'}</span></button>`).join('')}</div><div class="at-world-school"><img src="../../DLC/插图/六大学园校徽/葵恩薇儿女学园_偶像校徽.png" alt="葵恩薇儿女学园校徽"><p>葵恩薇儿女学园同样存在于六花。<br>当前为男性角色入口，因此不列入入学选择。</p></div><p class="at-note">本次切换仅用于视觉预览，不会更改游戏中的所属学园。</p>`);
  }

  function notify(message) {
    clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.page) { renderPage(button.dataset.page, true); return; }
    if (button.dataset.action === 'school') { showSchoolPicker(); return; }
    if (button.dataset.action === 'close-dialog') { closeDialog(); return; }
    if (button.dataset.school) {
      const school = schools.find(item => item.id === button.dataset.school);
      if (!school) return;
      state.school = school; syncIdentity(); closeDialog(); notify(`已切换为${school.name}的视觉预览`); return;
    }
    if (button.dataset.dialogue) { state.dialogue = button.dataset.dialogue; renderDialogue(); return; }
    if (button.dataset.filter) {
      state.eventFilter = button.dataset.filter; renderPage('events');
      document.querySelector(`[data-filter="${state.eventFilter}"]`)?.focus(); return;
    }
    if (button.dataset.weapon) {
      const weapon = weapons.find(item => item.id === button.dataset.weapon); if (!weapon) return;
      openDialog(weapon.name, `${weapon.english} / 形态演示`, `<div class="at-weapon-art"><svg viewBox="0 0 140 130" aria-hidden="true">${weapon.art}</svg></div><p>${weapon.detail}</p><dl class="at-data-list"><div><dt>具体型号</dt><dd>待设定</dd></div><div><dt>持有状态</dt><dd>未持有</dd></div><div><dt>适合率</dt><dd>未测定</dd></div></dl><p class="at-note">这是详情预览；当前武装仍为「未选」。</p>`); return;
    }
    if (button.dataset.person !== undefined) {
      const index = Number(button.dataset.person); const person = people[index]; if (!person) return;
      openDialog(person.name, `${person.english} / 人物预览`, `${portrait(index, 'at-modal-portrait')}<div class="at-detail-label">${demoTag}</div><p>${person.full}</p><p>${person.note}</p><dl class="at-data-list"><div><dt>关系状态</dt><dd>未建立</dd></div><div><dt>相遇记录</dt><dd>暂无</dd></div></dl><p class="at-note">保留官方人物原图，仅做界面裁切展示。未设置好感、评价或剧情进度。</p>`); return;
    }
    if (button.dataset.event) {
      const item = eventItems.find(entry => entry.id === button.dataset.event); if (!item) return;
      openDialog(item.title, `EVENT ${item.code} / 示例条目`, `<div class="at-detail-label"><span class="at-demo-tag">未发生 · 排版演示</span></div><p>${item.body}</p><dl class="at-data-list"><div><dt>时间</dt><dd>未确定</dd></div><div><dt>结果</dt><dd>无记录</dd></div><div><dt>进度</dt><dd>尚未开始</dd></div></dl>`);
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'at-profile-form') return;
    event.preventDefault();
    const input = document.getElementById('at-name-input');
    const value = input.value.trim();
    const error = document.getElementById('at-name-error');
    if (value.length > 24) { error.textContent = '请将显示名控制在 24 个字符以内。'; error.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    error.hidden = true; input.removeAttribute('aria-invalid'); state.name = value; syncIdentity();
    notify(value ? '显示名已更新，仅用于本次页面预览' : '显示名已恢复为「待登记」');
  });

  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true }); });
  document.querySelector('.at-brand').addEventListener('click', event => { event.preventDefault(); renderPage('home', true); });
  renderPage('home');
})();
