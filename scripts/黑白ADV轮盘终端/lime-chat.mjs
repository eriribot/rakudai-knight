// LIME messages are explicit text in native chat floors, never inferred from narration or MVU.
// This service has no storage, host API, generation, DOM, or cross-chat cache.
export function createLimeChatProtocol() {
  const limits = Object.freeze({
    contactLength: 100, messageLength: 4000, sourceLength: 200000,
    blockLength: 24000, blocksPerFloor: 32, messagesPerBlock: 24,
    nativeFloors: 10000, records: 4096,
  });
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keysAre = (value, keys) => object(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  function contactName(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim();
    return name && name.length <= limits.contactLength && !/[\u0000-\u001f\u007f-\u009f]/u.test(name) ? name : null;
  }
  function messageText(value) {
    if (typeof value !== 'string' || value.length > limits.messageLength || /\u0000/u.test(value)) return null;
    const text = value.replace(/\r\n?/g, '\n').trim();
    return text || null;
  }
  function parseLimeMessages(text, options = {}) {
    const role = options.role;
    if (!['user', 'assistant'].includes(role) || typeof text !== 'string' || text.length > limits.sourceLength) return [];
    const playerName = contactName(options.playerName);
    const result = [];
    let blocks = 0;
    for (const match of text.matchAll(/<LIME>\s*([\s\S]*?)\s*<\/LIME>/g)) {
      if (++blocks > limits.blocksPerFloor) break;
      if (match[1].length > limits.blockLength || match[1].includes('<LIME>')) continue;
      let block;
      try { block = JSON.parse(match[1]); } catch (_) { continue; }
      if (!keysAre(block, ['对象', '消息'])) continue;
      const contact = contactName(block.对象);
      if (!contact || contact === '玩家' || contact === playerName || !Array.isArray(block.消息) ||
        !block.消息.length || block.消息.length > limits.messagesPerBlock) continue;
      const records = [];
      let valid = true;
      for (const item of block.消息) {
        if (!keysAre(item, ['发言人', '内容'])) { valid = false; break; }
        const speaker = contactName(item.发言人), content = messageText(item.内容);
        const sender = speaker === '玩家' || playerName && speaker === playerName ? 'player' : speaker === contact ? 'contact' : null;
        // A native user floor cannot forge incoming mail; an assistant floor cannot forge a player action.
        if (!content || sender !== (role === 'user' ? 'player' : 'contact')) { valid = false; break; }
        records.push({ contact, sender, text: content });
      }
      if (valid) result.push(...records);
    }
    return result;
  }
  function activeText(message) {
    // getChatMessages(include_swipes:true) supplies every page: select exactly the active one.
    if (Object.prototype.hasOwnProperty.call(message, 'swipes')) {
      if (!Array.isArray(message.swipes) || !Number.isInteger(message.swipe_id) || message.swipe_id < 0 ||
        message.swipe_id >= message.swipes.length || typeof message.swipes[message.swipe_id] !== 'string') return null;
      return { text: message.swipes[message.swipe_id], swipeId: message.swipe_id };
    }
    // A normalized Helper record without swipes exposes its current page as message.
    const swipeId = message.swipe_id === undefined ? 0 : message.swipe_id;
    if (!Number.isInteger(swipeId) || swipeId < 0 || typeof message.message !== 'string') return null;
    return { text: message.message, swipeId };
  }
  function activeData(message, swipeId) {
    // An explicit swipe array is authoritative; never borrow the current data mirror for another page.
    return Object.prototype.hasOwnProperty.call(message, 'swipes_data') ?
      (Array.isArray(message.swipes_data) && object(message.swipes_data[swipeId]) ? message.swipes_data[swipeId] : {}) :
      (object(message.data) ? message.data : {});
  }
  function storyTime(data) {
    const time = data?.stat_data?.场景?.时间;
    return typeof time === 'string' && time.length <= 256 ? time.trim() : '';
  }
  function ownedStore(data, messageId, swipeId) {
    const store = data && data.rk_lime;
    return object(store) && store.version === 1 && object(store.owner) &&
      store.owner.messageId === messageId && store.owner.swipeId === swipeId ? store : null;
  }
  function narrativeSnapshot(data, messageId, swipeId, strict = false) {
    const store = ownedStore(data, messageId, swipeId);
    if (!store || !Object.prototype.hasOwnProperty.call(store, 'narrative')) return null;
    const snapshot = store.narrative;
    const invalid = !Array.isArray(snapshot) || snapshot.length > limits.blocksPerFloor * limits.messagesPerBlock ||
      snapshot.some(item => !keysAre(item, ['contact', 'text', 'time']) || !contactName(item.contact) ||
        !messageText(item.text) || typeof item.time !== 'string' || item.time.length > 256) ||
      snapshot.reduce((size, item) => size + item.text.length, 0) > limits.sourceLength;
    if (invalid) {
      if (strict) throw new Error('当前页的 LIME 正文时间记录损坏或超限；没有覆盖记录。');
      return null;
    }
    return snapshot.map(item => ({ contact: contactName(item.contact), text: messageText(item.text), time: item.time.trim() }));
  }
  function captureNarrative(data, messageId, swipeId, text) {
    if (typeof text !== 'string' || text.length > limits.sourceLength ||
      Array.from(text.matchAll(/<LIME>\s*([\s\S]*?)\s*<\/LIME>/g)).length > limits.blocksPerFloor) {
      throw new Error('当前页正文超过 LIME 时间记录的读取范围；没有截断或覆盖记录。');
    }
    const previous = narrativeSnapshot(data, messageId, swipeId, true), time = storyTime(data);
    return parseLimeMessages(text, { role: 'assistant' }).map((item, index) => {
      const old = previous && previous[index];
      return { contact: item.contact, text: item.text,
        time: old && old.contact === item.contact && old.text === item.text ? old.time : time };
    });
  }
  function attachmentExchanges(data, messageId, swipeId) {
    const store = ownedStore(data, messageId, swipeId);
    if (!store ||
      !Array.isArray(store.exchanges) || store.exchanges.length > limits.records) return [];
    const ids = new Set(), result = [];
    for (const item of store.exchanges) {
      if (!object(item) || typeof item.id !== 'string' || !item.id || item.id.length > 160 || ids.has(item.id) ||
        !contactName(item.contact) || !messageText(item.player) || typeof item.time !== 'string' || item.time.length > 256 ||
        !Array.isArray(item.reply) || item.reply.length > limits.messagesPerBlock || item.reply.some(text => !messageText(text))) return [];
      if (Object.prototype.hasOwnProperty.call(item, 'narrativeCount') && (!Number.isInteger(item.narrativeCount) ||
        item.narrativeCount < 0 || item.narrativeCount > limits.blocksPerFloor * limits.messagesPerBlock)) return [];
      ids.add(item.id);
      result.push({ id: item.id, contact: contactName(item.contact), time: item.time.trim(),
        player: messageText(item.player), reply: item.reply.map(messageText),
        ...(Object.prototype.hasOwnProperty.call(item, 'narrativeCount') ? { narrativeCount: item.narrativeCount } : {}) });
    }
    return result;
  }
  function readLimeThreads(messages, options = {}) {
    if (!Array.isArray(messages) || messages.length > limits.nativeFloors) return [];
    if (options.maxMessageId !== undefined && (!Number.isInteger(options.maxMessageId) || options.maxMessageId < -1)) return [];
    const currentBranch = messages.filter(message => object(message) && Number.isInteger(message.message_id) && message.message_id >= 0 &&
      ['user', 'assistant'].includes(message.role))
      .slice().sort((left, right) => left.message_id - right.message_id);
    // Locate the streaming floor before the optional completed-floor cutoff, avoiding double exclusion.
    const streamingId = options.generating === true && currentBranch.at(-1)?.role === 'assistant' ? currentBranch.at(-1).message_id : null;
    const floors = currentBranch.filter(message => options.maxMessageId === undefined || message.message_id <= options.maxMessageId);
    const counts = new Map();
    for (const message of floors) counts.set(message.message_id, (counts.get(message.message_id) || 0) + 1);
    // Duplicate floor identities are ambiguous; never choose one swipe or message by array order.
    if (Array.from(counts.values()).some(count => count !== 1)) return [];
    const records = [];
    let turn = 0;
    for (const message of floors) {
      if (message.role === 'user') turn++;
      const current = activeText(message);
      if (!current) continue;
      const data = activeData(message, current.swipeId), time = storyTime(data);
      const parsed = parseLimeMessages(current.text, { role: message.role, playerName: options.playerName });
      const snapshot = message.role === 'assistant' ? narrativeSnapshot(data, message.message_id, current.swipeId) : null;
      const exchanges = message.role === 'assistant' ? attachmentExchanges(data, message.message_id, current.swipeId) : [];
      const boundaries = new Map();
      for (const exchange of exchanges) {
        // Legacy exchanges had no boundary: preserve their previous placement after all narrative mail.
        const boundary = Number.isInteger(exchange.narrativeCount) ? Math.min(exchange.narrativeCount, parsed.length) : parsed.length;
        if (!boundaries.has(boundary)) boundaries.set(boundary, []);
        boundaries.get(boundary).push(exchange);
      }
      for (let index = 0; index <= parsed.length; index++) {
        for (const exchange of boundaries.get(index) || []) {
          const texts = [{ sender: 'player', text: exchange.player }, ...exchange.reply.map(text => ({ sender: 'contact', text }))];
          for (const item of texts) {
            if (records.length >= limits.records) return records;
            records.push({ ...item, contact: exchange.contact, messageId: message.message_id,
              swipeId: current.swipeId, turn, time: exchange.time, origin: 'attachment', exchangeId: exchange.id });
          }
        }
        if (index === parsed.length) continue;
        const item = parsed[index], old = snapshot && snapshot[index];
        const saved = old && old.contact === item.contact && old.text === item.text;
        // Same-page continue may stream new mail while old, verified mail and attachments remain visible.
        if (message.message_id === streamingId && !saved) continue;
        if (records.length >= limits.records) return records;
        records.push({ ...item, messageId: message.message_id, swipeId: current.swipeId, turn,
          time: saved ? old.time : time, origin: 'narrative' });
      }
    }
    return records;
  }
  function buildLimeUserMessage(name, text) {
    const contact = contactName(name), content = messageText(text);
    if (!contact || contact === '玩家') throw new Error('请选择有效的 LIME 收信者。');
    if (!content) throw new Error('LIME 讯息须为非空文字，且不超过 ' + limits.messageLength + ' 字符。');
    // Escape tag delimiters inside JSON values so user text cannot prematurely close its block.
    const block = JSON.stringify({ 对象: contact, 消息: [{ 发言人: '玩家', 内容: content }] })
      .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return '本次是附于当前剧情的 LIME 通讯。依据本局上下文、指定人物档案和当前关系扮演收信者。只输出一个闭合的 LIME JSON 块，发言人仅为对象本人；没有实际回信时消息数组可为空。不要输出正文、UpdateVariable 或 JSONPatch，不推进剧情时间，不追加玩家行动，不虚构在线、已读或送达，不循环请求。\n\n<LIME>\n' + block + '\n</LIME>';
  }
  function parseLimeReply(text, name) {
    if (typeof text !== 'string' || text.length > limits.sourceLength) throw new Error('通讯回复不是受支持的文字。');
    const match = text.trim().match(/^<LIME>\s*([\s\S]*?)\s*<\/LIME>$/);
    if (!match || match[1].length > limits.blockLength) throw new Error('通讯回复须为单个 LIME JSON 块；没有写入记录。');
    let block;
    try { block = JSON.parse(match[1]); } catch (_) { throw new Error('通讯回复 JSON 不完整；没有写入记录。'); }
    if (!keysAre(block, ['对象', '消息']) || block.对象 !== name || !Array.isArray(block.消息) || block.消息.length > limits.messagesPerBlock) {
      throw new Error('通讯回复对象或格式不匹配；没有写入记录。');
    }
    if (!block.消息.length) return [];
    const parsed = parseLimeMessages(text.trim(), { role: 'assistant' });
    if (parsed.length !== block.消息.length || parsed.some(item => item.contact !== name)) throw new Error('通讯回复包含错误的发言人；没有写入记录。');
    return parsed.map(item => item.text);
  }
  function buildAttachmentContext(messages, options = {}) {
    const records = readLimeThreads(messages, options).filter(record => record.origin === 'attachment');
    // Bounded recent memory; no model-written summaries or hidden scoring changes.
    let selected = [], size = 2;
    for (const record of records.slice(-80).reverse()) {
      const item = { 楼层: record.messageId, 时间: record.time || '时间未记录', 对象: record.contact,
        发言人: record.sender === 'player' ? '玩家' : record.contact, 内容: record.text };
      const length = JSON.stringify(item).length + 1;
      if (size + length > 32000) break;
      selected.unshift(item); size += length;
    }
    return selected.length ? JSON.stringify(selected) : '';
  }
  function applyNarrativePrompt(messages, context) {
    if (!Array.isArray(messages) || typeof context !== 'string' || context.length > 32000) return false;
    const marker = '[rk-lime:attached-context:v1]\n';
    // Only replace this feature's own system prompt in the final request copy.
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'system' && typeof messages[i].content === 'string' && messages[i].content.startsWith(marker)) messages.splice(i, 1);
    }
    const content = marker + 'LIME 是剧情楼层附带通讯。下列为当前分支真实已记录的近期通讯，不是新玩家行动，不重复执行已做的事；关系变化仅在本轮有实际依据时按原有 MVU 规则结算，不能因为回看聊天重复加分。正文可以在合适情境自然收到已建立联系人物的消息，不要求每轮来信；人物口吻遵循其世界书档案、当前关系和剧情认知。仅当本轮实际收到信息时附加闭合的 <LIME>{"对象":"人物全名","消息":[{"发言人":"人物全名","内容":"实际来信"}]}</LIME>，每个对象单独一块；不代写玩家发信，不写在线/已读/送达。消息显示时间取本楼 MVU 的场景.时间，不在 LIME JSON 里自造时钟。正常输出正文与 MVU 更新。\n近期附带通讯：\n' + (context || '暂无');
    const lastUser = messages.findLastIndex(message => message?.role === 'user');
    messages.splice(lastUser < 0 ? messages.length : lastUser, 0, { role: 'system', content });
    return true;
  }
  return Object.freeze({ limits, parseLimeMessages, readLimeThreads, buildLimeUserMessage,
    activeData, storyTime, attachmentExchanges, captureNarrative, parseLimeReply, buildAttachmentContext, applyNarrativePrompt });
}

const defaultLimeChatService = createLimeChatProtocol();
export const parseLimeMessages = defaultLimeChatService.parseLimeMessages;
export const readLimeThreads = defaultLimeChatService.readLimeThreads;
export const buildLimeUserMessage = defaultLimeChatService.buildLimeUserMessage;
