// 优先读取当前聊天最新助手楼层的活动回复页；等待 MVU 时仅保留只读显示。
// 接口依据：Tavern Helper 4.8.19 @types/function/chat_message.d.ts。
// 每次从当前分支重新读取；不缓存曾显示过的状态，避免回退或切换 swipe 后残留人物。
function createTerminalStateReader(readMessages, getContext) {
  var scope = null;
  function clear() { scope = null; }
  function sameScope(left, right) {
    return left && left.chat === right.chat && left.chatId === right.chatId &&
      left.characterId === right.characterId && left.groupId === right.groupId;
  }
  function pending(snapshot, targetSource) {
    return { state: structuredClone(snapshot.state), source: structuredClone(snapshot.source), pending: true,
      targetSource: structuredClone(targetSource), message: '当前回复尚未写入 MVU，暂显最近已保存状态；等待更新，不作为当前回复的结算结果。' };
  }
  function readTerminalState(options = {}) {
    if (typeof readMessages !== 'function') throw new Error('酒馆助手的消息读取接口尚未就绪');
    var context = getContext();
    if (!context || !Array.isArray(context.chat) || !context.chat.length) { clear(); throw new Error('当前没有聊天记录'); }
    var currentScope = { chat: context.chat, chatId: context.getCurrentChatId?.() ?? context.chatId,
      characterId: context.characterId, groupId: context.groupId };
    if (!sameScope(scope, currentScope)) { clear(); scope = currentScope; }
    var targetSource = null;
    for (var id = context.chat.length - 1; id >= 0; id--) {
      var messages = readMessages(id, { role: 'assistant', include_swipes: true });
      if (!Array.isArray(messages)) throw new Error('消息读取接口返回格式不受支持');
      var message = messages[0];
      if (!message) continue;
      if (message.message_id !== id || !Number.isInteger(message.swipe_id) || message.swipe_id < 0 ||
          !Array.isArray(message.swipes) || message.swipe_id >= message.swipes.length) {
        throw new Error('当前助手回复的楼层或回复页标识不完整，无法确认 MVU 槽');
      }
      var source = {
        messageId: message.message_id,
        swipeId: message.swipe_id,
        swipeCount: message.swipes.length,
        chatId: currentScope.chatId ?? null,
        characterId: currentScope.characterId ?? null,
        groupId: currentScope.groupId ?? null
      };
      if (!targetSource) targetSource = source;
      var data = Array.isArray(message.swipes_data) ? message.swipes_data[message.swipe_id] : null;
      var state = data && data.stat_data;
      var complete = state && typeof state === 'object' && !Array.isArray(state) &&
        ['系统', '场景', '玩家', '人际'].every(function(key) {
          return state[key] && typeof state[key] === 'object' && !Array.isArray(state[key]);
        });
      if (!complete && source.messageId === targetSource.messageId && state && typeof state === 'object' &&
          !Array.isArray(state) && state.人际 && typeof state.人际 === 'object' && !Array.isArray(state.人际)) {
        // 本页已有名册时，不因其他根字段尚未写全而退回旧楼层的空初始化。
        // 只展示本页实际保存的字段；不拼接别的楼层，不给部分档案开放写操作。
        var partial = {};
        ['系统', '场景', '玩家', '人际'].forEach(function(key) {
          if (state[key] && typeof state[key] === 'object' && !Array.isArray(state[key])) partial[key] = structuredClone(state[key]);
        });
        return { state: partial, source: source, targetSource: targetSource, pending: true, incomplete: true,
          message: '当前回复的人际字段已读取，其他档案字段尚未完整；先显示本页资料，补齐前仅可查看。' };
      }
      if (!complete) {
        // 重生成可能已经删除旧回复，或新 swipe 还没有变量槽。
        // 仅向前读取仍属于当前分支的助手活动回复；不能复用旧回复的显示快照。
        continue;
      }
      var result = {};
      ['系统', '场景', '玩家', '人际'].forEach(function(key) {
        if (Object.prototype.hasOwnProperty.call(state, key)) result[key] = structuredClone(state[key]);
      });
      var snapshot = { state: result, source: source };
      if (source.messageId !== targetSource.messageId) return pending(snapshot, targetSource);
      if (options.generating) {
        var displayed = pending(snapshot, targetSource);
        displayed.message = '正在生成，暂显最近已保存状态；新回复完成 MVU 更新后再切换。';
        return displayed;
      }
      return { ...snapshot, pending: false, targetSource: source, message: '' };
    }
    var error = new Error(targetSource ? '当前回复及此前助手楼层都没有可显示的 MVU 数据' : '当前聊天没有助手楼层');
    error.source = targetSource;
    error.code = 'MVU_PENDING';
    throw error;
  }
  readTerminalState.clear = clear;
  return readTerminalState;
}
