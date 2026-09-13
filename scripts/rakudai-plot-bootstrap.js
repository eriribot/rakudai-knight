(function installRakudaiPlot() {
  const W = window;
  function host() {
    // TH also exposes SillyTavern.getContext in every script iframe. Prefer the
    // outer ST window; otherwise the singleton is invisible to the terminal.
    for (const scope of [W.top, W.parent, W]) {
      try { if (scope?.SillyTavern?.getContext) return scope; } catch (_) {}
    }
    throw new Error('未连接 SillyTavern');
  }
  const H = host(), disposers = [];
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error('酒馆助手缺少接口：' + name);
  }
  const context = () => H.SillyTavern.getContext();
  const worldbookReader = createRakudaiWorldbookReader({
    getCharWorldbookNames: helper('getCharWorldbookNames'),
    getWorldbook: helper('getWorldbook'),
  });
  const getVariables = helper('getVariables'), updateVariablesWith = helper('updateVariablesWith');
  const settingsKey = 'rakudai_chapter_injection';
  const eventOn = helper('eventOn'), events = W.tavern_events, helperEvents = W.iframe_events;
  if (!events?.CHAT_COMPLETION_PROMPT_READY || !events.CHAT_COMPLETION_SETTINGS_READY || !events.GENERATION_AFTER_COMMANDS || !helperEvents?.GENERATION_STARTED) throw new Error('缺少必要生成生命周期事件，未安装剧情注入器');
  H.__RK_PLOT_V3__?.dispose?.();
  // TH's Mvu getter is installed by this wait even when MVU starts after this iframe.
  helper('waitGlobalInitialized')('Mvu').catch(error => console.warn('[RK剧情 v3] MVU 接口尚未就绪', error));
  const runtime = createRakudaiPlotRuntime({
    getContext: context,
    readMessages: helper('getChatMessages'),
    getMvu: () => W.Mvu || H.Mvu,
    readStoryEntry: (volume, chapter) => worldbookReader.read(volume, chapter),
    readSettings: () => getVariables({ type: 'chat' })?.[settingsKey]?.enabled !== false,
    writeSettings: enabled => updateVariablesWith(variables => ({ ...variables, [settingsKey]: { ...variables[settingsKey], enabled } }), { type: 'chat' }),
    now: () => Date.now(),
    report: message => console.info('[RK剧情 v3]', message),
    measureBudget: async (chat, _text, request) => {
      const ctx = context(), settings = ctx.chatCompletionSettings;
      const outputTokens = request?.max_completion_tokens ?? request?.max_tokens ?? settings?.openai_max_tokens;
      const allowance = Number(settings?.openai_max_context) - Number(outputTokens);
      if (!(allowance > 0) || typeof ctx.getTokenCountAsync !== 'function') return false;
      // Unknown media accounting cannot establish remaining space at this late hook.
      // Preserve such requests unchanged and expose the skip in the terminal.
      if (request?.tools?.length || chat.some(m => typeof m.content !== 'string' && (!Array.isArray(m.content) || m.content.some(p => p.type !== 'text')) || m.tool_calls)) return false;
      let timer;
      try {
        const tokens = await Promise.race([ctx.getTokenCountAsync(JSON.stringify(chat)), new Promise(resolve => { timer = setTimeout(() => resolve(NaN), 8000); })]);
        return Number.isFinite(tokens) && tokens >= 0 && tokens + Math.max(1024, Math.ceil(tokens * 0.1)) < allowance;
      } finally { clearTimeout(timer); }
    },
  });
  function on(name, callback) {
    if (!name) throw new Error('生成事件不可用');
    const handle = eventOn(name, callback);
    disposers.push(() => { if (typeof handle === 'function') handle(); else if (handle?.stop) handle.stop(); else helper('eventRemoveListener')(name, callback); });
  }
  const originalDispose = runtime.dispose;
  runtime.dispose = () => {
    originalDispose();
    while (disposers.length) { try { disposers.pop()(); } catch (error) { console.warn('[RK剧情 v3] 清理监听失败', error); } }
    W.removeEventListener('pagehide', runtime.dispose);
    if (H.__RK_PLOT_V3__ === runtime) delete H.__RK_PLOT_V3__;
  };
  try {
    on(events.GENERATION_AFTER_COMMANDS, runtime.onGeneration);
    on(events.CHAT_COMPLETION_PROMPT_READY, runtime.onPromptReady);
    on(events.CHAT_COMPLETION_SETTINGS_READY, runtime.onSettingsReady);
    on(events.GENERATION_ENDED, runtime.end);
    on(events.GENERATION_STOPPED, runtime.end);
    on(events.CHAT_CHANGED, runtime.end);
    on(helperEvents.GENERATION_STARTED, runtime.foreignStart);
    W.addEventListener('pagehide', runtime.dispose);
    H.__RK_PLOT_V3__ = runtime;
    console.info('[RK剧情 v3] 已注册唯一剧情注入通道；EJS 由提示词模板扩展处理');
  } catch (error) { runtime.dispose(); throw error; }
})();
