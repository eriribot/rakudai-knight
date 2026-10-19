"use strict";

var bridge = null;
var stat = {};
var currentStack = ['scr-home'];
var blazerSubTab = 'overview';
var activeChat = null;
var dataStatus = 'loading';
var dataError = '';
var stateSource = null;
var stateTargetSource = null;
var stateMessage = '';
var hasDisplayedState = false;
var expandedPeople = new Set();
var hiddenPeopleOpen = false;
var rosterWriting = false;
var rosterDeleteDraft = null;

function sourceKey(source) {
  return source ? JSON.stringify([source.characterId ?? null, source.groupId ?? null, source.chatId, source.messageId, source.swipeId]) : '';
}

function sourceLabel(source) {
  var label = source ? '第 ' + source.messageId + ' 楼 · 回复 ' + (source.swipeId + 1) +
    (Number.isInteger(source.swipeCount) ? '/' + source.swipeCount : '') : '本局已保存档案';
  if (dataStatus === 'error') return '读取失败：' + dataError;
  if (dataStatus === 'pending') {
    var target = stateTargetSource ? '（第 ' + stateTargetSource.messageId + ' 楼 · 回复 ' + (stateTargetSource.swipeId + 1) + '）' : '';
    return label + ' · 暂显最近已保存状态；' + (stateMessage || '等待当前回复 MVU') + target;
  }
  return hasDisplayedState ? label + ' · 已保存 MVU' : '正在读取当前回复';
}

function rememberPersonExpansion(card) {
  var body = document.getElementById('blazer-body');
  if (!body || !body.contains(card) || card.getAttribute('data-source') !== sourceKey(stateSource)) return;
  var name = card.getAttribute('data-person');
  if (card.open) expandedPeople.add(name);
  else expandedPeople.delete(name);
}

function rememberHiddenPeopleExpansion(list) {
  var body = document.getElementById('blazer-body');
  if (!body || !body.contains(list) || list.getAttribute('data-source') !== sourceKey(stateSource)) return;
  hiddenPeopleOpen = list.open;
}

function isDeletedPerson(name) {
  var deleted = stat && stat.系统 && stat.系统.已删除人物;
  return Array.isArray(deleted) && deleted.indexOf(name) !== -1;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveKnightAvatar(name, roleOptions) {
  var portrait = bridge && bridge.playerPortrait;
  if (roleOptions && roleOptions.player && portrait && typeof portrait.resolve === 'function') {
    try { var playerAvatar = portrait.resolve('玩家'); if (playerAvatar) return playerAvatar; } catch (_) {}
  }
  var key = String(name || '').normalize('NFKC').replace(/[\s·・･‧•．.]/g, '');
  var catalog = typeof RK_KNIGHT_AVATARS === 'undefined' ? null : RK_KNIGHT_AVATARS;
  var id = catalog && Object.prototype.hasOwnProperty.call(catalog.byName, key) ? catalog.byName[key] : null;
  if (id && Object.prototype.hasOwnProperty.call(catalog.entries, id)) return catalog.entries[id];
  if (portrait && typeof portrait.resolve === 'function') {
    try { return portrait.resolve(name) || null; } catch (_) {}
  }
  return null;
}

function renderKnightAvatar(name, compact, roleOptions) {
  var avatar = resolveKnightAvatar(name, roleOptions);
  var initial = esc(Array.from(String(name || '?'))[0] || '?');
  if (roleOptions && roleOptions.square) {
    return '<span class="rk-player-avatar" data-rk-avatar data-rk-player-avatar="true" aria-hidden="true">' +
      '<span class="rk-avatar-initial">' + initial + '</span>' +
      (avatar && avatar.src ? '<img class="rk-avatar-image" data-rk-avatar-image src="' + esc(avatar.src) + '" alt="" decoding="async">' : '') + '</span>';
  }
  if (!avatar || !avatar.src) return '<div class="roster-ava" aria-hidden="true">' + initial + '</div>';
  var framed = avatar.hasShieldFrame || avatar.prepared;
  var shield = typeof RK_KNIGHT_AVATARS === 'undefined' ? null : RK_KNIGHT_AVATARS.shield;
  var aperture = shield && shield.aperture;
  var position = !framed && aperture ? 'left:' + aperture.x + '%;top:' + aperture.y + '%;width:' + aperture.width + '%;height:' + aperture.height + '%;' : '';
  if (!framed && avatar.portraitScale > 1) position += 'transform:scale(' + avatar.portraitScale + ');transform-origin:center top;';
  if (avatar.player) position += 'object-position:center top;';
  position = position ? ' style="' + position + '"' : '';
  var ratio = !framed && shield && shield.aspectRatio;
  var slotRatio = compact ? 56 / 74 : 60 / 80;
  var canvasStyle = ratio ? ' style="width:' + Math.min(100, ratio / slotRatio * 100) + '%;height:' + Math.min(100, slotRatio / ratio * 100) + '%;"' : '';
  var mask = !framed && shield && shield.mask;
  var maskStyle = mask ? ' style="mask-image:url(' + esc(mask) + ');-webkit-mask-image:url(' + esc(mask) + ');"' : '';
  return '<div class="roster-ava rk-knight-avatar' + (compact ? ' rk-knight-avatar--compact' : '') +
    (framed ? ' rk-knight-avatar--native' : ' rk-knight-avatar--plain') + '" data-rk-avatar' + (avatar.player ? ' data-rk-player-avatar="true"' : '') + ' aria-hidden="true">' +
    '<span class="rk-avatar-initial">' + initial + '</span>' +
    '<span class="rk-avatar-canvas"' + canvasStyle + '><span class="rk-avatar-portrait' + (mask ? ' rk-avatar-portrait--masked' : '') + '"' + maskStyle + '>' +
      '<img class="rk-avatar-image" data-rk-avatar-image src="' + esc(avatar.src) + '" alt="" decoding="async"' + position + '></span>' +
      (!avatar.hasShieldFrame && shield ? '<img class="rk-avatar-frame" src="' + esc(shield.src) + '" alt="" decoding="async">' : '') + '</span></div>';
}

function renderCompanionAvatar(name, compact) { return renderKnightAvatar(name, compact); }

// error 不冒泡；捕获监听同样覆盖名册刷新后新生成的头像，失败时保留首字。
document.addEventListener('load', function(event) {
  var image = event.target;
  var avatar = image && image.matches && image.matches('[data-rk-avatar-image]') && image.closest('[data-rk-avatar]');
  if (avatar) avatar.classList.add('rk-avatar-ready');
}, true);
document.addEventListener('error', function(event) {
  var image = event.target;
  var avatar = image && image.matches && image.matches('[data-rk-avatar-image], .rk-avatar-frame') && image.closest('[data-rk-avatar]');
  if (avatar) avatar.classList.add('rk-avatar-failed');
}, true);

function toast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('on'); }, 2200);
}

// 导航操作
async function toggleDorm(button) {
  if (!bridge || typeof bridge.dorm !== 'function' || dataStatus !== 'ready') return toast('当前未连接本局存档，请使用离线预览或在酒馆中打开终端。');
  try { button.disabled = true; await bridge.dorm(!document.body.classList.contains('rk-dorm'), stateSource); goHome(); await refreshTerminalState(); }
  catch (error) { toast(error && error.message || '宿舍状态未保存，请刷新后重试。'); refreshTerminalView(); }
}
function openApp(appId) {
  var scrMap = {
    'blazer': 'scr-blazer',
    'lime': 'scr-lime',
    'moments': 'scr-moments',
    'bbs': 'scr-bbs',
    'schedule': 'scr-schedule',
    'arena': 'scr-arena',
    'gallery': 'scr-gallery',
    'calendar': 'scr-calendar',
    'worldbook': 'scr-calendar',
    'settings': 'scr-settings'
  };
  var target = scrMap[appId];
  if (!target) return;

  if (appId === 'blazer') renderBlazer();
  else if (appId === 'lime') renderLime();
  else if (appId === 'moments') renderMoments();
  else if (appId === 'bbs') renderBbs();
  else if (appId === 'schedule') renderSchedule();
  else if (appId === 'arena') renderTournamentPanel();
  else if (appId === 'gallery') renderGallery();
  else if (appId === 'calendar' || appId === 'worldbook') loadCalendarLore(true);
  else if (appId === 'settings') renderSettings();

  var curEl = document.getElementById(currentStack[currentStack.length - 1]);
  var targetEl = document.getElementById(target);
  if (curEl && targetEl && curEl !== targetEl) {
    curEl.classList.remove('on');
    curEl.classList.add('under');
    targetEl.classList.remove('under');
    targetEl.classList.add('on');
    currentStack.push(target);
  }
}

function goBack() {
  if (currentStack[currentStack.length - 1] === 'scr-lime' && activeChat && typeof closeLimeChat === 'function') { closeLimeChat(); return; }
  if (currentStack.length <= 1) return;
  var curId = currentStack.pop();
  if (curId === 'scr-arena') destroyTournamentPanel();
  var curEl = document.getElementById(curId);
  var prevId = currentStack[currentStack.length - 1];
  var prevEl = document.getElementById(prevId);
  if (curEl) {
    curEl.classList.remove('on');
    curEl.classList.remove('under');
  }
  if (prevEl) {
    prevEl.classList.remove('under');
    prevEl.classList.add('on');
  }
  if (curId === 'scr-arena' && prevId === 'scr-schedule') renderSchedule();
}

function goHome() {
  destroyTournamentPanel();
  while (currentStack.length > 1) {
    var curId = currentStack.pop();
    var el = document.getElementById(curId);
    if (el) { el.classList.remove('on'); el.classList.remove('under'); }
  }
  var home = document.getElementById('scr-home');
  if (home) { home.classList.remove('under'); home.classList.add('on'); }
  activeChat = null;
}

// ===== 数据解析引擎 (落第骑士 MVU 数据规范) =====
function resolvePlayer() {
  var p = stat && stat.玩家 || {};
  var ability = p.伐刀能力 || {};
  var techniques = ability.招式 || {};
  return {
    name: p.姓名 || '未建档',
    affiliation: p.所属 || '所属未登记',
    rank: p.登记等级 || '—',
    device: p.固有灵装 || '灵装未登记',
    arts: Object.keys(techniques).join('、') || '尚无命名招式',
    bio: p.角色简介 || '完成开局建档后，这里显示本局角色档案。',
    mechanism: ability.能力本质 || '能力本质未登记',
    category: ability.能力系别 || '系别未登记',
    cost: ability.共通限制 || '共通限制未登记',
    style: p.战斗风格 || '战斗风格未登记',
    techniques: techniques,
    otherAbilities: p.其他能力 || {},
    sixAxes: p.六维 || {},
    // 觉醒只认存档中的布尔 true；缺字段按普通状态展示，不给旧存档补写。
    awakened: p.魔人觉醒 === true,
    growth: p.成长 || {}
  };
}

