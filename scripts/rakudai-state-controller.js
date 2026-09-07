// GENERATED: node scripts/build-state-controller.mjs --write
(function () {
"use strict";
// 本卡 stat_data v3。纯 schema 工厂；不访问聊天、不自动迁移旧楼层。
const CHAPTERS = ['待选择', '序章', '第一章', '第二章', '第三章', '第四章', '终章'];
const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
const AXES = ['攻击力', '防御力', '魔力量', '魔力控制', '体能', '运气'];
const INITIAL_STATE = {
  系统: { 结构版本: 3, 开局状态: '待建档', 主角模式: '未选择' },
  场景: { 当前卷: 1, 当前章: '待选择', 阶段: '未开始', 时间: '', 地点: '', 切入说明: '', 已发生事件: {} },
  玩家: {
    姓名: '', 性格关键词: '', 处事风格: '', 所属: '', 固有灵装: '', 角色简介: '', 战斗风格: '',
    伐刀能力: { 能力系别: '', 能力本质: '', 共通限制: '', 招式: {} },
    其他能力: {},
    六维: Object.fromEntries(AXES.map(key => [key, ''])),
    综合初评: { 规则版本: 'R05-第一版', 分数: null, 等级: null, 拟定登记等级: null, 评定状态: '待填写六维', 待填写项: AXES.slice(0, 4) },
    登记等级: null,
  },
  人际: {},
};

function createSchema(z) {
  const text = z.string();
  // 动态记录允许有名条目；固定对象全部 strict，禁止拼错路径后另造字段。
  const key = z.string().min(1).refine(value => !/[~/]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value), '名称不能包含 /、~ 或保留键');
  const record = value => z.record(key, value);
  const skill = z.object({ 说明: text, 条件与代价: text, 掌握状态: z.enum(['待确认', '学习中', '已掌握']) }).strict();
  const root = z.object({
    // MVU 更新过程临时注入的框架元数据；保留原值，不作为本卡业务结构校验。
    $internal: z.unknown().optional(),
    系统: z.object({ 结构版本: z.literal(3), 开局状态: z.enum(['待建档', '已建档']), 主角模式: z.enum(['未选择', '黑铁一辉', '自定义角色']) }).strict(),
    场景: z.object({
      当前卷: z.literal(1),
      当前章: z.enum(CHAPTERS),
      阶段: z.enum(['未开始', '进行中', '已结束']),
      时间: text, 地点: text, 切入说明: text.default(''),
      已发生事件: record(z.object({ 章段: z.enum(CHAPTERS.slice(1)), 结果: text.min(1), 参与者: z.array(text.min(1)), 知情者: z.array(text.min(1)) }).strict()),
    }).strict(),
    玩家: z.object({
      姓名: text, 性格关键词: text, 处事风格: text, 所属: text, 固有灵装: text, 角色简介: text, 战斗风格: text,
      伐刀能力: z.object({ 能力系别: z.enum(['', '体能强化系', '自然干涉系', '概念干涉系', '因果干涉系']), 能力本质: text, 共通限制: text, 招式: record(skill) }).strict(),
      其他能力: record(skill),
      六维: z.object(Object.fromEntries(AXES.map(axis => [axis, z.enum(['', ...GRADES])]))).strict(),
      综合初评: z.object({
        规则版本: text, 分数: z.number().min(1).max(6).nullable(), 等级: z.enum(GRADES).nullable(), 拟定登记等级: z.enum(GRADES).nullable(),
        评定状态: z.enum(['待填写六维', '已计算', '原作档案']), 待填写项: z.array(z.enum(AXES.slice(0, 4))),
      }).strict(),
      登记等级: z.enum(GRADES).nullable(),
    }).strict(),
    人际: record(z.object({ 关系: text, 态度印象: text, 好感: z.number().min(0).max(100).nullable(), 羁绊阶段: z.enum(['未定', '未建立', 'C', 'B', 'A', 'S']), 变化依据: text }).strict()),
  }).strict().superRefine((state, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (state.系统.开局状态 === '已建档' && (state.系统.主角模式 === '未选择' || !state.玩家.姓名.trim())) issue(['系统', '开局状态'], '已建档需要已选身份和非空姓名');
    if (state.场景.阶段 !== '未开始' && state.系统.开局状态 !== '已建档') issue(['场景', '阶段'], '先完成建档，再开始剧情');
    if (state.场景.当前章 === '待选择' && state.场景.阶段 !== '未开始') issue(['场景', '阶段'], '未选择章段时不能开始或结束剧情');
    const chapter = CHAPTERS.indexOf(state.场景.当前章);
    for (const [name, event] of Object.entries(state.场景.已发生事件)) {
      if (CHAPTERS.indexOf(event.章段) > chapter) issue(['场景', '已发生事件', name, '章段'], '不能把后续章段事件写成已发生');
    }
    if (state.系统.主角模式 === '黑铁一辉' && Object.hasOwn(state.人际, '黑铁一辉')) issue(['人际', '黑铁一辉'], '一辉模式不能新建另一个一辉的人际记录');
    for (const [name, relation] of Object.entries(state.人际)) {
      if (['C', 'B', 'A', 'S'].includes(relation.羁绊阶段) && !relation.变化依据.trim()) issue(['人际', name, '变化依据'], '已成立羁绊必须有本局依据');
    }
  });
  // 上游桥接器对直接传入的 ZodObject 会改用 looseObject。
  // preprocess 保留本卡固定字段的 strict 校验；在 record 可能忽略保留键前明确拒绝。
  return z.preprocess((value, ctx) => {
    function inspect(node, path = []) {
      if (!node || typeof node !== 'object') return;
      for (const name of Object.keys(node)) {
        if (path.length === 0 && name === '$internal') continue;
        if (['__proto__', 'prototype', 'constructor'].includes(name)) ctx.addIssue({ code: 'custom', path: [...path, name], message: '不接受保留键，未丢弃原始数据' });
        else inspect(node[name], [...path, name]);
      }
    }
    inspect(value);
    return value;
  }, root);
}

// 离线 v2 迁移：拒绝未识别数据，不覆盖聊天，不凭招式名猜测多招式分隔。
function migrateV2(input, z) {
  const schema = createSchema(z);
  if (input?.系统?.结构版本 === 3) return schema.parse(structuredClone(input));
  if (input?.系统?.结构版本 !== 2) throw new Error('仅支持中文结构 v2 → v3；英文或未知版本须先核对原始数据');
  const next = structuredClone(input);
  next.系统.结构版本 = 3;
  next.场景 = { 当前章: '待选择', 阶段: '未开始', 已发生事件: {}, ...next.场景 };
  const p = next.玩家;
  p.伐刀能力 = { 能力系别: p.能力系别 ?? '', 能力本质: p.能力机制 ?? '', 共通限制: p.限制与代价 ?? '', 招式: {} };
  if (p.伐刀绝技?.trim()) p.伐刀能力.招式[p.伐刀绝技.trim()] = { 说明: '', 条件与代价: '', 掌握状态: '待确认' };
  p.其他能力 = {};
  for (const field of ['伐刀绝技', '能力系别', '能力机制', '限制与代价']) delete p[field];
  next.人际 ??= {};
  for (const relation of Object.values(next.人际)) {
    const old = relation.羁绊阶段;
    if (!['未定', '未建立', 'C', 'B', 'A', 'S'].includes(old)) {
      relation.羁绊阶段 = '未定';
      relation.变化依据 = `旧存档阶段：${old ?? '未记录'}。尚未确认 C/B/A/S 对应，保留原描述待核对。`;
    } else relation.变化依据 ??= '';
    relation.好感 ??= null;
  }
  return schema.parse(next);
}

// 状态规则与运行时适配分开：本模块不访问宿主、不发送消息、不生成剧情。
const STATE_CHAPTERS = ['待选择', '序章', '第一章', '第二章', '第三章', '第四章', '终章'];
const cloneState = value => structuredClone(value);
function stateKey(value) {
  if (Array.isArray(value)) return '[' + value.map(stateKey).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stateKey(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function applyOpening(before, payload) {
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

function applyTransition(before, request) {
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
function enforceStateOwnership(variables, previous) {
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

function createStateController(adapter) {
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

// 构建时与 schema、纯状态规则一起内联；只在 Tavern Helper 上下文使用。
// 精确接口依据及尚未完成的实机验收见 世界书规则/MVU/v3_使用与迁移.md。
(function installRakudaiController() {
  const W = window;
  function host() {
    if (W.SillyTavern?.getContext) return W;
    try { if (W.parent?.SillyTavern?.getContext) return W.parent; } catch (_) {}
    try { if (W.top?.SillyTavern?.getContext) return W.top; } catch (_) {}
    throw new Error('未连接 SillyTavern，档案仅为草稿。');
  }
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error(`酒馆助手缺少 ${name}，尚未写入。`);
  }
  function runtime() {
    const H = host(), mvu = W.Mvu || H.Mvu;
    if (!mvu || typeof mvu.getMvuData !== 'function' || typeof mvu.replaceMvuData !== 'function') throw new Error('MVU 尚未就绪，请启用变量框架后重试。');
    const version = helper('getTavernHelperVersion')();
    const parts = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!parts || Number(parts[1]) < 4 || (Number(parts[1]) === 4 && (Number(parts[2]) < 8 || (Number(parts[2]) === 8 && Number(parts[3]) < 19)))) throw new Error('本建档器需要酒馆助手 4.8.19 或以上的同步变量接口。');
    const Z = W.z || H.z;
    if (!Z?.preprocess || !Z?.toJSONSchema) throw new Error('未找到酒馆助手提供的 Zod 4，尚未写入。');
    return { H, mvu, Z };
  }
  function sync(value, label) {
    if (value && typeof value.then === 'function') throw new Error(`${label} 在此版本不是同步接口，不能确认分支隔离。`);
    return value;
  }
  function position(messageId) {
    const { H, mvu } = runtime();
    const guard = H.__RK_MVU_GUARD_V3__ || W.__RK_MVU_GUARD_V3__ || (function () {
      try { return W.parent?.__RK_MVU_GUARD_V3__; } catch (_) {}
    })() || (function () {
      try { return W.top?.__RK_MVU_GUARD_V3__; } catch (_) {}
    })();
    if (guard?.version !== '3.1.0') throw new Error('请先导入并启用更新后的“落第骑士·MVU v3 字段与第一卷约束”脚本（修订 3.1.0）。');
    const ctx = H.SillyTavern.getContext();
    const chatId = ctx.chatId;
    if (chatId === null || chatId === undefined || chatId === '' || !Array.isArray(ctx.chat) || !ctx.chat.length) throw new Error('当前没有可建档的聊天。');
    const readMessages = helper('getChatMessages');
    const assistants = sync(readMessages(`0-${ctx.chat.length - 1}`, { role: 'assistant', include_swipes: true }), '读取楼层');
    const latest = assistants.at(-1);
    if (!latest) throw new Error('当前聊天没有助手楼层。');
    const id = messageId === undefined ? latest.message_id : messageId;
    if (!Number.isInteger(id) || id !== latest.message_id) throw new Error('该开局页已是历史楼层；请在当前分支最新助手楼层操作，不能覆盖旧状态。');
    const message = latest;
    if (!Number.isInteger(message.swipe_id)) throw new Error('未能识别当前 swipe，尚未写入。');
    const options = { type: 'message', message_id: id };
    const data = sync(mvu.getMvuData(options), '读取 MVU');
    if (!data?.stat_data) throw new Error('当前楼层没有 MVU 初始化数据，请先检查初始化通知。');
    return { H, mvu, ctx, chatId, messageId: id, messageRef: ctx.chat[id], swipeId: message.swipe_id,
      messageText: message.swipes?.[message.swipe_id], length: ctx.chat.length, data: cloneState(data), options };
  }
  function current(saved) {
    const now = position(saved.messageId);
    if (now.chatId !== saved.chatId || now.ctx.characterId !== saved.ctx.characterId || now.ctx.groupId !== saved.ctx.groupId ||
      now.ctx.chat !== saved.ctx.chat || now.messageRef !== saved.messageRef || now.length !== saved.length ||
      now.swipeId !== saved.swipeId || now.messageText !== saved.messageText) throw new Error('聊天、楼层或 swipe 已变化，请重新读取；草稿已保留。');
    return now;
  }
  const api = createStateController({
    capture: ({ messageId } = {}) => position(messageId),
    current,
    validate: value => createSchema(runtime().Z).parse(value),
    write: (saved, expected, state) => {
      const now = current(saved);
      if (stateKey(now.data) !== stateKey(expected)) throw new Error('变量在提交前发生变化，请刷新。');
      // 使用宿主同步 updater：校验与赋值之间不 await，不退回 chat/global scope。
      const result = helper('updateVariablesWith')(variables => {
        current(saved);
        if (stateKey(variables) !== stateKey(expected)) throw new Error('变量已经更新，未覆盖。');
        const next = cloneState(variables);
        next.stat_data = cloneState(state);
        return next;
      }, now.options);
      sync(result, '更新变量');
      return undefined;
    },
  });
  W.RakudaiStateController = api;
})();

})();
