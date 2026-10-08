import { GROWTH_AXES } from '../世界书规则/MVU/schema.mjs';

// 主约束与可选成长脚本共用真实回复来源；不读聊天级变量、不保存聊天。
export function replyMvuBlock(content) {
  if (typeof content !== 'string') return '';
  const text = content.replace(/\r\n?/g, '\n');
  if ((text.match(/<UpdateVariable>/gi) || []).length !== 1 ||
      (text.match(/<\/UpdateVariable>/gi) || []).length !== 1) return '';
  const block = text.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i)?.[0];
  if (!block || (block.match(/<json_?patch>/gi) || []).length !== 1 ||
      (block.match(/<\/json_?patch>/gi) || []).length !== 1) return '';
  const patch = block.match(/<(json_?patch)>([\s\S]*?)<\/\1>/i);
  try { return patch && Array.isArray(JSON.parse(patch[2].trim())) ? block : ''; }
  catch (_) { return ''; }
}

// 副修复由调用方明确绑定真实回复；无有效主补丁时保留正文作为来源。
// MVU 自动追加的末尾显示占位符不是剧情编辑，不应让同一回复的修复过期。
export function repairReplyText(content) {
  if (typeof content !== 'string') return '';
  return replyMvuBlock(content) || content.replace(/\r\n?/g, '\n')
    .replace(/(?:\s*<StatusPlaceHolderImpl\s*\/>)+\s*$/i, '').trim();
}

function replyPatchOperations(content) {
  const block = replyMvuBlock(content), patch = block.match(/<(json_?patch)>([\s\S]*?)<\/\1>/i);
  try { return patch ? JSON.parse(patch[2].trim()) : []; }
  catch (_) { return []; }
}

function replyPatchParts(op) {
  if (!op || !['add', 'replace'].includes(op.op) || typeof op.path !== 'string' ||
      !op.path.startsWith('/') || /~(?![01])/.test(op.path)) return null;
  const parts = op.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  return parts.some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part)) ? null : parts;
}

// 明确提交的最终数值支持叶字段与父对象写法；奖励重放不能再次加分。
export function submittedFinals(content) {
  const fields = [], growthFinalAxes = new Set(), growthGradeAxes = new Set();
  function inspect(parts, value) {
    if (parts[0] === '人际' && parts.length === 3 && ['好感', '支援度'].includes(parts[2]) &&
        (typeof value === 'number' && Number.isFinite(value) || value === null)) fields.push([JSON.stringify([parts[1], parts[2]]), value]);
    if (parts.length === 4 && parts[0] === '玩家' && parts[1] === '成长' && parts[2] === '经验' && GROWTH_AXES.includes(parts[3])) growthFinalAxes.add(parts[3]);
    if (parts.length === 3 && parts[0] === '玩家' && parts[1] === '六维' && GROWTH_AXES.includes(parts[2])) growthGradeAxes.add(parts[2]);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) if (!['__proto__', 'prototype', 'constructor'].includes(key)) inspect([...parts, key], child);
  }
  for (const op of replyPatchOperations(content)) {
    const parts = replyPatchParts(op);
    if (parts) inspect(parts, op.value);
  }
  return { fields, growthFinalAxes: [...growthFinalAxes], growthGradeAxes: [...growthGradeAxes] };
}

// 副补丁只能补领真实正文已提交且已经保存的本轮事件，不凭副模型自称认来源。
export function savedReplyEventKeys(content, state) {
  const keys = [], events = state?.场景?.已发生事件;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function remember(name, result) {
    if (typeof name !== 'string' || !name || /[~/]/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name) ||
        typeof result !== 'string' || !result.trim() || !object(events) || !Object.hasOwn(events, name) ||
        result !== events[name]?.结果 || keys.includes(name)) return;
    keys.push(name);
  }
  function rememberObject(value) {
    if (object(value)) for (const [name, event] of Object.entries(value)) {
      if (object(event) && Object.hasOwn(event, '结果')) remember(name, event.结果);
    }
  }
  for (const op of replyPatchOperations(content)) {
    const parts = replyPatchParts(op);
    if (!parts || parts[0] !== '场景') continue;
    if (parts.length === 1 && object(op.value) && Object.hasOwn(op.value, '已发生事件')) rememberObject(op.value.已发生事件);
    else if (parts[1] === '已发生事件') {
      if (parts.length === 2) rememberObject(op.value);
      else if (parts.length === 3) remember(parts[2], object(op.value) ? op.value.结果 : null);
      else if (parts.length === 4 && parts[3] === '结果') remember(parts[2], op.value);
    }
  }
  return keys;
}

