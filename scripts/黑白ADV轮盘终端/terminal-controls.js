
/* MONO ADV controls: menu keyboard operation and UI-only status badge. */
(function () {
  var root = document.querySelector('.home-content');
  document.querySelectorAll('[data-layout-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      var layout = button.getAttribute('data-layout-choice');
      root.setAttribute('data-layout', layout);
      document.querySelectorAll('[data-layout-choice]').forEach(function (b) {
        b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
      });
    });
  });
  var items = Array.from(document.querySelectorAll('.mono-sector'));
  items.forEach(function (item, index) {
    function setLabel() {
      document.getElementById('mono-wheel-label').textContent = item.getAttribute('data-label');
      items.forEach(function (it) { it.setAttribute('tabindex', it === item ? '0' : '-1'); });
    }
    item.addEventListener('pointerenter', setLabel);
    item.addEventListener('focus', setLabel);
    item.addEventListener('keydown', function (e) {
      var next = index;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); openApp(item.getAttribute('data-app')); return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % items.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index + items.length - 1) % items.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = items.length - 1;
      else return;
      e.preventDefault(); items[next].focus();
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (currentStack.length > 1) goBack();
      else if (bridge && bridge.ui) bridge.ui.close();
    }
  });
  var originalUpdate = updateHomeScreen;
  updateHomeScreen = function () {
    originalUpdate();
    var badge = document.getElementById('mono-source');
    if (badge) {
      badge.textContent = dataStatus === 'ready' ? '本局档案' : dataStatus === 'error' ? '读取未就绪' : '读取中';
      badge.title = '终端 v' + (bridge && bridge.version || '未连接') + '；' + (dataStatus === 'error' ? dataError : '读取当前回复的 MVU 记录，未获知的人物资料保持空白。');
    }
  };
  updateHomeScreen();
})();