function resolveScene() {
  var s = stat && stat.场景 || {};
  return {
    time: s.时间 || '时间未确认',
    location: s.地点 || '地点未确认',
    volume: Number.isInteger(s.当前卷) && s.当前卷 >= 1 && s.当前卷 <= 19 ? '第' + s.当前卷 + '卷' : '卷数未确认',
    chapter: s.当前章 || '待选择',
    phase: s.阶段 || '未读取'
  };
}

// 刷新首页学生证
function updateHomeScreen() {
  var pl = resolvePlayer();
  var sc = resolveScene();

  var nameEl = document.getElementById('home-name');
  if (nameEl) nameEl.textContent = pl.name;

  var avaEl = document.getElementById('home-ava');
  if (avaEl) {
    var avatarHtml = renderKnightAvatar(pl.name, false, { player: true, square: true });
    if (avaEl.innerHTML !== avatarHtml) avaEl.innerHTML = avatarHtml;
  }

  var classEl = document.getElementById('home-class');
  if (classEl) classEl.textContent = pl.affiliation;

  var rankEl = document.getElementById('home-rank');
  if (rankEl) rankEl.textContent = pl.rank + '级';

  var devEl = document.getElementById('home-device');
  if (devEl) devEl.textContent = pl.device;

  var artEl = document.getElementById('home-art');
  if (artEl) artEl.textContent = pl.arts;

  var clkEl = document.getElementById('sys-clk');
  if (clkEl) clkEl.textContent = sc.time;

  // 六维标签药丸
  var axes = pl.sixAxes;
  var map = [
    { id: 'pill-atk', label: '攻', val: axes['攻击力'] || '—' },
    { id: 'pill-def', label: '防', val: axes['防御力'] || '—' },
    { id: 'pill-mp',  label: '魔', val: axes['魔力量'] || '—' },
    { id: 'pill-ctrl',label: '控', val: axes['魔力控制'] || '—' },
    { id: 'pill-phy', label: '体', val: axes['体能'] || '—' },
    { id: 'pill-lck', label: '运', val: axes['运气'] || '—' }
  ];
  map.forEach(function(item) {
    var el = document.getElementById(item.id);
    if (el) {
      el.className = 'axis-pill rank-' + item.val;
      el.innerHTML = item.label + '<b>' + esc(item.val) + '</b>';
    }
  });
}

// ===== 伐刀者档案 (Blazer ID) =====
function switchBlazerTab(tab) {
  blazerSubTab = tab;
  document.querySelectorAll('.subtab').forEach(function(el) {
    el.classList.toggle('on', el.getAttribute('data-btab') === tab);
  });
  renderBlazer();
}

function rankToValue(r) {
  var rank = String(r == null ? '' : r).normalize('NFKC').trim().toUpperCase();
  if (!/^(S|[A-F]\+?)$/.test(rank)) return null;
  // 本卡扩展 A+、S；S 为外圈，所有 + 档位于相邻两整档之间。
  var m = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };
  return m[rank.charAt(0)] + (rank.endsWith('+') ? 0.5 : 0);
}

function renderAwakeningStatus(pl) {
  return '<div class="gba-awakening" data-awakened="' + pl.awakened + '">' +
    '<span>魔人状态</span><strong>' + (pl.awakened ? '已觉醒' : '普通') + '</strong></div>';
}

function renderRelationshipMetrics(relation) {
  var rules = bridge && bridge.relationshipRules;
  if (!rules || typeof bridge.supportStage !== 'function') return '<p class="gba-unknown">计分规则尚未连接。</p>';
  function metric(label, value, config, kind, unknown) {
    var known = typeof value === 'number' && Number.isFinite(value) && value >= config.min && value <= config.max &&
      (kind !== 'support' || Number.isInteger(value));
    return '<div class="gba-metric"><span>' + label + '</span>' +
      (known ? '<strong>' + value + ' / ' + config.max + '</strong>' : '<span class="gba-unknown">' + unknown + '</span>') + '</div>' +
      (known ? '<div class="gba-meter" data-kind="' + kind + '" role="meter" aria-label="' + label + '" aria-valuemin="' + config.min +
        '" aria-valuemax="' + config.max + '" aria-valuenow="' + value + '"><span style="width:' +
        ((value - config.min) / (config.max - config.min) * 100).toFixed(2) + '%"></span></div>' : '');
  }
  var stage = bridge.supportStage(relation.支援度);
  var knownSupport = stage !== '未定';
  var next = knownSupport && rules.support.stages.find(function(item) { return relation.支援度 < item.min; });
  var stageText = knownSupport ? stage : '待核定' + (relation.羁绊阶段 && relation.羁绊阶段 !== '未定' ? '（原记录：' + esc(relation.羁绊阶段) + '）' : '');
  var contactNote = '';
  if (typeof relation.好感 !== 'number') {
    contactNote = bridge.mvuRuntimeMode === 'native' ? '尚未计分。原生 MVU 保留已提交的分数，请按本局实际互动记录好感；未记录时保持待核定。' :
      bridge.contactBaselineVersion !== 'C02' ? '请更新并启用按互动累计的 MVU v4 字段约束脚本，取消普通初始50。' :
      '尚未计分。普通首次从0累计本轮实际变化；特殊关系可按既定背景核定初始好感。无需先交换联系方式。';
  }
  return '<section class="gba-bond-panel" aria-label="好感与支援状态">' +
    metric('好感', relation.好感, rules.affection, 'affection', '待核定') +
    (contactNote ? '<p class="gba-note">' + esc(contactNote) + '</p>' : '') +
    metric('支援度', relation.支援度, rules.support, 'support', '待核定起点') +
    '<div class="gba-metric"><span>支援阶段</span><strong>' + stageText + '</strong></div>' +
    (knownSupport ? '<ol class="gba-support-track" aria-label="支援阶段门槛">' + rules.support.stages.map(function(item) {
      return '<li data-achieved="' + (relation.支援度 >= item.min) + '">' + esc(item.stage) + '<small>' + item.min + '</small></li>';
    }).join('') + '</ol><p class="gba-note">' + (next ? '距 ' + esc(next.stage) + ' 还需 ' + (next.min - relation.支援度) + ' 点支援。' : '已达到最高支援。') +
      'S 不自动表示恋爱。</p>' : '<p class="gba-note">旧字母不折算为分数；确认起点后再累计。</p>') +
    renderRomanceStatus(relation, rules) +
    (relation.变化依据 ? '<p class="gba-note">最近变化依据：' + esc(relation.变化依据) + '</p>' : '') +
    (relation.好感突破依据 ? '<p class="gba-note">最近一次好感突破依据：' + esc(relation.好感突破依据) + '</p>' : '') + '</section>';
}

function renderRomanceStatus(relation, rules) {
  if (relation.性别 === '男性') return '';
  if (relation.性别 !== '女性') return '<p class="gba-unknown">性别尚未记录，暂不显示恋爱阶段。</p>';
  if (!rules.romance || typeof bridge.romanceStage !== 'function') return '<p class="gba-unknown">恋爱阶段规则尚未连接。</p>';
  var stage = bridge.romanceStage(relation);
  if (!stage) return '<div class="gba-romance-panel"><div class="gba-metric"><span>恋爱阶段</span><span class="gba-unknown">好感未计分</span></div></div>';
  var next = rules.romance.stages.find(function(item) { return relation.好感 < item.min; });
  return '<section class="gba-romance-panel" aria-label="女性恋爱阶段">' +
    '<div class="gba-metric"><span>恋爱阶段</span><strong>' + esc(stage) + '</strong></div>' +
    '<ol class="gba-support-track gba-romance-track" aria-label="恋爱阶段好感门槛">' + rules.romance.stages.map(function(item) {
      return '<li data-achieved="' + (relation.好感 >= item.min) + '">' + esc(item.stage) + '<small>' + item.min + '</small></li>';
    }).join('') + '</ol><p class="gba-note">' + (next ? '距“' + esc(next.stage) + '”还需 ' + (next.min - relation.好感) + ' 点好感。' : '已达到最高恋爱阶段。') +
    '依好感显示；支援度单独累计。</p></section>';
}

function renderGrowthProgress(pl) {
  if (!hasDisplayedState) return '<div class="card1">读取本局 MVU 后显示成长记录。</div>';
  var growth = pl.growth || {};
  var rules = bridge && bridge.growthRules;
  var costs = rules && rules.costs || {};
  var experience = growth.经验 || {};
  // 觉醒仅开放魔力量的成长结算；显示开关不会赠送经验或抬高任何评级。
  var targets = pl.awakened ? ['魔力控制', '体能', '魔力量'] : ['魔力控制', '体能'];
  var progress = targets.map(function(target) {
    var grade = String(pl.sixAxes[target] || '').normalize('NFKC').trim().toUpperCase();
    var value = Number.isInteger(experience[target]) && experience[target] >= 0 ? experience[target] : 0;
    var cost = costs[grade];
    var known = rankToValue(grade) !== null;
    var next = known && grade !== 'S' && Number.isInteger(cost) && cost > 0;
    var note = !known ? '起点评级尚未记录，不猜测当前能力。' : grade === 'S' ? '已达到本卡成长上限 S，已有经验保留。' :
      !next ? '成长规则尚未连接。' : value >= cost ? '已达到本档门槛，以本回复最终结算为准。' : '距下一小档还需 ' + (cost - value) + ' 点经验。';
    return '<section class="gba-bond-panel"><div class="gba-metric"><span>' + target + ' · ' + esc(grade || '待确认') +
      '</span><strong>' + value + (next ? ' / ' + cost : '') + '</strong></div>' +
      (next ? '<div class="gba-meter" role="meter" aria-label="' + target + '经验" aria-valuemin="0" aria-valuemax="' + cost +
        '" aria-valuenow="' + Math.min(value, cost) + '"><span style="width:' + Math.min(value / cost * 100, 100).toFixed(2) +
        '%"></span></div>' : '') + '<p class="gba-note">' + note + '</p></section>';
  }).join('');
  var receipts = Object.keys(growth.记录 || {}).slice(-3).reverse().map(function(id) { return growth.记录[id] || {}; });
  var history = receipts.map(function(receipt) {
    var title = (receipt.日期 ? esc(receipt.日期) + ' · ' : '') + esc(receipt.目标 || '成长') + ' +' + esc(receipt.获得);
    var context = [receipt.类型, receipt.方式].filter(Boolean).map(esc).join(' · ');
    var evidence = receipt.成果 || receipt.说明 || '';
    return '<div class="noble-art-block"><div class="noble-art-title">' + title + '</div>' +
      '<p class="gba-note">来源：' + esc(receipt.来源事件 || '旧记录未注明') + (context ? ' · ' + context : '') + '</p>' +
      (evidence ? '<p class="gba-note">依据：' + esc(evidence) + '</p>' : '') +
      (receipt.成果 && receipt.说明 && receipt.说明 !== receipt.成果 ? '<p class="gba-note">结算：' + esc(receipt.说明) + '</p>' : '') + '</div>';
  }).join('');
  return '<div class="card1" id="growth-progress"><div class="ct">成长记录</div>' + renderAwakeningStatus(pl) +
    '<p class="gba-note">' + (pl.awakened ? '已开放魔力量成长；觉醒本身不提升评级。' :
      '魔力控制与体能可成长；魔力量维持当前评级，觉醒后开放成长。') + '</p>' + progress +
    '<p class="gba-note">主 API 按实际成长写入经验与评级终值；经验是当前档位内的进度，晋级后保留余量。可选字段约束校验类型与门槛。登记等级只随实际登记改变。</p>' +
    (growth.最近提示 ? '<p role="status" class="gba-note">最近结算：' + esc(growth.最近提示) + '</p>' : '') +
    (history ? '<details open><summary>历史成长记录（最多 3 条）</summary>' + history + '</details>' : '') + '</div>';
}

