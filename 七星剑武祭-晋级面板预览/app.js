(() => {
  const data = window.TOURNAMENT_DATA;
  const portraits = window.TOURNAMENT_PORTRAITS;
  const allMatches = [...data.regions.flatMap(region => region.matches), ...data.finals];
  const matchesById = new Map(allMatches.map(match => [match.id, match]));
  const stages = ['开幕列阵', '16强争夺', '8强争夺', '4强争夺', '准决赛', '冠军诞生'];
  const roundNames = ['', '16强争夺 · 32→16', '8强争夺 · 16→8', '4强争夺 · 8→4', '准决赛 · 4→2', '决赛 · 2→1'];
  const state = { view: 'B', stage: 0, display: 'tree', focus: 'b-r1-4', timer: null };
  const $ = selector => document.querySelector(selector);
  const board = $('#board');
  const dialog = $('#match-dialog');
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const player = id => data.players[id];
  const name = id => player(id)?.name || '未具名选手';
  const effectiveRound = match => match.id === 'b-r3-1' ? 2 : match.round;
  const resolved = match => state.stage >= effectiveRound(match);
  const isWin = match => match.status === 'played' || match.status === 'special';
  const shortNames = { stella: '史黛菈', mikoto: '鹤屋美琴', hiraga: '平贺玲泉', rinna: '风祭凛奈', tatara: '多多良幽衣' };

  function avatar(id) {
    return `<div class="fighter-avatar">${portraits[id]
      ? `<img src="${portraits[id]}" alt="" loading="lazy">`
      : `<span class="portrait-fallback" aria-hidden="true">${id && !player(id).unnamed ? esc(name(id).slice(0, 1)) : '?'}</span>`}</div>`;
  }

  function fighter(id, match, available) {
    const done = resolved(match);
    const won = available && done && id && match.winner === id;
    const lost = available && done && match.winner && id !== match.winner && isWin(match);
    let status = won ? (isWin(match) ? 'WIN' : 'ADV') : lost ? 'OUT' : '—';
    if (available && done && match.status === 'cancelled' && !won) status = '取消';
    if (available && done && match.status === 'bye' && !won) status = match.id === 'd-r3-1' ? '失格' : '缺席';
    const label = !available ? '上轮胜者待定' : id ? name(id) : match.id === 'b-r3-1' ? '无有效对手' : '未具名晋级者';
    const school = !available ? '等待晋级结果' : id ? player(id).school : match.id === 'b-r3-1' ? '赛事委员会确认出线' : '原著未交代身份';
    const className = won ? (isWin(match) ? 'won' : 'advanced') : lost ? 'lost' : !id || player(id).unnamed ? 'unknown' : '';
    return `<div class="fighter ${className}">${avatar(available ? id : null)}<div class="fighter-name"><b>${esc(label)}</b><small>${esc(school)}</small></div><span class="fighter-status">${status}</span></div>`;
  }

  function matchCard(match) {
    const done = resolved(match);
    const available = match.round === 1 || state.stage >= match.round - 1;
    const roundLabel = roundNames[match.round];
    const topLabel = match.status === 'special' ? '首轮补赛 · 1 对 4' : roundLabel;
    const resultLabels = { played: '赛果已确认', bye: '不战晋级', cancelled: '比赛取消', unknown: '赛况未详', special: '特别赛胜出' };
    const status = done ? resultLabels[match.status] : '等待赛果';
    const footer = match.status === 'special' ? '特别成员：平贺 / 风祭 / 多多良' : '';
    return `<div class="match-wrap"><button type="button" class="match ${done ? match.status : 'pending'}" data-match="${match.id}" data-node="${match.id}" aria-label="${esc(roundLabel + '：' + (available ? name(match.p1) + ' 对 ' + name(match.p2) : '等待上轮胜者') + '，' + status)}"><div class="match-top"><span>${topLabel}</span><strong class="${match.status === 'special' ? 'special-tag' : ''}">${status}</strong></div>${fighter(match.p1, match, available)}${fighter(match.p2, match, available)}${footer ? `<div class="match-result">${footer}</div>` : ''}</button></div>`;
  }

  function qualifier(id, source, champion = false) {
    const ready = resolved(source);
    return `<div class="match-wrap"><div class="qualifier ${champion ? 'champion' : ''} ${ready ? '' : 'pending'}" data-node="${id}"><div class="qualifier-title">${champion ? 'SEVEN STARS KING' : 'FINAL FOUR'}</div>${avatar(ready ? source.winner : null)}<h3>${ready ? esc(name(source.winner)) : '席位待定'}</h3><p>${ready ? esc(player(source.winner).school) : '胜者将出现在这里'}</p><span class="qualified-stamp">${ready ? champion ? 'CHAMPION' : 'QUALIFIED' : 'TO BE DECIDED'}</span></div></div>`;
  }

  function column(title, english, className, content) {
    return `<div class="bracket-column"><div class="round-title">${title}<span>${english}</span></div><div class="round-matches ${className}">${content}</div></div>`;
  }

  function renderRegion(region) {
    $('#board-kicker').textContent = `BLOCK ${region.id} / EIGHT TO ONE`;
    $('#board-title').textContent = `${region.id} 区 · 通往四强`;
    $('#board-note').textContent = region.note;
    const lastMatch = region.matches.find(match => match.round === 3);
    board.innerHTML = `<div class="bracket-scroll"><div class="bracket"><svg class="connector-layer" aria-hidden="true"></svg>${[1, 2, 3].map(round => column(['首轮 · 全国32→16', '第二轮 · 全国16→8', '分区决赛 · 全国8→4'][round - 1], `ROUND 0${round}`, `round-${round}`, region.matches.filter(match => match.round === round).map(matchCard).join(''))).join('')}${column('全国四强', 'QUALIFIED', 'round-winner', qualifier(`qualifier-${region.id}`, lastMatch))}</div></div>`;
  }

  function focusForStage() {
    if (state.view === 'all') return;
    if (state.view === 'finals') {
      state.focus = state.stage >= 5 ? 'final' : 'sf-2';
      return;
    }
    if (state.view === 'B') {
      state.focus = state.stage <= 1 ? 'b-r1-4' : 'b-r3-1';
      return;
    }
    const round = Math.max(1, Math.min(3, state.stage));
    const choices = data.regions.find(region => region.id === state.view).matches.filter(match => match.round === round);
    state.focus = (state.view === 'C' || (state.view === 'D' && round === 2) ? choices.at(-1) : choices[0]).id;
  }

  function contender(id, className = '') {
    return `<div class="tv-contender ${className}"><div class="tv-portrait">${avatar(id)}</div><b>${esc(shortNames[id] || name(id))}</b><small>${id ? esc(player(id).school) : '身份未记载'}</small></div>`;
  }

  function wing(id, label, winner = false) {
    return `<div class="tv-wing ${winner ? 'winner' : ''}"><div class="tv-wing-inner">${id ? avatar(id) : '<div class="league-seal">Ⅶ</div>'}<b>${esc(id ? shortNames[id] || name(id) : 'SEVEN STARS')}</b><small>${esc(label)}</small></div></div>`;
  }

  function promotion(match) {
    if (match.id === 'b-r1-4') return '一人击败四人 · 正式首轮胜出';
    if (match.id === 'b-r3-1') return '两人弃权、一人失格 · 委员会确认晋级四强';
    if (!match.winner) return match.status === 'cancelled' ? '本场没有举行' : '原著未交代本场胜者';
    return ['', '晋级全国16强', '晋级全国8强', '晋级全国4强', '晋级最终决赛', '第62届 · 七星剑王'][match.round];
  }

  function matchNote(match) {
    if (match.id === 'b-r1-4') return '时序：一辉对诸星结束 → 补办B区第4场（一对四）→ 整理场地后开始D区。此战仍属首轮。';
    if (match.id === 'c-r1-4') return '本场为“第一轮，C区第四场”。一辉胜出并进军第二轮；诸星首轮止步。这里的16强是胜者晋级目标。';
    if (match.id === 'b-r3-1') return '先有一对四的实战胜利，后有多多良与风祭弃权、平贺失格；B区第二、三轮取消，史黛菈提前晋级四强。';
    return match.detail;
  }

  function renderBroadcast() {
    const match = matchesById.get(state.focus);
    const done = resolved(match);
    const special = match.status === 'special';
    const available = match.round === 1 || state.stage >= match.round - 1;
    const confirmedWinner = done && match.winner;
    const liveWin = confirmedWinner && isWin(match);
    const title = special ? '史黛菈 · 惊天一对四' : match.id === 'c-r1-4' ? '一辉 VS 诸星 · 16强争夺' : match.id === 'b-r3-1' ? 'B区出线 · 委员会判定' : match.round === 5 ? '决赛 · 七星剑王之争' : `${state.view === 'finals' ? '全国' : state.view + '区'} · ${roundNames[match.round]}`;
    $('#board-kicker').textContent = special ? 'B区第四场 / 接续C区赛事的首轮补赛' : `第${match.round}轮 / ${roundNames[match.round]}`;
    $('#board-title').textContent = title;
    $('#board-note').textContent = matchNote(match);
    const result = liveWin ? 'WINNER' : confirmedWinner ? 'ADVANCE' : done ? match.status === 'cancelled' ? 'CANCELLED' : 'UNRECORDED' : 'VS';
    const center = special
      ? `<div class="tv-special-duel ${done ? 'resolved' : ''}">${contender('stella', 'main-contender ' + (done ? 'winner' : ''))}<span class="tv-vs">VS</span><div class="tv-opponents">${['mikoto', 'hiraga', 'rinna', 'tatara'].map(id => contender(id)).join('')}</div></div>`
      : confirmedWinner
        ? `<div class="tv-portrait winner-portrait">${avatar(match.winner)}</div>`
        : `<div class="broadcast-duel">${contender(available ? match.p1 : null)}<span class="tv-vs">VS</span>${contender(available ? match.p2 : null)}</div>`;
    const left = special ? wing(null, '第62届 · 七星剑斗祭') : wing(available ? match.p1 : null, available && done && match.p1 === match.winner ? 'WIN' : 'RED CORNER', liveWin && match.p1 === match.winner);
    const right = special ? wing(null, 'SPECIAL BATTLE · 1 VS 4') : wing(available ? match.p2 : null, available && done && match.p2 === match.winner ? 'WIN' : 'BLUE CORNER', liveWin && match.p2 === match.winner);
    const strip = done ? `${confirmedWinner ? name(match.winner) + ' · ' : ''}${promotion(match)}` : `${roundNames[match.round]} · 等待开赛与判定`;
    const matches = state.view === 'finals' ? data.finals : data.regions.find(region => region.id === state.view).matches;
    board.innerHTML = `<div class="tv-stage"><div class="tv-rig">${left}<div class="tv-main ${special ? 'special' : ''}"><div class="tv-glass"><div class="tv-topline">${special ? 'SPECIAL BATTLE · 1 VS 4' : esc(roundNames[match.round])}</div><div class="tv-center-content">${center}</div><div class="tv-win ${liveWin ? '' : 'advance'}">${result}</div><div class="tv-result-name">${confirmedWinner ? esc(name(match.winner)) : done ? '比赛记录' : '胜者未定'}</div><div class="tv-promotion">${done ? esc(promotion(match)) : '只显示当前阶段已知结果'}</div></div></div>${right}</div><div class="tv-result-strip">${esc(strip)}</div></div><div class="battle-strip" aria-label="选择本区对局">${matches.map(item => `<button type="button" class="battle-choice ${item.id === match.id ? 'active' : ''}" data-focus="${item.id}" aria-pressed="${item.id === match.id}"><small>${item.status === 'special' ? '首轮补赛 · 一对四' : item.status === 'cancelled' ? '取消 / 资格判定' : roundNames[item.round]}</small><b>${esc(item.status === 'special' ? '史黛菈 VS 四名对手' : item.id === 'b-r3-1' ? '史黛菈 · 提前出线' : name(item.p1) + ' / ' + name(item.p2))}</b></button>`).join('')}</div>`;
  }

  function renderFinals() {
    $('#board-kicker').textContent = 'FINAL STAGE / THE LAST FOUR';
    $('#board-title').textContent = '冠军之路 · 最后的王座';
    $('#board-note').textContent = '准决赛配对：A区对B区、C区对D区。决赛由两场准决赛的胜者交锋。';
    const final = data.finals.find(match => match.round === 5);
    board.innerHTML = `<div class="bracket-scroll"><div class="bracket final-board"><svg class="connector-layer" aria-hidden="true"></svg>${column('准决赛 · 四强', 'SEMIFINALS', 'round-2', data.finals.filter(match => match.round === 4).map(matchCard).join(''))}${column('最终决赛', 'GRAND FINAL', 'round-3', matchCard(final))}${column('七星剑王', 'CHAMPION', 'round-winner', qualifier('champion', final, true))}</div></div><div class="podium-note">${state.stage >= 5 ? '<b>最终名次</b>冠军：黑铁一辉　/　亚军：史黛菈　/　季军：黑铁王马。天音因犯规被剥夺资格，王马自动取得季军，没有另打一场季军赛。' : '<b>晋级路线</b>A区胜者 × B区胜者，C区胜者 × D区胜者；两场准决赛的胜者晋级决赛。'}</div>`;
  }

  function rosterStatus(id, region) {
    if (state.stage === 0) return { label: '参赛', className: '' };
    if (state.stage >= 5 && ['ikki', 'stella', 'ouma', 'amane'].includes(id)) return { label: { ikki: '冠军', stella: '亚军', ouma: '季军', amane: '失格' }[id], className: id === 'amane' ? 'eliminated' : 'qualifying' };
    if (state.stage >= 2 && ['hiraga', 'rinna', 'tatara'].includes(id)) return { label: id === 'hiraga' ? '失格' : '弃权', className: 'eliminated' };
    const known = allMatches.filter(match => resolved(match) && [match.p1, match.p2].includes(id));
    const last = known.at(-1);
    if (!last || (!last.winner && last.status === 'unknown')) return { label: '未详', className: '' };
    if (last.winner && last.winner !== id) return { label: id === 'shizuku' && last.status === 'bye' ? '失格' : last.round === 1 ? '首轮止步' : '止步', className: 'eliminated' };
    if (id === 'stella' && state.stage === 4) return { label: '决赛', className: 'qualifying' };
    if (last.round === 4) return { label: '决赛', className: 'qualifying' };
    const regionalFinal = region.matches.find(match => match.round === 3);
    if (resolved(regionalFinal) && regionalFinal.winner === id) return { label: '四强', className: 'qualifying' };
    if (last.winner === id) return { label: last.round === 1 ? '晋级16强' : last.round === 2 ? '晋级8强' : '晋级', className: 'qualifying' };
    return { label: '未详', className: '' };
  }

  function renderRoster() {
    $('#board-kicker').textContent = 'TOURNAMENT ROSTER / ALL 32 ENTRIES';
    $('#board-title').textContent = '正赛32人 · 参赛名单';
    $('#board-note').textContent = '18名已具名选手 + 14个未具名席位。驹城与新留仅给出姓氏；编号是展示占位，不是官方种子号。';
    board.innerHTML = `<div class="roster-grid">${data.regions.map(region => `<section class="roster-zone"><div class="roster-zone-head">BLOCK ${region.id} · ${region.id} 区<button type="button" data-open-region="${region.id}">查看对阵 ↗</button></div>${region.matches.filter(match => match.round === 1).flatMap(match => [match.p1, match.p2]).map((id, index) => {
      const status = rosterStatus(id, region);
      return `<button type="button" class="roster-entry ${status.className} ${player(id).unnamed ? 'unknown' : ''}" data-player="${id}"><span class="roster-index">${String(index + 1).padStart(2, '0')}</span>${avatar(id)}<span class="fighter-name"><b>${esc(name(id))}</b><small>${esc(player(id).school)}</small></span><span class="roster-flag">${status.label}</span></button>`;
    }).join('')}</section>`).join('')}</div><div class="overview-finals">${data.regions.map(region => {
      const match = region.matches.find(match => match.round === 3);
      return `<div class="overview-final-chip"><small>${region.id} 区出线</small><strong>${resolved(match) ? esc(name(match.winner)) : '待定'}</strong></div>`;
    }).join('')}</div>`;
  }

  function specialPerson(id) {
    return `<div class="special-person ${id === 'stella' && state.stage >= 1 ? 'winner' : ''}">${avatar(id)}<span>${esc(shortNames[id])}</span></div>`;
  }

  function renderSpecial() {
    const panel = $('#special-panel');
    panel.hidden = true;
    panel.innerHTML = '';
  }

  function render() {
    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === state.view);
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    });
    document.querySelectorAll('[data-display]').forEach(button => {
      button.classList.toggle('active', button.dataset.display === state.display);
      button.setAttribute('aria-pressed', String(button.dataset.display === state.display));
    });
    $('.display-toggle').hidden = state.view === 'all';
    $('#match-source').hidden = state.view === 'all' || state.display === 'tree';
    $('#stages').innerHTML = stages.map((label, index) => `<button type="button" data-stage="${index}" class="${index < state.stage ? 'done' : index === state.stage ? 'current' : ''}" aria-pressed="${index === state.stage}">${label}</button>`).join('');
    $('#stage-label').textContent = `0${state.stage} / ${stages[state.stage]}`;
    $('#previous').disabled = state.stage === 0;
    $('#next').disabled = state.stage === stages.length - 1;
    $('#play').textContent = state.timer ? 'Ⅱ 暂停播放' : '▶ 播放晋级';
    if (state.view === 'all') renderRoster();
    else if (state.display === 'broadcast') renderBroadcast();
    else if (state.view === 'finals') renderFinals();
    else renderRegion(data.regions.find(region => region.id === state.view));
    renderSpecial();
    requestAnimationFrame(drawConnectors);
  }

  function drawConnectors() {
    const bracket = board.querySelector('.bracket');
    if (!bracket) return;
    const svg = bracket.querySelector('svg');
    const bounds = bracket.getBoundingClientRect();
    const nodes = new Map([...bracket.querySelectorAll('[data-node]')].map(node => [node.dataset.node, node]));
    const edges = [];
    for (const [id] of nodes) {
      const match = matchesById.get(id);
      if (match) match.from.forEach(source => edges.push([source, id]));
      else if (id === 'champion') edges.push(['final', id]);
      else if (id.startsWith('qualifier-')) edges.push([`${id.at(-1).toLowerCase()}-r3-1`, id]);
    }
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    svg.innerHTML = edges.filter(([source, target]) => nodes.has(source) && nodes.has(target)).map(([source, target]) => {
      const a = nodes.get(source).getBoundingClientRect();
      const b = nodes.get(target).getBoundingClientRect();
      const x1 = a.right - bounds.left, y1 = a.top + a.height / 2 - bounds.top;
      const x2 = b.left - bounds.left, y2 = b.top + b.height / 2 - bounds.top;
      const midpoint = (x1 + x2) / 2;
      const match = matchesById.get(source);
      const active = resolved(match);
      return `<path class="connector ${active && match.winner ? 'progressed' : ''} ${active && match.status === 'cancelled' ? 'cancelled' : ''}" d="M ${x1} ${y1} H ${midpoint} V ${y2} H ${x2}"/>`;
    }).join('');
  }

  function evidence(refs) {
    return `<details class="dialog-evidence"><summary>展开原文依据</summary><p>${refs.map(esc).join('<br>')}</p><p>行号对应「世界观 / 七星剑武祭考据」中记录的本地小说文本版本。完整论证见页面底部的考据文件。</p></details>`;
  }

  function showDialog(content) {
    $('#dialog-content').innerHTML = content;
    dialog.showModal();
  }

  function person(id, vacant = false) {
    return `<div class="dialog-person">${avatar(id)}<b>${vacant ? '无有效对手' : esc(name(id))}</b><small>${vacant ? '比赛取消' : id ? esc(player(id).school) : '原著未记载身份'}</small></div>`;
  }

  function openMatch(id) {
    const match = matchesById.get(id);
    if (match.status === 'special') return openSpecial();
    const result = match.winner ? `${name(match.winner)} · ${isWin(match) ? 'WIN' : 'ADV 晋级'}` : match.status === 'cancelled' ? '比赛取消 · 无实战赛果' : '胜者未详';
    showDialog(`<p class="dialog-kicker">MATCH ARCHIVE / 原著对局档案</p><h2 id="dialog-title" class="dialog-title">${esc(match.label)}</h2><div class="dialog-duel">${person(match.p1, match.id === 'b-r3-1')}<span class="dialog-vs">VS</span>${person(match.p2)}</div><div class="dialog-result">${esc(result)}</div><p class="dialog-description">${esc(match.detail)}</p>${evidence(match.evidence)}`);
  }

  function openSpecial() {
    showDialog(`<p class="dialog-kicker">SPECIAL MATCH / 原著对局档案</p><h2 id="dialog-title" class="dialog-title">史黛菈 · 一对四特别赛</h2><div class="dialog-special-grid">${specialPerson('stella')}<span class="versus">VS</span>${['mikoto', 'hiraga', 'rinna', 'tatara'].map(specialPerson).join('')}</div><div class="dialog-result">史黛菈 · WIN</div><p class="dialog-description">${esc(data.special.detail)}</p>${evidence(data.special.evidence)}`);
  }

  function openPlayer(id) {
    const route = allMatches.filter(match => match.p1 === id || match.p2 === id);
    const refs = [...new Set(route.flatMap(match => match.evidence))];
    const identity = data.players[id]?.identityNote;
    if (identity) route.unshift({ label: '身份关联 · 原著档案', detail: identity });
    showDialog(`<p class="dialog-kicker">PLAYER ARCHIVE / 原著参赛记录</p><h2 id="dialog-title" class="dialog-title">${esc(name(id))}</h2><div class="dialog-duel">${person(id)}</div><div class="player-route">${route.map(match => `<div class="route-row"><b>${esc(match.label)}</b><span>${esc(match.detail)}</span></div>`).join('')}${['hiraga', 'rinna', 'tatara'].includes(id) ? '<div class="route-row"><b>特别赛成员</b><span>赢得各自首轮后，加入史黛菈对鹤屋的一对四特别赛；此事不抹去此前的首轮赛果。</span></div>' : ''}</div>${evidence(refs)}`);
  }

  function stop() {
    clearInterval(state.timer);
    state.timer = null;
  }
  window.RK_MATCH_CANON = { pause() { stop(); render(); } };

  function setStage(stage) {
    stop();
    state.stage = stage;
    focusForStage();
    render();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.view || button.dataset.openRegion) {
      stop();
      state.view = button.dataset.view || button.dataset.openRegion;
      focusForStage();
      render();
    } else if (button.dataset.display) {
      state.display = button.dataset.display;
      render();
    } else if (button.dataset.focus) {
      stop();
      state.focus = button.dataset.focus;
      state.stage = effectiveRound(matchesById.get(state.focus));
      render();
    } else if (button.dataset.stage !== undefined) setStage(Number(button.dataset.stage));
    else if (button.dataset.match) { stop(); state.focus = button.dataset.match; state.display = 'broadcast'; render(); }
    else if (button.dataset.player) openPlayer(button.dataset.player);
    else if (button.hasAttribute('data-special')) openSpecial();
  });
  $('#previous').addEventListener('click', () => setStage(state.stage - 1));
  $('#next').addEventListener('click', () => setStage(state.stage + 1));
  $('#play').addEventListener('click', () => {
    if (state.timer) { stop(); render(); return; }
    if (state.stage >= 5 || state.stage === 3) {
      state.stage = 0;
      if (state.view === 'finals') state.view = 'C';
    }
    focusForStage();
    state.timer = setInterval(() => {
      state.stage++;
      if (state.stage >= 4 && state.view !== 'all') state.view = 'finals';
      focusForStage();
      if (state.stage === 5) stop();
      render();
    }, 1800);
    render();
  });
  $('.dialog-close').addEventListener('click', () => dialog.close());
  $('#match-source').addEventListener('click', () => openMatch(state.focus));
  dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
  new ResizeObserver(drawConnectors).observe(board);
  render();
})();
