  // MVU 是唯一保存的剧情状态；表单与操作凭据不会另存剧情。
  let statePanel = null, stateCapture = null, panelMigration = null;
  let panelBusy = false, panelReading = false, panelRequest = 0, panelEpoch = 0;
  let panelCatalogue = [], panelUpdate = null, panelBackupUrl = null;
  let panelDisplayState = null, panelDisplaySource = null, panelReadOnly = true;
  let injectionPreviewRequest = 0;
  const routeCaptures = { jump: null, nextVolume: null };

  function stateService() {
    const service = window.RakudaiStateController;
    if (!service || service.version !== '4.0.0' || typeof service.capture !== 'function' || typeof service.transition !== 'function') throw new Error('剧情状态服务尚未就绪，请更新终端与 v4 约束后刷新。');
    return service;
  }
  function panelNode(selector) { return statePanel && statePanel.querySelector(selector); }
  function panelText(selector, value) { const node = panelNode(selector); if (node) node.textContent = value; }
  function panelVolume(volume) { return panelCatalogue.find(item => item.volume === volume); }
  function panelPosition(volume, chapter) {
    let position = 0;
    for (const book of panelCatalogue) for (const node of book.chapters) {
      if (book.volume === volume && node.key === chapter) return position;
      position++;
    }
    return -1;
  }
  function sceneLabel(scene) {
    const book = panelVolume(scene.当前卷);
    return (book ? '第' + book.volume + '卷' : '卷数未确认') + ' · ' + (scene.当前章 || '未读取') + ' / ' + (scene.阶段 || '未读取');
  }
  function setPanelOptions(select, options, selected) {
    const signature = JSON.stringify(options);
    if (select.dataset.options !== signature) {
      select.replaceChildren();
      for (const item of options) {
        const option = HD.createElement('option'); option.value = String(item.value); option.textContent = item.label; select.appendChild(option);
      }
      select.dataset.options = signature;
    }
    if (selected !== undefined && options.some(item => String(item.value) === String(selected))) select.value = String(selected);
  }
  function closeRouteForms(clearDrafts = false) {
    routeCaptures.jump = null; routeCaptures.nextVolume = null;
    if (!statePanel) return;
    panelNode('[data-story-next-volume]').hidden = true;
    panelNode('[data-story-jump]').open = false;
    if (clearDrafts) for (const form of statePanel.querySelectorAll('[data-story-form]')) form.reset();
  }
  function firstNextVolumeChapter() {
    const captured = routeCaptures.nextVolume;
    return captured && panelVolume(captured.state.场景.当前卷 + 1)?.chapters[0]?.key;
  }
  function updatePanelActions() {
    if (!statePanel) return;
    const state = stateCapture?.state || panelDisplayState, scene = state?.场景 || {}, system = state?.系统 || {};
    const book = panelVolume(scene.当前卷), index = book ? book.chapters.findIndex(chapter => chapter.key === scene.当前章) : -1;
    const ready = !panelBusy && !panelReading && !generationPending && !panelReadOnly && !!stateCapture && system.开局状态 === '已建档' && system.主角模式 !== '未选择' && !!book;
    const start = panelNode('[data-story-start-chapter]');
    const located = typeof scene.时间 === 'string' && scene.时间.trim() && typeof scene.地点 === 'string' && scene.地点.trim();
    const selected = scene.当前章 === '待选择' ? start.value : scene.当前章;
    panelNode('[data-story-start-choice]').hidden = scene.当前章 !== '待选择';
    start.disabled = !ready || scene.当前章 !== '待选择';
    panelNode('[data-story-action="refresh"]').disabled = panelBusy;
    panelNode('[data-story-action="start"]').disabled = !ready || scene.阶段 !== '未开始' || !located || !book.chapters.some(chapter => chapter.key === selected);
    panelNode('[data-story-action="end"]').disabled = !ready || scene.阶段 !== '进行中';
    panelNode('[data-story-action="next"]').disabled = !ready || scene.阶段 !== '已结束' || index < 0 || index === book.chapters.length - 1;
    panelNode('[data-story-action="nextVolume"]').disabled = !ready || scene.阶段 !== '已结束' || index !== book.chapters.length - 1 || !panelVolume(scene.当前卷 + 1);
    const atVolumeEnd = !!book && index === book.chapters.length - 1;
    panelNode('[data-story-action="next"]').hidden = atVolumeEnd;
    panelNode('[data-story-action="nextVolume"]').hidden = !atVolumeEnd || scene.阶段 !== '已结束';
    panelNode('[data-story-jump]').hidden = !state || system.开局状态 !== '已建档';
    for (const action of ['jump', 'nextVolume']) {
      const form = panelNode('[data-story-form="' + action + '"]'), enabled = ready && !!routeCaptures[action];
      for (const control of form.querySelectorAll('input,textarea,select,button')) control.disabled = !enabled;
      form.querySelector('[data-story-submit]').disabled = !enabled || !(action === 'jump' ? form.elements.chapter.value : firstNextVolumeChapter());
    }
    panelNode('[data-story-action="migrate"]').disabled = panelBusy || panelReading || generationPending || panelReadOnly || !panelMigration || panelMigration.status !== 'migration-required';
    panelNode('[data-story-action="backup"]').disabled = !panelMigration || panelBusy;
    statePanel.setAttribute('aria-busy', String(panelBusy));
  }
  function renderStatePanel() {
    const state = stateCapture?.state || panelMigration?.before || panelDisplayState, system = state?.系统 || {}, scene = state?.场景 || {}, book = panelVolume(scene.当前卷);
    panelText('[data-story-summary]', '剧情 · ' + sceneLabel(scene));
    panelText('[data-story-system]', '系统：' + (system.开局状态 || '未读取') + ' · ' + (system.主角模式 || '未选择'));
    panelText('[data-story-scene]', (book ? book.title + ' · ' : '') + sceneLabel(scene));
    panelText('[data-story-location]', '时间：' + (scene.时间 || '未确认') + '　地点：' + (scene.地点 || '未确认'));
    panelText('[data-story-display-source]', panelDisplayState && (generationPending || panelReadOnly)
      ? '暂显最近已保存状态 · ' + sourceLabel(panelDisplaySource) + '；等待当前回复 MVU，剧情操作暂不可用。' : '');
    setPanelOptions(panelNode('[data-story-start-chapter]'), [{ value: '', label: '请选择章节' }, ...(book?.chapters || []).map(chapter => ({ value: chapter.key, label: chapter.key + ' · ' + chapter.title }))], scene.当前章 === '待选择' ? undefined : scene.当前章);
    let hint = 'AI 按当前世界书条目的完成标识，在 MVU 更新时自动进入相邻下一章；按钮保留为手动兜底。事件、人际与能力仍依据本局实际记录。';
    if (panelMigration) hint = '当前为 v3 存档，先核对下方差异，再明确确认升级。预览不会修改聊天。';
    else if (system.开局状态 !== '已建档') hint = '请先完成开局建档。';
    else if (HW.__RK_MVU_GUARD_V4__?.automaticStoryProgress !== true) hint = '自动切章需要同步更新并启用 MVU v4 字段约束脚本；当前可使用按钮手动兜底。';
    else if (scene.当前卷 === 19 && scene.当前章 === book?.chapters.at(-1)?.key && scene.阶段 === '已结束') hint = '已到第 19 卷末。回看已有剧情请使用聊天分支或已有回复页。';
    else if (!scene.时间 || !scene.地点) hint = '请先在本局确认时间和地点，再开始本章。';
    panelText('[data-story-hint]', hint);
    panelNode('[data-story-migration]').hidden = !panelMigration;
    if (panelMigration) panelText('[data-story-migration-diff]', panelMigration.changes.map(change => change.path + '\n  ' + (change.before === undefined ? '未设置' : JSON.stringify(change.before)) + ' → ' + JSON.stringify(change.after)).join('\n\n') || '当前已是 v4，无需迁移。');
    updatePanelActions();
  }
  function sourceLabel(source) {
    if (!source || !Number.isInteger(source.messageId)) return '当前消息来源未确认';
    return '第 ' + source.messageId + ' 楼' + (Number.isInteger(source.swipeId) ? ' · 回复 ' + (source.swipeId + 1) : '');
  }
  function injectionService() {
    const service = HW.__RK_PLOT_V3__;
    if (!service || service.version !== '3.0.0' || typeof service.preview !== 'function' || typeof service.getStatus !== 'function' || typeof service.setEnabled !== 'function') throw new Error('请导入并启用新版章节注入器（3.0.0）。');
    return service;
  }
  async function refreshInjectionPreview() {
    if (!statePanel) return;
    const request = ++injectionPreviewRequest, panel = statePanel, epoch = panelEpoch;
    const toggle = panelNode('[data-story-injection-enabled]');
    try {
      const service = injectionService(), status = service.getStatus();
      toggle.disabled = false; toggle.checked = status.enabled;
      panelText('[data-story-injection-status]', (status.enabled ? '章节注入已启用。' : '章节注入已关闭。') + (status.reason || ''));
      const previous = status.lastInjection;
      const previousEntry = previous && typeof previous.worldbook === 'string' && typeof previous.entryName === 'string' && Number.isInteger(previous.entryOrder)
        ? ' · ' + previous.worldbook + ' / ' + previous.entryName + '（order ' + previous.entryOrder + '）' : '';
      panelText('[data-story-last-injection]', previous ? '最近一次：第' + previous.volume + '卷 · ' + previous.chapter + ' · ' + previous.phase + ' · ' + sourceLabel(previous.source) + previousEntry : '本会话尚无注入记录。');
      try {
        const preview = await service.preview();
        if (request !== injectionPreviewRequest || panel !== statePanel || epoch !== panelEpoch || SS.destroyed) return;
        panelText('[data-story-injection-source]', '预览来源：' + sourceLabel(preview.source) + ' · ' + preview.worldbook + ' / ' + preview.entryName + '（order ' + preview.entryOrder + '）');
        panelText('[data-story-injection-preview]', preview.text || '当前状态没有可注入的剧情。');
      } catch (error) {
        if (request !== injectionPreviewRequest || panel !== statePanel || epoch !== panelEpoch || SS.destroyed) return;
        panelText('[data-story-injection-source]', '当前预览不可用'); panelText('[data-story-injection-preview]', error.message || String(error));
      }
    } catch (error) {
      if (request !== injectionPreviewRequest || panel !== statePanel || epoch !== panelEpoch || SS.destroyed) return;
      toggle.disabled = true; toggle.checked = false;
      panelText('[data-story-injection-status]', error.message || String(error));
      panelText('[data-story-last-injection]', ''); panelText('[data-story-injection-source]', ''); panelText('[data-story-injection-preview]', '');
    }
  }
  async function refreshStatePanel() {
    if (!statePanel || SS.destroyed || panelBusy || panelReading) return;
    const request = ++panelRequest; panelReading = true; updatePanelActions();
    let snapshot = null;
    try {
      const service = stateService(); panelCatalogue = service.catalogue;
      if (!Array.isArray(panelCatalogue) || !panelCatalogue.length) throw new Error('剧情目录尚未就绪，请更新终端。');
      try { snapshot = await readSnapshot(); } catch (_) {}
      if (request !== panelRequest || SS.destroyed || !statePanel) return;
      if (generationPending || snapshot?.pending) {
        stateCapture = null; panelMigration = null; panelReadOnly = true; closeRouteForms();
        if (snapshot?.state) { panelDisplayState = snapshot.state; panelDisplaySource = snapshot.source || null; }
        renderStatePanel();
        panelText('[data-story-status]', snapshot?.message || '等待当前回复 MVU，暂时保留已保存状态。');
        return;
      }
      let captured, migration;
      try { captured = await service.capture(); }
      catch (error) { if (error.code !== 'MIGRATION_REQUIRED') throw error; migration = await service.prepareMigration(); }
      if (request !== panelRequest || SS.destroyed || !statePanel) return;
      if (captured && (!captured.state || !captured.token)) throw new Error('未取得可用的剧情状态。');
      if (generationPending) throw new Error('正在生成，等待当前回复 MVU。');
      stateCapture = captured || null; panelMigration = migration || null; panelReadOnly = false;
      panelDisplayState = captured?.state || migration?.before || null;
      panelDisplaySource = snapshot?.source || null;
      renderStatePanel();
      panelText('[data-story-status]', migration ? '已准备迁移候选，尚未写入。' : '已读取当前聊天状态。');
    } catch (error) {
      if (request !== panelRequest || SS.destroyed || !statePanel) return;
      stateCapture = null; panelMigration = null; panelReadOnly = true; closeRouteForms();
      try { snapshot = await readSnapshot(); } catch (_) {}
      if (request !== panelRequest || SS.destroyed || !statePanel) return;
      if (snapshot?.state) { panelDisplayState = snapshot.state; panelDisplaySource = snapshot.source || null; }
      renderStatePanel();
      panelText('[data-story-status]', error.message || String(error));
    } finally {
      if (request === panelRequest && statePanel) { panelReading = false; updatePanelActions(); refreshInjectionPreview(); }
    }
  }
  function fillJumpChapters() {
    const capture = routeCaptures.jump, form = panelNode('[data-story-form="jump"]'); if (!capture) return;
    const scene = capture.state.场景, from = panelPosition(scene.当前卷, scene.当前章), volume = Number(form.elements.volume.value);
    const chapters = (panelVolume(volume)?.chapters || []).filter(chapter => panelPosition(volume, chapter.key) > from);
    setPanelOptions(form.elements.chapter, chapters.map(chapter => ({ value: chapter.key, label: chapter.key + ' · ' + chapter.title })));
    updateRouteSummary('jump'); updatePanelActions();
  }
  function updateRouteSummary(action) {
    const captured = routeCaptures[action]; if (!captured) return;
    const form = panelNode('[data-story-form="' + action + '"]');
    const volume = action === 'jump' ? Number(form.elements.volume.value) : captured.state.场景.当前卷 + 1;
    const chapter = action === 'jump' ? form.elements.chapter.value : firstNextVolumeChapter();
    form.querySelector('[data-story-route-summary]').textContent = '从 ' + sceneLabel(captured.state.场景) + ' → 第' + volume + '卷 · ' + (chapter || '没有更后的章节') + ' / 未开始。保留已发生事件，不补造跳过的剧情。';
  }
  function openRouteForm(action) {
    if (!stateCapture || panelBusy || panelReading || generationPending || panelReadOnly) return;
    routeCaptures[action] = stateCapture;
    const form = panelNode('[data-story-form="' + action + '"]');
    if (action === 'jump') {
      const scene = stateCapture.state.场景, from = panelPosition(scene.当前卷, scene.当前章);
      const volumes = panelCatalogue.filter(book => book.chapters.some(chapter => panelPosition(book.volume, chapter.key) > from));
      setPanelOptions(form.elements.volume, volumes.map(book => ({ value: book.volume, label: '第' + book.volume + '卷 · ' + book.title })));
      fillJumpChapters();
    } else { panelNode('[data-story-next-volume]').hidden = false; updateRouteSummary(action); }
    updatePanelActions(); form.elements.time.focus({ preventScroll: true });
  }
  async function runPanelWrite(operation, success) {
    if (panelBusy || panelReading || generationPending || panelReadOnly || SS.destroyed) return;
    const epoch = panelEpoch; panelBusy = true; updatePanelActions(); panelText('[data-story-status]', '正在保存并核对当前楼层…');
    let failure = '';
    try { await operation(); if (epoch === panelEpoch && statePanel) { closeRouteForms(true); emit({ type: 'vars' }); } }
    catch (error) { failure = error.message || String(error); }
    finally {
      panelBusy = false;
      if (!SS.destroyed && statePanel) {
        await refreshStatePanel();
        if (epoch === panelEpoch) panelText('[data-story-status]', failure ? failure + '（草稿保留；重新打开表单可更新操作基准）' : success);
      }
    }
  }
  function submitRoute(action, event) {
    event.preventDefault();
    const captured = routeCaptures[action], form = event.currentTarget;
    if (!captured || panelBusy || panelReading || generationPending || panelReadOnly || !form.reportValidity()) return;
    const request = { action, time: form.elements.time.value, location: form.elements.location.value, entryNote: form.elements.entryNote.value };
    if (action === 'jump') { request.volume = Number(form.elements.volume.value); request.chapter = form.elements.chapter.value; }
    runPanelWrite(() => stateService().transition(captured.token, request), '已切入目标卷章，尚未开始。核对场景后点击“开始本章”。');
  }
  function downloadMigrationBackup() {
    if (!panelMigration) return;
    const urls = HW.URL || URL;
    if (panelBackupUrl) urls.revokeObjectURL(panelBackupUrl);
    panelBackupUrl = urls.createObjectURL(new (HW.Blob || Blob)([JSON.stringify(panelMigration.before, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
    const anchor = HD.createElement('a'); anchor.href = panelBackupUrl; anchor.download = '落第骑士-v3-迁移前stat_data.json'; anchor.hidden = true;
    statePanel.appendChild(anchor); anchor.click(); anchor.remove();
    panelText('[data-story-status]', '已请求下载迁移前 stat_data 备份。当前聊天尚未修改。');
  }
  function handleStoryAction(action) {
    if (action === 'refresh') return refreshStatePanel();
    if (action === 'preview') return refreshInjectionPreview();
    if (action === 'backup') return downloadMigrationBackup();
    if (action === 'cancel-route') { closeRouteForms(); updatePanelActions(); return; }
    if (generationPending || panelReadOnly || panelReading) return;
    if (action === 'migrate') {
      const migration = panelMigration; if (!migration) return;
      return runPanelWrite(() => stateService().commitMigration(migration.token), '已升级为 v4，并回读确认当前楼层。');
    }
    if (!stateCapture || panelBusy) return;
    if (action === 'nextVolume') return openRouteForm('nextVolume');
    const captured = stateCapture, request = { action };
    if (action === 'start' && captured.state.场景.当前章 === '待选择') request.chapter = panelNode('[data-story-start-chapter]').value;
    runPanelWrite(() => stateService().transition(captured.token, request), '已保存并回读剧情阶段。');
  }
  function routeFields() {
    return '<label>目标时间<input name="time" required autocomplete="off" placeholder="填写本局已确认的时间"></label>' +
      '<label>目标地点<input name="location" required autocomplete="off" placeholder="填写本局已确认的地点"></label>' +
      '<label>切入说明<textarea name="entryNote" required rows="2" placeholder="说明从什么情境继续"></textarea></label>';
  }
  function buildStatePanel() {
    statePanel = HD.createElement('details'); statePanel.id = 'rk-story-panel'; statePanel.open = true;
    statePanel.innerHTML = '<summary><span data-story-summary>剧情 · 未读取</span></summary><div class="rk-story-content">' +
      '<p data-story-system></p><p data-story-scene></p><p data-story-location></p><p data-story-display-source role="status"></p>' +
      '<label data-story-start-choice hidden>起始章节<select data-story-start-chapter aria-label="选择当前卷起始章节"></select></label>' +
      '<div class="rk-story-actions"><button type="button" data-story-action="refresh">刷新</button><button type="button" data-story-action="start">开始本章</button>' +
      '<button type="button" data-story-action="end">结束本章</button><button type="button" data-story-action="next">进入下一章</button><button type="button" data-story-action="nextVolume">进入下一卷</button></div>' +
      '<p data-story-hint></p><p data-story-status role="status" aria-live="polite"></p>' +
      '<section class="rk-story-box" data-story-migration hidden><h3>升级旧存档至 v4</h3><p>旧事件补记为第 1 卷。先核对差异；只有点击确认升级才会写入当前楼层。</p><pre data-story-migration-diff></pre>' +
      '<div class="rk-story-actions"><button type="button" data-story-action="backup">下载迁移前备份</button><button type="button" data-story-action="migrate">确认升级当前楼层</button></div></section>' +
      '<section class="rk-story-box" data-story-next-volume hidden><h3>确认进入下一卷</h3><form data-story-form="nextVolume"><p data-story-route-summary></p>' + routeFields() +
      '<div class="rk-story-actions"><button type="submit" data-story-submit>确认进入下一卷</button><button type="button" data-story-action="cancel-route">取消</button></div></form></section>' +
      '<details class="rk-story-box" data-story-jump><summary>手动向前切入</summary><form data-story-form="jump"><label>目标卷<select name="volume"></select></label><label>目标章<select name="chapter"></select></label><p data-story-route-summary></p>' + routeFields() +
      '<button type="submit" data-story-submit>确认向前切入</button></form></details>' +
      '<details class="rk-story-box" data-story-injection><summary>章节注入与预览</summary><label class="rk-story-check"><input type="checkbox" data-story-injection-enabled>启用章节注入</label>' +
      '<p data-story-injection-status></p><p data-story-last-injection></p><p data-story-injection-source></p><button type="button" data-story-action="preview">刷新注入预览</button><pre data-story-injection-preview></pre></details></div>';
    SS.host.querySelector('.bar').after(statePanel);
    statePanel.addEventListener('click', event => {
      const button = event.target.closest('[data-story-action]');
      if (button && statePanel.contains(button) && !button.disabled) { try { handleStoryAction(button.dataset.storyAction); } catch (error) { panelText('[data-story-status]', error.message || String(error)); } }
    });
    panelNode('[data-story-start-chapter]').addEventListener('change', updatePanelActions);
    panelNode('[data-story-jump]').addEventListener('toggle', event => {
      if (event.target !== panelNode('[data-story-jump]')) return;
      if (event.target.open) openRouteForm('jump'); else routeCaptures.jump = null;
    });
    for (const action of ['jump', 'nextVolume']) panelNode('[data-story-form="' + action + '"]').addEventListener('submit', event => submitRoute(action, event));
    panelNode('[data-story-form="jump"]').elements.volume.addEventListener('change', fillJumpChapters);
    panelNode('[data-story-form="jump"]').elements.chapter.addEventListener('change', () => updateRouteSummary('jump'));
    panelNode('[data-story-injection-enabled]').addEventListener('change', event => {
      try { injectionService().setEnabled(event.target.checked); } catch (error) { panelText('[data-story-injection-status]', error.message || String(error)); }
      refreshInjectionPreview();
    });
    statePanel.addEventListener('toggle', event => { if (event.target === statePanel && statePanel.open) refreshStatePanel(); });
    panelUpdate = event => {
      if (event?.reset) {
        ++panelEpoch; ++panelRequest; ++injectionPreviewRequest; panelReading = false; stateCapture = null; panelMigration = null; panelReadOnly = true;
        if (!event.retainDisplay) { panelDisplayState = null; panelDisplaySource = null; }
        closeRouteForms(true); renderStatePanel();
        panelText('[data-story-status]', event.retainDisplay ? '等待当前回复 MVU，剧情操作暂不可用。' : '正在读取当前聊天状态。');
      }
      if (SS.visible && statePanel?.open) refreshStatePanel();
    };
    updateCbs.push(panelUpdate); updatePanelActions(); refreshStatePanel();
  }
  function disposeStatePanel() {
    ++panelEpoch; ++panelRequest; ++injectionPreviewRequest;
    if (panelUpdate) { const index = updateCbs.indexOf(panelUpdate); if (index >= 0) updateCbs.splice(index, 1); }
    if (panelBackupUrl) (HW.URL || URL).revokeObjectURL(panelBackupUrl);
    panelBackupUrl = null; panelUpdate = null; stateCapture = null; panelMigration = null; statePanel = null;
    panelDisplayState = null; panelDisplaySource = null; panelReadOnly = true;
    routeCaptures.jump = null; routeCaptures.nextVolume = null; panelReading = false;
  }