function renderBlazer() {
  var body = document.getElementById('blazer-body');
  if (!body) return;
  body.classList.add('gba-status');
  var pl = resolvePlayer();
  var sc = resolveScene();

  var headRank = document.getElementById('blazer-head-rank');
  if (headRank) headRank.textContent = pl.rank + '级 伐刀者 // ' + pl.affiliation;
  var headSource = document.getElementById('blazer-head-source');
  if (headSource) headSource.textContent = sourceLabel(stateSource);

  if (blazerSubTab === 'overview') {
    body.innerHTML = 
      '<div class="card1">' +
        '<div class="ct">本局角色档案</div>' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">' +
          '<div class="card-avatar" style="width:54px;height:54px;font-size:22px;">' + renderKnightAvatar(pl.name, false, { player: true, square: true }) + '</div>' +
          '<div>' +
            '<div style="font-size:17px;font-weight:800;color:var(--ink);">' + esc(pl.name) + ' <span class="card-rank-badge">' + esc(pl.rank) + '级</span></div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:2px;">所属：' + esc(pl.affiliation) + '</div>' +
            '<div style="font-size:12px;color:var(--sky);margin-top:2px;">灵装：' + esc(pl.device) + '</div>' +
          '</div>' +
        '</div>' +
        renderAwakeningStatus(pl) +
        '<div style="font-size:12.5px;color:var(--ink2);line-height:1.6;background:var(--card2);padding:10px 12px;border-radius:10px;">' +
          esc(pl.bio) +
        '</div>' +
      '</div>' +

      '<div class="card1">' +
        '<div class="ct">当前场景</div>' +
        '<div style="font-size:12.5px;color:var(--ink2);line-height:1.6;">' +
          '<div><i class="ti ti-map-pin" style="color:#ef4444;margin-right:4px;"></i> 地点：<b>' + esc(sc.location) + '</b></div>' +
          '<div style="margin-top:4px;"><i class="ti ti-clock" style="color:#38bdf8;margin-right:4px;"></i> 时间：' + esc(sc.time) + '</div>' +
          '<div style="margin-top:4px;"><i class="ti ti-trophy" style="color:#f59e0b;margin-right:4px;"></i> 进度：' + esc(sc.volume + ' · ' + sc.chapter + ' · ' + sc.phase) + '</div>' +
        '</div>' +
      '</div>';
  } else if (blazerSubTab === 'radar') {
    var axesOrder = ['攻击力', '防御力', '魔力量', '魔力控制', '体能', '运气'];
    var cx = 130, cy = 115, maxRadius = 75;
    var points = [];
    var webCircles = [1/7, 2/7, 3/7, 4/7, 5/7, 6/7, 1];

    var webSvg = '';
    webCircles.forEach(function(lvl) {
      var r = maxRadius * lvl;
      var pts = [];
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i - Math.PI / 2;
        pts.push((cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1));
      }
      webSvg += '<polygon class="radar-web" points="' + pts.join(' ') + '"/>';
    });

    var labelsSvg = '';
    var pointNodes = '';
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 3) * i - Math.PI / 2;
      var spokeX = (cx + maxRadius * Math.cos(angle)).toFixed(1);
      var spokeY = (cy + maxRadius * Math.sin(angle)).toFixed(1);
      webSvg += '<line class="radar-web-spoke" x1="' + cx + '" y1="' + cy + '" x2="' + spokeX + '" y2="' + spokeY + '"/>';

      var axisName = axesOrder[i];
      var rk = pl.sixAxes[axisName] || '—';
      var val = rankToValue(rk);
      if (val !== null) {
        // 最大半径按 S=7 归一化，A+ 与 S 均不会越过雷达外圈。
        var ptR = (Math.min(val, 7) / 7) * maxRadius;
        var ptX = cx + ptR * Math.cos(angle);
        var ptY = cy + ptR * Math.sin(angle);
        points.push(ptX.toFixed(1) + ',' + ptY.toFixed(1));
        pointNodes += '<circle class="radar-point" cx="' + ptX.toFixed(1) + '" cy="' + ptY.toFixed(1) + '" r="3.5"/>';
      }

      var labelR = maxRadius + 22;
      var lx = cx + labelR * Math.cos(angle);
      var ly = cy + labelR * Math.sin(angle);
      labelsSvg += '<text class="radar-label" x="' + lx.toFixed(1) + '" y="' + (ly - 6).toFixed(1) + '">' + axisName + '</text>';
      labelsSvg += '<text class="radar-rank-badge" x="' + lx.toFixed(1) + '" y="' + (ly + 7).toFixed(1) + '">' + (val === null ? '待确认' : esc(rk)) + '</text>';
    }

    var polygonSvg = points.length === 6 ? '<polygon class="radar-polygon" points="' + points.join(' ') + '"/>' : '';

    body.innerHTML = 
      '<div class="card1">' +
        '<div class="ct">六维能力雷达 · F 至 S</div>' +
        '<div class="radar-container">' +
          '<svg class="radar-svg" viewBox="0 0 260 230" role="img" aria-label="本卡六维等级雷达：F 至 S，A+ 介于 A 与 S；未知项不绘制数值。">' +
            webSvg +
            polygonSvg +
            pointNodes +
            labelsSvg +
          '</svg>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:4px;">' +
          '本卡扩展量表：F=1 至 A=6、A+=6.5、S=7；+ 档位于相邻整档之间。不是原著官方量表，也不代表能力倍率。' +
          (points.length < 6 ? '未确认项不绘点，资料齐全后再连成面。' : '') +
        '</div>' +
      '</div>' + renderGrowthProgress(pl);
  } else if (blazerSubTab === 'device') {
    function listSkills(records) {
      var names = Object.keys(records);
      if (!names.length) return '<div class="noble-art-desc">尚未登记具体能力。</div>';
      return names.map(function(name) {
        var skill = records[name] || {};
        return '<div class="noble-art-block"><div class="noble-art-title">' + esc(name) + ' · ' + esc(skill.掌握状态 || '待确认') + '</div>' +
          '<div class="noble-art-desc">' + esc(skill.说明 || '说明未登记') + '</div>' +
          '<div class="noble-art-desc">条件与代价：' + esc(skill.条件与代价 || '未登记') + '</div></div>';
      }).join('');
    }
    body.innerHTML = '<div class="card1"><div class="ct">固有灵装</div><div class="noble-art-title">' + esc(pl.device) + '</div>' +
      '<div class="ct" style="margin-top:14px;">伐刀能力 · ' + esc(pl.category) + '</div><p>' + esc(pl.mechanism) + '</p>' +
      '<p>共通限制：' + esc(pl.cost) + '</p>' + listSkills(pl.techniques) +
      '<div class="ct" style="margin-top:14px;">其他能力</div>' + listSkills(pl.otherAbilities) + '</div>';
  } else if (blazerSubTab === 'roster') {
    var rosterSource = dataStatus === 'pending' ? stateTargetSource || stateSource : stateSource;
    var rosterSourceLabel = rosterSource ? '第 ' + rosterSource.messageId + ' 楼 · 回复 ' + (rosterSource.swipeId + 1) : '当前助手回复页';
    var sourceNote = '<p class="gba-note">' + esc(rosterSourceLabel) + '</p>';
    if (!hasDisplayedState) {
      var unreadMessage = dataStatus === 'error' ? '名册未能读取：' + dataError : dataStatus === 'pending' ?
        '当前回复的 MVU 尚未就绪，等待变量更新后读取名册。' : '正在读取当前回复的名册…';
      body.innerHTML = '<div class="card1" role="status">' + esc(unreadMessage) + sourceNote + '</div>';
      return;
    }
    var rawRelations = stat && stat.人际;
    var invalidContainer = rawRelations !== undefined && (!rawRelations || typeof rawRelations !== 'object' || Array.isArray(rawRelations));
    var relations = invalidContainer ? {} : rawRelations || {};
    var deleted = stat && stat.系统 && stat.系统.已删除人物;
    var deletedCount = Array.isArray(deleted) ? new Set(deleted.filter(function(name) { return typeof name === 'string' && name.trim(); })).size : 0;
    var selfCount = 0;
    var invalidNames = [];
    var allNames = Object.keys(relations).filter(function(name) {
      if (isDeletedPerson(name)) return false;
      // 一辉模式中的自己不作为独立 NPC 显示；不修改原始存档。
      if (stat.系统 && stat.系统.主角模式 === '黑铁一辉' && name === '黑铁一辉') { selfCount++; return false; }
      var relation = relations[name];
      if (!relation || typeof relation !== 'object' || Array.isArray(relation)) { invalidNames.push(name); return false; }
      // 登记和计分、通联各自独立；未计好感或未加联系方式也显示。
      return true;
    });
    var names = allNames.filter(function(name) { return relations[name].名册隐藏 !== true; });
    var hiddenNames = allNames.filter(function(name) { return relations[name].名册隐藏 === true; });
    var locked = rosterWriting || dataStatus !== 'ready' || !stateSource || !bridge || typeof bridge.setRosterHidden !== 'function';
    var deleteLocked = rosterWriting || dataStatus !== 'ready' || !stateSource || !bridge || typeof bridge.deleteRosterPerson !== 'function';
    if (rosterDeleteDraft && (rosterDeleteDraft.source !== sourceKey(stateSource) || rosterDeleteDraft.state !== JSON.stringify(stat))) rosterDeleteDraft = null;
    function rosterCard(name, hidden) {
      var relation = relations[name] || {};
      var known = relation.已知资料 || {};
      var grade = typeof known.登记等级 === 'string' ? known.登记等级.trim() : '';
      var details = [['身份', '身份'], ['灵装', '灵装'], ['已知能力', '已知能力']].map(function(field) {
        var value = known[field[0]];
        return typeof value === 'string' && value.trim() ? '<div class="roster-device">' + field[1] + '：' + esc(value) + '</div>' : '';
      }).join('');
      var deleting = rosterDeleteDraft && rosterDeleteDraft.name === name;
      var deleteControls = deleting ? '<div class="card1" role="group" aria-label="永久移除确认">' +
        '<p>永久移除【' + esc(name) + '】？</p><p class="gba-note">第 ' + stateSource.messageId + ' 楼 · 回复 ' + (stateSource.swipeId + 1) +
        '：删除此人的人际资料，并在本分支后续回复中保持移除；不会放入恢复列表。旧楼层不变，回退后以该楼层记录为准。</p>' +
        '<button type="button" class="gba-btn-sm"' + (deleteLocked ? ' disabled' : '') + ' onclick="confirmRosterDeletion(this)">确认永久移除</button> ' +
        '<button type="button" class="gba-btn-sm"' + (rosterWriting ? ' disabled' : '') + ' onclick="cancelRosterDeletion()">取消</button></div>' :
        '<button type="button" class="gba-btn-sm"' + (deleteLocked ? ' disabled' : '') + ' onclick="prepareRosterDeletion(this)">永久移除</button>';
      return '<details class="roster-card gba-contact" data-person="' + esc(name) + '" data-source="' + esc(sourceKey(stateSource)) + '"' +
        (expandedPeople.has(name) ? ' open' : '') + ' ontoggle="rememberPersonExpansion(this)"><summary class="gba-contact-summary">' +
        renderCompanionAvatar(name) + '<div class="roster-info">' +
        '<div class="roster-name">' + esc(name) + (grade ? ' <span class="card-rank-badge">' + esc(grade) + '</span>' : '') + '</div>' +
        '<div class="roster-device">与你的关系：' + esc(relation.关系 || '尚未确认') + '</div></div>' +
        '<span class="gba-disclosure" aria-hidden="true">资料</span></summary><div class="gba-contact-body">' +
        (relation.态度印象 ? '<div class="roster-device">印象：' + esc(relation.态度印象) + '</div>' : '') +
        (relation.联系状态 ? '<div class="roster-device">联系状态：' + esc(relation.联系状态) + '</div>' : '') +
        (relation.联系依据 ? '<div class="roster-device">联系依据：' + esc(relation.联系依据) + '</div>' : '') +
        details + (details ? '' : '<p class="gba-unknown">尚未获知更多身份或能力资料。</p>') + renderRelationshipMetrics(relation) +
        '<button type="button" class="gba-btn-sm"' + (locked ? ' disabled' : '') + ' onclick="changeRosterVisibility(this, ' + (!hidden) + ')">' +
        (hidden ? '恢复到名册' : '移出名册') + '</button><p class="gba-unknown">移出只整理显示，人物资料与已有关系继续保留。</p>' + deleteControls + '</div></details>';
    }
    var emptyMessage = dataStatus === 'pending' ? '当前回复的 MVU 尚未就绪，等待变量更新；暂显的已保存名册中没有展开的人物。' :
      hiddenNames.length ? '当前名册已收起全部人物，可在下方恢复。' :
      invalidContainer || invalidNames.length ? '当前没有可显示的人物资料，请查看下方记录说明。' :
      deletedCount ? '当前分支已永久移除 ' + deletedCount + ' 名人物，暂无其他可显示人物。' :
      selfCount ? '当前楼层仅记录玩家本人，不列入同行名册。' :
      '当前楼层 MVU 的“人际”尚未登记人物。首次见面且身份已确认的人物，即使好感没有变化也应登记。';
    var invalidNote = invalidContainer ? '<p class="gba-unknown" role="status">当前楼层的“人际”格式异常，应为人物对象表；页面未改动原始记录。</p>' :
      invalidNames.length ? '<p class="gba-unknown" role="status">' + invalidNames.length + ' 条人物资料不是对象，暂未显示：' +
        invalidNames.slice(0, 5).map(esc).join('、') + (invalidNames.length > 5 ? '等' : '') + '。其余人物正常显示，原始记录未改动。</p>' : '';
    body.innerHTML = (names.length ? '<div class="roster-list">' + names.map(function(name) { return rosterCard(name, false); }).join('') + '</div>' :
      '<div class="card1" role="status">' + esc(emptyMessage) + sourceNote + '</div>') +
      (hiddenNames.length ? '<details class="card1" data-source="' + esc(sourceKey(stateSource)) + '"' + (hiddenPeopleOpen ? ' open' : '') + ' ontoggle="rememberHiddenPeopleExpansion(this)"><summary>已移出的人物（' + hiddenNames.length + '）</summary>' +
        '<div class="roster-list">' + hiddenNames.map(function(name) { return rosterCard(name, true); }).join('') + '</div></details>' : '') +
      invalidNote +
      (dataStatus !== 'ready' ? '<p class="gba-unknown">等待当前回复的变量更新完成后，可整理或永久移除人物。</p>' : '');
  }
}

