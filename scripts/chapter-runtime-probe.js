// TEST ONLY: 仅供名字含“验收副本”的独立合成 fixture；禁止加入生产卡。
// ST 1.18 / TH 4.9.5：仅观察本地 chat-completions/generate 的 JSON 字符串 body。
// 不读取 headers、密钥或上游 URL；不调用生成，不写 MVU，不使用第三方请求查看器。
(function installChapterRuntimeProbe() {
  const W = window;
  let H;
  for (const scope of [W.top, W.parent, W]) {
    try { if (scope?.SillyTavern?.getContext) { H = scope; break; } } catch (_) {}
  }
  if (!H?.document || typeof H.fetch !== 'function') throw new Error('验收探针需要 SillyTavern 宿主与 fetch');
  H.__RK_CHAPTER_RUNTIME_PROBE__?.dispose?.();
  const D = H.document, records = [], BEGIN = '【RK剧情注入:BEGIN】', END = '【RK剧情注入:END】';
  let disposed = false, snapshot = null, snapshotBusy = false, downloadUrl = null, activeLayer = null;
  const diagnostics = { installs: 0, fetchCalls: 0, matchedLocalRequests: 0, recordedRequests: 0, lastInputKind: null, lastSkip: null };
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error('缺少酒馆助手接口：' + name);
  }
  const context = () => H.SillyTavern.getContext();
  function isFixture(ctx = context()) {
    return typeof ctx.characters?.[ctx.characterId]?.name === 'string' && ctx.characters[ctx.characterId].name.includes('验收副本');
  }
  function element(tag, text) { const node = D.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
  const panel = element('details'); panel.id = 'rk-chapter-runtime-probe'; panel.open = true;
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(600px,92vw);max-height:75vh;overflow:auto;background:#17191f;color:#f5f5f5;border:1px solid #8f9eaf;border-radius:8px;padding:12px;font:13px/1.5 sans-serif;box-shadow:0 6px 28px #0009;';
  panel.appendChild(element('summary', '仅验收副本 · 发送请求与 MVU 只读探针'));
  const notice = element('p', '仅记录本地出网前的脱敏元数据；不记录完整消息、请求头或上游地址。'); panel.appendChild(notice);
  const controls = element('div'); controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;'; panel.appendChild(controls);
  const readButton = element('button', '读取全部助手活动回复页'), reinstallButton = element('button', '重新安装观察'), downloadButton = element('button', '下载脱敏记录'), closeButton = element('button', '卸载探针');
  for (const button of [readButton, reinstallButton, downloadButton, closeButton]) { button.type = 'button'; controls.appendChild(button); }
  const statusView = element('pre'); panel.appendChild(statusView);
  const requestView = element('pre'), snapshotView = element('pre');
  for (const pre of [requestView, snapshotView]) pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;background:#0d0f14;padding:8px;max-height:32vh;overflow:auto;';
  panel.appendChild(element('h4', '最近 10 条发送请求')); panel.appendChild(requestView);
  panel.appendChild(element('h4', '手动读取的活动回复页')); panel.appendChild(snapshotView);
  D.body.appendChild(panel);
  function getStatus() {
    let fixtureMatched = false; try { fixtureMatched = isFixture(); } catch (_) {}
    return { fetchStillInstalled: !disposed && H.fetch === activeLayer?.wrapped, fixtureMatched, ...diagnostics };
  }
  function renderStatus() { if (!disposed) statusView.textContent = JSON.stringify(getStatus(), null, 2); }
  function render() {
    requestView.textContent = records.length ? JSON.stringify(records, null, 2) : '尚未收集请求。';
    snapshotView.textContent = snapshot ? JSON.stringify(snapshot, null, 2) : '尚未读取；点击上方按钮。'; renderStatus();
  }
  function completeBlocks(text) {
    const blocks = []; let cursor = 0;
    for (;;) {
      const start = text.indexOf(BEGIN, cursor); if (start < 0) break;
      const end = text.indexOf(END, start + BEGIN.length), nested = text.indexOf(BEGIN, start + BEGIN.length);
      if (nested >= 0 && (end < 0 || nested < end)) { cursor = nested; continue; }
      if (end < 0) break;
      const block = text.slice(start, end + END.length), match = /当前剧情节点：第(\d+)卷\s*·\s*([^\n（]+)/.exec(block);
      blocks.push({ text: block, volume: match ? Number(match[1]) : null, chapter: match ? match[2].trim() : null });
      cursor = end + END.length;
    }
    return blocks;
  }
  function observe(args) {
    if (disposed) return;
    const input = args[0], options = args[1];
    diagnostics.fetchCalls++;
    diagnostics.lastInputKind = typeof input === 'string' ? 'string' : input instanceof URL ? 'url' : input && typeof input === 'object' ? 'object' : 'other';
    if (!isFixture()) { diagnostics.lastSkip = 'not_fixture'; return; }
    if (!(typeof input === 'string' || input instanceof URL)) { diagnostics.lastSkip = 'unsupported_input'; return; }
    const target = new URL(String(input), H.location.origin);
    if (target.origin !== H.location.origin || target.pathname !== '/api/backends/chat-completions/generate') { diagnostics.lastSkip = 'other_endpoint'; return; }
    diagnostics.matchedLocalRequests++;
    if (!options || typeof options.body !== 'string') { diagnostics.lastSkip = 'non_string_body'; return; }
    let data;
    try { data = JSON.parse(options.body); } catch (_) { diagnostics.lastSkip = 'invalid_json'; return; }
    if (!data || !Array.isArray(data.messages)) { diagnostics.lastSkip = 'messages_missing'; return; }
    const texts = data.messages.flatMap(message => typeof message?.content === 'string' ? [message.content] :
      Array.isArray(message?.content) ? message.content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text) : []);
    const combined = texts.join('\n'), blocks = texts.flatMap(completeBlocks);
    const allowedTypes = ['normal', 'continue', 'regenerate', 'swipe', 'quiet', 'impersonate'];
    records.unshift({ time: new Date().toISOString(), type: allowedTypes.includes(data.type) ? data.type : data.type == null ? 'unspecified' : 'other',
      messageCount: data.messages.length, plotBlockCount: blocks.length, plotBlocks: blocks,
      ejs: { true: combined.includes('RK_EJS_TRUE'), false: combined.includes('RK_EJS_FALSE_BAD'), nested: combined.includes('RK_EJS_NESTED_OK'),
        nestedBad: combined.includes('RK_EJS_NESTED_BAD'), ikki: combined.includes('RK_EJS_IKKI'), custom: combined.includes('RK_EJS_CUSTOM') },
      hasRawEjsTags: /<%|%>/.test(combined), bodyBytes: new TextEncoder().encode(options.body).byteLength });
    records.length = Math.min(records.length, 10); diagnostics.recordedRequests++; diagnostics.lastSkip = null; render();
  }
  function reinstall() {
    if (disposed || H.fetch === activeLayer?.wrapped) { renderStatus(); return false; }
    if (typeof H.fetch !== 'function') { notice.textContent = '当前 fetch 不可调用，未重新安装。'; renderStatus(); return false; }
    // Every layer closes over an immutable predecessor. An extension may have retained
    // an older probe wrapper; deactivate it, rather than pointing it at our new layer.
    if (activeLayer) activeLayer.active = false;
    const layer = { original: H.fetch, active: true, wrapped: null };
    layer.wrapped = function (...args) {
      if (layer.active && !disposed) {
        try { observe(args); } catch (_) { diagnostics.lastSkip = 'observation_error'; notice.textContent = '本次观察未完成；原始 fetch 继续执行，未保存原始 body。'; }
        renderStatus();
      }
      // Deliberately not async: preserve this, args, exact return and synchronous exceptions.
      return layer.original.apply(this, args);
    };
    activeLayer = layer; H.fetch = layer.wrapped; diagnostics.installs++;
    notice.textContent = '已在当前 fetch 外层安装观察；不会自动重新安装。'; renderStatus(); return true;
  }
  let mvuReady;
  try { mvuReady = Promise.resolve(helper('waitGlobalInitialized')('Mvu')).then(() => true, () => false); }
  catch (_) { mvuReady = Promise.resolve(false); }
  const pick = (value, fields) => Object.fromEntries(fields.filter(field => value && Object.hasOwn(value, field)).map(field => {
    const item = value[field]; return [field, item === null || ['string', 'number', 'boolean'].includes(typeof item) ? item : '[非标量，未展开]'];
  }));
  async function readSnapshot() {
    if (disposed || snapshotBusy) return;
    if (!isFixture()) { notice.textContent = '当前角色不是验收副本，未读取变量。'; return; }
    snapshotBusy = true; readButton.disabled = true;
    try {
      if (!(await mvuReady) || disposed) throw new Error('MVU 尚未就绪');
      const ctx = context(); if (!isFixture(ctx) || !Array.isArray(ctx.chat)) throw new Error('验收副本来源不可确认');
      const mvu = W.Mvu || H.Mvu; if (typeof mvu?.getMvuData !== 'function') throw new Error('MVU 同步读取接口不可用');
      const messages = ctx.chat.length ? helper('getChatMessages')(`0-${ctx.chat.length - 1}`, { role: 'assistant', include_swipes: true }) : [];
      if (!Array.isArray(messages)) throw new Error('助手消息接口不是同步数组');
      const floors = messages.map(message => {
        const messageId = message.message_id, swipeId = message.swipe_id;
        if (!Number.isInteger(messageId) || messageId < 0 || !Number.isInteger(swipeId) || swipeId < 0) return { sourceValid: false };
        const wrapper = mvu.getMvuData({ type: 'message', message_id: messageId });
        if (!wrapper || typeof wrapper.then === 'function') return { messageId, swipeId, error: 'MVU 包装不可同步读取' };
        const state = wrapper.stat_data;
        return { messageId, swipeId, activeSlotMatchesMvu: !!state && JSON.stringify(message.swipes_data?.[swipeId]?.stat_data) === JSON.stringify(state),
          system: pick(state?.系统, ['结构版本', '开局状态', '主角模式']), scene: pick(state?.场景, ['当前卷', '当前章', '阶段', '时间', '地点', '切入说明']),
          playerName: typeof state?.玩家?.姓名 === 'string' ? state.玩家.姓名 : null,
          eventVolumes: Object.values(state?.场景?.已发生事件 || {}).map(event => typeof event?.卷号 === 'number' ? event.卷号 : null),
          wrapperFields: Object.keys(wrapper).sort() };
      });
      if (context().chat !== ctx.chat || !isFixture()) throw new Error('读取期间聊天已变化');
      snapshot = { time: new Date().toISOString(), assistantCount: floors.length, floors }; render(); notice.textContent = '已只读核对全部助手活动回复页；未写入变量。';
    } catch (_) { notice.textContent = '本次只读快照未完成，请确认当前为验收副本且 MVU 已就绪后重试。'; }
    finally { snapshotBusy = false; if (!disposed) readButton.disabled = false; }
  }
  function download() {
    const urls = H.URL || URL; if (downloadUrl) urls.revokeObjectURL(downloadUrl);
    downloadUrl = urls.createObjectURL(new (H.Blob || Blob)([JSON.stringify({ testOnly: true, status: getStatus(), requests: records, snapshot }, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = element('a'); anchor.href = downloadUrl; anchor.download = 'chapter-fixture-sanitized-probe.json'; anchor.hidden = true;
    panel.appendChild(anchor); anchor.click(); anchor.remove();
  }
  function dispose() {
    if (disposed) return; disposed = true;
    if (activeLayer) { activeLayer.active = false; if (H.fetch === activeLayer.wrapped) H.fetch = activeLayer.original; }
    clearInterval(statusTimer);
    W.removeEventListener('pagehide', dispose); panel.remove();
    if (downloadUrl) (H.URL || URL).revokeObjectURL(downloadUrl);
    if (H.__RK_CHAPTER_RUNTIME_PROBE__ === api) delete H.__RK_CHAPTER_RUNTIME_PROBE__;
  }
  const api = { version: 'test-only-2', getRecords: () => structuredClone(records), getSnapshot: () => structuredClone(snapshot), getStatus, readSnapshot, reinstall, dispose };
  readButton.addEventListener('click', readSnapshot); reinstallButton.addEventListener('click', reinstall); downloadButton.addEventListener('click', download); closeButton.addEventListener('click', dispose);
  // Read-only status polling never writes fetch; only installation and the explicit button do.
  const statusTimer = setInterval(renderStatus, 1000);
  W.addEventListener('pagehide', dispose); H.__RK_CHAPTER_RUNTIME_PROBE__ = api; reinstall(); render();
})();
