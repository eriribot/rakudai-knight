import { GROWTH_AXES, GROWTH_RULES, ATTRIBUTE_GRADES } from '../世界书规则/MVU/schema.mjs';
import { enforceGrowthProgress } from './rakudai-state-core.mjs';
import { rakudaiMvuScopes, rakudaiMvuRuntime } from './rakudai-mvu-native.mjs';
import { createRakudaiMvuReplySource } from './rakudai-mvu-reply-source.mjs';

// 可选成长结算不注册 Zod、不请求模型；只接管原生模式的成长账本与晋级。
export async function installRakudaiMvuGrowth(W) {
  const slot = '__RK_MVU_GROWTH_G04__', scopes = rakudaiMvuScopes([W]);
  const existing = scopes.map(scope => { try { return scope[slot]; } catch (_) { return null; } })
    .find(value => value?.version === 'G04' && value.state !== 'failed');
  // 同 iframe 重复启动复用；新 iframe 必须接管，不能继承即将 pagehide 的旧 helper。
  if (existing?.windowRef === W) return existing;
  for (const scope of scopes) { try { scope[slot]?.destroy?.(); } catch (_) {} }
  const marker = { version: 'G04', state: 'loading', growth: GROWTH_RULES.version,
    growthSettlement: 'G04', repair: 'P02', repairSource: 'MVU01', parseRepair: null, destroy: null };
  Object.defineProperty(marker, 'windowRef', { value: W });
  for (const scope of scopes) { try { scope[slot] = marker; } catch (_) {} }
  let disposed = false, commandListener = null, endedListener = null;
  function destroy() {
    if (disposed) return;
    disposed = true;
    commandListener?.stop(); endedListener?.stop();
    W.removeEventListener?.('pagehide', destroy);
    for (const scope of scopes) { try { if (scope[slot] === marker) delete scope[slot]; } catch (_) {} }
  }
  marker.destroy = destroy;
  W.addEventListener?.('pagehide', destroy, { once: true });
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error('独立成长结算缺少酒馆助手接口：' + name);
  }
  try {
    await helper('waitGlobalInitialized')('Mvu');
    if (disposed) return marker;
    const H = [...scopes].reverse().find(scope => { try { return scope.SillyTavern?.getContext; } catch (_) { return false; } });
    if (!H) throw new Error('独立成长结算未连接当前酒馆。');
    const initial = H.SillyTavern.getContext(), owner = { characterId: initial.characterId, groupId: initial.groupId ?? null };
    if (owner.characterId == null && owner.groupId == null) throw new Error('请在角色聊天中加载独立成长结算。');
    const mvu = W.Mvu || H.Mvu;
    if (!mvu?.events?.COMMAND_PARSED || !mvu.events.VARIABLE_UPDATE_ENDED || typeof mvu.parseMessage !== 'function') {
      throw new Error('MVU 缺少成长结算所需的解析事件或 parseMessage。');
    }
    function nativeActive() {
      if (disposed || marker.state !== 'ready') return false;
      const current = H.SillyTavern.getContext();
      return current.characterId === owner.characterId && (current.groupId ?? null) === owner.groupId &&
        rakudaiMvuRuntime(scopes).mode === 'native';
    }
    function requireNative() {
      if (!nativeActive()) throw new Error('独立成长结算当前未接管：请确认脚本就绪且字段约束已关闭；加载或失败的约束不能绕过。');
    }
    const sources = createRakudaiMvuReplySource(W, { mvu, assertRepairAvailable: requireNative });
    marker.parseRepair = sources.parseRepair;
    commandListener = helper('eventOn')(mvu.events.COMMAND_PARSED, (variables, commands, content) => {
      if (nativeActive()) sources.capture(variables, content);
      else sources.take(variables);
    });
    endedListener = helper('eventOn')(mvu.events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
      const { source, replyKey } = sources.take(variables);
      if (!nativeActive()) return;
      const object = value => value && typeof value === 'object' && !Array.isArray(value);
      const before = previous?.stat_data?.玩家, after = variables?.stat_data?.玩家;
      if (!object(before) || !object(after)) return;
      function restoreGrowth() {
        if (Object.hasOwn(before, '成长')) after.成长 = structuredClone(before.成长);
        else delete after.成长;
        if (object(before.六维) && object(after.六维)) for (const axis of GROWTH_AXES) {
          if (Object.hasOwn(before.六维, axis)) after.六维[axis] = before.六维[axis];
          else delete after.六维[axis];
        }
      }
      let notices = [];
      try {
        // 仅核对结算直接依赖的容器；不开全字段约束，也不强制转换旧档坏数据。
        for (const state of [before, after]) {
          if (state.成长 === undefined) continue;
          if (!object(state.成长)) throw new Error('成长容器不是对象');
          for (const field of ['经验', '申请', '记录']) if (state.成长[field] !== undefined && !object(state.成长[field])) {
            throw new Error('成长子容器不是对象');
          }
          for (const axis of GROWTH_AXES) {
            const value = state.成长.经验?.[axis];
            if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error('经验不是非负安全整数');
          }
        }
        // 原生路径没有 Zod 前置校验；核对旧账中参与求和/晋级/去重的收据。
        const old = before.成长;
        for (const row of Object.values(old?.记录 || {})) {
          if (!object(row) || !GROWTH_AXES.includes(row.目标) || typeof row.来源事件 !== 'string' ||
              typeof row.活动指纹 !== 'string' || !Number.isSafeInteger(row.获得) || row.获得 < 0 ||
              row.获得 > GROWTH_RULES.perReplyCap || row.回合 !== undefined && typeof row.回合 !== 'string') {
            throw new Error('旧成长收据无法安全读取');
          }
        }
        if (old?.回合结算 !== undefined) {
          const budget = old.回合结算;
          if (!object(budget) || typeof budget.标识 !== 'string' || !object(budget.获得) ||
              !Array.isArray(budget.已晋级) || budget.已晋级.some(axis => !GROWTH_AXES.includes(axis))) {
            throw new Error('旧回合收据无法安全读取');
          }
          for (const value of Object.values(budget.获得)) if (!Number.isSafeInteger(value) || value < 0 || value > GROWTH_RULES.perReplyCap) {
            throw new Error('旧回合额度不是非负整数');
          }
          if (budget.终值收据 !== undefined && !object(budget.终值收据)) throw new Error('旧终值收据不是对象');
          for (const receipt of Object.values(budget.终值收据 || {})) {
            if (!object(receipt) || typeof receipt.提交 !== 'string' || !ATTRIBUTE_GRADES.includes(receipt.评级) ||
                !Number.isSafeInteger(receipt.经验) || receipt.经验 < 0) throw new Error('旧终值收据无法安全读取');
          }
        }
        notices = enforceGrowthProgress(variables, previous, { replyKey,
          repairEventKeys: replyKey ? source?.repairEventKeys || [] : [],
          growthFinalAxes: source?.growthFinalAxes || [], growthGradeAxes: source?.growthGradeAxes || [] });
      } catch (_) {
        restoreGrowth();
        notices = [{ path: '/玩家/成长', message: '成长结构无法安全结算，已保留原成长数据与评级；其它事实照常保存。' }];
      }
      if (notices.length) {
        const message = notices.map(item => item.path + '：' + item.message).join('\n');
        (W.console || console).info('[落第 MVU 独立成长 G04] ' + message);
        const toast = W.toastr || H.toastr;
        if (toast?.info) toast.info(message, '成长结算');
      }
    });
    marker.state = 'ready';
  } catch (error) {
    commandListener?.stop(); endedListener?.stop();
    if (!disposed) { marker.state = 'failed'; marker.message = error?.message || '独立成长结算启动失败。'; }
  }
  return marker;
}
