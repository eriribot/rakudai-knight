/* =========================================================================
 * 落第骑士英雄谭 · 破军伐刀者智能终端 MONO ADV（版本由构建注入）
 * 运行环境：TavernHelper 卡内脚本（script iframe）；UI 注入 ST 宿主 document
 * 结构：破军战术微光悬浮球(自由吸附) + 桌面浮动可拖拽终端(自由停靠与缩放) + 沙箱 iframe + MVU桥接
 * v1.3.0 更新：① 添加輪盤展開動畫 ② 終端打開時隱藏輪盤入口球 ③ 移除硬編碼測試數據
 * ========================================================================= */
/*__INJECT_STATE_CONTROLLER__*/

(async function () {
  'use strict';
  const BUILD_VERSION = /*__INJECT_VERSION__*/;
  const RELATIONSHIP_SCORING = /*__INJECT_RELATIONSHIP_SCORING__*/;
  const CORRECTION_RULES = /*__INJECT_CORRECTION_RULES__*/;
  const CORRECTION_FORMAT = /*__INJECT_CORRECTION_FORMAT__*/;
  const supportStage = /*__INJECT_SUPPORT_STAGE__*/;
  const romanceStage = /*__INJECT_ROMANCE_STAGE__*/;

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
    disposers: [], booted: false, mounting: null, cancelMount: null, destroyed: false, badge: 0,
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

  /*__INJECT_STATE_READER__*/

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
    if (!SS.destroyed && SS.visible) {
      emit({ type: 'show', reset: true, retainDisplay: true });
      clearInterval(readTimer);
      // 代码直写变量不一定产生 MVU 事件；只在终端展开时核对已保存数据。
      readTimer = setInterval(() => emit({ type: 'poll' }), 1000);
    }
  }

  function hide() {
    closeWheel(false);
    SS.host.classList.remove('on');
    SS.visible = false;
    clearInterval(readTimer);
    SS.orb.style.visibility = '';
    try { SS.orb.focus({ preventScroll: true }); } catch (_) {}
  }

  /* 内嵌 HTML 解码与沙箱加载 */
  function embeddedPhoneHtml() { return /*__INJECT_APP_HTML__*/; }

  async function mountVia(html, mode) {
    if (SS.destroyed) throw new Error('终端已销毁，已取消挂载');
    const f = HD.createElement('iframe');
    f.setAttribute('title', '破军战术终端');
    SS.host.appendChild(f);
    SS.iframe = f;
    try {
      await new Promise((res, rej) => {
        let settled = false;
        let timeout;
        const finish = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          f.onload = null;
          if (SS.cancelMount === cancel) SS.cancelMount = null;
          error ? rej(error) : res();
        };
        const cancel = () => finish(new Error('终端已销毁，已取消挂载'));
        SS.cancelMount = cancel;
        timeout = setTimeout(() => finish(new Error(mode + ' 超时')), mode === 'blob' ? 3000 : 5000);
        f.onload = () => finish();
        try {
          if (mode === 'blob') {
            SS.blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            f.src = SS.blobUrl;
          } else {
            f.srcdoc = html;
          }
        } catch (error) {
          finish(error);
        }
      });
      if (SS.destroyed || SS.iframe !== f) throw new Error('终端已销毁或挂载已失效');
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
        if (SS.destroyed) return;
        console.error('[Hagun-Mono-Terminal] Mount failed:', e);
        showOrbTip('终端未能加载', '收起后再次打开可重试；请查看浏览器控制台。');
      } finally { SS.mounting = null; }
    })();
    return SS.mounting;
  }

  /* 桥接对象 (Bridge) */
  let terminalStateReader = null;
  let generationPending = false;
  function readSnapshot() {
    if (!terminalStateReader) terminalStateReader = createTerminalStateReader((...args) => {
      const read = fn('getChatMessages');
      if (!read) throw new Error('酒馆助手的消息读取接口尚未就绪');
      return read(...args);
    }, () => {
      const st = HW.SillyTavern || window.SillyTavern;
      return st && typeof st.getContext === 'function' ? st.getContext() : null;
    });
    return terminalStateReader({ generating: generationPending });
  }

  const updateCbs = [];
  let readTimer;
  let rosterEditRevision = 0;
  let rosterEditBusy = false;
  function emit(ev) {
    if (ev?.reset && !['show', 'correction-applied'].includes(ev.type)) { rosterEditRevision++; correctionHostReset(ev.type); }
    updateCbs.forEach(cb => { try { cb(ev); } catch(_) {} });
  }

  function rosterSnapshotKey(state) {
    return JSON.stringify(Object.fromEntries(['系统', '场景', '玩家', '人际'].map(key => [key, state[key]])));
  }
  async function editRoster(name, action, hidden, expectedSource, expectedState) {
    if (rosterEditBusy) throw new Error('正在保存终端操作，请稍候。');
    if (SS.destroyed || generationPending) throw new Error('生成期间只能查看名册，请在变量更新完成后操作。');
    const controller = window.RakudaiStateController;
    const guard = HW.__RK_MVU_GUARD_V4__ || window.__RK_MVU_GUARD_V4__;
    if (!guard?.scheduleAndRoster || typeof controller?.setRosterHidden !== 'function') throw new Error('请同步更新并启用包含日程与名册功能的 MVU v4 字段约束脚本。');
    if (action === 'delete' && (!guard?.rosterPermanentRemoval || typeof controller?.deleteRosterPerson !== 'function')) {
      throw new Error('请同步更新并启用支持永久移除的 MVU v4 字段约束脚本。');
    }
    const revision = rosterEditRevision;
    const snapshot = readSnapshot();
    if (snapshot.pending || JSON.stringify(snapshot.source) !== JSON.stringify(expectedSource) ||
        rosterSnapshotKey(snapshot.state) !== expectedState) throw new Error('名册来源或变量已变化，请刷新后再操作。');
    rosterEditBusy = true;
    try {
      const captured = await controller.capture({ messageId: snapshot.source.messageId });
      const latest = readSnapshot();
      if (SS.destroyed || generationPending || revision !== rosterEditRevision ||
          latest.pending || JSON.stringify(latest.source) !== JSON.stringify(expectedSource) ||
          rosterSnapshotKey(latest.state) !== expectedState ||
          rosterSnapshotKey(captured.state) !== expectedState) throw new Error('当前分支已变化，未修改名册，请重新读取。');
      if (action === 'delete') await controller.deleteRosterPerson(captured.token, name);
      else await controller.setRosterHidden(captured.token, name, hidden);
      terminalStateReader?.clear();
      emit({ type: 'roster-updated', reset: true, retainDisplay: true });
    } finally { rosterEditBusy = false; }
  }
  function setRosterHidden(name, hidden, expectedSource, expectedState) {
    return editRoster(name, 'visibility', hidden, expectedSource, expectedState);
  }
  function deleteRosterPerson(name, expectedSource, expectedState) {
    return editRoster(name, 'delete', undefined, expectedSource, expectedState);
  }

  /*__INJECT_CORRECTION__*/

  // 通知挂在酒馆宿主上，终端是否展开不影响状态；关闭通知也不会取消后台任务。
  function installHostCorrectionNotice() {
    const notice = HD.createElement('section');
    notice.id = 'rk-correction-notice'; notice.hidden = true;
    notice.setAttribute('aria-label', '副 API 处理通知');
    notice.innerHTML = '<span class="rk-notice-glyph" aria-hidden="true"></span><div class="rk-notice-copy">' +
      '<strong data-notice-stage></strong><p data-notice-message role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<small data-notice-attempt></small><div class="rk-notice-actions">' +
      '<button type="button" data-notice-retry hidden>重试本轮</button><button type="button" data-notice-cancel hidden>取消处理</button>' +
      '<button type="button" data-notice-settings>设置</button></div></div>' +
      '<button type="button" data-notice-close aria-label="隐藏这条通知（不取消处理）" title="仅隐藏通知，不取消处理">×</button>';
    HD.body.appendChild(notice);
    const title = notice.querySelector('[data-notice-stage]'), message = notice.querySelector('[data-notice-message]');
    const attempt = notice.querySelector('[data-notice-attempt]'), retry = notice.querySelector('[data-notice-retry]');
    const cancel = notice.querySelector('[data-notice-cancel]'), settings = notice.querySelector('[data-notice-settings]');
    const stages = { waiting: '等待本轮保存', reading: '读取本轮', requesting: '请求模型', retrying: '等待重试',
      applying: '保存 MVU', verifying: '回读核对', applied: '已保存', unchanged: '无需更改', failed: '处理失败',
      cancelled: '已取消', preview: '预览待确认' };
    const activeStages = ['waiting', 'reading', 'requesting', 'retrying', 'applying', 'verifying'];
    let latest = null, countdown = null, hideTimer = null, signature = '', dismissed = false, busy = false, action = 0;
    const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
    function paint() {
      if (SS.destroyed) return;
      const state = latest?.state || 'inactive', active = activeStages.includes(state);
      notice.hidden = dismissed || !stages[state];
      notice.setAttribute('data-state', state); notice.setAttribute('data-active', String(active));
      text(title, '副 API · ' + (stages[state] || '状态更新'));
      // 模型和接口返回的内容只能作为纯文本显示，不能进入宿主 HTML。
      text(message, latest?.message || '正在处理本轮内容…');
      const notes = [];
      if (Number.isFinite(latest?.attempt) && latest.attempt > 0) notes.push('尝试 ' + latest.attempt +
        (Number.isFinite(latest.maxAttempts) && latest.maxAttempts > 0 ? '/' + latest.maxAttempts : ''));
      if (state === 'retrying' && Number.isFinite(latest?.retryAt)) {
        const seconds = Math.max(0, Math.ceil((latest.retryAt - Date.now()) / 1000));
        notes.push(seconds > 0 ? seconds + ' 秒后重试' : '即将重试');
      }
      text(attempt, notes.join(' · '));
      retry.hidden = !latest?.canRetry; retry.disabled = busy || active;
      cancel.hidden = !active; settings.textContent = state === 'preview' ? '查看预览' : '设置';
    }
    function refresh() {
      latest = getCorrectionStatus();
      const next = JSON.stringify([latest.state, latest.message, latest.attempt, latest.retryAt, latest.canRetry]);
      if (next !== signature) {
        signature = next; dismissed = false; clearTimeout(hideTimer);
        // 成功与取消短暂提示后收起；错误与待确认预览保留，直到处理或手动关闭。
        if (['applied', 'unchanged', 'cancelled'].includes(latest.state)) hideTimer = setTimeout(() => {
          dismissed = true; paint();
        }, 5000);
      }
      clearInterval(countdown); countdown = null;
      if (latest.state === 'retrying' && Number.isFinite(latest.retryAt)) countdown = setInterval(paint, 1000);
      paint();
    }
    async function openSettings(result) {
      const expectedDraft = correctionDraft;
      // show() 会懒加载 iframe；必须等 RKBoot 完成订阅、设置页渲染后再交付同一份预览。
      await openPhoneApp('settings');
      if (SS.destroyed || !SS.booted || !SS.visible) return;
      // 挂载期间可能换轮、取消或生成另一份预览；旧结果不能重新启用应用按钮。
      if (result?.count > 0 && expectedDraft && correctionDraft === expectedDraft && getCorrectionStatus().state === 'preview') {
        emit({ type: 'correction-preview', result });
      }
    }
    settings.onclick = () => { openSettings().catch(() => {}); };
    notice.querySelector('[data-notice-close]').onclick = () => { dismissed = true; paint(); };
    cancel.onclick = () => { action++; busy = false; cancelCorrection(); refresh(); };
    retry.onclick = async () => {
      if (busy || !latest?.canRetry) return;
      const token = ++action; busy = true; paint();
      try {
        const result = await retryCorrection();
        if (SS.destroyed || token !== action) return;
        // 手动重试仍需用户检查补丁；自动任务自己完成写入，通知不重复调用 apply。
        if (result && result.automatic !== true && typeof result.patch === 'string' && Number.isFinite(result.count)) {
          await openSettings(result);
        }
        refresh();
      } catch (error) {
        if (SS.destroyed || token !== action) return;
        refresh();
        if (!['failed', 'cancelled'].includes(latest?.state)) {
          latest = { state: 'failed', message: error?.message || '重试未能启动，请在设置中核对本轮状态。' };
          dismissed = false; paint();
        }
      } finally { if (token === action) { busy = false; paint(); } }
    };
    const onUpdate = event => { if (event?.type === 'correction-status') refresh(); };
    updateCbs.push(onUpdate); refresh();
    SS.disposers.push(() => {
      action++; clearInterval(countdown); clearTimeout(hideTimer);
      const index = updateCbs.indexOf(onUpdate); if (index !== -1) updateCbs.splice(index, 1);
      notice.remove();
    });
  }

  function makeBridge() {
    return {
      version: BUILD_VERSION,
      relationshipRules: RELATIONSHIP_SCORING,
      get contactBaselineVersion() { return (HW.__RK_MVU_GUARD_V4__ || window.__RK_MVU_GUARD_V4__)?.contactBaseline || null; },
      growthRules: window.RakudaiStateController?.growthRules,
      supportStage,
      romanceStage,
      correction: { getConfig: getCorrectionConfig, saveConfig: saveCorrectionConfig,
        getStatus: getCorrectionStatus, getContext: getCorrectionInput, fetchModels: fetchCorrectionModels,
        request: () => requestCorrection(), retry: retryCorrection, apply: applyCorrection, cancel: cancelCorrection },
      getSnapshot: async () => readSnapshot(),
      getStat: async () => readSnapshot().state,
      setRosterHidden,
      deleteRosterPerson,
      onUpdate: (cb) => {
        updateCbs.push(cb);
        return () => { const index = updateCbs.indexOf(cb); if (index !== -1) updateCbs.splice(index, 1); };
      },
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

    wireAutomaticCorrection(safeOn, TE);

    // 主生成开始前留下只读显示；新回复的 MVU 仍由框架独立结算。
    if (TE.GENERATION_AFTER_COMMANDS) safeOn(TE.GENERATION_AFTER_COMMANDS, (type, options = {}, dryRun = false) => {
      if (dryRun || options?.dryRun || ![undefined, null, '', 'normal', 'continue', 'regenerate', 'swipe'].includes(type)) return;
      try { readSnapshot(); } catch (_) {}
      generationPending = true;
      try { readSnapshot(); } catch (_) {}
      emit({ type: 'generation-start', reset: true, retainDisplay: true });
      startAutomaticCorrection();
    });
    // 删楼层、切 swipe、编辑消息都使原显示失效；生成中也不能保留被回退的回复。
    for (const name of ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_RECEIVED', 'CHARACTER_FIRST_MESSAGE_SELECTED']) {
      if (TE[name]) safeOn(TE[name], () => {
        const clearDisplay = ['CHAT_CHANGED', 'CHARACTER_FIRST_MESSAGE_SELECTED', 'MESSAGE_EDITED',
          'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED'].includes(name);
        if (clearDisplay) terminalStateReader?.clear();
        // 重 roll 的删除/切页事件不提前解除生成写锁。
        if (name === 'CHAT_CHANGED' || name === 'CHARACTER_FIRST_MESSAGE_SELECTED') generationPending = false;
        emit({ type: name, reset: true, retainDisplay: !clearDisplay });
      });
    }
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED']) {
      if (TE[name]) safeOn(TE[name], messageCount => { generationPending = false; endAutomaticCorrection(name === 'GENERATION_STOPPED', messageCount); emit({ type: 'story-turn', retainDisplay: true }); });
    }
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
    if (SS.cancelMount) SS.cancelMount();
    clearInterval(readTimer);
    terminalStateReader?.clear(); terminalStateReader = null; generationPending = false;
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
  installHostCorrectionNotice();
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

  HW[SLOT] = { destroy, show, hide, toggle, recenter, toggleWheel, openApp: openPhoneApp, version: BUILD_VERSION };
  try { HW.RKTacticalToggle = toggle; } catch(_) {}

  console.info('[Hagun-Blazer-Terminal] initialized');
})();
