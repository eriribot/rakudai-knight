export function tournamentSnapshotKey(state) {
  return JSON.stringify({ ledger: state?.场景?.选拔赛 ?? null, qualification: state?.场景?.七星剑斗祭 ?? null,
    time: state?.场景?.时间 ?? null, mode: state?.系统?.主角模式 ?? null, player: state?.玩家?.姓名 ?? null,
    affiliation: state?.玩家?.所属 ?? null });
}

// 赛事界面只通过传入快照和回调接入外壳；草稿、保存状态与 iframe 留在本实例内。
export function createTerminalTournament({ getSnapshot, refreshState, refreshView, renderSchedule, navigate,
  esc, sourceKey, sourceLabel, getPortrait, panelHtml, document }) {
  // ===== 选拔赛：三个页面共用程序视图；实际记录优先，背景推演只读 =====
  var tournamentDraft = null;
  var tournamentWriting = false;
  var tournamentMessage = '';
  function tournamentView() {
    var current = getSnapshot(), stat = current.state, service = current.service;
    if (!current.hasDisplayedState) return { exists: false, roster: [], matches: [], leaderboard: [], warnings: ['等待本局 MVU 保存后读取选拔赛。'] };
    if (!service || typeof service.view !== 'function') {
      return { exists: false, roster: [], matches: [], leaderboard: [], warnings: ['选拔赛组件尚未连接，请更新配套脚本。'] };
    }
    try { return service.view(stat); }
    catch (error) { return { exists: false, roster: [], matches: [], leaderboard: [], warnings: [error.message || '选拔赛读取失败'] }; }
  }
  function nationalView() {
    var current = getSnapshot();
    return current.hasDisplayedState && current.service && current.service.nationalView
      ? current.service.nationalView(current.state)
      : { exists: false, tournament: {}, participants: [], matches: [], advancement: [] };
  }
  function nationalRecords() {
    var view = nationalView(), ledger = view.tournament || {}, calendar = view.calendar || {};
    return '<div class="card1 rk-t-panel"><div class="ct">七星剑斗祭 · 本局赛程</div><p class="gba-note">' +
      esc((calendar.date ? calendar.date.key + (calendar.active ? ' · 赛期内' : ' · 赛期外') : '剧情日期待确认') + ' · ' + (ledger.状态 || '未开始')) + '</p>' +
      '<div class="rk-t-actions">' + tournamentButton('national-schedule', '赛期与状态') + tournamentButton('national-match', '登记全国赛') + tournamentButton('national-advancement', '登记晋级裁定') + '</div>' +
      view.matches.map(function(match) {
        return '<article class="rk-t-match"><div class="rk-t-match-head"><strong>' + esc(match.分区 + ' · ' + match.轮次) + '</strong><span>' + esc(match.状态) + '</span></div><p>' + esc(match.参赛者姓名.join(' / ')) + '</p><p class="gba-note">' +
          esc([match.日期 || '日期待定', match.时间, match.地点].filter(Boolean).join(' · ')) + '</p>' +
          (match.状态 === '已完成' ? '<p>' + esc(match.胜者姓名 + ' 胜出' + (match.晋级至 ? ' · ' + match.晋级至 : '')) + '</p>' : '') +
          (match.依据 ? '<p class="gba-note">' + esc(match.依据) + '</p>' : '') + tournamentButton('national-match', '修改赛程 / 赛果', match.id) + '</article>';
      }).join('') + (view.matches.length ? '' : '<p>对阵待公布，可逐场登记。</p>') +
      Object.keys(ledger.晋级记录 || {}).map(function(id) {
        var row = ledger.晋级记录[id], person = view.participants.find(function(p) { return p.id === row.选手; });
        return '<article class="rk-t-match"><strong>' + esc((person ? person.name : row.选手) + ' · ' + row.阶段 + ' · ' + row.状态) + '</strong><p class="gba-note">' + esc(row.依据 || '') + '</p>' + tournamentButton('national-advancement', '修改晋级裁定', id) + '</article>';
      }).join('') + '</div>';
  }
  function tournamentButton(action, text, id) {
    return '<button type="button" data-rk-t-action="' + action + '"' + (id ? ' data-rk-t-id="' + esc(id) + '"' : '') +
      (tournamentWriting ? ' disabled' : '') + '>' + esc(text) + '</button>';
  }
  function tournamentResult(match) {
    if (match.状态 !== '已完成') return match.状态 || '待定';
    var name = match.胜者 === match.甲方 ? match.甲方姓名 : match.乙方姓名;
    return (match.程序推演 ? '背景推演 · ' : '已确认 · ') + name + ' 胜出' + (match.弃权方 ? ' · 对方弃权' : '') + ' · ' +
      (match.积分 == null ? '本场积分待确认' : '本场 +' + match.积分 + ' 分');
  }
  function tournamentMatchCard(match, editable) {
    editable = editable && !match.程序推演;
    return '<article class="rk-t-match"><div class="rk-t-match-head"><strong>第 ' + esc(match.轮次) + ' 轮</strong><span>' + esc(match.状态) + '</span></div>' +
      '<p class="rk-t-pair">' + esc(match.甲方姓名) + ' <span>对</span> ' + esc(match.乙方姓名) + '</p>' +
      '<p class="gba-note">' + esc((match.日期 || '日期待定') + (match.时间 ? ' · ' + match.时间 : '') + ' · ' + (match.地点 || '地点待定')) + '</p>' +
      (match.状态 === '已完成' ? '<p>' + esc(tournamentResult(match)) + '</p>' : '') +
      (match.依据 ? '<p class="gba-note">' + esc(match.依据) + '</p>' : '') +
      (editable ? '<div class="rk-t-actions">' + tournamentButton('edit-match', '登记 / 修正结果', match.id) +
        (match.状态 === '已取消' ? '' : tournamentButton('cancel-match', '取消此场', match.id)) + '</div>' : '') + '</article>';
  }
  function tournamentWarnings(view) {
    return view.warnings && view.warnings.length ? '<div class="gba-note" role="status">' + view.warnings.map(function(item) { return '<p>' + esc(item) + '</p>'; }).join('') + '</div>' : '';
  }
  function tournamentCalendar(view) {
    var calendar = view.calendar;
    if (!calendar) return '';
    if (!calendar.valid) return '<p class="gba-note">' + esc(calendar.reason || '剧情日期待确认，暂不推演场外比赛。') + '</p>';
    var today = calendar.todayRound ? '今天第 ' + calendar.todayRound + ' 轮，待实际赛果' : '';
    var progress = calendar.currentRound ? '当前第 ' + calendar.currentRound + ' 轮' : '尚未开赛';
    var next = (calendar.schedule || []).find(function(row) { return row.round === calendar.nextRound; });
    return '<p><strong>' + esc(calendar.date.key + ' · ' + (calendar.suspended ? '黄金周停赛中' : today || progress)) + '</strong></p>' +
      '<p class="gba-note">' + esc('已过去 ' + (calendar.elapsedRound || 0) + ' 轮排期；当天不会自动判胜。' +
        (next ? ' 下一排期：' + next.date + '，第 ' + next.round + ' 轮。' : '')) + '</p>' +
      '<p class="gba-note">4/27—5/6 为学园停赛期。日期来自剧情日历；选择日历格子不会推进比赛。</p>';
  }
  function tournamentBackgroundMatches(matches) {
    var projected = matches.filter(function(match) { return match.程序推演; });
    return projected.length ? '<details class="card1 rk-t-panel"><summary>场外背景推演 · ' + projected.length + ' 场</summary><p class="gba-note">程序按已过去的排期生成；本局实际对局与赛果优先覆盖，以下记录不可直接编辑。</p>' +
      projected.map(function(match) { return tournamentMatchCard(match, false); }).join('') + '</details>' : '';
  }
  function tournamentRanking(view) {
    if (!view.roster.length) return '<p>尚未登记参赛者。</p>';
    return '<p class="gba-note">' + esc(view.rankingLabel || '仅据已记录积分') + ' · 同分并列；涉及代表名额时保留待决，不按姓名或录入顺序分配。</p>' +
      '<div class="rk-t-table-wrap"><table class="rk-t-table"><thead><tr><th scope="col">选手</th><th scope="col">战绩</th><th scope="col">积分</th></tr></thead><tbody>' +
      view.leaderboard.map(function(row) {
        return '<tr><th scope="row">' + (row.rank ? esc(row.rank) + (row.tied ? ' 并列 · ' : ' · ') : '') + esc(row.name) + '<small>' + esc(row.status + (row.projectedWithdrawal ? '（背景推演）' : '') + ' · ' + row.source) + '</small></th>' +
          '<td>' + (row.wins == null || row.losses == null ? '战绩待补<small>已计入 ' + esc(row.recordedWins || 0) + ' 胜 ' + esc(row.recordedLosses || 0) + ' 负</small>' : esc(row.wins) + ' 胜 ' + esc(row.losses) + ' 负') +
          (row.simulatedMatches ? '<small>含背景推演 ' + esc(row.simulatedMatches) + ' 场</small>' : '') + '</td>' +
          '<td>' + (row.points == null ? '总分待确认<small>已计入 ' + esc(row.recordedPoints || 0) + ' 分</small>' : esc(row.points)) +
          (row.pendingPoints ? '<small>' + esc(row.pendingPoints) + ' 场积分待补</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function tournamentQualificationCandidates(view) {
    var stat = getSnapshot().state;
    var saved = stat && stat.场景 && stat.场景.七星剑斗祭 && stat.场景.七星剑斗祭.资格名册 || {};
    var candidates = Object.create(null), player = stat && stat.玩家 || {};
    var school = function(value) { return String(value || '').split(/[／/·]/)[0].trim().replace('破軍學園', '破军学园'); };
    var playerName = stat && stat.系统 && stat.系统.主角模式 === '黑铁一辉' ? '黑铁一辉' : String(player.姓名 || '').trim();
    var playerSchool = school(player.所属);
    view.roster.forEach(function(row) { candidates[row.id] = { 姓名: row.name, 学园: '破军学园' }; });
    Object.keys(saved).forEach(function(id) { candidates[id] = saved[id]; });
    var matches = Object.keys(saved).filter(function(id) { return saved[id].姓名 === playerName && school(saved[id].学园) === playerSchool; });
    var savedPlayerId = matches.indexOf(view.playerId) >= 0 ? view.playerId : matches.length === 1 ? matches[0] : '';
    var playerId = savedPlayerId || view.playerId || 'player';
    if (!savedPlayerId && !view.playerId && candidates[playerId] && (candidates[playerId].姓名 !== playerName || school(candidates[playerId].学园) !== playerSchool)) {
      var index = 1;
      while (candidates['player_' + String(index).padStart(3, '0')]) index++;
      playerId = 'player_' + String(index).padStart(3, '0');
    }
    candidates[playerId] = Object.assign({}, saved[savedPlayerId], { 姓名: playerName, 学园: playerSchool });
    return Object.keys(candidates).map(function(id) { return Object.assign({}, candidates[id], { id: id, player: id === playerId }); });
  }
  function tournamentQualifications(view) {
    var stat = getSnapshot().state;
    var saved = stat && stat.场景 && stat.场景.七星剑斗祭 && stat.场景.七星剑斗祭.资格名册 || {};
    var player = tournamentQualificationCandidates(view).find(function(row) { return row.player; });
    return '<div class="card1 rk-t-panel"><div class="ct">七星剑斗祭 · 代表资格</div><p class="gba-note">按本局剧情登记各学园代表，跳过的普通对局无需逐场补齐。</p>' +
      '<div class="rk-t-actions">' + tournamentButton('qualification', '我的资格', player.id) + tournamentButton('qualification', '登记其他角色') + '</div>' +
      (Object.keys(saved).length ? Object.keys(saved).map(function(id) {
        var row = saved[id];
        return '<article class="rk-t-match"><div class="rk-t-match-head"><strong>' + esc(row.姓名) + '</strong><span>' + esc(row.资格状态) + '</span></div><p>' + esc(row.学园) + '</p>' +
          (row.依据 ? '<p class="gba-note">' + esc(row.依据) + '</p>' : '') + '<div class="rk-t-actions">' + tournamentButton('qualification', '修改资格', id) + '</div></article>';
      }).join('') : '<p>尚未登记代表资格。</p>') + '</div>';
  }
  function bindTournamentActions(body) {
    body.onclick = function(event) {
      var button = event.target.closest('[data-rk-t-action]');
      if (!button || !body.contains(button) || button.disabled) return;
      var action = button.getAttribute('data-rk-t-action');
      var id = button.getAttribute('data-rk-t-id') || '';
      if (action === 'open-schedule') { navigate('schedule'); return; }
      if (action === 'open-arena') { navigate('arena'); return; }
      if (tournamentWriting) return;
      if (action === 'close-draft') { tournamentDraft = null; tournamentMessage = ''; renderSchedule(); return; }
      if (action === 'cancel-match') { submitTournament({ action: 'cancelMatch', id: id }); return; }
      if (action === 'suggest') { suggestTournamentDraft(); return; }
      openTournamentDraft(action, id);
    };
    body.oninput = function(event) {
      if (!tournamentDraft || !event.target.matches('[data-rk-t-field]')) return;
      tournamentDraft.fields[event.target.name] = event.target.multiple ? Array.from(event.target.selectedOptions, function(option) { return option.value; }) : event.target.value;
    };
    body.onchange = function(event) {
      if (!tournamentDraft || !event.target.matches('[data-rk-t-field]')) return;
      if (tournamentDraft.kind === 'qualification' && event.target.name === '参赛者') { openTournamentDraft('qualification', event.target.value); return; }
      tournamentDraft.fields[event.target.name] = event.target.multiple ? Array.from(event.target.selectedOptions, function(option) { return option.value; }) : event.target.value;
      if (['甲方', '乙方', '全国参赛者'].indexOf(event.target.name) >= 0) renderSchedule();
    };
    body.onsubmit = function(event) {
      if (!event.target.matches('[data-rk-t-form]')) return;
      event.preventDefault();
      saveTournamentDraft();
    };
  }
  function openTournamentDraft(action, id) {
    var current = getSnapshot(), stat = current.state, stateSource = current.source;
    var view = tournamentView();
    if (view.applicable === false && action !== 'qualification' && action.indexOf('national-') !== 0) { tournamentDraft = null; tournamentMessage = '当前所属不适用破军选拔，仅可查看历史记录。'; renderSchedule(); return; }
    var fields = {}, kind = action;
    tournamentMessage = '';
    if (action.indexOf('national-') === 0) {
      var national = nationalView(), ledger = national.tournament || {};
      if (action === 'national-schedule') fields = { 开始日期: ledger.开始日期 || national.calendar.startDate, 结束日期: ledger.结束日期 || national.calendar.endDate, 状态: ledger.状态 || '未开始' };
      else {
        var records = action === 'national-match' ? ledger.比赛 || {} : ledger.晋级记录 || {};
        fields = records[id] ? Object.assign({}, records[id]) : action === 'national-match'
          ? { 轮次: '首轮', 分区: '未定', 参赛者: [], 日期: '', 时间: '', 地点: '', 状态: '待定', 胜者: '', 晋级至: '', 依据: '' }
          : { 选手: '', 阶段: '16强', 日期: '', 状态: '已确认', 依据: '' };
        if (action === 'national-match') fields.全国参赛者 = fields.参赛者.slice();
        if (!id) { var next = 1, prefix = action === 'national-match' ? 'national_match_' : 'advance_'; while (records[prefix + next]) next++; id = prefix + next; }
      }
    } else if (action === 'qualification') {
      var candidate = tournamentQualificationCandidates(view).find(function(row) { return row.id === id; });
      fields = Object.assign({ 姓名: '', 学园: '', 资格状态: '待确认', 依据: '' }, candidate, { 参赛者: id || '' });
    } else if (action === 'edit-match' || action === 'new-match') {
      kind = 'match';
      if (id && view.matches.some(function(match) { return match.id === id && match.程序推演; })) { tournamentMessage = '背景推演为只读记录，请登记本局实际比赛以覆盖对应排期。'; renderSchedule(); return; }
      var record = id && view.tournament && view.tournament.比赛[id];
      var calendar = view.calendar || {}, round = calendar.currentRound || calendar.nextRound || 1;
      var slot = (calendar.schedule || []).find(function(row) { return row.round === round; });
      fields = record ? Object.assign({}, record) : { 轮次: round, 甲方: view.playerId || (view.roster[0] || {}).id || '', 乙方: '', 状态: '待定', 日期: slot && slot.date || '', 时间: '', 地点: '', 依据: '' };
      if (!id) { var n = 1; while (view.tournament && view.tournament.比赛['match_' + n]) n++; id = 'match_' + n; }
    } else if (action === 'edit-participant' || action === 'new-participant' || action === 'backfill') {
      kind = 'participant';
      var person = id && view.tournament && view.tournament.名册[id];
      fields = person ? Object.assign({}, person) : { 姓名: '', 来源: '原创', 参赛状态: '参赛' };
      if (fields.入赛轮次 == null) fields.入赛轮次 = 1;
      var base = person && person.初始战绩 || {};
      ['截至轮次', '胜场', '败场', '积分', '依据'].forEach(function(key) { fields['初始' + key] = base[key] == null ? '' : base[key]; });
    } else if (action === 'initialize') fields = { season: '破军学园选拔赛' };
    else if (action === 'status') fields = { status: view.tournament.状态 };
    else if (action === 'detained') fields = { detained: view.tournament.一辉拘押 === true ? 'true' : 'false' };
    else return;
    // 草稿归属当前回复；刷新可保留输入，切换聊天或回复后不得提交旧草稿。
    tournamentDraft = { kind: kind, id: id, fields: fields, backfill: action === 'backfill', source: sourceKey(stateSource), ledger: current.service.snapshotKey(stat) };
    renderSchedule();
    var form = document.querySelector('[data-rk-t-form]');
    if (form) { form.scrollIntoView({ block: 'nearest' }); var input = form.querySelector('input,select'); if (input) input.focus({ preventScroll: true }); }
  }
  function tournamentField(name, label, fields, type, options) {
    var value = fields[name] == null ? '' : fields[name];
    var id = 'rk-t-' + name;
    var common = ' id="' + esc(id) + '" name="' + esc(name) + '" data-rk-t-field';
    var control;
    if (options) control = '<select' + common + (type === 'multiple' ? ' multiple size="6"' : '') + '>' + options.map(function(option) {
      var pair = Array.isArray(option) ? option : [option, option];
      return '<option value="' + esc(pair[0]) + '"' + (Array.isArray(value) ? value.indexOf(pair[0]) >= 0 ? ' selected' : '' : String(value) === String(pair[0]) ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
    }).join('') + '</select>';
    else if (type === 'textarea') control = '<textarea' + common + ' rows="2">' + esc(value) + '</textarea>';
    else control = '<input' + common + ' type="' + (type || 'text') + '" value="' + esc(value) + '"' + (type === 'number' ? ' min="0" step="1"' : '') + '>';
    return '<label class="rk-t-field" for="' + esc(id) + '"><span>' + esc(label) + '</span>' + control + '</label>';
  }
  function renderTournamentDraft(view) {
    var dataStatus = getSnapshot().status;
    var draft = tournamentDraft;
    if (!draft) return '';
    var fields = draft.fields, contents = '', title = '';
    var field = function(name, label, type, options) { return tournamentField(name, label, fields, type, options); };
    if (draft.kind.indexOf('national-') === 0) {
      var national = nationalView();
      var nationalPeople = national.participants.map(function(row) { return [row.id, row.name + ' · ' + row.school]; });
      var stages = ['16强', '8强', '4强', '决赛', '冠军'];
      if (draft.kind === 'national-schedule') {
        title = '七星剑斗祭赛期';
        contents = '<div class="rk-t-grid">' + field('开始日期', '开始日期', 'date') + field('结束日期', '结束日期', 'date') + field('状态', '状态', '', ['未开始', '进行中', '已结束']) + '</div><p class="gba-note">剧情日期进入赛期后发送全国赛规则；日期不决定胜负。</p>';
      } else if (draft.kind === 'national-match') {
        title = '全国赛安排 / 赛果';
        var selected = fields.全国参赛者 || [];
        contents = '<div class="rk-t-grid">' + field('轮次', '轮次 / 特别赛名称') + field('分区', '分区', '', ['A', 'B', 'C', 'D', '决赛区', '未定']) + field('状态', '状态', '', ['待定', '已安排', '进行中', '已完成', '已取消']) + '</div>' +
          field('全国参赛者', '参赛者（可多选；角色先登记代表资格）', 'multiple', nationalPeople) + '<div class="rk-t-grid">' + field('日期', '日期', 'date') + field('时间', '时间') + field('地点', '地点') +
          field('胜者', '胜者', '', [['', '尚未确定']].concat(nationalPeople.filter(function(pair) { return selected.indexOf(pair[0]) >= 0; }))) + field('晋级至', '胜者晋级至', '', [''].concat(stages)) + '</div>' + field('依据', '赛程 / 赛果依据', 'textarea');
      } else {
        title = '全国赛晋级裁定';
        contents = '<p class="gba-note">用于直接晋级等正式裁定；已有比赛胜者会自动显示晋级。</p><div class="rk-t-grid">' + field('选手', '选手', '', [['', '请选择']].concat(nationalPeople)) + field('阶段', '阶段', '', stages) + field('日期', '日期', 'date') + field('状态', '状态', '', ['已确认', '已撤销']) + '</div>' + field('依据', '裁定依据', 'textarea');
      }
    }
    else if (draft.kind === 'initialize') { title = '建立本局选拔赛'; contents = field('season', '赛季名称'); }
    else if (draft.kind === 'status') { title = '赛季状态'; contents = field('status', '状态', '', ['未开始', '进行中', '已结束']); }
    else if (draft.kind === 'detained') {
      title = '一辉拘押事实';
      contents = '<p class="gba-note">只按本局实际剧情确认；日期不会自动触发拘押。已发生时，第 17—19 场采用个人延赛；未发生或标记有误时按普通日期重算。</p>' +
        field('detained', '本局拘押剧情', '', [['false', '未确认发生 / 清除错误标记'], ['true', '已实际发生']]);
    }
    else if (draft.kind === 'qualification') {
      title = '登记代表资格';
      var candidates = [['', '其他角色（新建）']].concat(tournamentQualificationCandidates(view).map(function(row) { return [row.id, row.姓名 + (row.player ? ' · 玩家' : '')]; }));
      contents = field('参赛者', '角色', '', candidates) + '<div class="rk-t-grid">' + field('姓名', '姓名') + field('学园', '代表学园') +
        field('资格状态', '资格状态', '', ['待确认', '已取得', '未取得', '已取消']) + '</div>' + field('依据', '剧情依据（可空）', 'textarea');
    }
    else if (draft.kind === 'participant') {
      title = draft.backfill ? '补录我的累计战绩' : draft.id ? '修改参赛者' : '登记参赛者';
      contents = '<div class="rk-t-grid">' + field('姓名', '姓名') + field('来源', '来源', '', ['原创', '正典', '玩家']) + field('参赛状态', '参赛状态', '', ['参赛', '退选', '取消资格']) + field('入赛轮次', '入赛轮次（可选，默认 1）', 'number') + '</div>' +
        '<p class="gba-note">仅实际中途加入时调整入赛轮次；登记日期较晚不代表从本轮才参赛。</p>' +
        '<details' + (draft.backfill ? ' open' : '') + '><summary>手动补录截至某轮的累计战绩</summary><p class="gba-note">跳过普通对局后，在这里填写已确认的累计胜场、败场和积分，包含该轮以前已有的比赛记录。明细会保留，不重复计分；后续比赛继续累加。积分未知可留空；全部清空并保存可移除错误补录。</p>' +
        '<div class="rk-t-grid">' + field('初始截至轮次', '截至轮次', 'number') + field('初始胜场', '累计胜场', 'number') + field('初始败场', '累计败场', 'number') + field('初始积分', '累计积分（未知留空）', 'number') + '</div>' + field('初始依据', '本局战绩依据', 'textarea') + '</details>';
    } else if (draft.kind === 'match') {
      title = '安排比赛 / 登记结果';
      var people = [['', '请选择']].concat(view.roster.map(function(row) { return [row.id, row.name + ' · ' + row.status]; }));
      var sides = [['', '尚未确定']].concat(view.roster.filter(function(row) { return row.id === fields.甲方 || row.id === fields.乙方; }).map(function(row) { return [row.id, row.name]; }));
      contents = '<div class="rk-t-grid">' + field('轮次', '轮次', 'number') + field('状态', '比赛状态', '', ['待定', '已安排', '已完成', '已取消']) + field('甲方', '甲方', '', people) + field('乙方', '乙方', '', people) + '</div>' +
        '<div class="rk-t-actions">' + tournamentButton('suggest', '查看本轮可选对手') + '</div><div id="rk-t-suggestions" class="gba-note" role="status"></div>' +
        '<div class="rk-t-grid">' + field('日期', '日期', 'date') + field('时间', '时间') + field('地点', '地点') + field('胜者', '胜者', '', sides) + field('弃权方', '弃权方', '', [['', '无 / 未确认']].concat(sides.slice(1))) + '</div>' +
        '<details><summary>旧存档：手动补录赛前胜场</summary><p class="gba-note">填写本局已确认的赛前胜场；已有比赛会自动计入，不确定时留空。</p><div class="rk-t-grid">' + field('甲赛前胜场', '甲方赛前胜场', 'number') + field('乙赛前胜场', '乙方赛前胜场', 'number') + '</div></details>' + field('依据', '安排 / 赛果依据', 'textarea');
    }
    return '<form class="card1 rk-t-form" data-rk-t-form><div class="ct">' + title + '</div><fieldset' + (tournamentWriting ? ' disabled' : '') + '>' + contents +
      '<div class="rk-t-actions"><button type="submit"' + (dataStatus !== 'ready' || tournamentWriting ? ' disabled' : '') + '>' + (tournamentWriting ? '正在保存…' : '保存本局记录') + '</button>' + tournamentButton('close-draft', '收起编辑') + '</div></fieldset></form>';
  }
  function suggestTournamentDraft() {
    var current = getSnapshot();
    if (!tournamentDraft || !current.service) return;
    var area = document.getElementById('rk-t-suggestions');
    try {
      var result = current.service.opponents(current.state, { participantId: tournamentDraft.fields.甲方, round: Number(tournamentDraft.fields.轮次) });
      if (area) area.textContent = result.candidates.map(function(row) { return row.name + '：' + row.reason; }).concat(result.warnings || []).join('；') || '暂无可安排的已登记对手，请先登记其他参赛者。';
    } catch (error) { if (area) area.textContent = error.message || '读取对手失败。'; }
  }
  function saveTournamentDraft() {
    var current = getSnapshot(), stat = current.state, stateSource = current.source;
    if (!tournamentDraft || tournamentWriting) return;
    var draft = tournamentDraft, fields = draft.fields, request;
    var number = function(key) { var value = String(fields[key] == null ? '' : fields[key]).trim(); return value === '' ? '' : Number(value); };
    try {
      if (draft.source !== sourceKey(stateSource) || draft.ledger !== current.service.snapshotKey(stat)) throw new Error('本局赛事记录、剧情日期或玩家身份已变化，请重新打开编辑后保存。');
      if (draft.kind === 'national-schedule') request = { action: 'setNationalSchedule', 开始日期: fields.开始日期, 结束日期: fields.结束日期, 状态: fields.状态 };
      else if (draft.kind === 'national-match') {
        var nationalMatch = {};
        ['轮次', '分区', '日期', '时间', '地点', '状态', '胜者', '晋级至', '依据'].forEach(function(key) { nationalMatch[key] = String(fields[key] || '').trim(); });
        nationalMatch.参赛者 = fields.全国参赛者 || [];
        request = { action: 'upsertNationalMatch', id: draft.id, match: nationalMatch };
      }
      else if (draft.kind === 'national-advancement') {
        var advancement = {};
        ['选手', '阶段', '日期', '状态', '依据'].forEach(function(key) { advancement[key] = String(fields[key] || '').trim(); });
        request = { action: 'upsertNationalAdvancement', id: draft.id, advancement: advancement };
      }
      else if (draft.kind === 'initialize') request = { action: 'initialize', season: fields.season };
      else if (draft.kind === 'status') request = { action: 'setStatus', status: fields.status };
      else if (draft.kind === 'detained') request = { action: 'setDetained', detained: fields.detained === 'true' };
      else if (draft.kind === 'qualification') {
        var qualification = {};
        ['姓名', '学园', '资格状态', '依据'].forEach(function(key) { qualification[key] = String(fields[key] || '').trim(); });
        var qualificationId = draft.id;
        if (!qualificationId) {
          var usedIds = tournamentQualificationCandidates(tournamentView()).map(function(row) { return row.id; }), index = 1;
          while (usedIds.indexOf('national_' + String(index).padStart(3, '0')) >= 0) index++;
          qualificationId = 'national_' + String(index).padStart(3, '0');
        }
        request = { action: 'upsertQualification', id: qualificationId, qualification: qualification };
      }
      else if (draft.kind === 'participant') {
        if (!String(fields.姓名 || '').trim()) throw new Error('请填写参赛者姓名。');
        var person = { 姓名: fields.姓名.trim(), 来源: fields.来源, 参赛状态: fields.参赛状态 };
        if (number('入赛轮次') !== '') person.入赛轮次 = number('入赛轮次');
        var baseKeys = ['截至轮次', '胜场', '败场', '积分'];
        var baseEvidence = String(fields.初始依据 || '').trim();
        if (baseKeys.some(function(key) { return number('初始' + key) !== ''; }) || baseEvidence) {
          person.初始战绩 = { 截至轮次: number('初始截至轮次'), 胜场: number('初始胜场'), 败场: number('初始败场'), 依据: baseEvidence };
          if (number('初始积分') !== '') person.初始战绩.积分 = number('初始积分');
        } else {
          // 空表单是主动清除；省略字段会被同 ID 合并保留，无法纠正旧起点。
          person.初始战绩 = null;
        }
        var id = draft.id || current.service.participant(stat, { name: person.姓名, source: person.来源 }).id;
        request = { action: 'upsertParticipant', id: id, participant: person };
      } else {
        var match = {};
        ['甲方', '乙方', '日期', '时间', '地点', '状态', '胜者', '弃权方', '依据'].forEach(function(key) { match[key] = fields[key] || ''; });
        ['轮次', '甲赛前胜场', '乙赛前胜场'].forEach(function(key) { match[key] = number(key); });
        request = { action: 'upsertMatch', id: draft.id, match: match };
      }
      submitTournament(request, draft);
    } catch (error) { tournamentMessage = error.message; renderSchedule(); }
  }
  function submitTournament(request, draft) {
    var current = getSnapshot(), stateSource = current.source, service = current.service;
    if (tournamentWriting || current.status !== 'ready' || !stateSource || !service) { tournamentMessage = '请等当前回复的 MVU 保存完成后再登记。'; renderSchedule(); return; }
    var expectedSource = JSON.parse(JSON.stringify(stateSource)), expectedState = service.snapshotKey(current.state);
    tournamentWriting = true;
    tournamentMessage = '正在保存本局记录…';
    renderSchedule();
    Promise.resolve().then(function() {
      return service.action(request, expectedSource, expectedState);
    }).then(function(result) {
      if (result && result.ok === false) throw new Error(result.error || result.message || '赛事记录未保存');
      if (getSnapshot().service !== service || sourceKey(getSnapshot().source) !== sourceKey(expectedSource)) return;
      if (!draft || tournamentDraft === draft) tournamentDraft = null;
      tournamentMessage = request.action === 'upsertQualification' ? '代表资格已保存。' : request.action.indexOf('National') >= 0 ? '全国赛记录已保存。' : '本局记录已保存，赛程、积分和学园圈已同步。';
      return refreshState({ type: 'tournament-saved', retainDisplay: true });
    }).catch(function(error) {
      if (getSnapshot().service === service) tournamentMessage = error.message || '记录未保存，请稍后重试。';
    }).finally(function() {
      tournamentWriting = false;
      if (getSnapshot().service === service) refreshView();
    });
  }

  // ===== 学园圈 (Moments) =====
  function renderMoments() {
    var body = document.getElementById('moments-body');
    if (!body) return;
    var view = tournamentView();
    var matches = view.matches.filter(function(match) { return !match.程序推演; }).reverse();
    body.innerHTML = '<div class="card1 rk-t-panel"><div class="ct">本局选拔赛公告</div><p class="gba-note">实际安排与赛果优先展示；场外背景由程序按剧情日期推演。</p>' + tournamentCalendar(view) +
      tournamentButton('open-schedule', '查看赛程与积分') + tournamentWarnings(view) + '</div>' +
      (matches.length ? matches.map(function(match) { return '<div class="card1 rk-t-panel">' + tournamentMatchCard(match, false) + '</div>'; }).join('') : '<div class="card1">尚无已登记的实际比赛公告。</div>') + tournamentBackgroundMatches(view.matches);
    bindTournamentActions(body);
  }

  // ===== 破军 BBS 选拔战板 =====
  function renderBbs() {
    var body = document.getElementById('bbs-body');
    if (!body) return;
    var view = tournamentView();
    body.innerHTML = '<div class="card1 rk-t-panel"><div class="ct">选拔战 · 本局战绩</div>' + tournamentCalendar(view) + tournamentRanking(view) + tournamentWarnings(view) +
      '<div class="rk-t-actions">' + tournamentButton('open-schedule', '查看 / 登记赛程') + '</div></div>';
    bindTournamentActions(body);
  }

  // ===== 本局剧情记录与选拔赛 =====
  function tournamentPanelUnlocked() {
    var current = getSnapshot(), stat = current.state, dataStatus = current.status;
    var selection = stat && stat.场景 && stat.场景.选拔赛;
    var national = stat && stat.场景 && stat.场景.七星剑斗祭;
    return dataStatus === 'ready' && (!!selection && selection.状态 === '已结束' || !!national && (national.状态 === '进行中' || national.状态 === '已结束'));
  }
  function scheduleHtml() {
    var view = tournamentView(), dataStatus = getSnapshot().status;
    // ponytail: 学园归属由共享赛事视图判定，界面只控制编辑入口。
    var hasView = view.exists || view.virtual, editable = view.applicable !== false;
    var tournamentHtml = '<div class="card1 rk-t-panel"><div class="ct">' + esc(hasView && view.tournament ? view.tournament.赛季 : '本局选拔赛') + '</div>' +
      (hasView && view.tournament ? '<p>' + esc(view.tournament.状态 + ' · ' + view.tournament.总轮次 + ' 轮 · ' + view.tournament.代表名额 + ' 个代表名额') + '</p><p class="gba-note">胜场积分 = 10 + 10 × 对手赛前胜场；败局不扣历史积分。实际赛果优先，修正同一场后程序重算。</p>' : '<p>主、副 API 和手动登记共用本局实际比赛记录。</p>') +
      tournamentCalendar(view) +
      (view.virtual ? '<p class="gba-note">当前为按剧情日期生成的背景预览；尚未保存本局账本，玩家实际战绩待补。可直接登记比赛或参赛者，保存时自动建立账本。</p>' : '') +
      (editable ? '<div class="rk-t-actions">' + tournamentButton('new-match', '登记比赛') + tournamentButton('new-participant', '登记参赛者') +
      (view.playerId ? tournamentButton('backfill', '补录我的累计战绩', view.playerId) : '') +
      (view.exists ? tournamentButton('status', '赛季状态') + tournamentButton('detained', '一辉拘押事实') : tournamentButton('initialize', '建立本局选拔赛')) + '</div>' : '<p class="gba-note">破军选拔仅适用于所属已确认的破军学园角色；当前仅查看历史记录。</p>') +
      (dataStatus !== 'ready' ? '<p class="gba-note">正在等待当前回复的 MVU 保存；可以查看，保存操作稍后可用。</p>' : '') +
      (tournamentMessage ? '<p class="rk-t-message" role="status">' + esc(tournamentMessage) + '</p>' : '') + tournamentWarnings(view) + '</div>';
    var confirmedMatches = view.matches.filter(function(match) { return !match.程序推演; });
    if (hasView) tournamentHtml += '<div class="card1 rk-t-panel"><div class="ct">本局积分与参赛者</div>' + tournamentRanking(view) +
      (editable && view.roster.length ? '<details><summary>维护参赛者资料</summary><div class="rk-t-actions">' + view.roster.map(function(row) { return tournamentButton('edit-participant', row.name, row.id); }).join('') + '</div></details>' : '') + '</div>' +
      '<div class="card1 rk-t-panel"><div class="ct">本局实际比赛记录</div>' + (confirmedMatches.length ? confirmedMatches.map(function(match) { return tournamentMatchCard(match, editable); }).join('') : '<p>尚未登记实际比赛。</p>') + '</div>' + tournamentBackgroundMatches(view.matches);
    var arenaEntry = tournamentPanelUnlocked()
      ? '<button type="button" class="rk-arena-entry" data-rk-t-action="open-arena"><span>七星剑斗祭 · 赛事面板</span><small>本局选拔与角色 · 分区晋级图 · 对战大屏 →</small></button>'
      : '<div class="card1 rk-arena-locked"><p>七星剑斗祭将在选拔赛结束后开放。</p><button type="button" data-rk-t-action="open-arena">预览赛事面板 →</button></div>';
    return arenaEntry + tournamentQualifications(view) + renderTournamentDraft(view) + nationalRecords() + tournamentHtml;
  }
  function calendarEntries() {
    var selection = tournamentView().matches.filter(function(match) { return !match.程序推演; }).map(function(match) {
      return { id: match.id, name: '选拔赛第 ' + match.轮次 + ' 轮 · ' + match.甲方姓名 + ' 对 ' + match.乙方姓名,
        entry: { 类型: '比赛', 日期: match.日期, 时间: match.时间, 地点: match.地点, 状态: match.状态,
          参与者: [match.甲方姓名, match.乙方姓名], 说明: tournamentResult(match) + (match.依据 ? '；' + match.依据 : '') } };
    });
    return selection.concat(nationalView().matches.map(function(match) {
      return { id: 'national:' + match.id, name: '七星剑斗祭 · ' + match.轮次 + ' · ' + match.参赛者姓名.join(' / '),
        entry: { 类型: '比赛', 日期: match.日期, 时间: match.时间, 地点: match.地点, 状态: match.状态,
          参与者: match.参赛者姓名, 说明: '全国赛 · ' + (match.状态 === '已完成' ? match.胜者姓名 + ' 胜出' : match.状态) + (match.依据 ? '；' + match.依据 : '') } };
    }));
  }
  function reset() { tournamentDraft = null; tournamentMessage = ''; }
  function onSnapshot() {
    var current = getSnapshot();
    if (tournamentDraft && tournamentDraft.ledger !== current.service.snapshotKey(current.state)) {
      reset();
      tournamentMessage = '赛事记录、剧情日期或玩家身份已更新，请重新打开登记表单。';
    }
  }
  // 赛事子页只接收终端已经选定的 MVU 快照，不另读消息或保存变量。
  var tournamentPanelFrame = null;
  var tournamentPanelSource = null;

  function pushTournamentPanel() {
    var current = getSnapshot(), stat = current.state, stateSource = current.source, dataStatus = current.status;
    var frame = tournamentPanelFrame;
    if (!frame || !frame.contentWindow.RK_MATCH_PREVIEW) return;
    var child = frame.contentWindow;
    child.RK_TERMINAL_ACTIONS = { editSelection: function() { navigate('schedule'); } };
    var key = sourceKey(stateSource);
    var portrait = getPortrait();
    child.RK_MATCH_PREVIEW.setSnapshot({
      state: stat,
      source: stateSource,
      pending: dataStatus !== 'ready',
      view: tournamentView(), nationalView: nationalView()
    }, {
      avatarUrl: portrait && portrait.src,
      sourceLabel: sourceLabel(stateSource),
      reset: tournamentPanelSource !== key
    });
    tournamentPanelSource = key;
  }

  function renderTournamentPanel() {
    var body = document.getElementById('arena-body');
    if (!body) return;
    var unlocked = tournamentPanelUnlocked();
    var title = unlocked ? '七星剑斗祭 · 赛事面板' : '七星剑斗祭 · 预览';
    document.getElementById('arena-title').textContent = title;
    document.getElementById('arena-preview-notice').hidden = unlocked;
    if (!tournamentPanelFrame) {
      var frame = document.createElement('iframe');
      frame.id = 'rk-tournament-frame';
      frame.onload = function() { if (tournamentPanelFrame === frame) pushTournamentPanel(); };
      frame.srcdoc = panelHtml;
      tournamentPanelFrame = frame;
      body.replaceChildren(frame);
    } else pushTournamentPanel();
    tournamentPanelFrame.title = title;
  }

  function destroyTournamentPanel() {
    if (tournamentPanelFrame) {
      tournamentPanelFrame.onload = null;
      tournamentPanelFrame.remove();
    }
    tournamentPanelFrame = null;
    tournamentPanelSource = null;
  }

  return { scheduleHtml, bindSchedule: bindTournamentActions, calendarEntries, renderMoments, renderBbs,
    renderPanel: renderTournamentPanel, closePanel: destroyTournamentPanel, onSnapshot, reset,
    destroy: function() { reset(); destroyTournamentPanel(); } };
}