function changeRosterVisibility(button, hidden) {
  var card = button.closest('[data-person]');
  if (!card || rosterWriting || dataStatus !== 'ready' || !stateSource || !bridge || typeof bridge.setRosterHidden !== 'function') return;
  if (card.getAttribute('data-source') !== sourceKey(stateSource)) { toast('名册来源已变化，请刷新。'); return; }
  var name = card.getAttribute('data-person');
  var currentBridge = bridge;
  var expectedSource = JSON.parse(JSON.stringify(stateSource));
  var expectedState = JSON.stringify(stat);
  rosterDeleteDraft = null;
  rosterWriting = true;
  renderBlazer();
  Promise.resolve().then(function() {
    return currentBridge.setRosterHidden(name, hidden, expectedSource, expectedState);
  }).then(function() {
    if (bridge !== currentBridge) return;
    if (sourceKey(stateSource) === sourceKey(expectedSource)) {
      expandedPeople.delete(name);
      toast(hidden ? '已移出名册，可在“已移出的人物”中恢复。' : '已恢复到名册。');
    }
    return refreshTerminalState({ type: 'roster-saved', retainDisplay: true });
  }).catch(function(error) {
    if (bridge === currentBridge) toast(error && error.message || '名册未保存，请刷新后重试。');
  }).finally(function() {
    rosterWriting = false;
    if (bridge === currentBridge) refreshTerminalView();
  });
}

function prepareRosterDeletion(button) {
  var card = button.closest('[data-person]');
  if (!card || rosterWriting || dataStatus !== 'ready' || !stateSource || !bridge || typeof bridge.deleteRosterPerson !== 'function') return;
  if (card.getAttribute('data-source') !== sourceKey(stateSource)) { toast('名册来源已变化，请刷新。'); return; }
  var name = card.getAttribute('data-person');
  if (!stat.人际 || !Object.prototype.hasOwnProperty.call(stat.人际, name) || isDeletedPerson(name)) return;
  expandedPeople.add(name);
  rosterDeleteDraft = { name: name, source: sourceKey(stateSource), state: JSON.stringify(stat) };
  renderBlazer();
}

function cancelRosterDeletion() {
  if (rosterWriting) return;
  rosterDeleteDraft = null;
  renderBlazer();
}

function confirmRosterDeletion(button) {
  var card = button.closest('[data-person]');
  var draft = rosterDeleteDraft;
  if (!card || !draft || rosterWriting || dataStatus !== 'ready' || !stateSource || !bridge || typeof bridge.deleteRosterPerson !== 'function') return;
  if (draft.name !== card.getAttribute('data-person') || draft.source !== card.getAttribute('data-source') ||
      draft.source !== sourceKey(stateSource) || draft.state !== JSON.stringify(stat)) {
    rosterDeleteDraft = null;
    toast('当前楼层或人物资料已变化，请重新确认。');
    renderBlazer();
    return;
  }
  var currentBridge = bridge;
  var expectedSource = JSON.parse(JSON.stringify(stateSource));
  rosterWriting = true;
  renderBlazer();
  Promise.resolve().then(function() {
    return currentBridge.deleteRosterPerson(draft.name, expectedSource, draft.state);
  }).then(function() {
    if (bridge !== currentBridge) return;
    if (sourceKey(stateSource) === draft.source) {
      expandedPeople.delete(draft.name);
      if (activeChat === draft.name) activeChat = null;
      toast('已从本分支永久移除【' + draft.name + '】。');
    }
    return refreshTerminalState({ type: 'roster-deleted', retainDisplay: true });
  }).catch(function(error) {
    if (bridge === currentBridge) toast(error && error.message || '人物未移除，请刷新后重试。');
  }).finally(function() {
    rosterWriting = false;
    if (rosterDeleteDraft === draft) rosterDeleteDraft = null;
    if (bridge === currentBridge) refreshTerminalView();
  });
}

// LIME UI is maintained in terminal-lime.js and bundled into this page.

// ===== 赛事入口；编辑状态由赛事模块持有 =====
var tournamentModule = null;
function tournamentUI() {
  if (!tournamentModule) tournamentModule = createTerminalTournament({
    getSnapshot: function() { return { state: stat, source: stateSource, status: dataStatus,
      hasDisplayedState: hasDisplayedState, service: bridge && bridge.tournament }; },
    refreshState: refreshTerminalState, refreshView: refreshTerminalView, renderSchedule: renderSchedule,
    navigate: function(app) {
      var target = 'scr-' + app, index = currentStack.lastIndexOf(target);
      if (index >= 0) {
        while (currentStack.length - 1 > index) goBack();
        if (app === 'schedule') renderSchedule();
      } else {
        if (currentStack[currentStack.length - 1] === 'scr-arena') goBack();
        openApp(app);
      }
    },
    esc: esc, sourceKey: sourceKey, sourceLabel: sourceLabel,
    getPortrait: function() { return resolveKnightAvatar(resolvePlayer().name, { player: true }); },
    panelHtml: typeof RK_TOURNAMENT_PANEL_HTML === 'string' ? RK_TOURNAMENT_PANEL_HTML : '', document: document
  });
  return tournamentModule;
}
function renderMoments() { tournamentUI().renderMoments(); }
function renderBbs() { tournamentUI().renderBbs(); }
function renderTournamentPanel() { tournamentUI().renderPanel(); }
function destroyTournamentPanel() { if (tournamentModule) tournamentModule.closePanel(); }
function postMomentPrompt() { openApp('schedule'); }
function refreshBbs() { refreshTerminalState({ type: 'tournament-refresh', retainDisplay: true }); }