// 设置页保留处理详情；全局通知由酒馆宿主显示，不再占用终端每个页面。
var correctionProgressUI = (function installCorrectionProgress() {
  var stopStatus = null, countdown = null, panel = null, panelUpdate = null, panelPreview = null, savedPreview = null;
  var latest = null, actionSequence = 0, actionBusy = false;
  var stages = {
    waiting: '等待本轮保存', reading: '读取本轮', requesting: '请求模型', retrying: '等待重试',
    applying: '保存 MVU', verifying: '回读核对', applied: '已保存', unchanged: '无需更改',
    failed: '处理失败', cancelled: '已取消', inactive: '未启用', ready: '自动待命', preview: '预览待确认'
  };
  var activeStages = ['waiting', 'reading', 'requesting', 'retrying', 'applying', 'verifying'];
  function markup() {
    return '<span class="rk-progress-glyph" aria-hidden="true"></span><div class="rk-progress-copy">' +
      '<strong data-progress-stage></strong><p data-progress-message role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<small data-progress-attempt></small></div><div class="rk-progress-actions">' +
      '<button type="button" data-progress-retry hidden>重试本轮</button><button type="button" data-progress-cancel hidden>取消</button>' +
      '<button type="button" data-progress-settings>设置</button></div>';
  }
  function connectedPanel() { return panel && panel.isConnected; }
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function paint(node, status) {
    if (!node) return;
    var stage = status && status.state || 'inactive', active = activeStages.indexOf(stage) !== -1;
    node.setAttribute('data-state', stage);
    node.setAttribute('data-active', active ? 'true' : 'false');
    setText(node.querySelector('[data-progress-stage]'), '副 API · ' + (stages[stage] || '状态更新'));
    setText(node.querySelector('[data-progress-message]'), status && status.message || '保存连接配置后，自动读取本轮内容并校验保存。');
    var notes = [];
    if (Number.isFinite(status && status.attempt) && status.attempt > 0) {
      notes.push('尝试 ' + status.attempt + (Number.isFinite(status.maxAttempts) && status.maxAttempts > 0 ? '/' + status.maxAttempts : ''));
    }
    if (stage === 'retrying' && Number.isFinite(status && status.retryAt)) {
      var seconds = Math.max(0, Math.ceil((status.retryAt - Date.now()) / 1000));
      notes.push(seconds > 0 ? seconds + ' 秒后重试' : '即将重试');
    }
    setText(node.querySelector('[data-progress-attempt]'), notes.join(' · '));
    var retry = node.querySelector('[data-progress-retry]'), cancel = node.querySelector('[data-progress-cancel]');
    retry.hidden = !(status && status.canRetry); retry.disabled = actionBusy || active;
    cancel.hidden = !active; cancel.disabled = false;
  }
  function paintAll() {
    if (connectedPanel()) paint(panel, latest);
  }
  function readStatus() {
    try { latest = bridge && bridge.correction && bridge.correction.getStatus(); }
    catch (_) { latest = { state: 'inactive', message: '副 API 尚未连接，请在设置中核对配置。' }; }
    if (!latest || ['preview', 'unchanged'].indexOf(latest.state) === -1) savedPreview = null;
    paintAll();
    if (countdown) { clearInterval(countdown); countdown = null; }
    // 倒计时只刷新文字，不重新读取正文，也不触发额外请求。
    if (latest && latest.state === 'retrying' && Number.isFinite(latest.retryAt)) countdown = setInterval(paintAll, 1000);
    return latest;
  }
  async function retry() {
    var api = bridge && bridge.correction;
    if (!api || typeof api.retry !== 'function' || actionBusy || !(latest && latest.canRetry)) return;
    var token = ++actionSequence, owner = bridge;
    actionBusy = true; paintAll();
    try {
      var result = await api.retry();
      if (owner !== bridge || token !== actionSequence) return;
      // 手动任务的重试仍止于预览；自动任务由后台自己保存，界面不再调用 apply。
      if (result && result.automatic !== true && typeof result.patch === 'string' && Number.isFinite(result.count)) {
        if (currentStack[currentStack.length - 1] !== 'scr-settings') openApp('settings');
        showPreview(result);
      }
      readStatus();
    } catch (error) {
      if (owner !== bridge || token !== actionSequence) return;
      readStatus();
      if (!latest || latest.state !== 'failed') {
        latest = { state: 'failed', message: error && error.message || '重试失败，请核对连接后再试。', canRetry: false };
        paintAll();
      }
    } finally { if (token === actionSequence) { actionBusy = false; paintAll(); } }
  }
  function cancel() {
    actionSequence++; actionBusy = false;
    var api = bridge && bridge.correction;
    if (api && typeof api.cancel === 'function') api.cancel();
    readStatus();
  }
  function bindButtons(node) {
    node.querySelector('[data-progress-retry]').onclick = retry;
    node.querySelector('[data-progress-cancel]').onclick = cancel;
    node.querySelector('[data-progress-settings]').onclick = function () { openApp('settings'); };
  }
  function boot() {
    actionSequence++; actionBusy = false;
    if (stopStatus) { stopStatus(); stopStatus = null; }
    if (countdown) { clearInterval(countdown); countdown = null; }
    readStatus();
    if (bridge && typeof bridge.onUpdate === 'function') stopStatus = bridge.onUpdate(function (event) {
      if (event && event.type === 'correction-preview') {
        showPreview(event.result);
      } else if (event && event.type === 'correction-status') {
        var previous = latest, state = readStatus();
        if (connectedPanel() && panelUpdate) panelUpdate(state, previous, event);
      } else if (connectedPanel() && panelUpdate) panelUpdate(latest, latest, event);
    });
  }
  function showPreview(result) {
    if (!result || result.automatic === true || typeof result.patch !== 'string' || !Number.isFinite(result.count)) return;
    savedPreview = result;
    if (connectedPanel() && panelPreview) panelPreview(result);
  }
  var originalBoot = window.RKBoot;
  window.RKBoot = function (b) { originalBoot(b); boot(); };
  function destroy() {
    actionSequence++;
    if (stopStatus) stopStatus(); stopStatus = null;
    if (countdown) clearInterval(countdown); countdown = null;
    panel = null; panelUpdate = null; panelPreview = null; savedPreview = null;
  }
  if (bridge) boot();
  return {
    markup: markup,
    refresh: readStatus,
    showPreview: showPreview,
    destroy: destroy,
    setPanel: function (node, onUpdate, onPreview) {
      panel = node; panelUpdate = onUpdate; panelPreview = onPreview;
      if (!node) return;
      bindButtons(node); node.querySelector('[data-progress-settings]').hidden = true;
      node.querySelector('[data-progress-message]').setAttribute('aria-live', 'off');
      paint(node, latest || readStatus());
      if (panelUpdate) panelUpdate(latest, latest, { type: 'correction-status' });
      if (savedPreview && panelPreview) panelPreview(savedPreview);
    }
  };
})();


