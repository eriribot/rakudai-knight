/* =========================================================================
 * 落第骑士英雄谭 · 破军伐刀者智能终端 v1.3.0 MONO ADV
 * 运行环境：TavernHelper 卡内脚本（script iframe）；UI 注入 ST 宿主 document
 * 结构：破军战术微光悬浮球(自由吸附) + 桌面浮动可拖拽终端(自由停靠与缩放) + 沙箱 iframe + MVU桥接
 * v1.3.0 更新：① 添加輪盤展開動畫 ② 終端打開時隱藏輪盤入口球 ③ 移除硬編碼測試數據
 * ========================================================================= */
/*__INJECT_STATE_CONTROLLER__*/

(async function () {
  'use strict';

  function hostWindow() {
    try { if (window.parent && window.parent !== window && window.parent.document) return window.parent; }
    catch (_) {}
    return window;
  }
  const HW = hostWindow();
  const HD = (function(){ try { return HW.document; } catch (_) { return document; } })();

  const SLOT = '__RK_PHONE_SHELL__';
  try { HW[SLOT] && HW[SLOT].destroy && HW[SLOT].destroy(); } catch (_) {}

  const SS = {
    mode: 'floating', visible: false,
    host: null, iframe: null, blobUrl: null, orb: null, style: null,
    rect: null, orbPos: {x: 0, y: 0},
    disposers: [], booted: false, mounting: null, destroyed: false, badge: 0,
    wheel: null, wheelBackdrop: null, wheelOpen: false, focusBeforeWheel: null
  };

  const LS = {
    get(k, d) { try { const v = HW.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(_) { return d; } },
    set(k, v) { try { HW.localStorage.setItem(k, JSON.stringify(v)); } catch(_) {} }
  };

  function fn(name) {
    try { if (typeof window[name] === 'function') return window[name]; } catch(_) {}
    try { if (window.TavernHelper && typeof window.TavernHelper[name] === 'function')
      return window.TavernHelper[name].bind(window.TavernHelper); } catch(_) {}
    return null;
  }

  const ORB_W = 68, ORB_H = 68;

  /*__INJECT_LAYOUT__*/

  /* 样式注入 */
  const css = /*__INJECT_STYLES__*/;


  function buildDom() {
    SS.style = HD.createElement('style');
    SS.style.textContent = css;
    HD.head.appendChild(SS.style);

    SS.orb = HD.createElement('div');
    SS.orb.id = 'rk-orb';
    SS.orb.title = '点击展开操作轮盘；拖动可移动入口';
    SS.orb.setAttribute('role', 'button');
    SS.orb.setAttribute('tabindex', '0');
    SS.orb.setAttribute('aria-label', '打开终端操作轮盘');
    SS.orb.setAttribute('aria-expanded', 'false');
    SS.orb.setAttribute('aria-controls', 'rk-wheel');
    SS.orb.setAttribute('aria-haspopup', 'menu');
    SS.orb.innerHTML = "<div class=\"crest\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" aria-hidden=\"true\" class=\"mono-aperture\" fill=\"currentColor\"><polygon points=\"16.63,1.47 28.58,8.37 21.71,16.16 19.95,11.31\"/><polygon points=\"28.90,9.28 28.90,23.08 18.72,21.03 22.03,17.07\"/><polygon points=\"28.27,23.81 16.32,30.71 13.00,20.87 18.09,21.76\"/><polygon points=\"15.37,30.53 3.42,23.63 10.29,15.84 12.05,20.69\"/><polygon points=\"3.10,22.72 3.10,8.92 13.28,10.97 9.97,14.93\"/><polygon points=\"3.73,8.19 15.68,1.29 19.00,11.13 13.91,10.24\"/></svg><span>操作</span></div><span class=\"b\"></span><span class=\"tip\" aria-hidden=\"true\"></span>";
    HD.body.appendChild(SS.orb);

    const op = LS.get('rk:orb', null), vp = viewport();
    const ox = op ? op.x : vp.x + vp.w - ORB_W - 16;
    const oy = op ? op.y : vp.y + Math.round(vp.h * 0.45);
    placeOrb(clampOrb(ox, oy));

    SS.host = HD.createElement('section');
    SS.host.id = 'rk-shell';
    SS.host.setAttribute('role', 'region');
    SS.host.setAttribute('aria-label', '破军战术终端');
    SS.host.innerHTML = `
      <div class="bar">
        <span class="crest-label"><svg xmlns="http://www.w3.org/2000/svg" class="" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="1" width="1" height="1"/><rect x="4" y="1" width="1" height="1"/><rect x="5" y="1" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="8" y="1" width="1" height="1"/><rect x="9" y="1" width="1" height="1"/><rect x="10" y="1" width="1" height="1"/><rect x="11" y="1" width="1" height="1"/><rect x="12" y="1" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="9" y="2" width="1" height="1"/><rect x="10" y="2" width="1" height="1"/><rect x="11" y="2" width="1" height="1"/><rect x="12" y="2" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/><rect x="11" y="3" width="1" height="1"/><rect x="12" y="3" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="11" y="4" width="1" height="1"/><rect x="12" y="4" width="1" height="1"/><rect x="3" y="5" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/><rect x="8" y="5" width="1" height="1"/><rect x="11" y="5" width="1" height="1"/><rect x="12" y="5" width="1" height="1"/><rect x="3" y="6" width="1" height="1"/><rect x="4" y="6" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/><rect x="8" y="6" width="1" height="1"/><rect x="11" y="6" width="1" height="1"/><rect x="12" y="6" width="1" height="1"/><rect x="3" y="7" width="1" height="1"/><rect x="4" y="7" width="1" height="1"/><rect x="7" y="7" width="1" height="1"/><rect x="8" y="7" width="1" height="1"/><rect x="11" y="7" width="1" height="1"/><rect x="12" y="7" width="1" height="1"/><rect x="3" y="8" width="1" height="1"/><rect x="4" y="8" width="1" height="1"/><rect x="7" y="8" width="1" height="1"/><rect x="8" y="8" width="1" height="1"/><rect x="11" y="8" width="1" height="1"/><rect x="12" y="8" width="1" height="1"/><rect x="3" y="9" width="1" height="1"/><rect x="4" y="9" width="1" height="1"/><rect x="11" y="9" width="1" height="1"/><rect x="12" y="9" width="1" height="1"/><rect x="4" y="10" width="1" height="1"/><rect x="5" y="10" width="1" height="1"/><rect x="10" y="10" width="1" height="1"/><rect x="11" y="10" width="1" height="1"/><rect x="4" y="11" width="1" height="1"/><rect x="5" y="11" width="1" height="1"/><rect x="10" y="11" width="1" height="1"/><rect x="11" y="11" width="1" height="1"/><rect x="5" y="12" width="1" height="1"/><rect x="6" y="12" width="1" height="1"/><rect x="9" y="12" width="1" height="1"/><rect x="10" y="12" width="1" height="1"/><rect x="6" y="13" width="1" height="1"/><rect x="7" y="13" width="1" height="1"/><rect x="8" y="13" width="1" height="1"/><rect x="9" y="13" width="1" height="1"/><rect x="7" y="14" width="1" height="1"/><rect x="8" y="14" width="1" height="1"/></svg> 破军 · 便携终端</span>
        <div class="bar-handle"></div>
        <button data-a="min" title="收起">—</button>
        <button data-a="x" title="关闭">×</button>
      </div>
      <div class="rsz" aria-hidden="true"></div>
    `;
    HD.body.appendChild(SS.host);
    buildWheel();
  }


  /*__INJECT_WHEEL__*/

  function bindDrag() {
    const bar = SS.host.querySelector('.bar');
    const rsz = SS.host.querySelector('.rsz');
    let st = null;

    function down(e, kind) {
      if (SS.mode === 'drawer') return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
      st = { kind, sx: e.clientX, sy: e.clientY, r: { ...SS.rect } };
      SS.host.classList.add('busy');
    }

    function move(e) {
      if (!st) return;
      const dx = e.clientX - st.sx, dy = e.clientY - st.sy, vp = viewport();
      HW.requestAnimationFrame(() => {
        if (!st) return;
        if (st.kind === 'drag') {
          applyRect(clampRect({ ...st.r, x: st.r.x + dx, y: st.r.y + dy }, vp));
        } else {
          applyRect(clampRect({ ...st.r, w: st.r.w + dx, h: st.r.h + dy }, vp));
        }
      });
    }

    function up() {
      if (!st) return;
      st = null;
      SS.host.classList.remove('busy');
      LS.set('rk:rect', SS.rect);
    }

    bar.addEventListener('pointerdown', e => down(e, 'drag'));
    rsz.addEventListener('pointerdown', e => down(e, 'rsz'));
    HD.addEventListener('pointermove', move);
    HD.addEventListener('pointerup', up);
    HD.addEventListener('pointercancel', up);

    SS.disposers.push(() => {
      HD.removeEventListener('pointermove', move);
      HD.removeEventListener('pointerup', up);
      HD.removeEventListener('pointercancel', up);
    });

    /* 悬浮球拖拽与吸边 */
    let ost = null, moved = false;
    SS.orb.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      try { SS.orb.setPointerCapture && SS.orb.setPointerCapture(e.pointerId); } catch(_) {}
      ost = { sx: e.clientX, sy: e.clientY, x: SS.orbPos.x, y: SS.orbPos.y };
      moved = false;
    });

    SS.orb.addEventListener('pointermove', e => {
      if (!ost) return;
      const dx = e.clientX - ost.sx, dy = e.clientY - ost.sy;
      if (!moved && Math.hypot(dx, dy) > 8) moved = true;
      if (moved) placeOrb(clampOrb(ost.x + dx, ost.y + dy));
    });

    SS.orb.addEventListener('pointerup', e => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (!ost) return;
      if (moved) {
        placeOrb(clampOrb(SS.orbPos.x, SS.orbPos.y));
        LS.set('rk:orb', { x: SS.orbPos.x, y: SS.orbPos.y });
      } else {
        clearOrbTip();
      }
      ost = null;
    });

    SS.orb.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (!moved) toggleWheel();
      moved = false;
    });
    SS.orb.addEventListener('pointercancel', () => { ost = null; moved = true; });
  }

  function toggle() { SS.visible ? hide() : show(); }

  async function show() {
    if (SS.destroyed) return;
    closeWheel(false);
    clearOrbTip();
    setMode(preferDrawer() ? 'drawer' : 'floating');
    SS.host.classList.add('on');
    SS.visible = true;
    SS.orb.style.visibility = 'hidden';
    refreshStatePanel();
    if (!SS.booted) await mountPhone();
  }

  function hide() {
    closeWheel(false);
    SS.host.classList.remove('on');
    SS.visible = false;
    SS.orb.style.visibility = '';
    try { SS.orb.focus({ preventScroll: true }); } catch (_) {}
  }

  /* 内嵌 HTML 解码与沙箱加载 */
  function embeddedPhoneHtml() { return /*__INJECT_APP_HTML__*/; }

  async function mountVia(html, mode) {
    const f = HD.createElement('iframe');
    f.setAttribute('title', '破军战术终端');
    SS.host.appendChild(f);
    SS.iframe = f;
    try {
      await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error(mode + ' 超时')), mode === 'blob' ? 3000 : 5000);
        f.onload = () => { clearTimeout(to); res(); };
        if (mode === 'blob') {
          SS.blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
          f.src = SS.blobUrl;
        } else {
          f.srcdoc = html;
        }
      });
      const boot = f.contentWindow && f.contentWindow.RKBoot;
      if (typeof boot !== 'function') throw new Error('RKBoot 缺失（' + mode + '）');
      boot(makeBridge());
    } catch(e) {
      try { f.remove(); } catch(_) {}
      if (SS.iframe === f) SS.iframe = null;
      if (mode === 'blob' && SS.blobUrl) { try { HW.URL.revokeObjectURL(SS.blobUrl); } catch(_) {} SS.blobUrl = null; }
      throw e;
    }
  }

  async function mountPhone() {
    if (SS.booted || SS.destroyed) return;
    if (SS.mounting) return SS.mounting;
    SS.mounting = (async () => {
      const html = embeddedPhoneHtml();
      try {
        try { await mountVia(html, 'srcdoc'); }
        catch (e1) { if (SS.destroyed) return; await mountVia(html, 'blob'); }
        if (!SS.destroyed) SS.booted = true;
      } catch (e) {
        console.error('[Hagun-Mono-Terminal] Mount failed:', e);
        showOrbTip('终端未能加载', '收起后再次打开可重试；请查看浏览器控制台。');
      } finally { SS.mounting = null; }
    })();
    return SS.mounting;
  }

  /* 桥接对象 (Bridge) */
  async function readStat() {
    const service = window.RakudaiStateController;
    if (!service || typeof service.capture !== 'function') throw new Error('剧情状态服务尚未就绪');
    const captured = await service.capture();
    return captured.state;
  }

  const updateCbs = [];
  function emit(ev) {
    updateCbs.forEach(cb => { try { cb(ev); } catch(_) {} });
  }

  function makeBridge() {
    return {
      getStat: async () => readStat(),
      onUpdate: (cb) => updateCbs.push(cb),
      setOrbBadge: (n) => {
        const b = SS.orb && SS.orb.querySelector('.b');
        if (!b) return;
        SS.badge = n | 0;
        b.textContent = SS.badge > 99 ? '99+' : String(SS.badge);
        b.style.display = SS.badge > 0 ? 'block' : 'none';
      },
      notify: (p) => {
        p = p || {};
        if (!p.title && !p.body) { clearOrbTip(); return; }
        if (SS.visible) return;
        showOrbTip(p.title, p.body);
      },
      ui: {
        close: hide,
        recenter: () => recenter(),
        openStoryControls: () => { if (statePanel) { statePanel.open = true; refreshStatePanel(); } }
      }
    };
  }

  /* 宿主事件监听 */
  function wireEvents() {
    const eon = fn('eventOn');
    if (!eon) return;
    const TE = window.tavern_events || {};
    function safeOn(ev, cb) {
      try { const r = eon(ev, cb); r && r.stop && SS.disposers.push(() => r.stop()); } catch(_) {}
    }

    safeOn(TE.VARIABLE_UPDATE_ENDED || 'mag_variable_update_ended', () => emit({ type: 'vars' }));
    safeOn('mag_variable_update_ended_for_zod', () => emit({ type: 'vars' }));
    safeOn(TE.GENERATION_ENDED || 'generation_ended', () => emit({ type: 'story-turn' }));
    safeOn(TE.CHAT_CHANGED || 'chat_changed', () => emit({ type: 'chat' }));
  }

  function onResize() {
    if (SS.visible) setMode(preferDrawer() ? 'drawer' : 'floating');
    placeOrb(clampOrb(SS.orbPos.x, SS.orbPos.y));
    placeOrbTip();
    placeWheel();
  }

  function destroy() {
    if (SS.destroyed) return;
    SS.destroyed = true;
    disposeStatePanel();
    updateCbs.length = 0;
    try { SS.wheel && SS.wheel.remove(); SS.wheelBackdrop && SS.wheelBackdrop.remove(); } catch (_) {}
    try { if (HW.RKTacticalToggle === toggle) delete HW.RKTacticalToggle; } catch (_) {}
    while (SS.disposers.length) { try { SS.disposers.pop()(); } catch(_) {} }
    try { HW.removeEventListener('resize', onResize); } catch(_) {}
    try { SS.iframe && SS.iframe.remove(); } catch(_) {}
    try { SS.host && SS.host.remove(); } catch(_) {}
    try { SS.orb && SS.orb.remove(); } catch(_) {}
    try { SS.style && SS.style.remove(); } catch(_) {}
    try { SS.blobUrl && HW.URL.revokeObjectURL(SS.blobUrl); } catch(_) {}
    try { delete HW[SLOT]; } catch(_) {}
  }

  /*__INJECT_STATE_PANEL__*/

  buildDom();
  buildStatePanel();
  bindDrag();
  wireEvents();

  SS.host.querySelector('[data-a="x"]').onclick = hide;
  SS.host.querySelector('[data-a="min"]').onclick = hide;
  HW.addEventListener('resize', onResize);
  window.addEventListener('pagehide', destroy);
  SS.disposers.push(() => window.removeEventListener('pagehide', destroy));
  if (HW.visualViewport) {
    HW.visualViewport.addEventListener('resize', onResize);
    HW.visualViewport.addEventListener('scroll', onResize);
    SS.disposers.push(() => {
      HW.visualViewport.removeEventListener('resize', onResize);
      HW.visualViewport.removeEventListener('scroll', onResize);
    });
  }

  HW[SLOT] = { destroy, show, hide, toggle, recenter, toggleWheel, openApp: openPhoneApp, version: '1.3.0' };
  try { HW.RKTacticalToggle = toggle; } catch(_) {}

  console.info('[Hagun-Blazer-Terminal] initialized');
})();