// ===== 本局剧情记录与选拔赛 =====
function renderSchedule() {
  var body = document.getElementById('schedule-body');
  if (!body) return;
  var scene = resolveScene();
  var events = stat && stat.场景 && stat.场景.已发生事件 || {};
  var names = Object.keys(events), sceneDate = parseSceneDate();
  // 比赛在选拔赛区域完整展示；其他约定沿用原日程，日历会合并两类数据。
  var schedule = readSceneSchedule().filter(function(item) { return !item.tournament; });
  var dated = schedule.filter(function(item) { return !!item.date; }), undated = schedule.filter(function(item) { return !item.date; });
  body.innerHTML = tournamentUI().scheduleHtml() + '<details class="card1"><summary>当前剧情 · ' + esc(scene.volume + ' · ' + scene.chapter + ' · ' + scene.phase) + '</summary>' +
    '<p>' + esc(scene.time + ' · ' + scene.location) + '</p><button type="button" onclick="openStoryControls()">展开剧情控制</button></details>' +
    '<div class="card1"><div class="ct">其他日程与约定</div>' + (dated.length ? dated.map(function(item) { return renderScheduleItem(item, sceneDate); }).join('') : '尚无其他已确定日期的日程。') +
    '<p><button type="button" onclick="openApp(\'calendar\')">打开手机日历</button></p></div>' + renderUndatedSchedule(undated, sceneDate) +
    '<details class="card1"><summary>已发生事件 · ' + names.length + ' 条</summary>' + (names.length ? names.map(function(name) {
      var event = events[name] || {};
      return '<div class="noble-art-block"><div class="noble-art-title">' + esc(name) + '</div><div class="noble-art-desc">' + esc(event.结果 || '') + '</div></div>';
    }).join('') : '<p>尚无已记录事件。</p>') + '</details>';
  tournamentUI().bindSchedule(body);
}
function openStoryControls() {
  if (bridge && bridge.ui && typeof bridge.ui.openStoryControls === 'function') bridge.ui.openStoryControls();
}

// ===== 灵装画廊 (Gallery) =====
function renderGallery() {
  var body = document.getElementById('gallery-body');
  if (!body) return;

  body.innerHTML = 
    '<div class="card1">' +
      '<div class="ct">灵装图鉴 · 图片尚未接入</div>' +
      '<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;margin-top:8px;">' +
        '<div style="background:var(--card2);height:120px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);font-size:12px;">' +
          '<i class="ti ti-photo" style="font-size:28px;color:#ef4444;margin-bottom:4px;"></i>' +
          '<span>灵装显现 · 阴铁</span>' +
        '</div>' +
        '<div style="background:var(--card2);height:120px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);font-size:12px;">' +
          '<i class="ti ti-flame" style="font-size:28px;color:#f59e0b;margin-bottom:4px;"></i>' +
          '<span>一刀修罗 · 爆发</span>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ===== 学园校历 (Calendar) =====
var calendarState = {
  year: null,
  month: null,
  selectedDay: null,
  _initialized: false
};

var calendarLore = { status: 'idle', worldbook: '', entries: [], undatedCount: 0, error: '', revision: 0 };
var calendarStoryOrigin = null;
var calendarLorePending = null;

function resetCalendarLore() {
  closeCalendarStory();
  calendarLore = { status: 'idle', worldbook: '', entries: [], undatedCount: 0, error: '', revision: calendarLore.revision + 1 };
  calendarLorePending = null;
}

function loadCalendarLore(force) {
  if (!force && calendarLore.status !== 'idle') return calendarLorePending || Promise.resolve();
  var currentBridge = bridge, revision = ++calendarLore.revision;
  closeCalendarStory();
  calendarLore.status = 'loading';
  calendarLore.worldbook = ''; calendarLore.entries = []; calendarLore.undatedCount = 0; calendarLore.error = '';
  var pending = Promise.resolve().then(function() {
    if (!currentBridge || !currentBridge.worldbookCalendar || typeof currentBridge.worldbookCalendar.read !== 'function') {
      throw new Error('当前终端未连接主世界书读取接口。');
    }
    return currentBridge.worldbookCalendar.read();
  }).then(function(result) {
    if (revision !== calendarLore.revision || currentBridge !== bridge) return;
    if (!result || typeof result.worldbook !== 'string' || !Array.isArray(result.entries)) throw new Error('世界书剧情读取结果无效。');
    calendarLore.status = 'ready';
    calendarLore.worldbook = result.worldbook;
    calendarLore.entries = result.entries;
    calendarLore.undatedCount = result.undatedCount || 0;
    renderCalendar();
  }).catch(function(error) {
    if (revision !== calendarLore.revision || currentBridge !== bridge) return;
    calendarLore.status = 'error';
    calendarLore.error = error && error.message || '世界书剧情暂不可用，请重试。';
    renderCalendar();
  });
  calendarLorePending = pending;
  if (force) renderCalendar();
  return pending;
}

function calendarLoreItems(key) {
  return calendarLore.status === 'ready' ? calendarLore.entries.filter(function(entry) {
    return entry.dates.some(function(date) { return date.key === key; });
  }) : [];
}

function calendarStoryButton(entry) {
  return '<button type="button" class="rk-calendar-story-button" onclick="openCalendarStory(' + entry.uid + ')">' +
    esc(entry.name) + '<small>' + esc(entry.dateLabel || '完整日期未明确') + '</small></button>';
}

function renderCalendarLoreStatus() {
  var text = calendarLore.status === 'ready' ? calendarLore.worldbook + ' · ' + calendarLore.entries.filter(function(entry) { return entry.dates.length; }).length + ' 条剧情已标注日期' :
    calendarLore.status === 'error' ? calendarLore.error : '正在读取当前角色主世界书…';
  return '<div class="card1"><div class="ct rk-calendar-lore-heading"><span>世界书剧情</span>' +
    '<button type="button" onclick="loadCalendarLore(true)"' + (calendarLore.status === 'loading' ? ' disabled' : '') + '>刷新剧情</button></div>' +
    '<p class="rk-calendar-lore-note" role="status" aria-live="polite">' + esc(text) + '</p>' +
    (calendarLore.status === 'ready' && !calendarLore.entries.length ? '<p>当前主世界书没有可查看的 [剧情] 条目。</p>' : '') + '</div>';
}

function renderUndatedCalendarLore() {
  var entries = calendarLore.status === 'ready' ? calendarLore.entries.filter(function(entry) { return !entry.dates.length; }) : [];
  return entries.length ? '<details class="card1 rk-calendar-undated"><summary>未定日期剧情 · ' + entries.length + ' 条</summary>' +
    '<p class="rk-calendar-lore-note">这些条目未明确完整年月日，点击标题可查看原文。</p>' + entries.map(calendarStoryButton).join('') + '</details>' : '';
}

function calendarStoryDialog() {
  var dialog = document.getElementById('rk-calendar-story');
  if (!dialog || typeof dialog.showModal !== 'function') { toast('当前浏览器无法打开剧情弹窗。'); return null; }
  if (!dialog._rkCalendarBound) {
    dialog._rkCalendarBound = true;
    dialog.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') event.stopPropagation();
    });
    dialog.addEventListener('click', function(event) {
      if (event.target !== dialog) return;
      var rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', function() {
      if (calendarStoryOrigin && calendarStoryOrigin.isConnected !== false && typeof calendarStoryOrigin.focus === 'function') calendarStoryOrigin.focus();
      calendarStoryOrigin = null;
    });
  }
  return dialog;
}

function showCalendarStoryDialog() {
  var dialog = calendarStoryDialog();
  if (!dialog) return;
  if (!dialog.open) { calendarStoryOrigin = document.activeElement; dialog.showModal(); }
  dialog.scrollTop = 0;
}

function closeCalendarStory() {
  var dialog = document.getElementById('rk-calendar-story');
  if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
  ['rk-calendar-story-title', 'rk-calendar-story-source', 'rk-calendar-story-content'].forEach(function(id) {
    var node = document.getElementById(id); if (node) node.textContent = '';
  });
  var choices = document.getElementById('rk-calendar-story-choices'); if (choices) choices.innerHTML = '';
}

function openCalendarStory(uid) {
  var entry = calendarLore.status === 'ready' && calendarLore.entries.find(function(item) { return item.uid === uid; });
  if (!entry) { toast('该剧情资料已更新，请刷新日历后查看。'); return; }
  document.getElementById('rk-calendar-story-title').textContent = entry.name;
  document.getElementById('rk-calendar-story-source').textContent = '来源：' + calendarLore.worldbook + '\n世界书时间：' + (entry.dateLabel || '完整日期未明确');
  document.getElementById('rk-calendar-story-choices').innerHTML = '';
  document.getElementById('rk-calendar-story-content').textContent = entry.content;
  showCalendarStoryDialog();
}

function openCalendarStoriesForDate(key) {
  var entries = calendarLoreItems(key);
  if (entries.length === 1) return openCalendarStory(entries[0].uid);
  if (!entries.length) return;
  document.getElementById('rk-calendar-story-title').textContent = key + ' · 世界书剧情';
  document.getElementById('rk-calendar-story-source').textContent = '来源：' + calendarLore.worldbook + ' · 请选择要查看的剧情';
  document.getElementById('rk-calendar-story-content').textContent = '';
  document.getElementById('rk-calendar-story-choices').innerHTML = entries.map(calendarStoryButton).join('');
  showCalendarStoryDialog();
}

// 2013年日本法定国民祝日 (National Holidays)
var JAPAN_HOLIDAYS_2013 = {
  '1-1': { name: '元日', desc: '日本法定祝日 · 迎新春元旦' },
  '1-14': { name: '成人の日', desc: '日本法定祝日 · 成人之日 (1月第2个周一)' },
  '2-11': { name: '建国記念の日', desc: '日本法定祝日 · 建国纪念之日' },
  '3-20': { name: '春分の日', desc: '日本法定祝日 · 自然赞美与春分祭' },
  '4-29': { name: '昭和の日', desc: '日本法定祝日 · 昭和之日 (黄金周首日)' },
  '5-3': { name: '憲法記念日', desc: '日本法定祝日 · 日本国宪法纪念日' },
  '5-4': { name: 'みどりの日', desc: '日本法定祝日 · 绿之日 · 亲近自然' },
  '5-5': { name: 'こどもの日', desc: '日本法定祝日 · 儿童之日 / 端午节句' },
  '5-6': { name: '振替休日', desc: '法定调休日 (儿童之日周日顺延)' },
  '7-15': { name: '海の日', desc: '日本法定祝日 · 海之日 (7月第3个周一)' },
  '9-16': { name: '敬老の日', desc: '日本法定祝日 · 敬老之日 (9月第3个周一)' },
  '9-23': { name: '秋分の日', desc: '日本法定祝日 · 敬祖缅怀与秋分祭' },
  '10-14': { name: '体育の日', desc: '日本法定祝日 · 体育之日 (10月第2个周一)' },
  '11-3': { name: '文化の日', desc: '日本法定祝日 · 文化之日 · 自由与和平' },
  '11-4': { name: '振替休日', desc: '法定调休日 (文化之日周日顺延)' },
  '11-23': { name: '勤労感謝の日', desc: '日本法定祝日 · 勤劳感谢之日' },
  '12-23': { name: '天皇誕生日', desc: '日本法定祝日 · 明仁天皇诞生日 (平成)' }
};

