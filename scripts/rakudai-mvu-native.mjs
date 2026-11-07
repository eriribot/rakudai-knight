import { isRakudaiMvuState, isSharedMvuState, resolveMvuWorld, repairRakudaiMvuStructure, hasAsteriskNativeContract } from './rakudai-mvu-structure.mjs';
import { normalizeRakudaiMvuCommands } from './rakudai-mvu-patch.mjs';
export { isRakudaiMvuState };

// 本卡的 MVU 兼容层；补缺失经验容器/零初值，兼容旧申请父容器，不注册 Zod、不调用模型。
// MVU 61010dab: STARTED 后读取 schema；strictSet 只关闭 set 的旧二元组解释。
export function rakudaiMvuScopes(scopes = []) {
  const result = [];
  for (const scope of scopes) {
    for (const resolve of [() => scope, () => scope?.parent, () => scope?.top]) {
      try { const value = resolve(); if (value && !result.includes(value)) result.push(value); } catch (_) {}
    }
  }
  return result;
}

export function rakudaiMvuRuntime(scopes = []) {
  const entries = rakudaiMvuScopes(scopes).flatMap(scope => {
    try { return [{ boot: scope.__RK_MVU_GUARD_BOOT_V4__, guard: scope.__RK_MVU_GUARD_V4__ || scope.__RK_MVU_GUARD_V3__ }]; } catch (_) { return []; }
  });
  const entry = entries.find(item => item.boot) || entries.find(item => item.guard);
  if (!entry) return { mode: 'native', guard: null, boot: null };
  const { boot, guard } = entry;
  if (boot?.state === 'loading') return { mode: 'loading', boot, guard: guard || null };
  if (boot?.state === 'failed') return { mode: 'failed', boot, guard: guard || null };
  if (boot && (!guard || boot.state !== 'ready' || boot.guard !== guard)) return { mode: 'failed', boot, guard: guard || null };
  // 老版配套约束没有 boot 标记；真实 guard 仍表示 Zod 路径，不冒充原生模式。
  return { mode: 'zod', boot: boot || null, guard: guard || null };
}

export function createRakudaiNativeSchema(state, previous) {
  function build(value, old, root = false) {
    if (Array.isArray(value)) {
      return { type: 'array', extensible: true, recursiveExtensible: true,
        elementType: value.length ? build(value[0], old?.elementType) : { type: 'any' },
        ...(old?.template !== undefined ? { template: structuredClone(old.template) } : {}) };
    }
    if (value && typeof value === 'object') {
      const properties = Object.fromEntries(Object.entries(value)
        .filter(([key]) => key !== '$internal' && key !== '$meta')
        .map(([key, child]) => [key, { ...build(child, old?.properties?.[key]), required: root }]));
      return { type: 'object', properties, extensible: !root, recursiveExtensible: !root,
        ...(old?.template !== undefined ? { template: structuredClone(old.template) } : {}) };
    }
    const type = typeof value;
    return { type: ['string', 'number', 'boolean'].includes(type) ? type : 'any' };
  }
  const schema = build(state, previous, true);
  schema.strictSet = true;
  schema.strictTemplate = previous?.strictTemplate ?? false;
  schema.concatTemplateArray = previous?.concatTemplateArray ?? true;
  return schema;
}

export function prepareRakudaiNativeMvu(data, scopes = [], { repairStructure = true } = {}) {
  const runtime = rakudaiMvuRuntime(scopes);
  if (repairStructure && data?.stat_data) data.stat_data = repairRakudaiMvuStructure(data.stat_data,
    { legacyRequests: runtime.guard?.growthProtocol !== 'final-values-v1' });
  if (runtime.mode === 'native' && isSharedMvuState(data?.stat_data)) {
    data.schema = createRakudaiNativeSchema(data.stat_data, data.schema);
  }
  return data;
}

