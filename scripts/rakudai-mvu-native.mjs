// 本卡的原生 MVU 兼容层；不注册 Zod、不调用模型、不改 stat_data。
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

export function isRakudaiMvuState(state) {
  return Boolean(state && !Array.isArray(state) && state.系统?.结构版本 === 4 &&
    state.系统 && state.场景 && state.玩家 && state.人际 &&
    [state.系统, state.场景, state.玩家, state.人际].every(value => typeof value === 'object' && !Array.isArray(value)));
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

export function prepareRakudaiNativeMvu(data, scopes = []) {
  if (rakudaiMvuRuntime(scopes).mode === 'native' && isRakudaiMvuState(data?.stat_data)) {
    data.schema = createRakudaiNativeSchema(data.stat_data, data.schema);
  }
  return data;
}

export async function installRakudaiNativeMvu(W) {
  const slot = '__RK_MVU_NATIVE_N01__';
  if (W[slot]?.version === 'N01' && W[slot].state !== 'failed') return W[slot];
  W[slot]?.destroy?.();
  const marker = { version: 'N01', state: 'loading', destroy: null };
  W[slot] = marker;
  let disposed = false, listener = null;
  function destroy() {
    disposed = true; listener?.stop();
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
    listener = helper('eventOn')(mvu.events.VARIABLE_UPDATE_STARTED, variables => {
      if (disposed) return;
      const current = H.SillyTavern.getContext();
      if (current.characterId !== owner.characterId || (current.groupId ?? null) !== owner.groupId) return;
      prepareRakudaiNativeMvu(variables, scopes);
    });
    marker.state = 'ready';
  } catch (error) {
    if (!disposed) { marker.state = 'failed'; marker.message = error?.message || '原生 MVU 兼容启动失败。'; }
  }
  return marker;
}