// 日本传统节庆与年中行事 (Traditional Festivals)
var JAPAN_FESTIVALS = {
  '2-3': { name: '节分', desc: '传统岁时 · 节分祭 (撒豆驱鬼与惠方卷)' },
  '3-3': { name: '雏祭', desc: '传统岁时 · 上巳节 / 女儿节 (祈愿平安成长)' },
  '7-7': { name: '七夕祭', desc: '传统行事 · 星祭 (短册挂竹枝许愿)' },
  '8-13': { name: '盂兰盆节·迎火', desc: '夏日行事 · 盂兰盆节首日迎魂火' },
  '8-14': { name: '盂兰盆会', desc: '夏日行事 · 盆踊与寺社法事' },
  '8-15': { name: '盂兰盆会', desc: '夏日行事 · 盂兰盆中日法会' },
  '8-16': { name: '盂兰盆节·送火', desc: '夏日行事 · 京都五山送火与精灵流' },
  '11-15': { name: '七五三', desc: '传统行事 · 三岁、五岁、七岁儿童神社参拜' },
  '12-31': { name: '大晦日', desc: '传统岁时 · 日本除夕 (年越荞麦面与除夜之钟)' }
};

function calendarMonthDays(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].indexOf(month) >= 0 ? 30 : 31;
}

function validCalendarDate(year, month, day, raw) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1 || day > calendarMonthDays(year, month)) return null;
  return { year: year, month: month, day: day, raw: raw || '',
    key: String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') };
}

function parseScheduleDate(text) {
  var match = typeof text === 'string' && text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]), text) : null;
}

function parseSceneDate() {
  var text = stat && stat.场景 && stat.场景.时间;
  if (typeof text !== 'string') return null;
  var match = text.match(/(?:^|[^\d])(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ||
    text.match(/(?:^|[^\d])(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})(?!\d)/);
  return match ? validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]), text) : null;
}

function readSceneSchedule() {
  var entries = stat && stat.场景 && stat.场景.日程;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) entries = {};
  // 程序背景只在赛程的收合详情展示，不把全校推演对局塞进手机日历。
  var matches = tournamentUI().calendarEntries();
  var matchIds = new Set(matches.map(function(match) { return match.id; }));
  var items = Object.keys(entries).map(function(name) {
    var entry = entries[name];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    if (matchIds.has(name) || matchIds.has(entry.比赛ID) || matchIds.has(entry.选拔赛ID)) return null;
    return { name: name, entry: entry, date: parseScheduleDate(entry.日期) };
  }).filter(function(item) { return !!item; });
  matches.forEach(function(match) { items.push({ name: match.name, entry: match.entry, date: parseScheduleDate(match.entry.日期), tournament: true }); });
  return items.sort(function(a, b) {
    var aDate = a.date ? a.date.key : '99999';
    var bDate = b.date ? b.date.key : '99999';
    return aDate < bDate ? -1 : aDate > bDate ? 1 : a.name.localeCompare(b.name, 'zh-CN');
  });
}

function renderScheduleItem(item, sceneDate) {
  var entry = item.entry;
  var status = entry.状态 || '待定';
  var statusLabel = status;
  if (item.date && sceneDate && item.date.key < sceneDate.key && status !== '已完成' && status !== '已取消') {
    statusLabel += ' · 结果待确认';
  }
  var dateLabel = item.date ? item.date.key : entry.日期 ? '日期待核对（' + String(entry.日期) + '）' : '日期待定';
  var participants = Array.isArray(entry.参与者) ? entry.参与者.filter(function(name) { return typeof name === 'string'; }).join('、') : '';
  return '<div class="gba-cal-event hagun-event"' + (status === '已取消' ? ' style="opacity:0.7;"' : '') + '>' +
    '<b>' + (entry.类型 === '比赛' ? '⚔ ' : '• ') + esc(item.name) + '</b>' +
    '<p>' + esc((entry.类型 || '其他') + ' · ' + statusLabel) + '</p>' +
    '<p>' + esc(dateLabel + (entry.时间 ? ' · ' + entry.时间 : '') + ' · ' + (entry.地点 || '地点待定')) + '</p>' +
    (participants ? '<p>参与者：' + esc(participants) + '</p>' : '') +
    (entry.说明 ? '<p style="white-space:pre-wrap;">' + esc(entry.说明) + '</p>' : '') + '</div>';
}

function renderUndatedSchedule(items, sceneDate) {
  if (!items.length) return '';
  return '<div class="card1"><div class="ct">日期待定 / 待核对</div>' +
    items.map(function(item) { return renderScheduleItem(item, sceneDate); }).join('') + '</div>';
}

function changeCalendarMonth(delta) {
  if (!validCalendarDate(calendarState.year, calendarState.month, 1) || (delta !== -1 && delta !== 1)) return;
  var y = calendarState.year;
  var m = calendarState.month + delta;
  if (m > 12) { y++; m = 1; }
  else if (m < 1) { y--; m = 12; }
  if (!validCalendarDate(y, m, 1)) return;
  calendarState.year = y;
  calendarState.month = m;
  calendarState.selectedDay = 1;
  renderCalendar();
}

function selectCalendarDay(day) {
  if (!validCalendarDate(calendarState.year, calendarState.month, day)) return;
  calendarState.selectedDay = day;
  renderCalendar();
  var selected = document.querySelector('[data-calendar-day="' + day + '"]');
  if (selected) selected.focus();
  openCalendarStoriesForDate(validCalendarDate(calendarState.year, calendarState.month, day).key);
}

function jumpToSceneDate() {
  var sceneDate = parseSceneDate();
  if (sceneDate) {
    calendarState.year = sceneDate.year;
    calendarState.month = sceneDate.month;
    calendarState.selectedDay = sceneDate.day;
    calendarState._initialized = true;
    renderCalendar();
    toast('已定位至剧情时间：' + sceneDate.month + '月' + sceneDate.day + '日');
  } else {
    toast('当前剧情时间尚未标明有效的完整年月日。');
  }
}

