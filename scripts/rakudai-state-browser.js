// 构建时与 schema、纯状态规则一起内联；只在 Tavern Helper 上下文使用。
// 精确接口依据及尚未完成的实机验收见 世界书规则/MVU/v3_使用与迁移.md。
(function installRakudaiController() {
  const W = window;
  function host() {
    if (W.SillyTavern?.getContext) return W;
    try { if (W.parent?.SillyTavern?.getContext) return W.parent; } catch (_) {}
    throw new Error('未连接 SillyTavern，档案仅为草稿。');
  }
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error(`酒馆助手缺少 ${name}，尚未写入。`);
  }
  function runtime() {
    const H = host(), mvu = W.Mvu || H.Mvu;
    if (!mvu || typeof mvu.getMvuData !== 'function' || typeof mvu.replaceMvuData !== 'function') throw new Error('MVU 尚未就绪，请启用变量框架后重试。');
    const version = helper('getTavernHelperVersion')();
    const parts = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!parts || Number(parts[1]) < 4 || (Number(parts[1]) === 4 && (Number(parts[2]) < 8 || (Number(parts[2]) === 8 && Number(parts[3]) < 19)))) throw new Error('本建档器需要酒馆助手 4.8.19 或以上的同步变量接口。');
    const Z = W.z || H.z;
    if (!Z?.preprocess || !Z?.toJSONSchema) throw new Error('未找到酒馆助手提供的 Zod 4，尚未写入。');
    return { H, mvu, Z };
  }
  function sync(value, label) {
    if (value && typeof value.then === 'function') throw new Error(`${label} 在此版本不是同步接口，不能确认分支隔离。`);
    return value;
  }
  function position(messageId) {
    const { H, mvu } = runtime();
    if (H.__RK_MVU_GUARD_V3__?.version !== '3.1.0') throw new Error('请先导入并启用更新后的“落第骑士·MVU v3 字段与第一卷约束”脚本（修订 3.1.0）。');
    const ctx = H.SillyTavern.getContext();
    const chatId = ctx.chatId;
    if (chatId === null || chatId === undefined || chatId === '' || !Array.isArray(ctx.chat) || !ctx.chat.length) throw new Error('当前没有可建档的聊天。');
    const readMessages = helper('getChatMessages');
    const assistants = sync(readMessages(`0-${ctx.chat.length - 1}`, { role: 'assistant', include_swipes: true }), '读取楼层');
    const latest = assistants.at(-1);
    if (!latest) throw new Error('当前聊天没有助手楼层。');
    const id = messageId === undefined ? latest.message_id : messageId;
    if (!Number.isInteger(id) || id !== latest.message_id) throw new Error('该开局页已是历史楼层；请在当前分支最新助手楼层操作，不能覆盖旧状态。');
    const message = latest;
    if (!Number.isInteger(message.swipe_id)) throw new Error('未能识别当前 swipe，尚未写入。');
    const options = { type: 'message', message_id: id };
    const data = sync(mvu.getMvuData(options), '读取 MVU');
    if (!data?.stat_data) throw new Error('当前楼层没有 MVU 初始化数据，请先检查初始化通知。');
    return { H, mvu, ctx, chatId, messageId: id, messageRef: ctx.chat[id], swipeId: message.swipe_id,
      messageText: message.swipes?.[message.swipe_id], length: ctx.chat.length, data: cloneState(data), options };
  }
  function current(saved) {
    const now = position(saved.messageId);
    if (now.chatId !== saved.chatId || now.ctx.characterId !== saved.ctx.characterId || now.ctx.groupId !== saved.ctx.groupId ||
      now.ctx.chat !== saved.ctx.chat || now.messageRef !== saved.messageRef || now.length !== saved.length ||
      now.swipeId !== saved.swipeId || now.messageText !== saved.messageText) throw new Error('聊天、楼层或 swipe 已变化，请重新读取；草稿已保留。');
    return now;
  }
  const api = createStateController({
    capture: ({ messageId } = {}) => position(messageId),
    current,
    validate: value => createSchema(runtime().Z).parse(value),
    write: (saved, expected, state) => {
      const now = current(saved);
      if (stateKey(now.data) !== stateKey(expected)) throw new Error('变量在提交前发生变化，请刷新。');
      // 使用宿主同步 updater：校验与赋值之间不 await，不退回 chat/global scope。
      const result = helper('updateVariablesWith')(variables => {
        current(saved);
        if (stateKey(variables) !== stateKey(expected)) throw new Error('变量已经更新，未覆盖。');
        const next = cloneState(variables);
        next.stat_data = cloneState(state);
        return next;
      }, now.options);
      sync(result, '更新变量');
      return undefined;
    },
  });
  W.RakudaiStateController = api;
})();
