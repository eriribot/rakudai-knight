(() => {
  const embedded = window.RK_TOURNAMENT_EMBEDDED === true;
  const model = window.RK_PREVIEW_MVU;
  const bracketModel = window.RK_PREVIEW_BRACKET;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalizeName = name => String(name).normalize('NFKC').replace(/[\s·・･‧•．.]/g, '');
  const ui = { page: 'selection', sample: 'selection', region: 'A', match: null, bracket: null, display: {} };
  let current;
  const main = $('#session-main');
  const dialog = $('#session-dialog');
  const roundLabels = ['', '首轮 · 32 → 16', '第二轮 · 16 → 8', '分区决赛 · 8 → 4', '准决赛', '决赛'];

  function portrait(name, isPlayer = false) {
    const catalog = window.TOURNAMENT_ROLE_PORTRAITS || {};
    const canonId = Object.keys(window.TOURNAMENT_DATA.players).find(id => normalizeName(window.TOURNAMENT_DATA.players[id].name) === normalizeName(name));
    const src = isPlayer && ui.display.avatarUrl || catalog[normalizeName(name)] || window.TOURNAMENT_PORTRAITS[canonId];
    const safe = src && /^(?:assets\/|data:image\/(?:png|jpeg|webp|gif);base64,|https:\/\/)/.test(src);
    return `<div class="fighter-avatar${isPlayer ? ' session-player-avatar' : ''}">${safe ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span class="portrait-fallback" aria-hidden="true">${esc(Array.from(name || '?')[0])}</span>`}</div>`;
  }
  function person(id) { return ui.bracket?.players[id]; }
  function displayName(id) { return person(id)?.name || '等待上轮胜者'; }
  function face(id) { return portrait(displayName(id), person(id)?.player); }
  function openDialog(content) { $('#session-dialog-content').innerHTML = content; dialog.showModal(); }
  function load(snapshot, display = {}) {
    current = model.read(snapshot);
    ui.display = display;
    if (!embedded || display.reset) {
      ui.bracket = null;
      ui.match = null;
      ui.page = 'selection';
      dialog.close();
    }
    render();
  }
  function loadSample(key) {
    ui.sample = key;
    $('#snapshot-sample').value = key;
    const sample = model.samples[key];
    load(sample.state);
    $('#snapshot-notice').textContent = sample.description;
  }
  // 正式终端传入当前显示快照及共享选拔视图；本页不再次读取酒馆变量。
  window.RK_MATCH_PREVIEW = { setSnapshot(snapshot, display = {}) {
    ui.sample = 'imported';
    $('#snapshot-sample').value = '';
    load(snapshot, display);
    $('#snapshot-notice').textContent = display.sourceLabel || '已读取传入的 MVU 快照；全国赛签位等待独立赛程记录。';
  } };

  function renderProfile() {
    const p = current.player, q = current.qualification, v = current.view;
    const row = v.roster.find(item => item.id === v.playerId);
    $('#session-profile').innerHTML = `<section class="session-profile">${portrait(p.name, true)}<div class="session-identity"><span class="screen-kicker">${esc(current.stat.系统?.主角模式 || '现有角色档案')}</span><h1>${esc(p.name || '尚未建档')}</h1><p>${esc(p.school || '所属待填写')}　<span>${esc(p.rank === '未登记' ? '等级未登记' : p.rank + '级')} / ${esc(p.device || '灵装待填写')}</span></p></div><div class="session-standing"><b>${esc(q.label)}</b><span>${row ? `${row.wins == null ? '战绩待补' : `${row.wins}胜 ${row.losses}负`} · ${row.points == null ? '总分待确认' : `${row.points}分`}` : '等待本局选拔记录'}</span></div></section>`;
  }
  function card(row, representative = false) {
    return `<button type="button" class="session-person ${row.player ? 'is-player' : ''}" data-session-person="${esc(row.id)}">${portrait(row.name, row.player)}<span><b>${esc(row.name)}</b><small>${row.player ? '玩家 · 当前档案' : esc(row.source)}${representative ? ' · 代表' : ' · ' + esc(row.status)}</small></span><strong>${row.points == null ? '待补' : row.points + '<small>分</small>'}</strong></button>`;
  }
  function selectionMatch(match) {
    return `<article class="session-ledger-row"><span>第${match.轮次}轮<small>${esc(match.日期 || '日期待定')}</small></span><div><b>${esc(match.甲方姓名)} <em>VS</em> ${esc(match.乙方姓名)}</b><small>${esc(match.地点 || '场地待定')}</small></div><strong>${match.状态 === '已完成' ? esc(match.胜者 === match.甲方 ? match.甲方姓名 : match.乙方姓名) + ' 胜' : esc(match.状态)}</strong><p>${esc(match.依据)}</p></article>`;
  }
  function renderSelection() {
    const v = current.view, q = current.qualification;
    const named = v.leaderboard.filter(row => row.source !== '原创' || row.player);
    const visible = [...named].sort((a, b) => Number(b.player) - Number(a.player));
    const others = v.leaderboard.filter(row => !named.includes(row));
    const real = v.matches.filter(match => !match.程序推演);
    const playerMatches = real.filter(match => [match.甲方, match.乙方].includes(v.playerId));
    main.innerHTML = `<section class="session-section"><header><div><span class="screen-kicker">SCHOOL QUALIFIERS</span><h2>${esc(v.tournament?.赛季 || '破军学园选拔赛')}</h2></div><span class="session-status">${esc(v.tournament?.状态 || '未建账本')}</span></header><div class="selection-summary"><div class="selection-facts"><div><b>${v.tournament?.总轮次 || 20}</b><span>轮校内积分赛</span></div><div><b>${v.tournament?.代表名额 || 6}</b><span>学园代表名额</span></div><div><b>${v.roster.length}</b><span>当前可见参赛者</span></div></div><div class="qualification-note"><b>${esc(q.label)}</b><p>${esc(q.reason)}</p><button type="button" data-session-page="national">${q.status === 'qualified' ? '查看七星剑斗祭分区 →' : '查看七星剑斗祭准备情况 →'}</button></div></div>${q.representatives.length ? `<div class="section-label">本局代表名单</div><div class="session-roster">${q.representatives.map(row => card(row, true)).join('')}</div>` : ''}</section>
      <section class="session-section"><header><div><span class="screen-kicker">ROSTER / 当前角色</span><h2>选拔参赛者</h2></div><span class="subtle">${esc(v.rankingLabel || '')}</span></header><div class="session-roster">${visible.map(row => card(row)).join('') || '<p class="session-empty">当前没有可显示的破军参赛名册。</p>'}</div>${others.length ? `<details class="session-details"><summary>其他已登记参赛者 · ${others.length}人</summary><div class="session-roster">${others.map(row => card(row)).join('')}</div></details>` : ''}<p class="session-caption">人物沿用当前名册；原作人物显示既有头像，自捏角色沿用开局头像，未设置时显示姓名首字。</p></section>
      <section class="session-section"><header><div><span class="screen-kicker">MY MATCHES</span><h2>我的实际对局</h2></div><span class="subtle">${playerMatches.length}场记录</span></header>${playerMatches.map(selectionMatch).join('') || '<p class="session-empty">还没有保存玩家的实际对局。场外背景推演不会替你决定胜负。</p>'}${real.length > playerMatches.length ? `<details class="session-details"><summary>其他实际比赛 · ${real.length - playerMatches.length}场</summary>${real.filter(match => !playerMatches.includes(match)).map(selectionMatch).join('')}</details>` : ''}</section>
      <details class="session-details source-details"><summary>这份档案的数据来源与待补项</summary><p>玩家：玩家.姓名 / 所属 / 固有灵装；参赛者与对局：场景.选拔赛。头像使用终端显示配置，不写入 MVU。</p><p>${esc(current.source ? JSON.stringify(current.source) : '独立样本 / 无酒馆楼层连接')}</p>${v.warnings.map(warning => `<p>${esc(warning)}</p>`).join('')}</details>`;
  }
  function emptyNational() {
    const q = current.qualification;
    return `<div class="national-gate"><span class="screen-kicker">SEVEN STARS / DRAW PENDING</span><h2>${q.status === 'qualified' ? '代表资格已确认，等待七星剑斗祭抽签' : '七星剑斗祭 · 等待资格与分组'}</h2><p>${esc(q.reason)}</p><div class="empty-zones">${[...'ABCD'].map(z => `<div><b>${z}</b><span>8 个席位</span><small>对阵待公布</small></div>`).join('')}</div><p class="session-caption">现有 MVU 尚未保存全国赛签表。选拔名册保留在上一步，获得资格也不会直接生成本局对手。</p>${!embedded && q.status === 'qualified' ? '<button type="button" class="primary-action" data-demo-draw>演示抽签后的界面 →</button><small class="demo-disclaimer">此按钮只生成预览签表，不代表本局已经抽签。</small>' : '<button type="button" data-session-page="selection">返回选拔记录</button>'}</div>`;
  }
  function matchCard(match) {
    const winner = match.winner;
    return `<button type="button" class="session-match ${winner ? 'completed' : ''} ${[match.p1, match.p2].some(id => person(id)?.player) ? 'my-match' : ''}" data-session-match="${match.id}" data-session-node="${match.id}"><small>${esc(roundLabels[match.round])}<span>${winner ? '已演示赛果' : '待赛'}</span></small>${[match.p1, match.p2].map(id => `<span class="session-side ${id && id === winner ? 'won' : ''}">${face(id)}<span><b>${esc(displayName(id))}</b><small>${person(id)?.player ? '玩家 · 本局角色' : esc(person(id)?.school || '晋级后填入')}</small></span><em>${id && id === winner ? 'WIN' : ''}</em></span>`).join('')}</button>`;
  }
  function renderBracket() {
    const list = ui.bracket.matches.filter(m => m.zone === ui.region);
    const rounds = ui.region === 'finals' ? [4, 5] : [1, 2, 3];
    const last = list.at(-1);
    const qualifier = last.winner;
    return `<div class="session-bracket-scroll"><div class="session-bracket ${ui.region === 'finals' ? 'session-finals' : ''}"><svg class="session-connectors" aria-hidden="true"></svg>${rounds.map(round => `<section class="session-round"><h3>${roundLabels[round]}</h3><div class="session-round-matches">${list.filter(m => m.round === round).map(matchCard).join('')}</div></section>`).join('')}<section class="session-round"><h3>${ui.region === 'finals' ? '七星剑王' : '全国四强'}</h3><div class="session-round-matches"><div class="session-qualified" data-session-node="qualified">${face(qualifier)}<b>${esc(qualifier ? displayName(qualifier) : '席位待定')}</b><span>${qualifier ? 'ADVANCE' : 'TO BE DECIDED'}</span></div></div></section></div></div>`;
  }
  function tvContender(id) {
    return `<div class="tv-contender"><div class="tv-portrait">${face(id)}</div><b>${esc(displayName(id))}</b><small>${esc(person(id)?.school || '等待晋级')}</small></div>`;
  }
  function tvWing(id, label) { return `<div class="tv-wing"><div class="tv-wing-inner">${face(id)}<b>${esc(displayName(id))}</b><small>${label}</small></div></div>`; }
  function renderTV(match) {
    const mine = [match.p1, match.p2].some(id => person(id)?.player);
    const ready = !!(match.p1 && match.p2) && ![match.p1, match.p2].some(id => person(id).pending);
    const win = match.winner;
    const promotion = ['', '晋级全国16强', '晋级全国8强', '晋级全国4强', '晋级最终决赛', '第62届 · 七星剑王'][match.round];
    return `<div class="session-tv-head"><button type="button" data-session-back>← 分区晋级图</button><span>${roundLabels[match.round]} / ${match.zone === 'finals' ? '全国' : match.zone + '区'} / ${mine ? '我的比赛' : '对局'}</span></div><div class="tv-stage"><div class="tv-rig">${tvWing(match.p1, 'RED CORNER')}<div class="tv-main"><div class="tv-glass"><div class="tv-topline">${ready ? 'SEVEN STARS BATTLE' : 'WAITING FOR QUALIFIERS'}</div><div class="tv-center-content">${win ? `<div class="tv-portrait winner-portrait">${face(win)}</div>` : `<div class="broadcast-duel">${tvContender(match.p1)}<span class="tv-vs">VS</span>${tvContender(match.p2)}</div>`}</div><div class="tv-win ${win ? '' : 'advance'}">${win ? 'WINNER' : 'VS'}</div><div class="tv-result-name">${win ? esc(displayName(win)) : '胜者未定'}</div><div class="tv-promotion">${win ? esc(promotion) : '等待本局行动与赛果'}</div></div></div>${tvWing(match.p2, 'BLUE CORNER')}</div></div><div class="session-match-actions">${mine && ready && !win ? `<button type="button" class="primary-action" data-prepare-action="${match.id}">返回正文 · 准备我的行动</button><p>由你决定招式与行动；大屏在剧情确认赛果后才展示晋级。</p>` : `<p>${win ? '预览赛果已带入下一轮。' : ready ? '对局已就绪，等待剧情记录。' : '上轮胜者尚未确定。'}</p>`}${win ? '<button type="button" data-session-back>查看更新后的签表 →</button>' : ''}</div>${ready ? `<details class="session-details demo-results"><summary>预览用：演示赛果回填</summary><p>这些按钮只改变本页演示，不是正式判定，也不写入 MVU。</p><div>${[match.p1, match.p2].map(id => `<button type="button" data-demo-winner="${esc(id)}" data-demo-match="${match.id}">${esc(displayName(id))} 胜出</button>`).join('')}</div></details>` : ''}`;
  }
  function renderNational() {
    if (!ui.bracket) { main.innerHTML = emptyNational(); return; }
    const selected = ui.bracket.matches.find(m => m.id === ui.match);
    main.innerHTML = `<div class="session-demo-banner"><span>抽签演示</span><p>使用本局选拔代表；其余席位借用原著名单展示。这里的分组与赛果均不写入存档。</p><button type="button" data-my-match>定位我的比赛 ↗</button></div><nav class="region-nav session-region-nav" aria-label="演示赛区">${[...'ABCD', 'finals'].map(z => `<button type="button" data-session-region="${z}" class="${z === ui.region ? 'active' : ''}" aria-pressed="${z === ui.region}">${z === 'finals' ? '冠军之路' : z + ' 区'}<span>${z === 'finals' ? 'FINAL STAGE' : '8 → 1'}</span></button>`).join('')}</nav><section class="screen session-national-screen"><div class="screen-header"><div><span class="screen-kicker">${selected ? 'MATCH SCREEN' : 'REGIONAL BRACKET'}</span><h2>${selected ? '对战大屏' : ui.region === 'finals' ? '冠军之路' : ui.region + '区 · 通往四强'}</h2></div><span class="subtle">${selected ? '随赛果播放' : '点击对局，打开大屏'}</span></div>${selected ? renderTV(selected) : renderBracket()}</section><p class="session-caption">B区一对四可在“原著回放”查看；本局需剧情另行确认特别赛与退赛、失格，不预排史黛菈必胜。</p>`;
    requestAnimationFrame(drawLines);
  }
  function drawLines() {
    const root = main.querySelector('.session-bracket');
    if (!root) return;
    const svg = root.querySelector('svg'), bounds = root.getBoundingClientRect();
    if (!bounds.width) return;
    const nodes = new Map([...root.querySelectorAll('[data-session-node]')].map(el => [el.dataset.sessionNode, el]));
    const matches = ui.bracket.matches.filter(m => m.zone === ui.region);
    const edges = matches.flatMap(m => m.from.map(id => [id, m.id]));
    edges.push([matches.at(-1).id, 'qualified']);
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    svg.innerHTML = edges.filter(([a, b]) => nodes.has(a) && nodes.has(b)).map(([a, b]) => {
      const x = nodes.get(a).getBoundingClientRect(), y = nodes.get(b).getBoundingClientRect();
      const x1 = x.right - bounds.left, y1 = x.top + x.height / 2 - bounds.top, x2 = y.left - bounds.left, y2 = y.top + y.height / 2 - bounds.top;
      return `<path class="${ui.bracket.matches.find(m => m.id === a).winner ? 'progressed' : ''}" d="M${x1},${y1} H${(x1 + x2) / 2} V${y2} H${x2}"/>`;
    }).join('');
  }
  function render() {
    renderProfile();
    document.querySelectorAll('[data-session-page]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sessionPage === ui.page)));
    if (ui.page === 'selection') renderSelection(); else renderNational();
  }
  function openPerson(id) {
    const row = current.view.roster.find(row => row.id === id);
    const known = current.stat.人际?.[row.name]?.已知资料 || {};
    const profile = row.player ? current.stat.玩家 : known;
    openDialog(`<p class="dialog-kicker">CURRENT ROSTER / 本局人物</p><h2 id="session-dialog-title">${esc(row.name)}</h2><div class="session-person-detail">${portrait(row.name, row.player)}<div><p>${row.player ? '玩家 · ' + esc(current.stat.系统?.主角模式) : esc(row.source + ' · ' + row.status)}</p><p>${esc(profile.所属 || profile.身份 || '身份资料待补')}</p><p>灵装：${esc(profile.固有灵装 || profile.灵装 || '尚未记录')}</p><p>登记等级：${esc(profile.登记等级 || '尚未记录')}</p></div></div><p>${esc(row.player ? profile.角色简介 : profile.已知能力 || '人际档案中暂无更多已知资料。')}</p><p>${row.points == null ? '选拔战绩尚未完整。' : `${row.wins}胜 ${row.losses}负 · ${row.points}分`}</p><p class="session-caption">身份对应当前名册 ID：${esc(row.id)}</p>`);
  }
  function prepareAction(id) {
    const match = ui.bracket.matches.find(m => m.id === id);
    const opponent = [match.p1, match.p2].find(id => !person(id)?.player);
    openDialog(`<p class="dialog-kicker">MY TURN / 正文行动草稿</p><h2 id="session-dialog-title">${esc(current.player.name)} 对 ${esc(displayName(opponent))}</h2><label class="action-label" for="session-action-text">准备怎样行动？</label><textarea id="session-action-text" rows="5" placeholder="写下你的出招、试探或临场决定……"></textarea><p class="session-caption">此处是离线预览。复制后可带回正文；不代替你发送消息，也不预判胜负。</p><button type="button" id="copy-session-action">复制行动草稿</button><p id="session-copy-status" role="status"></p>`);
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.sourceMode) {
      const session = button.dataset.sourceMode === 'session';
      if (session) window.RK_MATCH_CANON.pause();
      $('#session-view').hidden = !session;
      $('#canon-view').hidden = session;
      document.querySelectorAll('[data-source-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      if (session) render();
    } else if (button.dataset.sessionPage) { ui.page = button.dataset.sessionPage; ui.match = null; render(); }
    else if (button.dataset.sessionPerson) openPerson(button.dataset.sessionPerson);
    else if (!embedded && button.hasAttribute('data-demo-draw')) {
      ui.bracket = bracketModel.create(window.TOURNAMENT_DATA, current.qualification.representatives);
      const mine = ui.bracket.matches.find(m => [m.p1, m.p2].some(id => person(id)?.player));
      ui.region = mine?.zone || 'A'; ui.match = null; render();
    } else if (button.dataset.sessionRegion) { ui.region = button.dataset.sessionRegion; ui.match = null; render(); }
    else if (button.dataset.sessionMatch) { ui.match = button.dataset.sessionMatch; render(); }
    else if (button.hasAttribute('data-session-back')) { ui.match = null; render(); }
    else if (button.hasAttribute('data-my-match')) {
      const mine = ui.bracket.matches.filter(m => [m.p1, m.p2].some(id => person(id)?.player));
      const match = mine.find(m => !m.winner) || mine.at(-1);
      if (match) { ui.region = match.zone; ui.match = match.id; render(); }
    } else if (!embedded && button.dataset.demoWinner) { bracketModel.settle(ui.bracket, button.dataset.demoMatch, button.dataset.demoWinner); render(); }
    else if (button.dataset.prepareAction) prepareAction(button.dataset.prepareAction);
    else if (button.hasAttribute('data-session-close')) dialog.close();
    else if (button.id === 'copy-session-action') {
      const input = $('#session-action-text');
      try { await navigator.clipboard.writeText(input.value); $('#session-copy-status').textContent = '已复制，可以带回正文继续行动。'; }
      catch { input.select(); $('#session-copy-status').textContent = '请复制当前选中的行动文字。'; }
    }
  });
  if (!embedded) {
  $('#snapshot-sample').innerHTML = Object.entries(model.samples).map(([key, sample]) => `<option value="${key}">${esc(sample.label)}</option>`).join('');
  $('#snapshot-sample').addEventListener('change', event => loadSample(event.target.value));
  $('#import-snapshot').addEventListener('click', () => $('#snapshot-file').click());
  $('#snapshot-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      window.RK_MATCH_PREVIEW.setSnapshot(json);
      $('#snapshot-notice').textContent = `${file.name} · 本地读取，不上传；签位等待全国赛记录。`;
    } catch (error) { $('#snapshot-notice').textContent = '这份文件未能读取为 MVU 快照：' + error.message; }
    event.target.value = '';
  });
  loadSample('selection');
  } else {
    const tools = $('.snapshot-tools');
    tools.querySelector('label').hidden = true;
    $('#import-snapshot').hidden = true;
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.textContent = '登记与维护选拔记录';
    manage.addEventListener('click', () => window.RK_TERMINAL_ACTIONS.editSelection());
    tools.prepend(manage);
    main.innerHTML = '<p class="session-caption">正在读取本局已保存档案……</p>';
  }
  new ResizeObserver(drawLines).observe(main);
})();