function renderCalendar() {
  var body = document.getElementById('calendar-body');
  if (!body) return;
  var sub = document.getElementById('calendar-sub');
  if (calendarLore.status === 'idle') loadCalendarLore(false);
  var loreStatus = renderCalendarLoreStatus();
  var undatedLore = renderUndatedCalendarLore();

  var sceneDate = parseSceneDate();
  var schedule = readSceneSchedule();
  var dated = schedule.filter(function(item) { return !!item.date; });
  var undated = schedule.filter(function(item) { return !item.date; });
  if (!calendarState._initialized) {
    var firstLoreDate = calendarLore.entries.flatMap(function(entry) { return entry.dates; }).map(function(date) { return parseScheduleDate(date.key); })
      .filter(function(date) { return !!date; }).sort(function(a, b) { return a.key.localeCompare(b.key); })[0];
    var anchor = sceneDate || (dated.length ? dated[0].date : null) || firstLoreDate;
    calendarState.year = anchor ? anchor.year : null;
    calendarState.month = anchor ? anchor.month : null;
    calendarState.selectedDay = anchor ? anchor.day : null;
    calendarState._initialized = !!anchor;
  }

  var y = calendarState.year;
  var m = calendarState.month;
  var selectedDay = calendarState.selectedDay || 1;
  if (!validCalendarDate(y, m, 1)) {
    if (sub) sub.textContent = '本局年月日尚未确认';
    body.innerHTML = loreStatus + '<div class="card1"><div class="ct">手机日历</div>' +
      '<p>当前场景、日程和世界书剧情均无有效的完整日期，暂不定位月份。</p>' +
      '<p>明确比赛或约定的日期后，会显示在对应日期；尚未定日的安排保留在下方。</p></div>' +
      renderUndatedSchedule(undated, sceneDate) + undatedLore;
    return;
  }

  if (sub) {
    sub.textContent = y + '年' + m + '月 · ' + (sceneDate ? '本局日期：' + sceneDate.key : '本局日期未确认');
  }

  var totalDays = calendarMonthDays(y, m);
  if (selectedDay > totalDays) selectedDay = totalDays;
  calendarState.selectedDay = selectedDay;
  var firstDate = new Date(0);
  firstDate.setUTCFullYear(y, m - 1, 1);
  var firstDayWeekday = firstDate.getUTCDay();
  var byDate = Object.create(null);
  dated.forEach(function(item) {
    if (!byDate[item.date.key]) byDate[item.date.key] = [];
    byDate[item.date.key].push(item);
  });

  var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  var weekHeaderHtml = weekdays.map(function(w, idx) {
    var cls = (idx === 0) ? 'gba-cal-wh sun' : (idx === 6 ? 'gba-cal-wh sat' : 'gba-cal-wh');
    return '<span class="' + cls + '">' + w + '</span>';
  }).join('');

  var cellsHtml = '';
  for (var p = 0; p < firstDayWeekday; p++) {
    cellsHtml += '<div class="gba-cal-cell gba-cal-pad"></div>';
  }

  for (var d = 1; d <= totalDays; d++) {
    var key = m + '-' + d;
    var holiday = y === 2013 ? JAPAN_HOLIDAYS_2013[key] : null;
    var festival = JAPAN_FESTIVALS[key];
    var dateKey = validCalendarDate(y, m, d).key;
    var dayItems = byDate[dateKey] || [];
    var dayLore = calendarLoreItems(dateKey);
    var activeItems = dayItems.filter(function(item) { return item.entry.状态 !== '已取消'; });
    var hasMatch = activeItems.some(function(item) { return item.entry.类型 === '比赛'; });
    var isSceneToday = (sceneDate && sceneDate.year === y && sceneDate.month === m && sceneDate.day === d);
    var isSelected = (d === selectedDay);

    var weekdayIndex = (firstDayWeekday + d - 1) % 7;
    var cellClass = 'gba-cal-cell';
    if (isSelected) cellClass += ' is-selected';
    if (isSceneToday) cellClass += ' is-scene-today';
    if (activeItems.length) cellClass += ' has-school';
    else if (holiday) cellClass += ' has-holiday';
    if (dayLore.length) cellClass += ' has-lore';
    if (weekdayIndex === 0) cellClass += ' is-sun';
    if (weekdayIndex === 6) cellClass += ' is-sat';

    var marks = '';
    if (isSceneToday) marks += '<span class="gba-cal-mark mark-today" title="当前剧情日">★</span>';
    if (dayItems.length) marks += '<span class="gba-cal-mark mark-school" title="本局日程 ' + dayItems.length + ' 项">' + (hasMatch ? '⚔' : '•') + dayItems.length + '</span>';
    if (dayLore.length) marks += '<span class="gba-cal-mark mark-lore" title="点击查看世界书剧情">剧情' + (dayLore.length > 1 ? dayLore.length : '') + '</span>';
    if (holiday) marks += '<span class="gba-cal-mark mark-holiday" title="2013 年法定祝日">㊗</span>';
    else if (festival) marks += '<span class="gba-cal-mark mark-fest" title="传统节庆">🎋</span>';

    cellsHtml += '<button type="button" class="' + cellClass + '" data-calendar-day="' + d + '" onclick="selectCalendarDay(' + d + ')" aria-pressed="' + isSelected +
      '" aria-label="' + dateKey + '，' + dayItems.length + ' 项本局日程' + (hasMatch ? '，含比赛' : '') + (dayLore.length ? '，' + dayLore.length + ' 条世界书剧情，点击查看' : '') + '">' +
      '<span class="gba-cal-num">' + d + '</span>' +
      '<span class="gba-cal-marks">' + marks + '</span>' +
    '</button>';
  }

  var selKey = m + '-' + selectedDay;
  var selHoliday = y === 2013 ? JAPAN_HOLIDAYS_2013[selKey] : null;
  var selFestival = JAPAN_FESTIVALS[selKey];
  var selectedItems = byDate[validCalendarDate(y, m, selectedDay).key] || [];
  var selectedLore = calendarLoreItems(validCalendarDate(y, m, selectedDay).key);
  var selIsScene = (sceneDate && sceneDate.year === y && sceneDate.month === m && sceneDate.day === selectedDay);
  var selWeekdayName = weekdays[(firstDayWeekday + selectedDay - 1) % 7];

  var detailTags = '';
  if (selIsScene) detailTags += '<span class="gba-badge-today">★ 当前剧情时间</span> ';
  if (selectedItems.length) detailTags += '<span class="gba-badge-school">本局日程 ' + selectedItems.length + ' 项</span> ';
  if (selectedLore.length) detailTags += '<span class="gba-badge-school">世界书剧情 ' + selectedLore.length + ' 条</span> ';
  if (selHoliday) detailTags += '<span class="gba-badge-holiday">㊗ ' + esc(selHoliday.name) + '</span> ';
  if (selFestival) detailTags += '<span class="gba-badge-fest">🎋 ' + esc(selFestival.name) + '</span> ';

  var detailNotes = selectedItems.map(function(item) { return renderScheduleItem(item, sceneDate); });
  if (selectedLore.length) detailNotes.push('<div class="gba-cal-event"><b>【世界书剧情】</b>' + selectedLore.map(calendarStoryButton).join('') + '</div>');
  if (!selectedItems.length) detailNotes.push('<div style="font-size:12px;color:var(--muted);padding:4px 0;">当日暂无本局已登记的比赛或约定。</div>');
  if (selHoliday) {
    detailNotes.push('<div class="gba-cal-event holiday-event"><b>【法定祝日】' + esc(selHoliday.name) + '</b><p>' + esc(selHoliday.desc) + '</p></div>');
  }
  if (selFestival) {
    detailNotes.push('<div class="gba-cal-event fest-event"><b>【传统节庆】' + esc(selFestival.name) + '</b><p>' + esc(selFestival.desc) + '</p></div>');
  }
  if (selIsScene) {
    detailNotes.push('<div class="gba-cal-event scene-event"><b>【剧情推进基准】</b><p>' + esc(sceneDate.raw) + '</p></div>');
  }

  var html = 
    loreStatus + '<div class="gba-cal-panel">' +
      '<div class="gba-cal-nav">' +
        '<button type="button" class="gba-btn-sm" onclick="changeCalendarMonth(-1)">◀ 上月</button>' +
        '<span class="gba-cal-cur-title">' + y + ' 年 ' + m + ' 月</span>' +
        '<button type="button" class="gba-btn-sm" onclick="changeCalendarMonth(1)">下月 ▶</button>' +
        '<button type="button" class="gba-btn-sm gba-btn-jump" onclick="jumpToSceneDate()">🎯 定位剧情</button>' +
      '</div>' +
      '<div class="gba-cal-week-row">' + weekHeaderHtml + '</div>' +
      '<div class="gba-cal-grid">' + cellsHtml + '</div>' +
      '<p style="font-size:11px;color:var(--muted);">⚔ 比赛 · • 其他日程 · ★ 本局日期 · 剧情：点击查看世界书原文。</p>' +
      (y === 2013 ? '' : '<p style="font-size:11px;color:var(--muted);">该年的法定祝日尚未配置，节庆提示不代表本局活动。</p>') +
    '</div>' +
    '<div class="card1 gba-cal-detail">' +
      '<div class="ct" style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span>' + y + '年' + m + '月' + selectedDay + '日 (星期' + selWeekdayName + ')</span>' +
        '<small style="font-family:var(--font-num);font-weight:normal;color:var(--muted);">GBA CALENDAR</small>' +
      '</div>' +
      (detailTags ? '<div class="gba-cal-tags" style="margin-bottom:8px;">' + detailTags + '</div>' : '') +
      '<div class="gba-cal-desc-list">' + detailNotes.join('') + '</div>' +
    '</div>' + renderUndatedSchedule(undated, sceneDate) + undatedLore;

  body.innerHTML = html;
}

// 保持别名兼容
function renderWorldbook() {
  renderCalendar();
}

window.changeCalendarMonth = changeCalendarMonth;
window.selectCalendarDay = selectCalendarDay;
window.jumpToSceneDate = jumpToSceneDate;
window.loadCalendarLore = loadCalendarLore;
window.openCalendarStory = openCalendarStory;
window.closeCalendarStory = closeCalendarStory;

