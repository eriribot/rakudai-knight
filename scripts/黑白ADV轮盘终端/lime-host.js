/* LIME saves auxiliary exchanges on the owning assistant swipe, without native floors.
 * API authority: pinned Tavern Helper 4.8.19 (36d8889), checked against 4.11.3.
 * getChatMessages/setChatMessages data-only, generate, managed injectPrompts disposer.
 * Persistence is Helper's debounced chat save; readback confirms memory, not disk.
 */
function createLimeHostService(options) {
  'use strict';
  options = options || {};
  var protocol = options.protocol;
  var sourceKeys = ['chatId', 'characterId', 'groupId', 'messageId', 'swipeId', 'swipeCount'];
  var currentTask = null, sequence = 0;
  var witnessedScope = null, witnesses = [], rebindPending = 0, rebindChain = Promise.resolve();
  var timeoutMs = Math.min(120000, Math.max(10, Number(options.timeoutMs) || 120000));
  var setTimer = options.setTimeout || setTimeout, clearTimer = options.clearTimeout || clearTimeout;
  var transport = 'tavern-helper-floor-attachment';

  function fail(code, message, details) {
    var error = new Error(message); error.code = code;
    if (details) Object.keys(details).forEach(function(key) { error[key] = details[key]; });
    throw error;
  }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function copy(value) { return structuredClone(value); }
  function alive() {
    if (options.isDestroyed && options.isDestroyed()) fail('DESTROYED', '终端已关闭；LIME 草稿保留，请重新打开。');
  }
  function context() {
    alive();
    var ctx = typeof options.getContext === 'function' ? options.getContext() : null;
    if (!ctx || !Array.isArray(ctx.chat)) fail('CONTEXT_UNAVAILABLE', '当前酒馆聊天尚未就绪。');
    return ctx;
  }
  function identity(ctx) {
    var chatId = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
    return { chatId: chatId == null ? null : chatId, characterId: ctx.characterId == null ? null : ctx.characterId,
      groupId: ctx.groupId == null ? null : ctx.groupId };
  }
  function sameIdentity(left, right) {
    return left && right && ['chatId', 'characterId', 'groupId'].every(function(key) { return left[key] === right[key]; });
  }
  function sourceCopy(source) {
    var result = {};
    sourceKeys.forEach(function(key) { result[key] = source && source[key] != null ? source[key] : null; });
    return result;
  }
  function sameSource(left, right) {
    return left && right && sourceKeys.every(function(key) { return left[key] === right[key]; });
  }
  function nativeGenerating(ctx) {
    return !!((options.isGenerating && options.isGenerating()) || (typeof ctx.isGenerating === 'function' && ctx.isGenerating()));
  }
  function snapshot() {
    var value = typeof options.getSnapshot === 'function' ? options.getSnapshot() : null;
    if (!value || !value.source || !object(value.state)) fail('SNAPSHOT_UNAVAILABLE', '当前剧情的 MVU 状态尚未就绪。');
    return value;
  }
  function messages(ctx) {
    if (typeof options.getMessages !== 'function') fail('MESSAGES_UNAVAILABLE', '酒馆助手的消息读取接口尚未就绪。');
    var result = ctx.chat.length ? options.getMessages('0-' + (ctx.chat.length - 1), { include_swipes: true }) : [];
    if (!Array.isArray(result)) fail('MESSAGE_FORMAT', '当前聊天消息的返回格式不受支持。');
    return result;
  }
  function requireProtocol() {
    if (!protocol || ['activeData', 'storyTime', 'attachmentExchanges', 'buildAttachmentContext', 'parseLimeReply',
      'buildLimeUserMessage', 'captureNarrative'].some(function(key) { return typeof protocol[key] !== 'function'; })) {
      fail('PROTOCOL_UNAVAILABLE', 'LIME 附属消息协议尚未就绪。');
    }
  }
  function read() {
    var ctx = context(), snap = snapshot(), all = messages(ctx);
    if (!sameIdentity(identity(ctx), snap.source) || context().chat !== ctx.chat) {
      fail('SOURCE_CONFLICT', '聊天已切换，请重新读取 LIME。');
    }
    seedWitnesses(ctx, all);
    return { messages: visibleMessages(ctx, all), playerName: String(snap.state.玩家 && snap.state.玩家.姓名 || ctx.name1 || '玩家'),
      generating: nativeGenerating(ctx), auxiliaryBusy: !!currentTask || rebindPending > 0,
      source: sourceCopy(snap.source), pending: !!snap.pending || rebindPending > 0 };
  }
  function rawPageData(raw, swipeId) {
    return raw && raw.variables && object(raw.variables[swipeId]) ? raw.variables[swipeId] : null;
  }
  function payloadSignature(store) {
    if (!object(store) || store.version !== 1 || !object(store.owner) || !Number.isInteger(store.owner.messageId) ||
      store.owner.messageId < 0 || !Number.isInteger(store.owner.swipeId) || store.owner.swipeId < 0 ||
      !Array.isArray(store.exchanges) || !store.exchanges.length ||
      protocol.attachmentExchanges({ rk_lime: store }, store.owner.messageId, store.owner.swipeId).length !== store.exchanges.length) return null;
    var payload = copy(store); delete payload.owner;
    return JSON.stringify(payload);
  }
  function cacheScope(ctx) {
    var current = identity(ctx);
    if (!witnessedScope || witnessedScope.chat !== ctx.chat || !sameIdentity(witnessedScope, current)) {
      witnessedScope = Object.assign({ chat: ctx.chat }, current); witnesses = [];
    }
    return witnessedScope;
  }
  function seedWitnesses(ctx, all) {
    requireProtocol(); cacheScope(ctx);
    all.forEach(function(message) {
      var raw = ctx.chat[message.message_id];
      if (!raw || message.role !== 'assistant' || !Array.isArray(message.swipes) || !Array.isArray(message.swipes_data)) return;
      message.swipes.forEach(function(text, swipeId) {
        var data = message.swipes_data[swipeId], rawData = rawPageData(raw, swipeId), store = data && data.rk_lime;
        var signature = payloadSignature(store);
        if (!signature || !rawData || typeof text !== 'string' || store.owner.messageId !== message.message_id || store.owner.swipeId !== swipeId) return;
        var known = witnesses.filter(function(item) { return item.signature === signature; });
        if (known.length) {
          // A matching index after deletion is not new proof. Keep the witnessed object identity.
          known.forEach(function(item) {
            if (item.raw === raw && item.rawData === rawData && !item.retired && !item.ambiguous && !item.unresolved) item.text = text;
          });
          return;
        }
        witnesses.push({ raw: raw, rawData: rawData, signature: signature, text: text, copies: [],
          ambiguous: raw.variables.filter(function(item) { return item === rawData; }).length !== 1,
          messageId: message.message_id, swipeId: swipeId, retired: false, unresolved: false });
      });
    });
    // A different metadata object in the same message is only a proven copy while
    // the witnessed original still exists. Extensions may replace data wrappers.
    var pages = pageDescriptors(ctx, all);
    witnesses.forEach(function(witness) {
      if (witness.retired || !pages.some(function(page) {
        return page.raw === witness.raw && page.rawData === witness.rawData && page.signature === witness.signature;
      })) return;
      pages.forEach(function(page) {
        if (page.raw === witness.raw && page.rawData && page.rawData !== witness.rawData &&
          page.signature === witness.signature && !witness.copies.includes(page.rawData)) witness.copies.push(page.rawData);
      });
    });
  }
  function structure(ctx) {
    return { chat: ctx.chat, identity: identity(ctx), rows: ctx.chat.map(function(raw) {
      return { raw: raw, swipeId: raw.swipe_id, text: JSON.stringify(raw.swipes || [raw.mes]) };
    }) };
  }
  function quarantined(ctx, messageId, swipeId, data) {
    var signature = payloadSignature(data && data.rk_lime);
    if (!signature || !witnessedScope || witnessedScope.chat !== ctx.chat || !sameIdentity(witnessedScope, identity(ctx))) return false;
    var raw = ctx.chat[messageId], rawData = rawPageData(raw, swipeId);
    return witnesses.some(function(witness) {
      return witness.signature === signature && (witness.raw !== raw || witness.retired || witness.ambiguous ||
        witness.unresolved || witness.copies.includes(rawData));
    });
  }
  function visibleMessages(ctx, all) {
    var visible = copy(all);
    visible.forEach(function(message) {
      if (message.role !== 'assistant' || !Array.isArray(message.swipes_data)) return;
      message.swipes_data.forEach(function(data, swipeId) {
        // Hide only our namespace in the returned view. Uncertain stored data stays untouched.
        if (quarantined(ctx, message.message_id, swipeId, data)) delete data.rk_lime;
      });
    });
    return visible;
  }
  function assertStructure(expected) {
    var ctx = context();
    if (nativeGenerating(ctx) || ctx.chat !== expected.chat || !sameIdentity(identity(ctx), expected.identity) ||
      ctx.chat.length !== expected.rows.length || expected.rows.some(function(row, index) {
        return ctx.chat[index] !== row.raw || row.raw.swipe_id !== row.swipeId ||
          JSON.stringify(row.raw.swipes || [row.raw.mes]) !== row.text;
      })) fail('SOURCE_CONFLICT', '修复附属消息归属期间聊天或回复页已变化；停止旧分支写入。');
    return ctx;
  }
  function pageDescriptors(ctx, all) {
    var pages = [];
    all.forEach(function(message) {
      if (message.role !== 'assistant' || !Array.isArray(message.swipes) || !Array.isArray(message.swipes_data)) return;
      message.swipes.forEach(function(text, swipeId) {
        var data = message.swipes_data[swipeId], signature = payloadSignature(data && data.rk_lime);
        if (signature) pages.push({ raw: ctx.chat[message.message_id], rawData: rawPageData(ctx.chat[message.message_id], swipeId),
          messageId: message.message_id, swipeId: swipeId, signature: signature, text: text, store: data.rk_lime });
      });
    });
    return pages;
  }
  async function performRebind() {
    if (currentTask) cancelTask(currentTask, 'CANCELLED', '剧情结构已变化，通讯已取消；草稿保留。');
    var ctx = context(), stats = { rebound: 0, shadowsCleared: 0, skipped: 0 };
    if (!witnessedScope || witnessedScope.chat !== ctx.chat || !sameIdentity(witnessedScope, identity(ctx))) {
      cacheScope(ctx); return stats;
    }
    if (typeof options.setMessages !== 'function') fail('CAPABILITY_UNAVAILABLE', '缺少附属记录归属修复接口。');
    var frozenStructure = structure(ctx);
    // First remove proven clones; a second pass can then uniquely locate the surviving original page.
    for (var pass = 0; pass < 2; pass++) {
      ctx = assertStructure(frozenStructure);
      var pages = pageDescriptors(ctx, messages(ctx)), changes = [];
      witnesses.forEach(function(witness) {
        var samePayload = pages.filter(function(page) { return page.signature === witness.signature; });
        var sameRow = samePayload.filter(function(page) { return page.raw === witness.raw && page.text === witness.text; });
        var original = !witness.retired && !witness.ambiguous && sameRow.length === 1 && sameRow[0].rawData === witness.rawData &&
          ctx.chat.filter(function(raw) { return raw === witness.raw; }).length === 1 ? sameRow[0] : null;
        if (original) witness.unresolved = false;
        else if (samePayload.some(function(page) { return page.raw === witness.raw; })) witness.unresolved = true;
        if (original && (original.store.owner.messageId !== original.messageId || original.store.owner.swipeId !== original.swipeId)) {
          changes.push(Object.assign({ action: 'rebind', witness: witness }, original));
        } else if (!original && sameRow.length) stats.skipped++;
        samePayload.forEach(function(page) {
          // Different raw messages are definite copies. Within the same message,
          // retain unknown replacement wrappers unless a copy was witnessed.
          if (page.raw !== witness.raw || witness.copies.includes(page.rawData) || page.rawData !== witness.rawData &&
            samePayload.some(function(candidate) { return candidate.raw === witness.raw && candidate.rawData === witness.rawData; })) {
            changes.push(Object.assign({ action: 'shadow', witness: witness }, page));
          }
        });
        if (!ctx.chat.includes(witness.raw)) witness.retired = true;
      });
      var rows = new Set(changes.map(function(change) { return change.raw; }));
      for (var raw of rows) {
        ctx = assertStructure(frozenStructure);
        var fresh = messages(ctx), messageId = ctx.chat.indexOf(raw), matching = fresh.filter(function(message) { return message.message_id === messageId; });
        if (messageId < 0 || matching.length !== 1 || !Array.isArray(matching[0].swipes_data)) fail('SOURCE_CONFLICT', '修复页已不存在。');
        var message = matching[0], nextData = copy(message.swipes_data), applied = [];
        var oldRefs = message.swipes.map(function(_, swipeId) { return rawPageData(raw, swipeId); });
        changes.filter(function(change) { return change.raw === raw; }).forEach(function(change) {
          var data = nextData[change.swipeId], signature = payloadSignature(data && data.rk_lime);
          if (signature !== change.signature || rawPageData(raw, change.swipeId) !== change.rawData ||
            message.swipes[change.swipeId] !== change.text) fail('SOURCE_CONFLICT', '附属消息元数据已变化，停止归属修复。');
          if (change.action === 'shadow') { delete data.rk_lime; stats.shadowsCleared++; }
          else {
            data.rk_lime.owner = Object.assign({}, data.rk_lime.owner, { messageId: messageId, swipeId: change.swipeId }); stats.rebound++;
          }
          applied.push(change);
        });
        assertStructure(frozenStructure);
        // Full swipes_data is the documented way to update an inactive page; preserve every other page freshly read.
        await options.setMessages([{ message_id: messageId, swipes_data: nextData }], { refresh: 'none' });
        ctx = assertStructure(frozenStructure);
        var after = messages(ctx).find(function(item) { return item.message_id === messageId; });
        if (!after || applied.some(function(change) {
          var store = after.swipes_data && after.swipes_data[change.swipeId] && after.swipes_data[change.swipeId].rk_lime;
          return change.action === 'shadow' ? store !== undefined : !store || payloadSignature(store) !== change.signature ||
            store.owner.messageId !== messageId || store.owner.swipeId !== change.swipeId;
        })) fail('SAVE_UNCONFIRMED', '归属修复没有回读确认，未将其当作已保存。');
        witnesses.forEach(function(witness) {
          if (witness.raw !== raw || witness.retired) return;
          witness.copies = witness.copies.map(function(reference) {
            var copyIndex = oldRefs.indexOf(reference);
            return copyIndex >= 0 && oldRefs.lastIndexOf(reference) === copyIndex &&
              payloadSignature(after.swipes_data[copyIndex] && after.swipes_data[copyIndex].rk_lime) === witness.signature ?
              rawPageData(raw, copyIndex) : reference;
          });
          var index = oldRefs.indexOf(witness.rawData);
          if (index < 0 || oldRefs.lastIndexOf(witness.rawData) !== index) return;
          var data = after.swipes_data[index];
          if (payloadSignature(data && data.rk_lime) === witness.signature && after.swipes[index] === witness.text) {
            witness.rawData = rawPageData(raw, index); witness.messageId = messageId; witness.swipeId = index;
          }
        });
      }
      if (!changes.length) break;
    }
    return stats;
  }
  function rebindOwners() {
    rebindPending++;
    var work = rebindChain.then(performRebind);
    rebindChain = work.catch(function() {});
    return work.finally(function() { rebindPending--; });
  }
  function pageAt(all, source) {
    var matches = all.filter(function(message) { return message && message.message_id === source.messageId; });
    if (matches.length !== 1) fail('SOURCE_CONFLICT', '当前剧情楼层无法唯一确认。');
    var page = matches[0];
    if (page.role !== 'assistant' || !Number.isInteger(page.swipe_id) || page.swipe_id !== source.swipeId ||
      !Array.isArray(page.swipes) || page.swipes.length !== source.swipeCount ||
      typeof page.swipes[source.swipeId] !== 'string') fail('SOURCE_CONFLICT', '当前助手回复页已改变，请重新确认。');
    return page;
  }
  function validStore(data, source) {
    if (!Object.prototype.hasOwnProperty.call(data, 'rk_lime')) return null;
    var store = data.rk_lime;
    if (!object(store) || !object(store.owner) || !Number.isInteger(store.owner.messageId) || store.owner.messageId < 0 ||
      !Number.isInteger(store.owner.swipeId) || store.owner.swipeId < 0) {
      fail('ATTACHMENT_FORMAT', '当前页的 LIME 附属记录格式损坏；没有覆盖记录。');
    }
    // MVU may copy unknown wrapper fields forward. Such records stay with their actual owner.
    if (store.owner.messageId !== source.messageId || store.owner.swipeId !== source.swipeId) return null;
    if (store.version !== 1 || !Array.isArray(store.exchanges) ||
      protocol.attachmentExchanges(data, source.messageId, source.swipeId).length !== store.exchanges.length) {
      fail('ATTACHMENT_FORMAT', '当前页的 LIME 附属记录格式损坏；没有覆盖记录。');
    }
    if (store.exchanges.length >= (protocol.limits && protocol.limits.records || 4096)) {
      fail('ATTACHMENT_FULL', '当前剧情页的附属记录已满，请继续剧情后再通讯。');
    }
    return store;
  }
  function checkRound(expectedSource, name, frozen) {
    var ctx = context(), snap = snapshot(), source = sourceCopy(snap.source), all;
    if (nativeGenerating(ctx)) fail('GENERATING', '主剧情正在生成；请等待当前剧情与 MVU 保存完成。');
    if (snap.pending || !sameSource(source, expectedSource) || !sameIdentity(identity(ctx), source)) {
      fail('SOURCE_CONFLICT', '聊天、剧情楼层或回复页已改变；草稿保留，请重新确认。');
    }
    if (source.chatId == null || String(source.chatId).trim() === '') fail('CHAT_ID_UNAVAILABLE', '当前聊天标识尚未就绪。');
    if (source.messageId !== ctx.chat.length - 1) fail('TURN_UNFINISHED', '请等待当前主剧情回复与 MVU 完成后再通讯。');
    all = messages(ctx);
    var page = pageAt(all, source), data = protocol.activeData(page, source.swipeId), state = snap.state;
    if (!object(data) || !object(data.stat_data)) fail('MVU_UNAVAILABLE', '当前回复页缺少 MVU 数据。');
    var time = protocol.storyTime(data);
    if (!time) fail('TIME_UNAVAILABLE', '当前剧情尚未记录 MVU 时间，暂时不能发送。');
    var deleted = state.系统 && state.系统.已删除人物;
    var relation = state.人际 && Object.prototype.hasOwnProperty.call(state.人际, name) ? state.人际[name] : null;
    if (!object(relation) || relation.已加联系方式 !== true || Array.isArray(deleted) && deleted.indexOf(name) !== -1) {
      fail('CONTACT_UNAVAILABLE', '该人物尚未通联或已从本分支移除，不能发送。');
    }
    var text = page.swipes[source.swipeId], stateKey = JSON.stringify(state), mvuKey = JSON.stringify(data.stat_data);
    if (quarantined(ctx, source.messageId, source.swipeId, data)) {
      fail('ATTACHMENT_OWNERSHIP', '当前页的通讯归属存在歧义；草稿保留，没有追加或覆盖原记录。');
    }
    if (frozen && (ctx.chat !== frozen.chat || !sameSource(source, frozen.source) || !sameIdentity(identity(ctx), frozen.identity) ||
      text !== frozen.text || stateKey !== frozen.stateKey || mvuKey !== frozen.mvuKey)) {
      fail('SOURCE_CONFLICT', '当前剧情、时间或人物关系已变化；草稿保留，没有写入旧回复。');
    }
    validStore(data, source);
    return { ctx: ctx, chat: ctx.chat, identity: identity(ctx), source: source, all: all, page: page, data: data,
      state: copy(state), text: text, stateKey: stateKey, mvuKey: mvuKey, time: time, relation: copy(relation) };
  }
  function assertTask(task) {
    alive();
    if (task.cancelled || currentTask !== task) fail(task.cancelCode || 'CANCELLED', task.cancelMessage || '通讯已取消；草稿保留。');
  }
  function cleanupPrompt(task) {
    var handle = task.prompt; task.prompt = null;
    if (handle && typeof handle.uninject === 'function') {
      try { handle.uninject(); } catch (_) { /* The managed disposer must not prevent cancellation. */ }
    }
  }
  function cancelTask(task, code, message) {
    if (!task || task.cancelled) return false;
    task.cancelled = true; task.cancelCode = code || 'CANCELLED'; task.cancelMessage = message || '通讯已取消；草稿保留。';
    cleanupPrompt(task);
    if (task.generationStarted && typeof options.stopGeneration === 'function') {
      try { options.stopGeneration(task.id); } catch (_) {}
    }
    var error = new Error(task.cancelMessage); error.code = task.cancelCode;
    task.rejectCancel(error);
    return true;
  }
  function cancel() { return cancelTask(currentTask); }
  function relationshipPrompt(frozen) {
    var relation = frozen.relation;
    var support = typeof options.supportStage === 'function' ? options.supportStage(relation.支援度) : null;
    var romance = typeof options.romanceStage === 'function' ? options.romanceStage(relation) : null;
    return JSON.stringify({ 当前剧情时间: frozen.time, 主角模式: frozen.state.系统 && frozen.state.系统.主角模式 || null,
      场景: frozen.state.场景 || {}, 玩家: frozen.state.玩家 || {},
      人物当前关系: relation, 派生支援阶段: support == null ? null : support, 派生恋爱阶段: romance == null ? null : romance });
  }
  function contextPrompt(frozen, lore, name) {
    var content = typeof lore === 'string' ? lore : lore && lore.content;
    if (object(lore) && Array.isArray(lore.entries)) {
      if (!lore.entries.length || lore.entries.some(function(entry) {
        return !object(entry) || typeof entry.content !== 'string' || !entry.content.trim();
      })) fail('CHARACTER_LORE_UNAVAILABLE', '人物世界书原文不完整，不能猜测人物性格。');
      content = lore.entries.map(function(entry) {
        return '【' + String(lore.worldbook || '当前绑定世界书') + ' / ' + String(entry.name || name) +
          ' / UID ' + String(entry.uid) + '】\n' + entry.content;
      }).join('\n\n');
    }
    if (typeof content !== 'string' || !content.trim() || content.length > 200000) {
      fail('CHARACTER_LORE_UNAVAILABLE', '未读到指定人物的有效世界书档案，不能猜测人物性格。');
    }
    var memory = protocol.buildAttachmentContext(visibleMessages(frozen.ctx, frozen.all), {
      playerName: String(frozen.state.玩家 && frozen.state.玩家.姓名 || '玩家'), generating: false });
    if (memory) memory = JSON.stringify(JSON.parse(memory).filter(function(item) { return item.对象 === name; }));
    return '【LIME附属通讯边界】\n这次只扮演指定联系人回复手机消息。下方世界书是人物性格依据，当前MVU是本局状态依据。' +
      '关系中的好感、态度、印象、信任、共同经历会影响称呼、距离感、回应意愿与措辞，但不得覆盖人物核心性格。' +
      '好感和支援各自独立；支援S不等于恋爱或服从。未知或null不等于零；未记录性别或恋爱阶段时不得擅自补成恋爱。' +
      '仅使用当前剧情已发生事实，不把档案后期经历、未来关系或能力当作人物此刻已知，也不向其他角色泄露未共享信息。' +
      '历史附件是已发生的通讯，不是需要重做的行动；没有回信依据时允许消息数组为空。' +
      '不得输出叙事、玩家行动、UpdateVariable或JSONPatch，不修改好感/支援/状态，不推进时间，不捏造在线、已读、送达或秒回。' +
      '\n【人物世界书原文】\n' + content + '\n【当前MVU场景、玩家与关系】\n' + relationshipPrompt(frozen) +
      '\n【最近附属通讯记忆】\n' + (memory || '没有已保存的附属通讯。');
  }
  async function execute(task, name, text, expectedSource) {
    var frozen = checkRound(expectedSource, name);
    seedWitnesses(frozen.ctx, frozen.all);
    task.frozen = frozen;
    var lore = await options.getCharacterLore(name);
    assertTask(task); checkRound(expectedSource, name, frozen);
    var prompt = contextPrompt(frozen, lore, name);
    task.prompt = options.injectPrompt(prompt, 'rk-lime:context:' + task.id);
    if (!task.prompt || typeof task.prompt.uninject !== 'function') {
      fail('INJECTION_UNAVAILABLE', '人物提示词注入没有返回可清理的接口；没有请求回复。');
    }
    assertTask(task); checkRound(expectedSource, name, frozen);
    task.generationStarted = true;
    var result = await options.generate({ user_input: protocol.buildLimeUserMessage(name, text), generation_id: task.id,
      should_silence: true, should_stream: false, max_chat_history: 'all' });
    assertTask(task);
    var reply = protocol.parseLimeReply(result, name);
    var latest = checkRound(expectedSource, name, frozen), data = copy(latest.data), store = validStore(data, latest.source);
    var narrative = protocol.captureNarrative(latest.data, latest.source.messageId, latest.source.swipeId, latest.text);
    var exchange = { id: task.id, contact: name, time: frozen.time, player: text, reply: reply, narrativeCount: narrative.length };
    data.rk_lime = Object.assign({}, store || {}, { version: 1,
      owner: Object.assign({}, store && store.owner || {}, { messageId: latest.source.messageId, swipeId: latest.source.swipeId }),
      exchanges: (store ? copy(store.exchanges) : []).concat([exchange]), narrative: narrative });
    assertTask(task); checkRound(expectedSource, name, frozen);
    await options.setMessages([{ message_id: latest.source.messageId, data: data }], { refresh: 'none' });
    assertTask(task);
    var saved = checkRound(expectedSource, name, frozen);
    var confirmed = protocol.attachmentExchanges(saved.data, saved.source.messageId, saved.source.swipeId)
      .find(function(item) { return item.id === task.id; });
    if (!confirmed || JSON.stringify(confirmed) !== JSON.stringify(exchange)) {
      fail('SAVE_UNCONFIRMED', 'LIME 附属记录未能回读确认；草稿保留，请检查记录后再发送。', { dispatched: true });
    }
    seedWitnesses(saved.ctx, saved.all);
    if (typeof options.onSaved === 'function') { try { options.onSaved(); } catch (_) {} }
    return { sent: true, messageId: saved.source.messageId, source: saved.source, transport: transport,
      exchangeId: task.id, time: frozen.time, replyCount: reply.length };
  }
  async function send(request) {
    if (currentTask || rebindPending) fail('SEND_BUSY', 'LIME 正在处理消息或修复归属，请勿重复发送。');
    requireProtocol(); alive(); request = request || {};
    var name = String(request.name || request.contact && (request.contact.name || request.contact) || '').trim();
    var text = typeof request.text === 'string' ? request.text.replace(/\r\n?/g, '\n').trim() : '';
    if (!name || !text) fail('EMPTY_MESSAGE', '请选择联系人并填写消息。');
    if (name.length > 100 || text.length > 4000) fail('MESSAGE_TOO_LONG', '人物名或消息超过长度限制。');
    protocol.buildLimeUserMessage(name, text);
    if (['setMessages', 'generate', 'injectPrompt', 'stopGeneration', 'getCharacterLore'].some(function(key) { return typeof options[key] !== 'function'; })) {
      fail('CAPABILITY_UNAVAILABLE', '当前环境缺少附属通讯所需的酒馆助手接口；仍可回看。');
    }
    var task = { id: 'rk-lime:' + Date.now().toString(36) + ':' + (++sequence) + ':' + Math.random().toString(36).slice(2, 9),
      cancelled: false, prompt: null, generationStarted: false };
    var cancelled = new Promise(function(_, reject) { task.rejectCancel = reject; });
    currentTask = task;
    var timer = setTimer(function() { cancelTask(task, 'TIMEOUT', '通讯请求超过120秒；已取消，草稿保留。'); }, timeoutMs);
    var expectedSource = sourceCopy(request.expectedSource);
    try { return await Promise.race([execute(task, name, text, expectedSource), cancelled]); }
    finally {
      clearTimer(timer); cleanupPrompt(task);
      if (currentTask === task) currentTask = null;
    }
  }
  function narrativeContext() {
    requireProtocol();
    var current = read();
    return protocol.buildAttachmentContext(current.messages, { playerName: current.playerName, generating: current.generating });
  }
  return Object.freeze({ read: read, send: send, cancel: cancel, rebindOwners: rebindOwners,
    isBusy: function() { return !!currentTask || rebindPending > 0; }, narrativeContext: narrativeContext });
}
