// 启动状态先于异步依赖发布；开关开启不等于约束已经注册成功。
async function bootRakudaiMvuGuard(loadBridge = url => import(url)) {
  const key = '__RK_MVU_GUARD_BOOT_V4__';
  const boot = { state: 'loading', bridgeActive: false, stage: 'dependencies', message: '正在等待酒馆助手与 Zod 4 就绪。', startedAt: Date.now() };
  const scopes = [];
  for (const resolve of [() => window, () => window.parent, () => window.top]) {
    try {
      const scope = resolve();
      if (scope && !scopes.includes(scope)) { scope[key] = boot; scopes.push(scope); }
    } catch (_) {}
  }
  let disposed = false, cancelWait = null, dependencyTimer;
  const cancelled = new Error('字段约束启动已取消');
  const knownErrors = new WeakSet();
  const failure = message => { const error = new Error(message); knownErrors.add(error); return error; };
  function active() {
    return !disposed && scopes.every(scope => { try { return scope[key] === boot; } catch (_) { return false; } });
  }
  function requireActive() { if (!active()) throw cancelled; }
  window.addEventListener('pagehide', () => {
    disposed = true;
    clearTimeout(dependencyTimer);
    cancelWait?.();
    for (const scope of scopes) { try { if (scope[key] === boot) delete scope[key]; } catch (_) {} }
  }, { once: true });
  // import 不能取消；超时后的结果只会被丢弃，不能再调用注册函数。
  function bounded(promise, timeoutMessage) {
    requireActive();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (cancelWait === cancel) cancelWait = null;
        callback(value);
      };
      const cancel = () => finish(reject, cancelled);
      const timer = setTimeout(() => finish(reject, failure(typeof timeoutMessage === 'function' ? timeoutMessage() : timeoutMessage)),
        Math.max(0, Math.min(15000, 60000 - (Date.now() - boot.startedAt))));
      cancelWait = cancel;
      Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    });
  }
  const zodReady = () => typeof z !== 'undefined' && typeof z.preprocess === 'function' && typeof z.toJSONSchema === 'function';
  let stageFailure = '酒馆助手与 Zod 4 未就绪，请更新酒馆助手后重新启用字段约束脚本。';
  try {
    try {
      await bounded(new Promise(resolve => {
        const poll = () => {
          if (!active()) { resolve(); return; }
          if (zodReady() && typeof waitGlobalInitialized === 'function') { resolve(); return; }
          dependencyTimer = setTimeout(poll, 100);
        };
        poll();
      }), () => zodReady() ? '酒馆助手初始化接口未就绪，请更新酒馆助手后重新启用字段约束脚本。' : '酒馆助手尚未提供 Zod 4，请更新酒馆助手后重新启用字段约束脚本。');
    } finally { clearTimeout(dependencyTimer); }
    requireActive();
    boot.stage = 'mvu'; boot.message = '正在等待 MVU 变量框架就绪。';
    stageFailure = 'MVU 变量框架初始化失败，请查看 MVU 脚本日志后重新启用字段约束脚本。';
    await bounded(waitGlobalInitialized('Mvu'), '等待 MVU 超时，请确认变量框架已成功加载，再重新启用字段约束脚本。');
    requireActive();
    boot.stage = 'bridge'; boot.message = '正在加载固定版本的 Zod 桥接。';
    stageFailure = '固定版本 Zod 桥接的主备入口均加载失败，请检查网络后重新启用字段约束脚本；桥接子依赖仍需访问 testingcf.jsdelivr.net。';
    // 已核对同 commit 的两个入口：模块顶层不注册 MVU；只调用最终成功返回的注册函数一次。
    // 备用入口的子依赖仍指向 testingcf，因此不把入口切换描述成完整离线或网络兜底。
    const bridgePath = '/gh/StageDog/tavern_resource@dee97e8c3e24e1e75efe21141743e4b5c0af776e/dist/util/mvu_zod.js';
    const bridgeUrls = ['https://testingcf.jsdelivr.net' + bridgePath, 'https://cdn.jsdelivr.net' + bridgePath];
    let bridge;
    for (let index = 0; index < bridgeUrls.length; index++) {
      try {
        bridge = await bounded(Promise.resolve().then(() => { requireActive(); return loadBridge(bridgeUrls[index]); }), '固定版本 Zod 桥接加载超时，请检查网络后重新启用字段约束脚本；桥接子依赖仍需访问 testingcf.jsdelivr.net。');
        break;
      } catch (error) {
        requireActive();
        if (index === bridgeUrls.length - 1) throw error;
        boot.message = 'Zod 桥接主入口暂未就绪，正在尝试同版本备用入口。';
      }
    }
    requireActive();
    boot.stage = 'registering'; boot.message = '正在注册字段校验与写入责任保护。';
    stageFailure = '字段约束注册失败，请查看字段约束脚本日志后重新启用。';
    if (typeof bridge?.registerMvuSchema !== 'function') throw failure('Zod 桥接缺少注册接口，请检查固定版本桥接资源是否完整。');
    const schema = createSchema(z);
    bridge.registerMvuSchema(schema);
    boot.bridgeActive = true;
    requireActive();
    const previous = window.__RK_MVU_GUARD_V4__;
    installRakudaiMvuGuard(schema);
    const guard = window.__RK_MVU_GUARD_V4__;
    if (!guard || guard === previous || typeof guard.parseRepair !== 'function') throw failure('字段写入保护未完整注册，请查看字段约束脚本日志后重新启用。');
    requireActive();
    Object.assign(boot, { state: 'ready', stage: 'ready', message: 'G04 / T02 字段约束已就绪。', guard });
    console.info('[落第 MVU v4] G04 / T02 字段校验与写入责任保护已注册。');
  } catch (error) {
    if (error === cancelled || !active()) return;
    Object.assign(boot, { state: 'failed', message: knownErrors.has(error) ? error.message : stageFailure });
    console.error('[落第 MVU v4] ' + boot.message, error);
    if (typeof toastr !== 'undefined') toastr.error(boot.message);
  }
}