// ===== 终端配置 (Settings) =====
var playerPortraitDraft = null;
var playerPortraitError = '';
function playerPortraitIdentity(snapshot) {
  return JSON.stringify([snapshot.version, snapshot.scope, snapshot.primaryName, snapshot.personaName, snapshot.revision,
    snapshot.profileName, snapshot.profileMismatch]);
}
function readPlayerPortraitSnapshot() {
  var api = bridge && bridge.playerPortrait;
  if (!api || typeof api.get !== 'function') throw new Error('玩家称呼设置尚未连接，请更新终端后重载。');
  var snapshot = api.get();
  if (!snapshot || snapshot.version !== 1 || !snapshot.scope) throw new Error('请先打开本局聊天，再设置玩家称呼。');
  return JSON.parse(JSON.stringify(snapshot));
}
function beginPlayerPortraitDraft(snapshot) {
  playerPortraitDraft = { snapshot: snapshot, identity: playerPortraitIdentity(snapshot),
    aliasesText: (snapshot.aliases || []).join('\n'), dirty: false, invalidated: snapshot.profileMismatch === true };
  playerPortraitError = snapshot.profileMismatch === true ? '当前照片属于另一人物；请在开局页为当前姓名应用照片后重新读取。暂可用“玩家:台词”。' : '';
}
function syncPlayerPortraitDraft() {
  try {
    var snapshot = readPlayerPortraitSnapshot();
    if (!playerPortraitDraft) { beginPlayerPortraitDraft(snapshot); return true; }
    if (playerPortraitIdentity(snapshot) !== playerPortraitDraft.identity) {
      if (playerPortraitDraft.dirty) {
        playerPortraitDraft.invalidated = true;
        playerPortraitError = '聊天、玩家身份或已保存设置已变化；请重新读取后编辑。';
      } else { beginPlayerPortraitDraft(snapshot); return true; }
    }
    if (snapshot.profileMismatch === true) {
      playerPortraitDraft.invalidated = true;
      playerPortraitError = '当前照片属于另一人物；请在开局页为当前姓名应用照片后重新读取。暂可用“玩家:台词”。';
    }
    return false;
  } catch (error) {
    if (playerPortraitDraft) playerPortraitDraft.invalidated = true;
    playerPortraitError = error && error.message || '当前聊天的称呼设置不可用。';
    return false;
  }
}
function paintPlayerPortraitSettings() {
  var draft = playerPortraitDraft, message = document.getElementById('rk-player-portrait-message');
  if (message) message.textContent = playerPortraitError || (draft && draft.dirty ? '别名尚未保存。' : '别名已保存于本机，仅用于当前聊天。');
  ['save', 'clear'].forEach(function(action) {
    var button = document.getElementById('rk-player-portrait-' + action);
    if (button) button.disabled = !draft || draft.invalidated;
  });
  var preview = document.getElementById('rk-player-portrait-preview');
  if (preview) {
    var name = draft && (draft.snapshot.primaryName || draft.snapshot.personaName) || resolvePlayer().name;
    var html = renderKnightAvatar(name, false, { player: true, square: true });
    if (preview.innerHTML !== html) preview.innerHTML = html;
  }
}
function renderPlayerPortraitSettings() {
  var section = document.getElementById('rk-player-portrait-settings');
  if (!section) return;
  syncPlayerPortraitDraft();
  var draft = playerPortraitDraft;
  var name = draft && (draft.snapshot.primaryName || draft.snapshot.personaName) || resolvePlayer().name;
  section.innerHTML = '<div class="ct">玩家称呼 / 别名</div>' +
    '<p>头像沿用开局页载入或上传的照片，首页、人物档案与正文气泡共用。这里仅登记明确称呼，不改变正式角色档案。</p>' +
    '<div class="rk-player-portrait-heading"><div class="card-avatar" id="rk-player-portrait-preview"></div><div><b>' + esc(name) +
    '</b><p>当前头像预览。更换照片请在开局页核对姓名后点击“应用头像到本局”，无需重新建档。</p></div></div>' +
    '<label for="rk-player-portrait-aliases">别名（选填）<textarea id="rk-player-portrait-aliases" name="aliasesText" rows="3" maxlength="2048" placeholder="黎恩，教官\n舒华泽" oninput="editPlayerPortraitDraft(this)">' +
    esc(draft && draft.aliasesText || '') + '</textarea></label>' +
    '<p>用逗号或换行分隔。正文推荐固定写“玩家:台词”；简称请明确登记，避免与其他人物重名。别名只保存在本机当前聊天。</p>' +
    '<p id="rk-player-portrait-message" role="status" aria-live="polite"></p>' +
    '<div class="rk-player-portrait-actions"><button id="rk-player-portrait-save" type="button" onclick="savePlayerAliases()">保存别名</button>' +
    '<button id="rk-player-portrait-clear" type="button" onclick="clearPlayerAliases()">清除别名</button>' +
    '<button type="button" onclick="reloadPlayerPortraitSettings()">重新读取</button></div>';
  paintPlayerPortraitSettings();
}
function refreshPlayerPortraitSettings() {
  var replaced = syncPlayerPortraitDraft();
  if (currentStack[currentStack.length - 1] !== 'scr-settings') return;
  if (replaced) renderPlayerPortraitSettings(); else paintPlayerPortraitSettings();
}
function editPlayerPortraitDraft(input) {
  if (!playerPortraitDraft || !input || input.name !== 'aliasesText') return;
  playerPortraitDraft[input.name] = String(input.value || '');
  playerPortraitDraft.dirty = true;
  if (!playerPortraitDraft.invalidated) playerPortraitError = '';
  paintPlayerPortraitSettings();
}
function savePlayerAliases() {
  syncPlayerPortraitDraft();
  var draft = playerPortraitDraft;
  if (!draft || draft.invalidated) { paintPlayerPortraitSettings(); return; }
  try {
    var api = bridge && bridge.playerPortrait;
    if (!api || typeof api.saveAliases !== 'function') throw new Error('别名保存接口尚未连接。');
    api.saveAliases(draft.snapshot, { aliases: [...new Set(draft.aliasesText.split(/[,，\r\n]+/u).map(function(value) { return value.trim(); }).filter(Boolean))] });
    beginPlayerPortraitDraft(readPlayerPortraitSnapshot());
    renderPlayerPortraitSettings(); refreshTerminalView(); toast('已保存本局玩家别名。');
  } catch (error) { playerPortraitError = error && error.message || '别名未保存，请重试。'; paintPlayerPortraitSettings(); }
}
function clearPlayerAliases() {
  syncPlayerPortraitDraft();
  var draft = playerPortraitDraft;
  if (!draft || draft.invalidated) { paintPlayerPortraitSettings(); return; }
  try {
    var api = bridge && bridge.playerPortrait;
    if (!api || typeof api.clearAliases !== 'function') throw new Error('别名清除接口尚未连接。');
    api.clearAliases(draft.snapshot);
    beginPlayerPortraitDraft(readPlayerPortraitSnapshot());
    renderPlayerPortraitSettings(); refreshTerminalView(); toast('已清除本局玩家别名，头像保持原样。');
  } catch (error) { playerPortraitError = error && error.message || '别名未清除，请重试。'; paintPlayerPortraitSettings(); }
}
function reloadPlayerPortraitSettings() {
  try { beginPlayerPortraitDraft(readPlayerPortraitSnapshot()); } catch (error) { playerPortraitError = error.message; }
  renderPlayerPortraitSettings();
}
function renderSettings() {
  var body = document.getElementById('settings-body');
  if (!body) return;

  body.innerHTML = '<section class="card1 rk-player-portrait-settings" id="rk-player-portrait-settings" aria-label="玩家称呼与别名"></section>' +
    '<div class="card1">' +
      '<div class="ct">视觉与个性化</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--hair);">' +
        '<span>色彩主题风格</span>' +
        '<button onclick="toggleTheme()" style="padding:4px 10px;background:var(--card2);border-radius:6px;font-size:12px;color:var(--ink);">' +
          '切换 黑底 / 白底' +
        '</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;">' +
        '<span>窗口与悬浮球位置</span>' +
        '<button onclick="recenterWindow()" style="padding:4px 10px;background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.4);border-radius:6px;font-size:12px;">' +
          '重置居中' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="card1">' +
      '<div class="ct">系统版本信息</div>' +
      '<div style="font-size:12px;color:var(--muted);line-height:1.6;">' +
        '<div>破军学园伐刀者便携智能终端 OS</div>' +
        '<div>版本：' + (bridge && bridge.version ? 'v' + esc(bridge.version) : '尚未连接') + ' MONO ADV · 黑白轮盘版</div>' +
        '<div>内核驱动：TavernHelper / MVU Data Bridge</div>' +
      '</div>' +
    '</div>';
  renderPlayerPortraitSettings();
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-rk-theme');
  var next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-rk-theme', next);
  toast('已切换至 ' + (next === 'light' ? '黑白纸面' : '黑白墨色') + ' 主题');
}

function recenterWindow() {
  if (bridge && bridge.ui && typeof bridge.ui.recenter === 'function') {
    bridge.ui.recenter();
  }
  toast('终端位置已恢复屏幕中央');
}

// 只缓存界面显示；生成等待时保留，切聊天或手动切换回复时清空。
var bridgeRevision = 0;
var bridgeUnsubscribe = null;
var stateSignature = '';
function refreshTerminalView() {
  var active = stat.场景?.宿舍 === true, button = document.getElementById('dorm-toggle');
  if (active && !document.body.classList.contains('rk-dorm')) setTimeout(function() { var pan = document.getElementById('dorm-pan'); pan.scrollLeft = Math.max(0, (pan.scrollWidth - pan.clientWidth) / 2); }, 0);
  document.body.classList.toggle('rk-dorm', active);
  button.setAttribute('aria-pressed', String(active)); document.getElementById('dorm-pan').tabIndex = active ? 0 : -1;
  button.disabled = !bridge || typeof bridge.dorm !== 'function' || dataStatus !== 'ready';
  updateHomeScreen();
  refreshPlayerPortraitSettings();
  var renderers = {
    'scr-blazer': renderBlazer,
    'scr-lime': renderLime,
    'scr-moments': renderMoments,
    'scr-bbs': renderBbs,
    'scr-schedule': renderSchedule,
    'scr-arena': renderTournamentPanel,
    'scr-calendar': renderCalendar,
    'scr-worldbook': renderCalendar
  };
  var render = renderers[currentStack[currentStack.length - 1]];
  if (render) render();
}
function refreshTerminalState(event) {
  if (typeof prepareLimeRefresh === 'function') prepareLimeRefresh(event);
  if (event && event.type === 'player-portrait') { refreshTerminalView(); return Promise.resolve(); }
  var revision = ++bridgeRevision;
  var retainDisplay = !!event && (!event.reset || event.retainDisplay === true);
  if (!retainDisplay) {
    resetCalendarLore();
    stat = {};
    stateSource = null;
    stateTargetSource = null;
    stateMessage = '';
    hasDisplayedState = false;
    expandedPeople.clear();
    hiddenPeopleOpen = false;
    rosterDeleteDraft = null;
    if (tournamentModule) tournamentModule.reset();
    calendarState._initialized = false;
    stateSignature = '';
    dataStatus = 'loading';
    dataError = '';
    refreshTerminalView();
  } else if (event.reset && hasDisplayedState) {
    dataStatus = 'pending';
    dataError = '';
    stateMessage = '等待当前回复 MVU';
    refreshTerminalView();
  }
  if (!bridge || (typeof bridge.getSnapshot !== 'function' && typeof bridge.getStat !== 'function')) return Promise.resolve();
  var currentBridge = bridge;
  return Promise.resolve().then(function() {
    return typeof currentBridge.getSnapshot === 'function' ? currentBridge.getSnapshot() :
      Promise.resolve(currentBridge.getStat()).then(function(state) { return { state: state, source: null }; });
  }).then(function(snapshot) {
    if (revision !== bridgeRevision) return;
    if (typeof refreshLimeRecords === 'function') refreshLimeRecords();
    var signature = JSON.stringify(snapshot);
    if (signature === stateSignature && dataStatus === (snapshot.pending ? 'pending' : 'ready')) return;
    var previousScope = stateTargetSource || stateSource;
    var nextScope = snapshot.targetSource || snapshot.source;
    var calendarScopeKey = function(source) {
      return source ? JSON.stringify([source.characterId ?? null, source.groupId ?? null, source.chatId ?? null]) : '';
    };
    if (calendarScopeKey(previousScope) !== calendarScopeKey(nextScope)) resetCalendarLore();
    if (sourceKey(stateSource) !== sourceKey(snapshot.source)) {
      expandedPeople.clear();
      hiddenPeopleOpen = false;
      if (stateSource && typeof resetLimeSession === 'function' && (limeScope(stateSource) !== limeScope(snapshot.source) || (snapshot.source && stateSource.messageId > snapshot.source.messageId))) resetLimeSession();
      rosterDeleteDraft = null;
      if (tournamentModule) tournamentModule.reset();
      calendarState._initialized = false;
    }
    stateSource = snapshot.source || null;
    stateTargetSource = snapshot.targetSource || null;
    stateMessage = snapshot.message || '';
    stateSignature = signature;
    stat = snapshot.state || {};
    if (tournamentModule) tournamentModule.onSnapshot();
    hasDisplayedState = !!snapshot.state;
    dataStatus = snapshot.pending ? 'pending' : 'ready';
    dataError = '';
    refreshTerminalView();
  }).catch(function(error) {
    if (revision !== bridgeRevision) return;
    stat = {};
    stateSource = null;
    stateTargetSource = null;
    stateMessage = '';
    hasDisplayedState = false;
    expandedPeople.clear();
    hiddenPeopleOpen = false;
    activeChat = null;
    rosterDeleteDraft = null;
    if (tournamentModule) tournamentModule.reset();
    calendarState._initialized = false;
    stateSignature = '';
    dataStatus = 'error';
    dataError = error && error.message || '当前回复的数据不可用';
    refreshTerminalView();
  });
}
window.RKBoot = function(b) {
  if (typeof bridgeUnsubscribe === 'function') bridgeUnsubscribe();
  if (bridge && bridge !== b && typeof resetLimeSession === 'function') resetLimeSession();
  bridge = b;
  refreshTerminalState();
  bridgeUnsubscribe = bridge && typeof bridge.onUpdate === 'function' ? bridge.onUpdate(refreshTerminalState) : null;
};
window.addEventListener('pagehide', function() {
  bridgeRevision++;
  if (tournamentModule) tournamentModule.destroy();
  if (typeof resetLimeSession === 'function') resetLimeSession();
  calendarLore.revision++;
  if (typeof correctionProgressUI !== 'undefined') correctionProgressUI.destroy();
  if (typeof bridgeUnsubscribe === 'function') bridgeUnsubscribe();
  bridgeUnsubscribe = null;
});

// 默认首屏就绪
updateHomeScreen();