export function createRakudaiMvuReplySource(W, { mvu = W.Mvu, enrichRepairSource = source => source,
  assertRepairAvailable = () => {} } = {}) {
  const H = (function() {
    for (const resolve of [() => W.top, () => W.parent, () => W]) {
      try { const scope = resolve(); if (scope?.SillyTavern?.getContext) return scope; } catch (_) {}
    }
    return W;
  })();
  const parsingSources = new WeakMap();
  let repairSession = null;
  function replyContext() {
    const ctx = H.SillyTavern?.getContext();
    return ctx?.chatId !== undefined && ctx.chatId !== null && ctx.chatId !== '' &&
      Array.isArray(ctx.chat) && ctx.chat.length ? ctx : null;
  }
  function replyOwner() {
    const owner = typeof W.getChatMessages === 'function' ? W : W.TavernHelper;
    return typeof owner?.getChatMessages === 'function' ? owner : null;
  }
  function readReply(ctx, owner, messageId, repairBound = false) {
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= ctx.chat.length) return null;
    // mes 是宿主正在保存的正文，swipes 可能稍后更新；它仅提供当前页号。
    const active = owner.getChatMessages(String(messageId), { role: 'assistant' })?.[0];
    const page = owner.getChatMessages(String(messageId), { role: 'assistant', include_swipes: true })?.[0];
    if (active?.message_id !== messageId || page?.message_id !== messageId || !Number.isInteger(page.swipe_id)) return null;
    const block = repairBound ? repairReplyText(active.message) : replyMvuBlock(active.message), messageRef = ctx.chat[messageId];
    if (!block || !messageRef) return null;
    return { chatId: ctx.chatId, characterId: ctx.characterId, groupId: ctx.groupId,
      messageId, swipeId: page.swipe_id, chatRef: ctx.chat, messageRef, text: block,
      ...(repairBound ? { repairBound: true } : {}),
      key: JSON.stringify([ctx.characterId ?? null, ctx.groupId ?? null, ctx.chatId, messageId, page.swipe_id]) };
  }
  function locateBoundReply(content, identity) {
    const block = replyMvuBlock(content), ctx = replyContext(), owner = replyOwner();
    if (!block || !ctx || !owner || !identity || identity.chatRef !== ctx.chat ||
        identity.chatId !== ctx.chatId || (identity.characterId ?? null) !== (ctx.characterId ?? null) ||
        (identity.groupId ?? null) !== (ctx.groupId ?? null)) return null;
    const source = readReply(ctx, owner, identity.messageId);
    return source && source.messageRef === identity.messageRef && source.swipeId === identity.swipeId &&
      source.text === block ? source : null;
  }
  function locateRepairReply(content, identity) {
    const text = repairReplyText(content), ctx = replyContext(), owner = replyOwner();
    if (!text || !ctx || !owner || !identity || typeof identity !== 'object' || Array.isArray(identity) ||
        !Number.isSafeInteger(identity.messageId) || identity.messageId < 0 ||
        !Number.isSafeInteger(identity.swipeId) || identity.swipeId < 0 ||
        identity.chatRef !== ctx.chat || identity.chatId !== ctx.chatId ||
        (identity.characterId ?? null) !== (ctx.characterId ?? null) ||
        (identity.groupId ?? null) !== (ctx.groupId ?? null)) return null;
    const source = readReply(ctx, owner, identity.messageId, true);
    return source && source.messageRef === identity.messageRef && source.swipeId === identity.swipeId &&
      source.text === text ? source : null;
  }
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
  function capture(variables, content) {
    if (!variables || typeof variables !== 'object') return;
    parsingSources.delete(variables);
    try {
      let source = locateReply(content);
      if (repairSession && !repairSession.claimed && content === repairSession.content) {
        source = repairSession.source;
        repairSession.claimed = true;
      }
      if (source) {
        const finals = submittedFinals(content);
        parsingSources.set(variables, { ...source, submittedFields: finals.fields,
          growthFinalAxes: finals.growthFinalAxes, growthGradeAxes: finals.growthGradeAxes });
      }
    } catch (_) { /* 无真实身份则不给本轮额度，保留其他事实更新。 */ }
  }
  function take(variables) {
    const source = parsingSources.get(variables);
    parsingSources.delete(variables);
    let replyKey = '';
    if (source) {
      try {
        const now = source.repairBound ? locateRepairReply(source.text, source) : locateBoundReply(source.text, source);
        if (now && now.key === source.key) replyKey = source.key;
      } catch (_) {}
    }
    return { source, replyKey };
  }
  async function parseRepair(content, data, sourceText, identity) {
    assertRepairAvailable();
    if (repairSession) throw new Error('已有副 API 补丁正在解析。');
    try { if (!Array.isArray(JSON.parse(content))) throw new Error(); }
    catch (_) { throw new Error('副 API 补丁必须是完整的 JSON 数组，未解析。'); }
    const source = locateRepairReply(sourceText, identity);
    if (!source) throw new Error('无法唯一确认补丁对应的助手回复，未解析。');
    const nonce = Math.random().toString(36).slice(2);
    const wrapped = '<UpdateVariable><Analysis>repair:' + nonce + '</Analysis><JSONPatch>' +
      content + '</JSONPatch></UpdateVariable>';
    repairSession = { content: wrapped, source: enrichRepairSource({ ...source,
      repairEventKeys: savedReplyEventKeys(source.text, data.stat_data), flexibleRepair: true }, identity), claimed: false };
    try {
      const result = await mvu.parseMessage(wrapped, structuredClone(data));
      assertRepairAvailable();
      if (!locateRepairReply(source.text, source)) throw new Error('聊天、回复页或 MVU 来源已变化，未采用补丁。');
      return result;
    } finally { repairSession = null; }
  }
  return { host: H, capture, take, locateReply, locateBoundReply, locateRepairReply, parseRepair };
}
