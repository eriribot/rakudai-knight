// 内联到字段约束伴随脚本，在 Zod 桥接注册后调用。
function installRakudaiMvuGuard(schema) {
  if (typeof eventOn !== 'function' || !Mvu.events?.VARIABLE_UPDATE_ENDED) throw new Error('MVU 缺少更新结束事件，写入责任保护未注册。');
  const listener = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
    let changed;
    const internal = variables?.stat_data?.$internal;
    function rollback() {
      variables.stat_data = cloneState(previous.stat_data);
      if (internal !== undefined) variables.stat_data.$internal = internal;
    }
    try {
      changed = enforceStateOwnership(variables, previous);
      if (!changed.length) return;
      // 若模型把章段及其未来事件一起写入，恢复章段后也不能留下超前事件。
      if (!schema.safeParse(variables.stat_data).success) rollback();
    } catch (_) { rollback(); changed = ['/stat_data']; }
    const message = '已拒绝模型修改由页面管理的字段：' + changed.join('、') + '。请在开局页建档或使用终端章段按钮。';
    console.warn('[落第 MVU v3] ' + message);
    if (typeof toastr !== 'undefined') toastr.warning(message, '写入责任检查');
  });
  const H = window.SillyTavern?.getContext ? window : (function() {
    try { if (window.parent?.SillyTavern?.getContext) return window.parent; } catch (_) {}
    try { if (window.top?.SillyTavern?.getContext) return window.top; } catch (_) {}
    return window.parent || window;
  })();
  const marker = { version: '3.1.0' };
  H.__RK_MVU_GUARD_V3__ = marker;
  window.__RK_MVU_GUARD_V3__ = marker;
  try { if (window.parent) window.parent.__RK_MVU_GUARD_V3__ = marker; } catch (_) {}
  try { if (window.top) window.top.__RK_MVU_GUARD_V3__ = marker; } catch (_) {}
  window.addEventListener('pagehide', () => {
    listener.stop();
    if (H.__RK_MVU_GUARD_V3__ === marker) delete H.__RK_MVU_GUARD_V3__;
    if (window.__RK_MVU_GUARD_V3__ === marker) delete window.__RK_MVU_GUARD_V3__;
    try { if (window.parent?.__RK_MVU_GUARD_V3__ === marker) delete window.parent.__RK_MVU_GUARD_V3__; } catch (_) {}
    try { if (window.top?.__RK_MVU_GUARD_V3__ === marker) delete window.top.__RK_MVU_GUARD_V3__; } catch (_) {}
  }, { once: true });
}
