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
  function validationZ() {
    const Z = W.z || host().z;
    if (!Z?.preprocess || !Z?.toJSONSchema) throw new Error('未找到酒馆助手提供的 Zod 4，尚未写入。');
    return Z;
  }
  function checkHelperVersion() {
    const version = sync(helper('getTavernHelperVersion')(), '读取酒馆助手版本');
    const parts = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!parts || Number(parts[1]) < 4 || (Number(parts[1]) === 4 && (Number(parts[2]) < 8 || (Number(parts[2]) === 8 && Number(parts[3]) < 19)))) throw new Error('本建档器需要酒馆助手 4.8.19 或以上的同步变量接口。');
  }
  function runtime() {
    const H = host(), mvu = W.Mvu || H.Mvu;
    if (!mvu || typeof mvu.getMvuData !== 'function') throw new Error('MVU 尚未就绪，请启用变量框架后重试。');
    checkHelperVersion();
    return { H, mvu, Z: validationZ() };
  }
  function sync(value, label) {
    if (value && typeof value.then === 'function') throw new Error(`${label} 在此版本不是同步接口，不能确认分支隔离。`);
    return value;
  }
  function captureScope(messageId) {
    const H = host();
    // ponytail: 操作由本地校验负责，外置字段约束的启动与版本不作为读取门禁。
    const ctx = H.SillyTavern.getContext();
    const chatId = ctx.chatId;
    if (chatId === null || chatId === undefined || chatId === '' || !Array.isArray(ctx.chat) || !ctx.chat.length) throw new Error('当前没有可建档的聊天。');
    const readMessages = helper('getChatMessages');
    // 按宿主助手角色过滤语义从尾部寻找，避免每次校验克隆整段聊天的变量。
    let latest;
    for (let id = ctx.chat.length - 1; id >= 0; id--) {
      const messages = sync(readMessages(id, { role: 'assistant', include_swipes: true }), '读取楼层');
      if (!Array.isArray(messages)) throw new Error('读取楼层返回格式不受支持，尚未写入。');
      if (messages.length) { latest = messages[0]; break; }
    }
    if (!latest) throw new Error('当前聊天没有助手楼层。');
    const id = messageId === undefined ? latest.message_id : messageId;
    if (!Number.isInteger(id) || id !== latest.message_id) throw new Error('该开局页已是历史楼层；请在当前分支最新助手楼层操作，不能覆盖旧状态。');
    const message = latest;
    if (!Number.isInteger(message.swipe_id) || message.swipe_id < 0 || !Array.isArray(message.swipes) || message.swipe_id >= message.swipes.length) throw new Error('未能识别当前 swipe，尚未写入。');
    const options = { type: 'message', message_id: id };
    return { H, ctx, chatId, characterId: ctx.characterId, groupId: ctx.groupId, chatRef: ctx.chat, messageId: id, messageRef: ctx.chat[id], swipeId: message.swipe_id,
      messageText: message.swipes[message.swipe_id], length: ctx.chat.length, options };
  }
  function readPosition(scope, mvu) {
    const data = sync(mvu.getMvuData(scope.options), '读取 MVU');
    if (!data?.stat_data) throw new Error('当前楼层没有 MVU 初始化数据，请先检查初始化通知。');
    return { ...scope, mvu, data: cloneState(data) };
  }
  function position(messageId) {
    const { mvu } = runtime();
    return readPosition(captureScope(messageId), mvu);
  }
  function assertWaitingScope(saved) {
    const ctx = saved.H.SillyTavern.getContext(), message = ctx?.chat?.[saved.messageId];
    const swipeId = message?.swipe_id ?? 0;
    const text = (message?.swipes ? message.swipes[swipeId] : message?.mes) ?? '';
    if (!ctx || ctx.chatId !== saved.chatId || ctx.characterId !== saved.characterId || ctx.groupId !== saved.groupId ||
      ctx.chat !== saved.chatRef || message !== saved.messageRef || ctx.chat.length !== saved.length ||
      swipeId !== saved.swipeId || text !== saved.messageText) throw new Error('等待期间聊天、楼层或 swipe 已变化，请重新读取；草稿已保留。');
  }
  async function captureReadyPosition(messageId) {
    checkHelperVersion();
    validationZ();
    const saved = captureScope(messageId), deadline = Date.now() + 15000;
    let waiting = false;
    for (;;) {
      assertWaitingScope(saved);
      const mvu = W.Mvu || saved.H.Mvu;
      const globalReady = typeof mvu?.getMvuData === 'function';
      const dataReady = globalReady && saved.messageRef.variables?.[saved.swipeId]?.stat_data;
      const remaining = deadline - Date.now();
      // 已进入等待后，后台挂起或主线程拥堵不能把过期操作重新变成成功提交。
      if (remaining <= 0 && (waiting || !dataReady)) {
        const error = new Error(dataReady
          ? '本次就绪等待已超过 15 秒，已停止读取。请按当前状态重试；草稿已保留。'
          : globalReady ? 'MVU 已启动，但当前楼层在 15 秒内仍未初始化变量。请检查初始变量与世界书加载后重试；草稿已保留。'
            : '等待 15 秒后 MVU 仍未启动。请检查变量框架脚本及其加载错误后重试；草稿已保留。');
        error.code = dataReady ? 'MVU_READINESS_TIMEOUT' : globalReady ? 'MVU_DATA_NOT_READY' : 'MVU_NOT_READY';
        throw error;
      }
      // TH 4.8.19+ 的消息槽位仅作轻量就绪探针；正式取值仍走 MVU API。
      // 不调用 waitGlobalInitialized，避免旧版无期限等待或残留的全局事件监听。
      if (dataReady) {
        const result = readPosition(saved, mvu);
        assertWaitingScope(saved);
        return result;
      }
      waiting = true;
      await new Promise(resolve => setTimeout(resolve, Math.min(250, remaining)));
    }
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
  function validateState(value) {
    // 页面与副校正仅校验内存候选，不重算人际，也不创建楼层写入凭据。
    const parsed = createSchema(validationZ(), { normalizeRelationships: false }).parse(value);
    const state = cloneState(value);
    state.场景.当前卷 = parsed.场景.当前卷;
    state.场景.当前章 = parsed.场景.当前章;
    state.场景.阶段 = parsed.场景.阶段;
    for (const name of Object.keys(state.场景.已发生事件)) state.场景.已发生事件[name].章段 = parsed.场景.已发生事件[name].章段;
    return state;
  }
  const api = createStateController({
    // 有限等待仅放在读取入口；current/write 保持同步比较与更新。
    capture: ({ messageId } = {}) => captureReadyPosition(messageId),
    current, assertOpeningReplacement,
    validate: (value, scope = 'full') => scope === 'full' ? validateState(value) : validateStateOperation(value, scope, validationZ()),
    migrate: value => prepareStateMigration(value, validationZ()),
    write: (saved, expected, state, { openingReplacement = false, assertWritable } = {}) => {
      if (openingReplacement) assertOpeningReplacement(saved);
      const now = current(saved), H = now.H;
      if (stateKey(now.data) !== stateKey(expected)) throw new Error('变量在提交前发生变化，请刷新。');
      // 使用宿主同步 updater：校验与赋值之间不 await，不退回 chat/global scope。
      const result = helper('updateVariablesWith')(variables => {
        assertWritable?.();
        current(saved);
        if (openingReplacement) assertOpeningReplacement(saved);
        if (stateKey(variables) !== stateKey(expected)) throw new Error('变量已经更新，未覆盖。');
        const next = cloneState(variables);
        next.stat_data = cloneState(state);
        // 页面事务提交的是已验证候选；缺项修复留给 MVU STARTED，避免暗改迁移候选。
        prepareRakudaiNativeMvu(next, [W, H], { repairStructure: false });
        return next;
      }, now.options);
      sync(result, '更新变量');
      return undefined;
    },
  });
  const publicApi = Object.defineProperties({}, Object.getOwnPropertyDescriptors(api));
  Object.defineProperty(publicApi, 'validateState', { value: validateState, enumerable: true });
  W.RakudaiStateController = Object.freeze(publicApi);
  // 开局页已有的照片入口只保存显示信息；沿用宿主聊天 scope，不进入 MVU。
  const displayTokens = new WeakMap();
  function displayStore(H) {
    return createPlayerDisplayStore({
      storage: {
        getItem: key => H.localStorage.getItem(key),
        setItem: (key, value) => H.localStorage.setItem(key, value),
      },
      getContext: () => H.SillyTavern.getContext(),
      onChange: value => {
        try { H.dispatchEvent(new H.CustomEvent('rk:player-portrait-changed', { detail: { scope: value.scope, revision: value.revision } })); } catch (_) {}
      },
    });
  }
  W.RakudaiPlayerDisplay = Object.freeze({
    capture() {
      const saved = position(), view = displayStore(saved.H).get(), token = Object.freeze({});
      displayTokens.set(token, { saved, view });
      return { ...view, token, primaryName: saved.data.stat_data.玩家?.姓名 || '' };
    },
    apply(expected, values) {
      const record = displayTokens.get(expected?.token);
      if (!record) throw new Error('头像操作已失效，请重新应用。');
      const now = current(record.saved), profileName = typeof values?.profileName === 'string' ? values.profileName.trim() : '';
      if (!profileName || now.data.stat_data.系统?.开局状态 !== '已建档' || now.data.stat_data.玩家?.姓名?.trim() !== profileName) {
        throw new Error('档案姓名与本局已建档玩家不一致，请载入本局人物的档案或照片。');
      }
      const oldName = record.view.profileName || record.saved.data.stat_data.玩家?.姓名 || '';
      return displayStore(now.H).save(record.view, { avatarUrl: values.avatarUrl,
        aliases: oldName && oldName !== profileName ? [] : record.view.aliases, profileName, source: 'opening' });
    },
  });
})();