// 自动模式在宿主后台处理本轮；这里提供开关、处理状态和手动预览。
(function installCorrectionSettings() {
  var originalRender = renderSettings;
  var panelSequence = 0;
  renderSettings = function () {
    correctionProgressUI.setPanel(null);
    originalRender();
    var api = bridge && bridge.correction, body = document.getElementById('settings-body');
    if (!body || !api) return;
    var config;
    try { config = api.getConfig(); } catch (_) { return; }
    var sequence = ++panelSequence, actionSequence = 0, modelSequence = 0;
    var card = document.createElement('section');
    card.className = 'card1 rk-correction';
    card.innerHTML = '<div class="ct">副 API · MVU 校正</div>' +
      '<p>主回复负责当轮变量更新。副 API 自动复核本轮正文与事件，补齐遗漏的好感、支援及其他状态，校验后保存。</p>' +
      '<label class="rk-correction-auto"><input data-field="autoApply" type="checkbox">每轮自动校正并保存（保存配置后生效）</label>' +
      '<div data-auto-status class="rk-correction-progress" aria-label="副 API 处理进度">' + correctionProgressUI.markup() + '</div>' +
      '<label>API 地址<input data-field="endpoint" type="url" placeholder="https://example.com/v1" autocomplete="off" spellcheck="false"></label>' +
      '<label>API 密钥<input data-field="apiKey" type="password" autocomplete="off" placeholder="留空保留本机已保存密钥"></label>' +
      '<p data-key-status></p>' +
      '<div class="rk-correction-model"><label>可用模型<select data-model-list aria-label="拉取到的模型"><option value="">可拉取，也可手动填写</option></select></label><button type="button" data-action="models">拉取模型</button></div>' +
      '<div class="rk-correction-fields"><label>模型名称<input data-field="model" type="text" autocomplete="off" spellcheck="false" placeholder="从上方选择或手动填写"></label>' +
      '<label>输出上限<input data-field="maxTokens" type="number" min="256" max="30000" step="1" aria-label="最大输出 token"></label></div>' +
      '<p data-model-status role="status" aria-live="polite">填好地址和密钥即可拉取模型，无需先保存。</p>' +
      '<details class="rk-correction-fold"><summary>本轮内容 · 自动读取</summary><p data-context-source></p>' +
      '<label>本轮正文<textarea data-context-text rows="6" readonly aria-label="自动读取的本轮正文"></textarea></label>' +
      '<label>本轮发生的事<pre data-context-events tabindex="0"></pre></label>' +
      '<p>当前变量仅用于核对；请求时会重新读取最新内容。</p><button type="button" data-action="refresh">刷新本轮内容</button></details>' +
      '<label>补充说明（选填）<textarea data-field="deviation" rows="3" maxlength="6000" placeholder="无需抄写剧情。仅补充正文未写清的事实或具体纠错依据。"></textarea></label>' +
      '<details class="rk-correction-fold"><summary>校正提示词 · 内置且可编辑</summary><p>修改后可保存。本轮内容、世界书变量规则与输出格式会自动附带。</p>' +
      '<label>系统提示词<textarea data-field="prompt" rows="9" spellcheck="false"></textarea></label><button type="button" data-action="reset-prompt">恢复内置提示词</button></details>' +
      '<div class="rk-correction-actions"><button type="button" data-action="save">保存配置</button><button type="button" data-action="clear">清除密钥</button></div>' +
      '<div class="rk-correction-actions"><button type="button" data-action="request" class="rk-correction-primary">手动校正并预览</button><button type="button" data-action="cancel">取消</button></div>' +
      '<p role="status" aria-live="polite" data-status>手动模式保留预览。密钥在本机保存，重载自动恢复；留空保留，清除密钥会删除本机保存。</p>' +
      '<pre data-preview tabindex="0" aria-label="待应用的变量补丁" hidden></pre>' +
      '<button type="button" data-action="apply" disabled>应用预览补丁</button>';
    body.appendChild(card);
    function field(name) { return card.querySelector('[data-field="' + name + '"]'); }
    ['endpoint', 'model', 'maxTokens', 'deviation', 'prompt'].forEach(function (name) { field(name).value = config[name] == null ? '' : config[name]; });
    field('autoApply').checked = config.autoApply !== false;
    var status = card.querySelector('[data-status]'), preview = card.querySelector('[data-preview]');
    var apply = card.querySelector('[data-action="apply"]'), request = card.querySelector('[data-action="request"]');
    var models = card.querySelector('[data-model-list]'), fetchModels = card.querySelector('[data-action="models"]');
    var modelStatus = card.querySelector('[data-model-status]'), availableModels = [];
    function current() {
      return card.isConnected && sequence === panelSequence && currentStack[currentStack.length - 1] === 'scr-settings';
    }
    function refreshAutoStatus() { correctionProgressUI.refresh(); }
    // 设置页只更新只读上下文，用户正在编辑的连接与提示词不被刷新覆盖。
    correctionProgressUI.setPanel(card.querySelector('[data-auto-status]'), function (state, previous, event) {
      if (!card.isConnected || sequence !== panelSequence) return;
      var stage = state && state.state;
      if (event && event.type === 'correction-status') {
        if (stage === 'reading' || stage === 'requesting' || stage === 'applied' || stage === 'unchanged' || stage === 'ready') readContext();
        if (stage === 'reading' || stage === 'waiting') {
          preview.hidden = true; apply.disabled = true;
        }
        request.disabled = ['waiting', 'reading', 'requesting', 'retrying', 'applying', 'verifying'].indexOf(stage) !== -1;
        if (request.disabled || stage === 'cancelled' || stage === 'applied') apply.disabled = true;
      } else if (event && (event.reset || card.querySelector('.rk-correction-fold').open)) readContext();
    }, function (result) {
      preview.textContent = result.patch; preview.hidden = false; apply.disabled = result.count === 0; request.disabled = false;
      status.textContent = result.source + (result.count ? ' · ' + result.count + ' 项待检查，尚未写入。' : ' · 没有新的业务变量变化。') + (result.skipped?.length ? ' · 已略过程序维护字段：' + result.skipped.join('、') : '');
      readContext();
    });
    function keyStatus() { card.querySelector('[data-key-status]').textContent = config.hasKey ? '密钥已在本机保存，重载自动恢复。' : '未设置密钥；允许本地免认证端点。'; }
    function clearPreview(message) {
      actionSequence++; api.cancel(); apply.disabled = true; request.disabled = false; preview.hidden = true;
      if (message) status.textContent = message;
    }
    function showModels() {
      // 不用接口文本拼接 HTML，也不自动覆盖用户已选或手填的模型。
      models.replaceChildren();
      var hint = document.createElement('option'); hint.value = ''; hint.textContent = '请选择，或手动填写模型名'; models.appendChild(hint);
      var selected = field('model').value.trim();
      var names = availableModels.slice();
      if (selected && names.indexOf(selected) === -1) names.unshift(selected);
      names.forEach(function (name) {
        var option = document.createElement('option'); option.value = name; option.textContent = name; models.appendChild(option);
      });
      models.value = selected;
    }
    function edited(name) {
      // 配置改变后，旧请求和旧预览不可继续使用；在途的模型列表也不得回填。
      var wasFetching = fetchModels.disabled; modelSequence++; fetchModels.disabled = false;
      if (wasFetching) modelStatus.textContent = '配置已改变，可重新拉取模型。';
      if (name === 'endpoint' || name === 'apiKey') {
        availableModels = []; showModels(); modelStatus.textContent = '连接信息已改变，可重新拉取模型。';
      } else if (name === 'model') showModels();
      clearPreview('配置已修改，旧预览已失效。可保存配置或重新校正。');
    }
    function save(clearKey) {
      clearPreview();
      config = api.saveConfig({ endpoint: field('endpoint').value, model: field('model').value,
        maxTokens: Number(field('maxTokens').value), apiKey: field('apiKey').value,
        deviation: field('deviation').value, prompt: field('prompt').value, autoApply: field('autoApply').checked, clearKey: clearKey });
      field('apiKey').value = ''; keyStatus(); refreshAutoStatus();
    }
    function readContext() {
      var source = card.querySelector('[data-context-source]'), text = card.querySelector('[data-context-text]');
      var events = card.querySelector('[data-context-events]');
      try {
        var context = api.getContext();
        var nextSource = context.source || '已自动读取本轮内容。';
        var nextText = context.text || '本轮暂无可读取的正文。';
        var nextEvents = context.events && Object.keys(context.events).length ? JSON.stringify(context.events, null, 2) : '本轮没有新增事件记录。';
        if (source.textContent !== nextSource) source.textContent = nextSource;
        if (text.value !== nextText) text.value = nextText;
        if (events.textContent !== nextEvents) events.textContent = nextEvents;
      } catch (error) { source.textContent = error.message; text.value = ''; events.textContent = ''; }
    }
    ['endpoint', 'model', 'apiKey', 'maxTokens', 'deviation', 'prompt'].forEach(function (name) {
      field(name).addEventListener('input', function () { edited(name); });
    });
    field('autoApply').addEventListener('change', function () { edited('autoApply'); });
    models.onchange = function () {
      if (!models.value) return;
      field('model').value = models.value; edited('model');
    };
    fetchModels.onclick = async function () {
      var token = ++modelSequence;
      fetchModels.disabled = true; modelStatus.textContent = '正在拉取模型…';
      try {
        var result = await api.fetchModels({ endpoint: field('endpoint').value, apiKey: field('apiKey').value });
        if (!current() || token !== modelSequence) return;
        availableModels = Array.from(new Set((result.models || []).filter(function (name) { return typeof name === 'string' && name.trim(); })));
        showModels(); modelStatus.textContent = availableModels.length ? '已读取 ' + availableModels.length + ' 个模型，请选择。' : '接口未返回模型列表，可手动填写模型名。';
      } catch (error) { if (current() && token === modelSequence) modelStatus.textContent = error.message; }
      finally { if (current() && token === modelSequence) fetchModels.disabled = false; }
    };
    card.querySelector('[data-action="refresh"]').onclick = readContext;
    card.querySelector('.rk-correction-fold').addEventListener('toggle', function () { if (this.open) readContext(); });
    card.querySelector('[data-action="reset-prompt"]').onclick = function () {
      field('prompt').value = config.defaultPrompt || ''; edited('prompt'); status.textContent = '已恢复内置提示词，可保存配置或直接校正。';
    };
    keyStatus(); showModels(); readContext(); refreshAutoStatus();
    card.querySelector('[data-action="save"]').onclick = function () {
      try { save(false); status.textContent = '配置和密钥已在本机保存，重载自动恢复。'; } catch (error) { status.textContent = error.message; }
    };
    card.querySelector('[data-action="clear"]').onclick = function () {
      try { modelSequence++; fetchModels.disabled = false; availableModels = []; save(true); showModels(); status.textContent = '密钥已从本机保存中删除。'; } catch (error) { status.textContent = error.message; }
    };
    card.querySelector('[data-action="cancel"]').onclick = function () {
      if (fetchModels.disabled) modelStatus.textContent = '模型拉取已取消，可重新拉取。';
      modelSequence++; fetchModels.disabled = false; clearPreview('已取消请求与预览。');
    };
    request.onclick = async function () {
      var token;
      try {
        save(false); readContext(); token = ++actionSequence; request.disabled = true; status.textContent = '正在校正本轮内容…';
        var result = await api.request(); if (token !== actionSequence) return;
        // 即使用户收起终端或切到其他页，也保留本次有效预览，稍后从宿主通知继续检查。
        correctionProgressUI.showPreview(result);
      } catch (error) { if (current() && (token == null || token === actionSequence)) status.textContent = error.message; }
      finally { if (current() && (token == null || token === actionSequence)) request.disabled = false; }
    };
    apply.onclick = async function () {
      var token = ++actionSequence; apply.disabled = true; request.disabled = true;
      try { status.textContent = '正在通过 MVU 校验并保存…'; var message = await api.apply(); if (current() && token === actionSequence) status.textContent = message; }
      catch (error) { if (current() && token === actionSequence) status.textContent = error.message; }
      finally { if (current() && token === actionSequence) request.disabled = false; }
    };
  };
})();
