  // Appearance is local UI state. Business pages are selected only by MVU.
  const APPEARANCE_KEY = 'rk:terminal:appearance:v1';
  let appearancePreference = normalizeTerminalAppearance(LS.get(APPEARANCE_KEY, 'auto'));
  function readTerminalState() {
    // ponytail: the only fallible boundary here is the external MVU reader.
    try { SS.stateError = ''; return readSnapshot().state; }
    catch (error) { SS.stateError = error.message; return null; }
  }
  function terminalBusinessIsRakudai(state) {
    if (arguments.length === 0) state = readTerminalState();
    return resolveTerminalWorld(state) === 'rakudai' && state?.系统?.开局状态 === '已建档';
  }
  function assertRakudaiBusiness() {
    if (!terminalBusinessIsRakudai()) throw new Error('当前作品未启用落第操作；切换外观不会改变本局作品。');
  }
  function businessAction(action) {
    return (...args) => { assertRakudaiBusiness(); return action(...args); };
  }
  function applyIframeAppearance() {
    const root = SS.iframe?.contentDocument?.documentElement;
    if (!root) return;
    root.dataset.terminalAppearance = SS.asterisk ? 'asterisk' : 'rakudai';
    root.querySelectorAll('select[data-terminal-appearance]').forEach(select => { select.value = appearancePreference; });
  }
  function setTerminalAppearance(value) {
    appearancePreference = normalizeTerminalAppearance(value);
    LS.set(APPEARANCE_KEY, appearancePreference);
    syncTerminalPresentation();
    applyIframeAppearance();
  }
  function syncTerminalPresentation() {
    const world = resolveTerminalWorld(readTerminalState());
    const changedWorld = SS.businessWorld !== world;
    if (changedWorld) {
      const previous = SS.businessWorld;
      SS.businessWorld = world;
      if (SS.iframe) {
        hide(); SS.cancelMount?.();
        SS.iframe.remove(); SS.iframe = null; SS.booted = false;
        for (const callback of SS.appCallbacks.splice(0)) {
          const index = updateCbs.indexOf(callback);
          if (index >= 0) updateCbs.splice(index, 1);
        }
        if (SS.blobUrl) { HW.URL.revokeObjectURL(SS.blobUrl); SS.blobUrl = null; }
      }
      if (previous !== undefined && !ASTERISK_PREVIEW) {
        generationPending = false; limeNativeStarting = false;
        limeHost.cancel(); limeStory.cancel(); correctionHostReset('CHAT_CHANGED');
      }
    }
    const worldLabel = world === 'asterisk' ? '学战都市' : world === 'rakudai' ? '落第骑士' : '尚未选择';
    const enabled = resolveTerminalAppearance(appearancePreference, world) === 'asterisk';
    SS.host.querySelector('[data-terminal-appearance]').value = appearancePreference;
    SS.host.querySelector('[data-terminal-world]').textContent = '本局：' + worldLabel;
    SS.host.querySelector('[data-terminal-world]').title = SS.stateError || '档案由本局作品决定，外观选择只改变样式。';
    SS.host.setAttribute('aria-label', worldLabel + '终端');
    if (statePanel) statePanel.hidden = world !== 'rakudai';
    if (SS.asterisk === enabled) return;
    SS.asterisk = enabled;
    for (const node of [SS.orb, SS.host, SS.wheel, SS.wheelBackdrop]) node.dataset.presentation = enabled ? 'asterisk' : 'rakudai';
    SS.host.querySelector('.crest-label').innerHTML = enabled ? '<span class="aw-bar-star">✳</span> 六花 · 科技界面' : '黑白 ADV · 便携终端';
    SS.wheel.setAttribute('aria-label', enabled ? '科技终端操作轮盘' : '黑白终端操作轮盘');
    const crest = SS.orb.querySelector('.crest');
    if (!SS.originalCrest) SS.originalCrest = crest.innerHTML;
    crest.innerHTML = enabled ? '<svg class="aw-orb-star" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2v28M2 16h28M6 6l20 20M6 26 26 6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m16 10 5 3v6l-5 3-5-3v-6z" fill="#0b2939" stroke="currentColor"/></svg><span>操作</span>' : SS.originalCrest;
    renderWheelContents();
    if (SS.wheelOpen) placeWheel();
    applyIframeAppearance();
  }
  function asteriskWheelMarkup() {
    const apps = [
      ['blazer', '档案', 'PROFILE', 'M8 4h8l4 4v16H4V8z M8 10h8 M8 15h8 M8 20h5'],
      ['lime', '通讯', 'CONNECT', 'M3 4h22v15H13l-7 6v-6H3z M8 9h12 M8 14h8'],
      ['moments', '动态', 'FEED', 'M2 15h6l4-10 5 19 4-9h6'],
      ['bbs', '论坛', 'FORUM', 'M3 4h22v20H3z M8 9h12 M8 14h12 M8 19h8'],
      ['schedule', '赛程', 'FESTA', 'M6 3h16v8a8 8 0 01-16 0z M6 6H2v5l5 4 M22 6h4v5l-5 4 M14 19v6 M8 25h12'],
      ['gallery', '画廊', 'GALLERY', 'M3 4h22v20H3z M3 21l8-8 5 5 4-5 5 6 M18 8h1'],
      ['calendar', '校历', 'CALENDAR', 'M3 6h22v18H3z M8 2v8 M20 2v8 M3 12h22 M8 17h3 M17 17h3'],
      ['settings', '设置', 'SYSTEM', 'M14 2l11 6v12l-11 6-11-6V8z M18 14a4 4 0 11-8 0 4 4 0 018 0'],
    ];
    const positions = [[30,13],[70,13],[90,39],[90,70],[70,91],[30,91],[10,70],[10,39]];
    const tiles = apps.map(([id,label,en,path], i) => `<button class="mono-sector aw-hex-command" role="menuitem" tabindex="${i ? -1 : 0}" data-app="${id}" data-label="${label}" style="--x:${positions[i][0]}%;--y:${positions[i][1]}%;--i:${i}"><svg class="aw-hex-border" viewBox="0 0 100 112" aria-hidden="true"><path d="M50 2 98 29v54l-48 27L2 83V29z"/><path d="M50 9 92 33v46L50 103 8 79V33z"/></svg><small>${String(i+1).padStart(2,'0')}</small><svg class="aw-command-icon" viewBox="0 0 28 28" aria-hidden="true"><path d="${path}"/></svg><b>${label}</b><em>${en}</em></button>`).join('');
    return `<div class="aw-wheel-linklines" aria-hidden="true"></div><div class="aw-hex-menu" role="menu" aria-label="六花终端应用轮盘">${tiles}</div><button class="mono-core aw-hex-core" aria-label="打开六花终端总览"><svg viewBox="0 0 100 112" aria-hidden="true"><path d="M50 2 98 29v54l-48 27L2 83V29z"/><path d="M50 11 90 34v44L50 101 10 78V34z"/></svg><span class="aw-core-star">✳</span><span>六花</span><small>ASTERISK</small></button><div class="mono-wheel-caption"><b>选择终端应用</b><small>RIKKA · CONNECT</small></div><button class="mono-wheel-close" type="button">× 收起轮盘</button>`;
  }
