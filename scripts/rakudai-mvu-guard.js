// 内联依赖 rakudai-mvu-reply-source.mjs；在 Zod 桥接注册后调用。
function installRakudaiMvuGuard(schema) {
  if (typeof eventOn !== 'function' || !Mvu.events?.VARIABLE_UPDATE_ENDED) throw new Error('MVU 缺少更新结束事件，写入责任保护未注册。');
  const H = (function() {
    for (const resolve of [() => window.top, () => window.parent, () => window]) {
      try { const scope = resolve(); if (scope?.SillyTavern?.getContext) return scope; } catch (_) {}
    }
    return window;
  })();
  // 仅缓存真实回复的主结算起止点；正文/生图刷新不会重置同轮推进记录。
  const storySettlements = new Map();
  function storyPoint(scene) {
    if (!scene || storyPosition(scene.当前卷, scene.当前章) < 0 || !['未开始', '进行中', '已结束'].includes(scene.阶段)) return null;
    return { 当前卷: scene.当前卷, 当前章: resolveStoryChapter(scene.当前卷, scene.当前章).key, 阶段: scene.阶段 };
  }
  function storyReceipt(source) {
    const saved = storySettlements.get(source.key);
    return saved && saved.chatRef === source.chatRef && saved.messageRef === source.messageRef && saved.text === source.text ? saved : null;
  }
  function rememberStory(source, before, after) {
    const start = storyPoint(before), end = storyPoint(after);
    if (!source || !start || !end) return;
    const saved = storyReceipt(source);
    storySettlements.delete(source.key);
    storySettlements.set(source.key, { chatRef: source.chatRef, messageRef: source.messageRef, text: source.text,
      before: saved?.before || start, after: end });
    if (storySettlements.size > 300) storySettlements.delete(storySettlements.keys().next().value);
  }
  const replySources = createRakudaiMvuReplySource(window, { mvu: Mvu,
    enrichRepairSource: (source, identity) => ({ ...source, relationshipCorrection: true,
      storyCorrection: true, storyBefore: storyReceipt(source)?.before || storyPoint(identity.storyBefore) }),
  });
  const parseRepair = replySources.parseRepair;
  const commandListener = Mvu.events.COMMAND_PARSED ? eventOn(Mvu.events.COMMAND_PARSED,
    (variables, commands, content) => replySources.capture(variables, content)) : null;
  const listener = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
    let changed;
    let scoreNotices = [];
    let contactChanges = [];
    let growthNotices = [];
    let tournamentNotices = [];
    const internal = variables?.stat_data?.$internal;
    function rollback() {
      variables.stat_data = cloneState(previous.stat_data);
      if (internal !== undefined) variables.stat_data.$internal = internal;
    }
    try {
      const { source, replyKey } = replySources.take(variables);
      const flexibleRepair = Boolean(replyKey && source?.flexibleRepair === true);
      changed = enforceStateOwnership(variables, previous, { replyKey, flexibleRepair,
        storyCorrection: source?.storyCorrection === true, storyBefore: source?.storyBefore });
      scoreNotices = enforceRelationshipScores(variables, previous, { replyKey, submittedFields: source?.submittedFields || [],
        relationshipCorrection: Boolean(replyKey && source?.relationshipCorrection === true), flexibleRepair });
      contactChanges = enforceRelationshipContact(variables, previous, { replyKey, flexibleRepair });
      // 选拔赛只校验自身账本；坏比赛不回滚能力、人际或其它本轮事实。
      tournamentNotices = enforceTournamentState(variables, previous);
      const scoreReceiptChanged = stateKey(variables.stat_data?.系统?.关系计分) !== stateKey(previous.stat_data?.系统?.关系计分);
      growthNotices = enforceGrowthProgress(variables, previous, { mode: 'final', replyKey,
        repairEventKeys: replyKey ? source?.repairEventKeys || [] : [],
        growthFinalAxes: source?.growthFinalAxes || [], growthGradeAxes: source?.growthGradeAxes || [] });
      const storyChanged = ['当前卷', '当前章', '阶段'].some(key => variables.stat_data?.场景?.[key] !== previous.stat_data?.场景?.[key]);
      const growthChanged = stateKey(variables.stat_data?.玩家?.成长) !== stateKey(previous.stat_data?.玩家?.成长);
      // 合法相邻推进和越权恢复后都校验事件位置，不能留下超前事件。
      // 关系计分被拒时仍不牵连其他字段。
      if ((changed.length || contactChanges.length || storyChanged || growthChanged || scoreReceiptChanged) && !schema.safeParse(variables.stat_data).success) {
        rollback();
        changed.push('/场景（更新后结构或事件位置不合法）');
      }
      // 主回复无变化也要保存起点；副补漏首次推进后沿用同一起点，防止再次校正跳两章。
      if (replyKey) rememberStory(source, source.storyCorrection ? source.storyBefore : previous.stat_data?.场景, variables.stat_data?.场景);
    } catch (_) { rollback(); changed = ['/stat_data']; }
    if (changed.length) {
      const message = '已恢复越权或非法修改：' + changed.join('、') + '。自动切章只允许按当前世界书完成标识前进相邻章；其他切入请使用终端。';
      console.warn('[落第 MVU v4] ' + message);
      if (typeof toastr !== 'undefined') toastr.warning(message, '写入责任检查');
    }
    if (scoreNotices.length) {
      const message = scoreNotices.map(item => item.path + '：' + item.message).join('\n');
      console.warn('[落第 MVU v4 关系计分] ' + message);
      if (typeof toastr !== 'undefined') toastr.warning(message, '关系计分检查');
    }
    if (tournamentNotices.length) {
      const message = tournamentNotices.join('\n');
      console.warn('[落第 MVU 选拔赛] ' + message);
      if (typeof toastr !== 'undefined') toastr.warning(message, '选拔赛记录检查');
    }
    if (growthNotices.length) {
      const message = growthNotices.map(item => item.path + '：' + item.message).join('\n');
      console.info('[落第 MVU v4 成长结算] ' + message);
      if (typeof toastr !== 'undefined') toastr.info(message, '成长结算');
    }
  });
  const marker = { version: '4.0.0', automaticStoryProgress: true, scheduleAndRoster: true, rosterPermanentRemoval: true, contactBaseline: 'C02', relationshipScoring: RELATIONSHIP_SCORING.version, growth: GROWTH_RULES.version, growthMode: 'final', growthProtocol: 'final-values-v1', settlement: 'G04', growthSettlement: 'G04', tournament: 'T01', tournamentEngine: 'T02', repair: 'P02', repairSource: 'MVU02', storyRepair: 'S01', flexibleRepair: 'F01', parseRepair };
  H.__RK_MVU_GUARD_V4__ = marker;
  window.__RK_MVU_GUARD_V4__ = marker;
  try { if (window.parent) window.parent.__RK_MVU_GUARD_V4__ = marker; } catch (_) {}
  try { if (window.top) window.top.__RK_MVU_GUARD_V4__ = marker; } catch (_) {}
  window.addEventListener('pagehide', () => {
    listener.stop();
    commandListener?.stop();
    storySettlements.clear();
    if (H.__RK_MVU_GUARD_V4__ === marker) delete H.__RK_MVU_GUARD_V4__;
    if (window.__RK_MVU_GUARD_V4__ === marker) delete window.__RK_MVU_GUARD_V4__;
    try { if (window.parent?.__RK_MVU_GUARD_V4__ === marker) delete window.parent.__RK_MVU_GUARD_V4__; } catch (_) {}
    try { if (window.top?.__RK_MVU_GUARD_V4__ === marker) delete window.top.__RK_MVU_GUARD_V4__; } catch (_) {}
  }, { once: true });
}
