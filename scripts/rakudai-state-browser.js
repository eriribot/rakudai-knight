// 构建时与 schema、纯状态规则一起内联；只在 Tavern Helper 上下文使用。
// 精确接口依据及尚未完成的实机验收见 世界书规则/MVU/v4_使用与迁移.md。
(function installRakudaiController() {
  const W = window;
  function host() {
    // Helper 给每个 iframe 都提供 SillyTavern getter，不能据此把自己当成宿主。
    // 每次访问单独捕获跨源异常，优先实际最外层同源酒馆窗口。
    for (const resolve of [() => W.top, () => W.parent, () => W]) {
      try { const candidate = resolve(); if (candidate?.SillyTavern?.getContext) return candidate; } catch (_) {}
    }
    throw new Error('未连接 SillyTavern，档案仅为草稿。');
  }
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error(`酒馆助手缺少 ${name}，尚未写入。`);
  }
  function runtime() {
    const H = host(), mvu = W.Mvu || H.Mvu;
    if (!mvu || typeof mvu.getMvuData !== 'function') throw new Error('MVU 尚未就绪，请启用变量框架后重试。');
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
    const oldGuard = [W, H].some(scope => scope.__RK_MVU_GUARD_V3__) || (function () {
      try { return W.parent?.__RK_MVU_GUARD_V3__ || W.top?.__RK_MVU_GUARD_V3__; } catch (_) { return false; }
    })();
    if (oldGuard) throw new Error('旧版 v3 约束仍在运行，请先停用旧版约束，只启用 v4 后再读取或写入。');
    const guard = H.__RK_MVU_GUARD_V4__ || W.__RK_MVU_GUARD_V4__ || (function () {
      try { return W.parent?.__RK_MVU_GUARD_V4__; } catch (_) {}
    })() || (function () {
      try { return W.top?.__RK_MVU_GUARD_V4__; } catch (_) {}
    })();
    if (guard?.version !== '4.0.0') throw new Error('请先导入并启用“落第骑士·MVU v4 字段与卷章约束”脚本，并停用旧版约束。');
    // 旧v4也叫4.0.0，但不认识魔人觉醒；在建档前核对实际功能修订，不能只看显示名。
    if (guard.growth !== 'G03') throw new Error('当前运行的是旧v4约束，不支持玩家.魔人觉醒。请替换为标有G03/P02的v4约束并重载酒馆；保留现有true/false，不要重新初始化。');
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
    if (!Number.isInteger(message.swipe_id) || message.swipe_id < 0 || !Array.isArray(message.swipes) || message.swipe_id >= message.swipes.length) throw new Error('未能识别当前 swipe，尚未写入。');
    const options = { type: 'message', message_id: id };
    const data = sync(mvu.getMvuData(options), '读取 MVU');
    if (!data?.stat_data) throw new Error('当前楼层没有 MVU 初始化数据，请先检查初始化通知。');
    return { H, mvu, ctx, chatId, characterId: ctx.characterId, groupId: ctx.groupId, chatRef: ctx.chat, messageId: id, messageRef: ctx.chat[id], swipeId: message.swipe_id,
      messageText: message.swipes?.[message.swipe_id], length: ctx.chat.length, data: cloneState(data), options };
  }
  function current(saved) {
    const now = position(saved.messageId);
    if (now.chatId !== saved.chatId || now.characterId !== saved.characterId || now.groupId !== saved.groupId ||
      now.chatRef !== saved.chatRef || now.messageRef !== saved.messageRef || now.length !== saved.length ||
      now.swipeId !== saved.swipeId || now.messageText !== saved.messageText) throw new Error('聊天、楼层或 swipe 已变化，请重新读取；草稿已保留。');
    return now;
  }
  function assertOpeningReplacement(saved) {
    const now = current(saved);
    // 只信实际宿主聊天：过滤后的助手列表无法证明中间没有用户消息。
    if (now.ctx.chat.length !== 1 || now.messageId !== 0) throw new Error('本局已经产生后续聊天，不能替换开局人物；请在新聊天使用该档案。');
    assertOpeningReplacementState(now.data.stat_data);
  }
  const api = createStateController({
    capture: async ({ messageId } = {}) => {
      // MVU 可能在本 iframe 创建后初始化；用本 iframe 的 Helper 安装动态 getter。
      // 等待仅放在读取入口，current/write 内的同步比较与更新不能插入 await。
      await helper('waitGlobalInitialized')('Mvu');
      return position(messageId);
    },
    current, assertOpeningReplacement,
    validate: value => {
      // 页面事务只验证，不借迁移或切章重算人际、补入人物默认字段。
      const parsed = createSchema(runtime().Z, { normalizeRelationships: false }).parse(value);
      const state = cloneState(value);
      // 仅规范已经存在的卷章别名，避免合法别名在终端目录中失配。
      state.场景.当前章 = parsed.场景.当前章;
      for (const name of Object.keys(state.场景.已发生事件)) state.场景.已发生事件[name].章段 = parsed.场景.已发生事件[name].章段;
      return state;
    },
    migrate: value => prepareStateMigration(value, runtime().Z),
    write: (saved, expected, state, { openingReplacement = false } = {}) => {
      if (openingReplacement) assertOpeningReplacement(saved);
      const now = current(saved);
      if (stateKey(now.data) !== stateKey(expected)) throw new Error('变量在提交前发生变化，请刷新。');
      // 使用宿主同步 updater：校验与赋值之间不 await，不退回 chat/global scope。
      const result = helper('updateVariablesWith')(variables => {
        current(saved);
        if (openingReplacement) assertOpeningReplacement(saved);
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
