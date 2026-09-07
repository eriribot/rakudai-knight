// 状态规则与运行时适配分开：本模块不访问宿主、不发送消息、不生成剧情。
export const STATE_CHAPTERS = ['待选择', '序章', '第一章', '第二章', '第三章', '第四章', '终章'];
export const cloneState = value => structuredClone(value);
export function stateKey(value) {
  if (Array.isArray(value)) return '[' + value.map(stateKey).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stateKey(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export function applyOpening(before, payload) {
  if (before.系统.开局状态 !== '待建档') throw new Error('当前分支已建档，不能再次初始化。');
  if (!payload || payload.系统?.结构版本 !== 3 || !['黑铁一辉', '自定义角色'].includes(payload.系统.主角模式)) throw new Error('请选择身份模式并使用 v3 档案。');
  const next = cloneState(before);
  const scene = payload.场景 || {};
  for (const key of ['当前章', '时间', '地点', '切入说明']) {
    const incoming = scene[key];
    if (incoming !== undefined && typeof incoming !== 'string') throw new Error('场景字段必须是文字。');
    const existing = before.场景[key] || '';
    const established = existing && existing !== '待选择';
    if (established && incoming && incoming !== '待选择' && incoming !== existing) throw new Error(`场景${key}与已保存内容冲突，请先调整草稿：${existing}`);
    if (!established && incoming) next.场景[key] = incoming.trim();
  }
  if (!STATE_CHAPTERS.slice(1).includes(next.场景.当前章) || !next.场景.时间.trim() || !next.场景.地点.trim()) throw new Error('请先确定切入章段、时间和地点；相对时间也可以。');
  next.玩家 = cloneState(payload.玩家);
  if (!next.玩家 || !next.玩家.姓名?.trim()) throw new Error('档案缺少姓名。');
  next.玩家.登记等级 = payload.系统.主角模式 === '黑铁一辉' ? 'F' : null;
  next.系统 = { 结构版本: 3, 主角模式: payload.系统.主角模式, 开局状态: '已建档' };
  next.场景.阶段 = '进行中';
  return next;
}

export function applyTransition(before, request) {
  if (before.系统.开局状态 !== '已建档') throw new Error('请先在开局页完成建档。');
  const next = cloneState(before);
  const scene = next.场景;
  if (scene.当前卷 !== 1) throw new Error('本版仅开放第一卷。');
  if (request.action === 'start') {
    if (scene.阶段 !== '未开始') throw new Error('当前章段已开始，不能重复开始。');
    if (scene.当前章 === '待选择') scene.当前章 = request.chapter;
    else if (request.chapter && request.chapter !== scene.当前章) throw new Error('不能以开始操作跳到其他章段。');
    if (!STATE_CHAPTERS.slice(1).includes(scene.当前章) || !scene.时间.trim() || !scene.地点.trim()) throw new Error('当前章段、时间或地点尚未确认。');
    scene.阶段 = '进行中';
  } else if (request.action === 'end') {
    if (scene.阶段 !== '进行中') throw new Error('只有进行中的章段可以标记结束。');
    scene.阶段 = '已结束';
  } else if (request.action === 'next') {
    if (scene.阶段 !== '已结束') throw new Error('请先确认当前章段已结束。');
    const index = STATE_CHAPTERS.indexOf(scene.当前章);
    if (index < 1 || index >= STATE_CHAPTERS.length - 1) throw new Error('已到第一卷末，本版不自动开放第二卷。');
    scene.当前章 = STATE_CHAPTERS[index + 1];
    scene.阶段 = '未开始';
  } else throw new Error('未知剧情操作。');
  return next;
}

// 供 MVU 的更新结束事件使用。身份、初评及章段由界面代码持有写入权。
// 模型仍可按规则记录实际时间地点、能力成长、人际和事件；不判断事件真伪。
export function enforceStateOwnership(variables, previous) {
  const before = previous?.stat_data;
  const after = variables?.stat_data;
  if (before?.系统?.结构版本 !== 3) return [];
  if (!after || typeof after !== 'object' || Array.isArray(after)) {
    variables.stat_data = cloneState(before);
    return ['/stat_data'];
  }
  const changed = [];
  function restore(parent, key, original, path) {
    if (stateKey(parent[key]) !== stateKey(original)) { parent[key] = cloneState(original); changed.push(path); }
  }
  if (before.系统.开局状态 === '待建档') {
    for (const key of ['系统', '场景', '玩家', '人际']) restore(after, key, before[key], '/' + key);
  } else {
    restore(after, '系统', before.系统, '/系统');
    if (!after.场景 || typeof after.场景 !== 'object') after.场景 = cloneState(before.场景);
    for (const key of ['当前卷', '当前章', '阶段', '切入说明']) restore(after.场景, key, before.场景[key] ?? '', '/场景/' + key);
    if (!after.玩家 || typeof after.玩家 !== 'object') after.玩家 = cloneState(before.玩家);
    restore(after.玩家, '综合初评', before.玩家.综合初评, '/玩家/综合初评');
  }
  return changed;
}

export function createStateController(adapter) {
  const tokens = new WeakMap();
  async function capture(options = {}) {
    const snapshot = await adapter.capture(options);
    const state = adapter.validate(cloneState(snapshot.data.stat_data));
    const token = Object.freeze({});
    tokens.set(token, { snapshot, state, done: null });
    return { state: cloneState(state), token };
  }
  async function commit(token, build) {
    const record = tokens.get(token);
    if (!record) throw new Error('操作凭据已失效，请重新读取当前分支。');
    if (record.busy) throw new Error('正在写入，请勿重复操作。');
    record.busy = true;
    try {
      const candidate = adapter.validate(build(cloneState(record.state)));
      if (record.done) {
        if (stateKey(candidate) !== stateKey(record.done)) throw new Error('同一凭据只能重试原操作，请重新读取后再执行新操作。');
        const now = await adapter.current(record.snapshot);
        if (stateKey(adapter.validate(now.data.stat_data)) !== stateKey(record.done)) throw new Error('当前状态已变化，请刷新。');
        return { state: cloneState(record.done), alreadyApplied: true };
      }
      const current = await adapter.current(record.snapshot);
      // API 返回异常但写入已落地时，仅确认匹配结果，绝不再写一遍。
      if (stateKey(adapter.validate(current.data.stat_data)) === stateKey(candidate)) {
        record.done = candidate;
        return { state: cloneState(candidate), alreadyApplied: true };
      }
      if (stateKey(current.data) !== stateKey(record.snapshot.data)) throw new Error('变量已被其他操作更新，请重新读取，草稿已保留。');
      await adapter.write(record.snapshot, current.data, candidate);
      const persisted = await adapter.current(record.snapshot);
      const result = adapter.validate(persisted.data.stat_data);
      if (stateKey(result) !== stateKey(candidate)) throw new Error('回读与提交内容不一致，未确认写入成功；请检查 MVU 通知后刷新。');
      record.done = result;
      return { state: cloneState(result) };
    } finally { record.busy = false; }
  }
  return Object.freeze({
    version: '3.1.0', capture,
    verify: async token => {
      const record = tokens.get(token);
      if (!record?.done) throw new Error('尚无已回读确认的建档结果。');
      const now = await adapter.current(record.snapshot);
      const state = adapter.validate(now.data.stat_data);
      if (stateKey(state) !== stateKey(record.done)) throw new Error('本局状态已变化，请刷新后继续。');
      return { state: cloneState(state) };
    },
    commitOpening: (token, payload) => commit(token, state => applyOpening(state, payload)),
    transition: (token, request) => commit(token, state => applyTransition(state, request)),
  });
}
