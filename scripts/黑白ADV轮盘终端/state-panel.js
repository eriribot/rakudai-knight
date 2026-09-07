  // This view and its token are disposable. MVU remains the only saved story state.
  let statePanel = null;
  let stateCapture = null;
  let panelBusy = false;
  let panelRequest = 0;
  const panelChapters = ['序章', '第一章', '第二章', '第三章', '第四章', '终章'];

  function stateService() {
    const service = window.RakudaiStateController;
    if (!service || typeof service.capture !== 'function' || typeof service.transition !== 'function') {
      throw new Error('剧情状态服务尚未就绪，请刷新后重试。');
    }
    return service;
  }

  function panelText(selector, value) {
    const node = statePanel && statePanel.querySelector(selector);
    if (node) node.textContent = value;
  }

  function updatePanelActions() {
    if (!statePanel) return;
    const state = stateCapture && stateCapture.state;
    const system = state && state.系统 || {};
    const scene = state && state.场景 || {};
    const select = statePanel.querySelector('select');
    const chapter = scene.当前章 === '待选择' ? select.value : scene.当前章;
    const ready = !panelBusy && !!stateCapture && system.开局状态 === '已建档' && system.主角模式 !== '未选择' && scene.当前卷 === 1;
    const located = typeof scene.时间 === 'string' && scene.时间.trim() && typeof scene.地点 === 'string' && scene.地点.trim();
    select.disabled = panelBusy || !stateCapture || scene.当前章 !== '待选择';
    statePanel.querySelector('[data-story-action="refresh"]').disabled = panelBusy;
    statePanel.querySelector('[data-story-action="start"]').disabled = !ready || scene.阶段 !== '未开始' || !located || !panelChapters.includes(chapter);
    statePanel.querySelector('[data-story-action="end"]').disabled = !ready || scene.阶段 !== '进行中';
    statePanel.querySelector('[data-story-action="next"]').disabled = !ready || scene.阶段 !== '已结束' || scene.当前章 === '终章';
    statePanel.setAttribute('aria-busy', String(panelBusy));
  }

  function renderStatePanel() {
    const state = stateCapture && stateCapture.state;
    const system = state && state.系统 || {};
    const scene = state && state.场景 || {};
    panelText('[data-story-summary]', '第一卷剧情 · ' + (scene.当前章 || '未读取') + ' / ' + (scene.阶段 || '未读取'));
    panelText('[data-story-system]', '系统：' + (system.开局状态 || '未读取') + ' · ' + (system.主角模式 || '未选择'));
    panelText('[data-story-scene]', '场景：' + (scene.当前卷 === 1 ? '第一卷' : '卷数未确认') + ' · ' + (scene.当前章 || '未读取') + ' · ' + (scene.阶段 || '未读取'));
    panelText('[data-story-location]', '时间：' + (scene.时间 || '未确认') + '　地点：' + (scene.地点 || '未确认'));
    if (panelChapters.includes(scene.当前章)) statePanel.querySelector('select').value = scene.当前章;
    let hint = '按钮只确认剧情阶段；事件结果仍依据实际对话记录。';
    if (system.开局状态 !== '已建档') hint = '请先完成建档，再确认时间、地点并开始剧情。';
    else if (!scene.时间 || !scene.地点) hint = '请先在聊天中确认本章时间和地点，再开始剧情。';
    else if (scene.当前章 === '待选择') hint = '选择从第一卷的哪一章开始，然后点击“开始本章”。';
    else if (scene.当前章 === '终章' && scene.阶段 === '已结束') hint = '第一卷已结束；此面板不切换到其他卷。';
    panelText('[data-story-hint]', hint);
    updatePanelActions();
  }

  async function refreshStatePanel() {
    if (!statePanel || SS.destroyed || panelBusy) return;
    const request = ++panelRequest;
    panelBusy = true;
    updatePanelActions();
    panelText('[data-story-status]', '正在读取当前聊天状态…');
    try {
      const captured = await stateService().capture();
      if (request !== panelRequest || SS.destroyed || !statePanel) return;
      if (!captured || !captured.state || !captured.token) throw new Error('未取得可用的剧情状态，请完成建档后刷新。');
      stateCapture = captured;
      renderStatePanel();
      panelText('[data-story-status]', '已读取当前聊天状态。');
    } catch (error) {
      if (request !== panelRequest || SS.destroyed || !statePanel) return;
      stateCapture = null;
      renderStatePanel();
      panelText('[data-story-status]', error && error.message || String(error));
    } finally {
      if (request === panelRequest && !SS.destroyed && statePanel) {
        panelBusy = false;
        updatePanelActions();
      }
    }
  }

  async function performStoryAction(action) {
    if (!statePanel || !stateCapture || panelBusy || SS.destroyed) return;
    const button = statePanel.querySelector('[data-story-action="' + action + '"]');
    if (!button || button.disabled) return;
    const captured = stateCapture;
    const options = { action };
    if (action === 'start' && captured.state.场景.当前章 === '待选择') options.chapter = statePanel.querySelector('select').value;
    panelBusy = true;
    updatePanelActions();
    panelText('[data-story-status]', '正在保存剧情阶段…');
    let failure = '';
    try {
      await stateService().transition(captured.token, options);
      emit({ type: 'vars' });
    } catch (error) {
      failure = error && error.message || String(error);
    } finally {
      if (!SS.destroyed && statePanel) {
        panelBusy = false;
        await refreshStatePanel();
        if (failure) panelText('[data-story-status]', failure + '（已重新读取当前状态）');
      }
    }
  }

  function buildStatePanel() {
    statePanel = HD.createElement('details');
    statePanel.id = 'rk-story-panel';
    statePanel.open = true;
    statePanel.innerHTML = '<summary><span data-story-summary>第一卷剧情 · 未读取</span></summary>' +
      '<div class="rk-story-content"><p data-story-system></p><p data-story-scene></p><p data-story-location></p>' +
      '<label>起始章节 <select aria-label="选择第一卷起始章节"><option value="">请选择章节</option>' +
      panelChapters.map(chapter => '<option value="' + chapter + '">' + chapter + '</option>').join('') + '</select></label>' +
      '<div class="rk-story-actions"><button type="button" data-story-action="refresh">刷新</button>' +
      '<button type="button" data-story-action="start">开始本章</button><button type="button" data-story-action="end">结束本章</button>' +
      '<button type="button" data-story-action="next">进入下一章</button></div>' +
      '<p data-story-hint></p><p data-story-status role="status" aria-live="polite"></p></div>';
    SS.host.querySelector('.bar').after(statePanel);
    statePanel.querySelector('select').addEventListener('change', updatePanelActions);
    statePanel.addEventListener('click', event => {
      const button = event.target.closest('[data-story-action]');
      if (!button || !statePanel.contains(button) || button.disabled) return;
      const action = button.getAttribute('data-story-action');
      if (action === 'refresh') refreshStatePanel();
      else performStoryAction(action);
    });
    statePanel.addEventListener('toggle', () => { if (statePanel && statePanel.open) refreshStatePanel(); });
    updateCbs.push(() => {
      if (SS.visible) refreshStatePanel();
      else { stateCapture = null; updatePanelActions(); }
    });
    refreshStatePanel();
  }

  function disposeStatePanel() {
    ++panelRequest;
    stateCapture = null;
    statePanel = null;
  }