export async function installRakudaiNativeMvu(W, options = {}) {
  const slot = '__RK_MVU_NATIVE_N01__';
  const configured = options.acceptState;
  if (configured !== undefined && typeof configured !== 'function') throw new TypeError('acceptState 必须是同步状态判定函数。');
  const existing = W[slot];
  if (existing?.version === 'N04' && existing.dorm === 'D01' && existing.worlds === 'W02' && existing.capabilities === 'H01' && existing.state !== 'failed' &&
      (configured === undefined || typeof existing.setAcceptState === 'function')) {
    if (configured !== undefined) existing.setAcceptState(configured);
    return existing;
  }
  W[slot]?.destroy?.();
  const marker = { version: 'N04', dorm: 'D01', worlds: 'W02', capabilities: 'H01', state: 'loading', destroy: null };
  let acceptState = configured || (() => true);
  // 重复安装可以收紧/更新本监听的门禁；未传选项的旧调用不会清掉已配置门禁。
  marker.setAcceptState = predicate => {
    if (typeof predicate !== 'function') throw new TypeError('acceptState 必须是同步状态判定函数。');
    acceptState = predicate;
  };
  const accepted = state => acceptState(state) === true;
  W[slot] = marker;
  let disposed = false, listener = null, commandListener = null, endListener = null;
  function destroy() {
    disposed = true; listener?.stop(); commandListener?.stop(); endListener?.stop();
    if (W[slot] === marker) delete W[slot];
    W.removeEventListener?.('pagehide', destroy);
  }
  marker.destroy = destroy;
  W.addEventListener?.('pagehide', destroy, { once: true });
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error('原生 MVU 兼容缺少酒馆助手接口：' + name);
  }
  try {
    await helper('waitGlobalInitialized')('Mvu');
    if (disposed) return marker;
    const scopes = rakudaiMvuScopes([W]);
    const H = [...scopes].reverse().find(scope => { try { return scope.SillyTavern?.getContext; } catch (_) { return false; } });
    if (!H) throw new Error('原生 MVU 兼容未连接当前酒馆。');
    const initial = H.SillyTavern.getContext();
    const owner = { characterId: initial.characterId, groupId: initial.groupId ?? null };
    if (owner.characterId == null && owner.groupId == null) throw new Error('请在角色聊天中加载原生 MVU 兼容。');
    const mvu = W.Mvu || H.Mvu;
    if (!mvu?.events?.VARIABLE_UPDATE_STARTED) throw new Error('MVU 缺少变量更新开始事件。');
    const owned = () => {
      if (disposed) return false;
      const current = H.SillyTavern.getContext();
      return current.characterId === owner.characterId && (current.groupId ?? null) === owner.groupId;
    };
    listener = helper('eventOn')(mvu.events.VARIABLE_UPDATE_STARTED, variables => {
      if (!owned() || !accepted(variables?.stat_data)) return;
      prepareRakudaiNativeMvu(variables, scopes);
    });
    if (mvu.events.COMMAND_PARSED) commandListener = helper('eventOn')(mvu.events.COMMAND_PARSED, (variables, commands, content) => {
      if (!owned() || !accepted(variables?.stat_data) || !isSharedMvuState(variables?.stat_data)) return;
      const world = resolveMvuWorld(variables.stat_data);
      const chat = H.SillyTavern.getContext().chat || [], replies = chat.flatMap((message, index) => !message.is_user && message.mes === content ? [index] : []);
      const resting = /^(?:宿舍)?休息[。！!\s]*$/.test(chat.slice(0, replies.length === 1 ? replies[0] : chat.length).findLast(message => message.is_user)?.mes?.trim() || ''), inDorm = variables.stat_data.场景?.宿舍 === true;
      const normalized = normalizeRakudaiMvuCommands(commands.filter(command => {
        if (world === 'rakudai' && resting && !inDorm) return false;
        if (world === 'asterisk' && command.reason !== 'json_patch') return false;
        let patch; try { patch = JSON.parse(command.full_match); if (!patch || typeof patch !== 'object') return false; } catch (_) { return world !== 'asterisk' && !inDorm && typeof variables.stat_data.场景?.宿舍 !== 'boolean'; }
        if (world === 'asterisk' && !['add', 'replace', 'remove'].includes(patch.op)) return false;
        const locked = path => path === '' || path === '/' || path === '/系统' || path?.startsWith('/系统/') || world === 'asterisk' && (path === '/玩家' || /^\/玩家\/综合初评(\/|$)/.test(path) || /^\/场景\/(路线|选拔赛|七星剑斗祭|宿舍)(\/|$)/.test(path) || path === '/场景/当前卷' && patch.value !== null);
        if (locked(patch.path) || patch.op === 'move' && locked(patch.from)) return false;
        if (world === 'asterisk') return patch.path !== '/场景';
        const protectedPath = path => typeof path !== 'string' || !path.startsWith('/') || path.includes('//') || path.endsWith('/') || ['/场景', '/场景/宿舍'].includes(path) || path.startsWith('/场景/宿舍/') || resting && replies.length !== 1 && (path === '/场景/时间' || path.startsWith('/场景/时间/')) || inDorm && (path === '/场景/地点' || path.startsWith('/场景/地点/'));
        if (patch.path === '/场景/宿舍') return inDorm && resting && replies.length === 1 && ['add', 'replace'].includes(patch.op) && patch.value === false;
        return !protectedPath(patch.path) && !(patch.op === 'move' && protectedPath(patch.from));
      }), variables.stat_data);
      if (normalized !== commands) commands.splice(0, commands.length, ...normalized);
    });
    if (mvu.events.VARIABLE_UPDATE_ENDED) endListener = helper('eventOn')(mvu.events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
      if (!owned() || !accepted(previous?.stat_data) || !isSharedMvuState(previous?.stat_data)) return;
      // 以更新前的作品判断；legacy父对象替换同样不能借当前标记绕过保护。
      const before = previous.stat_data;
      if (variables.stat_data && typeof variables.stat_data === 'object' && !Array.isArray(variables.stat_data)) {
        const system = variables.stat_data.系统;
        if (!system || typeof system !== 'object' || Array.isArray(system)) variables.stat_data.系统 = structuredClone(before.系统);
        else if (Object.hasOwn(before.系统, '作品')) system.作品 = before.系统.作品;
        else delete system.作品;
      }
      if (!isSharedMvuState(variables.stat_data) || resolveMvuWorld(before) === 'asterisk' && !hasAsteriskNativeContract(variables.stat_data)) {
        variables.stat_data = structuredClone(before);
        variables.display_data = structuredClone(previous.display_data || {});
        variables.delta_data = {};
        marker.lastRejected = '本轮补丁破坏必要档案字段，已保留更新前的状态。';
      } else {
        if (variables.display_data?.系统 && typeof variables.display_data.系统 === 'object') delete variables.display_data.系统.作品;
        if (variables.delta_data?.系统 && typeof variables.delta_data.系统 === 'object') delete variables.delta_data.系统.作品;
      }
    });
    marker.state = 'ready';
  } catch (error) {
    if (!disposed) { marker.state = 'failed'; marker.message = error?.message || '原生 MVU 兼容启动失败。'; }
  }
  return marker;
}
