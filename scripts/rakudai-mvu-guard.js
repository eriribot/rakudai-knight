// 内联到字段约束伴随脚本，在 Zod 桥接注册后调用。
function installRakudaiMvuGuard(schema) {
  if (typeof eventOn !== 'function' || !Mvu.events?.VARIABLE_UPDATE_ENDED) throw new Error('MVU 缺少更新结束事件，写入责任保护未注册。');
  const H = (function() {
    for (const resolve of [() => window.top, () => window.parent, () => window]) {
      try { const scope = resolve(); if (scope?.SillyTavern?.getContext) return scope; } catch (_) {}
    }
    return window;
  })();
  const parsingSources = new WeakMap();
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
  let repairSession = null;
  // 副 API 的补丁不是聊天正文。显式绑定本次解析的真实来源，不能默认借用最新楼层额度。
  async function parseRepair(content, data, sourceText, identity) {
    if (repairSession) throw new Error('已有副 API 补丁正在解析。');
    const source = locateBoundReply(sourceText, identity);
    if (!source) throw new Error('无法唯一确认补丁对应的助手回复，未解析。');
    const nonce = Math.random().toString(36).slice(2);
    const wrapped = '<UpdateVariable><Analysis>repair:' + nonce + '</Analysis><JSONPatch>' +
      content + '</JSONPatch></UpdateVariable>';
    // 只认真实正文原补丁已提交的本轮事件结果，不能凭副模型自称把旧事件重新结算。
    const blocks = [...source.text.matchAll(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/gi)];
    const repairEventKeys = [], savedEvents = data.stat_data?.场景?.已发生事件;
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    function rememberEvent(name, result) {
      // 父对象写法也必须逐项核对已保存结果；空值、隐藏原型键和未落实事件不算本轮凭据。
      if (typeof name !== 'string' || !name || /[~/]/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name) ||
          typeof result !== 'string' || !result.trim() || !object(savedEvents) || !Object.hasOwn(savedEvents, name) ||
          result !== savedEvents[name]?.结果 || repairEventKeys.includes(name)) return;
      repairEventKeys.push(name);
    }
    function rememberEventObject(events) {
      if (object(events)) for (const [name, event] of Object.entries(events)) {
        if (object(event) && Object.hasOwn(event, '结果')) rememberEvent(name, event.结果);
      }
    }
    if (blocks.length === 1) {
      try {
        const operations = JSON.parse(blocks[0][1].trim());
        for (const op of Array.isArray(operations) ? operations : []) {
          if (!op || !['add', 'replace'].includes(op.op) || typeof op.path !== 'string' || !op.path.startsWith('/') || /~(?![01])/.test(op.path)) continue;
          const parts = op.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
          if (parts[0] !== '场景' || parts.some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) continue;
          if (parts.length === 1 && object(op.value) && Object.hasOwn(op.value, '已发生事件')) rememberEventObject(op.value.已发生事件);
          else if (parts[1] === '已发生事件') {
            if (parts.length === 2) rememberEventObject(op.value);
            else if (parts.length === 3) rememberEvent(parts[2], object(op.value) ? op.value.结果 : null);
            else if (parts.length === 4 && parts[3] === '结果') rememberEvent(parts[2], op.value);
          }
        }
      } catch (_) { /* 无原始结构化依据时，不开放已保存事件补奖。 */ }
    }
    // identity 已绑定同一 MVU 块；终端保存的主 ENDED.previous 可补充脚本重载后缺失的记录。
    const storyBefore = storyReceipt(source)?.before || storyPoint(identity.storyBefore);
    repairSession = { content: wrapped, source: { ...source, repairEventKeys, relationshipCorrection: true,
      storyCorrection: true, storyBefore, flexibleRepair: true }, claimed: false };
    try { return await Mvu.parseMessage(wrapped, cloneState(data)); }
    finally { repairSession = null; }
  }
  // 只以完整、唯一的 MVU 块确认来源；生图、正文修饰与块外内容不参与校验。
  function replyMvuBlock(content) {
    if (typeof content !== 'string') return '';
    const text = content.replace(/\r\n?/g, '\n');
    if ((text.match(/<UpdateVariable>/gi) || []).length !== 1 ||
        (text.match(/<\/UpdateVariable>/gi) || []).length !== 1) return '';
    const block = text.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i)?.[0];
    if (!block || (block.match(/<JSONPatch>/gi) || []).length !== 1 ||
        (block.match(/<\/JSONPatch>/gi) || []).length !== 1) return '';
    const patch = block.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
    try { return patch && Array.isArray(JSON.parse(patch[1].trim())) ? block : ''; }
    catch (_) { return ''; }
  }
  function replyContext() {
    const ctx = H.SillyTavern?.getContext();
    if (ctx?.chatId === undefined || ctx.chatId === null || ctx.chatId === '' ||
        !Array.isArray(ctx.chat) || !ctx.chat.length) return null;
    return ctx;
  }
  function replyOwner() {
    const owner = typeof window.getChatMessages === 'function' ? window : window.TavernHelper;
    return typeof owner?.getChatMessages === 'function' ? owner : null;
  }
  function readReply(ctx, owner, messageId) {
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= ctx.chat.length) return null;
    // 当前 mes 才是宿主正在保存的正文；swipes 数组可能稍后才更新，仅用它读取页号。
    const active = owner.getChatMessages(String(messageId), { role: 'assistant' })?.[0];
    const page = owner.getChatMessages(String(messageId), { role: 'assistant', include_swipes: true })?.[0];
    if (active?.message_id !== messageId || page?.message_id !== messageId || !Number.isInteger(page.swipe_id)) return null;
    const block = replyMvuBlock(active.message), messageRef = ctx.chat[messageId];
    if (!block || !messageRef) return null;
    return { chatId: ctx.chatId, characterId: ctx.characterId, groupId: ctx.groupId,
      messageId, swipeId: page.swipe_id, chatRef: ctx.chat, messageRef, text: block,
      key: JSON.stringify([ctx.characterId ?? null, ctx.groupId ?? null, ctx.chatId, messageId, page.swipe_id]) };
  }
  // 副补丁和 ENDED 均绑定同一聊天、楼层与回复页，不能借用其他页的同文块。
  function locateBoundReply(content, identity) {
    const block = replyMvuBlock(content), ctx = replyContext(), owner = replyOwner();
    if (!block || !ctx || !owner || !identity || identity.chatRef !== ctx.chat ||
        identity.chatId !== ctx.chatId || (identity.characterId ?? null) !== (ctx.characterId ?? null) ||
        (identity.groupId ?? null) !== (ctx.groupId ?? null)) return null;
    const source = readReply(ctx, owner, identity.messageId);
    return source && source.messageRef === identity.messageRef && source.swipeId === identity.swipeId &&
      source.text === block ? source : null;
  }
  // COMMAND_PARSED 未给楼层，只能接受唯一匹配；多轮常见的空补丁不能擅自归到最新页。
  // 额度键仍仅含真实回复身份，正文编辑或后台校正不会获得新额度。
  function locateReply(content) {
    const block = replyMvuBlock(content), ctx = replyContext(), owner = replyOwner();
    if (!block || !ctx || !owner) return null;
    const messages = owner.getChatMessages(`0-${ctx.chat.length - 1}`, { role: 'assistant' });
    if (!Array.isArray(messages)) return null;
    const matches = messages.filter(message => Number.isInteger(message.message_id) && replyMvuBlock(message.message) === block);
    if (matches.length !== 1) return null;
    const source = readReply(ctx, owner, matches[0].message_id);
    return source?.text === block ? source : null;
  }
  // 识别“这次是否提交了依据”，而非要求依据换一句话。仅解析数据，不执行文本。
  function relationshipSubmissions(content) {
    const blocks = [...replyMvuBlock(content).matchAll(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/gi)];
    if (blocks.length !== 1) return [];
    try {
      const operations = JSON.parse(blocks[0][1].trim());
      if (!Array.isArray(operations)) return [];
      const fields = [];
      for (const op of operations) {
        if (!op || !['add', 'replace'].includes(op.op) || typeof op.path !== 'string') continue;
        const parts = op.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (parts[0] !== '人际' || !parts[1] || ['__proto__', 'prototype', 'constructor'].includes(parts[1])) continue;
        for (const field of ['变化依据', '好感突破依据', '好感', '支援度']) {
          const value = parts.length === 3 && parts[2] === field ? op.value :
            parts.length === 2 && op.value && Object.hasOwn(op.value, field) ? op.value[field] : undefined;
          const score = ['好感', '支援度'].includes(field);
          if (score && (typeof value === 'number' && Number.isFinite(value) || value === null)) fields.push([JSON.stringify([parts[1], field]), value]);
          else if (!score && typeof value === 'string' && value.trim()) fields.push([JSON.stringify([parts[1], field]), value.trim()]);
        }
      }
      return fields;
    } catch (_) { return []; }
  }
  const commandListener = Mvu.events.COMMAND_PARSED ? eventOn(Mvu.events.COMMAND_PARSED, (variables, commands, content) => {
    if (!variables || typeof variables !== 'object') return;
    parsingSources.delete(variables);
    try {
      let source = locateReply(content);
      if (repairSession && !repairSession.claimed && content === repairSession.content) {
        source = repairSession.source;
        repairSession.claimed = true;
      }
      if (source) parsingSources.set(variables, { ...source, submittedFields: relationshipSubmissions(content) });
    } catch (_) { /* 归属不明只保留本次计分与成长的旧值，其他事实字段仍可更新。 */ }
  }) : null;
  const listener = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
    let changed;
    let scoreNotices = [];
    let contactChanges = [];
    let growthNotices = [];
    const internal = variables?.stat_data?.$internal;
    function rollback() {
      variables.stat_data = cloneState(previous.stat_data);
      if (internal !== undefined) variables.stat_data.$internal = internal;
    }
    try {
      const source = parsingSources.get(variables);
      parsingSources.delete(variables);
      let replyKey = '';
      if (source) {
        try {
          const now = locateBoundReply(source.text, source);
          if (now && now.chatRef === source.chatRef && now.messageRef === source.messageRef &&
              now.key === source.key && now.text === source.text) replyKey = source.key;
        } catch (_) {}
      }
      const flexibleRepair = Boolean(replyKey && source?.flexibleRepair === true);
      changed = enforceStateOwnership(variables, previous, { replyKey, flexibleRepair,
        storyCorrection: source?.storyCorrection === true, storyBefore: source?.storyBefore });
      scoreNotices = enforceRelationshipScores(variables, previous, { replyKey, submittedFields: source?.submittedFields || [],
        relationshipCorrection: Boolean(replyKey && source?.relationshipCorrection === true), flexibleRepair });
      contactChanges = enforceRelationshipContact(variables, previous, { replyKey, flexibleRepair });
      const scoreReceiptChanged = stateKey(variables.stat_data?.系统?.关系计分) !== stateKey(previous.stat_data?.系统?.关系计分);
      growthNotices = enforceGrowthProgress(variables, previous, { replyKey, repairEventKeys: replyKey ? source.repairEventKeys || [] : [], flexibleRepair });
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
    if (growthNotices.length) {
      const message = growthNotices.map(item => item.path + '：' + item.message).join('\n');
      console.info('[落第 MVU v4 成长结算] ' + message);
      if (typeof toastr !== 'undefined') toastr.info(message, '成长结算');
    }
  });
  const marker = { version: '4.0.0', automaticStoryProgress: true, scheduleAndRoster: true, rosterPermanentRemoval: true, contactBaseline: 'C02', relationshipScoring: RELATIONSHIP_SCORING.version, growth: GROWTH_RULES.version, repair: 'P02', repairSource: 'MVU01', storyRepair: 'S01', flexibleRepair: 'F01', parseRepair };
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
